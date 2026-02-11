const deepwikiLangchainAgent = async () => {
	const { createAgent, createMiddleware, modelRetryMiddleware } = require("langchain");
	const { AIMessage } = require("@langchain/core/messages");
	const { StateGraph, START, END, Annotation, Send } = require("@langchain/langgraph");
	const { ToolNode } = require("@langchain/langgraph/prebuilt");
	const { MultiServerMCPClient } = require("@langchain/mcp-adapters");

	const languageModel = await this.getInputConnectionData('ai_languageModel', 0);

	const mcpClient = new MultiServerMCPClient({  
		deepwiki: {
			transport: "http",
			url: "https://mcp.deepwiki.com/mcp",
		},
	});
	const tools = await mcpClient.getTools()
	const askQuestionTool = tools.filter(t => t.name === "ask_question")[0];

	const { owner, name } = $('Load Repo Info').item.json;
	const repoName = `${owner}/${name}`;
	const issues = $('get Top Fit Issues').item.json.issues;

	const DeepwikiResponseSchema = $('Deepwiki Response Schema').item.json;
	const wrappedSchema = {
		type: "object",
		properties: {
			output: DeepwikiResponseSchema
		},
		required: ["output"]
	};

	const buildUserPrompt = (deepwikiResponse) => `
		[ROLE]
		You are an AI assistant that processes DeepWiki GitHub issue analysis.
		
		[OUTPUT RULES]
		You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
		"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
		Do not include markdown code blocks in the output.
		Output ONLY the JSON object. No additional text.

		[JSON SCHEMA]
		${JSON.stringify(wrappedSchema, null, 2)}

		[TASK]
		Extract and return ONLY a JSON object following the exact schema.
		Preserve the full length and content of the original text rather than summarizing.

		[REQUIREMENTS]
		- All content must be in "${translationLanguage}"
		- translationLanguageCode should be "${translationLanguage}"
		- deepwikiLink must start with https://deepwiki.com/
		- technicalDifficulty.level must be one of: High, Medium, Low
		- keyword should contain 1-5 relevant keywords

		[EXAMPLE OUTPUT]
		{
			"output": {
				"translationLanguageCode": "en",
				"deepwikiLink": "https://deepwiki.com/search/here-is-a-github-issue-title-s_d2cf1a6c-1109-479c-986c-40cc2fa1f1c1",
				"rootCause": "Memory leak occurs during component rendering due to missing cleanup",
				"resolutionApproach": [
					"Add useEffect cleanup function",
					"Implement event listener removal logic"
				],
				"technicalDifficulty": {
					"level": "Medium",
					"reasons": [
						"Requires understanding of React lifecycle",
						"Need memory profiling experience"
					]
				},
				"summary": "Resolve React component memory leak by implementing proper cleanup function",
				"keyword": ["React", "memory leak", "useEffect", "cleanup"],
				"analogy": "Like leaving a faucet running - without cleanup, memory keeps leaking continuously"
			}
		}

		[OUTPUT FORMAT]
		- Return JSON only
		- No extra text

		[INPUT]
		DeepWiki Analysis:
		${deepwikiResponse}
	`;

	async function deepwikiToolNode({ issue }) {
		const toolCall = {
			name: "ask_question",
			args: {
				repoName: repoName,
				question: `Here is a GitHub issue.
					 Title: ${issue.issueTitle}
					 Body: ${issue.issueDescription}
					 How can this issue be resolved, what is its root cause, what is the recommended resolution approach, what is the technical difficulty, and what is a simple analogy for the issue and its resolution approach? Please provide the answer in ko-KR.`
			},
			id: `call_${Date.now()}`,
			type: "tool"
		};
		const aiMessage = new AIMessage({
			content: "",
			tool_calls: [toolCall]
		});
		const result = await new ToolNode([askQuestionTool]).invoke({
			messages: [aiMessage]
		});
		return { deepwikiResponses: [{ 
			deepwikiResponse: result.messages.at(-1)?.content,
			issueURL: issue.issueURL	
		}]};
	}

	const validateResponseMiddleware = createMiddleware({
		name: "validateResponseDeepwikiMiddleware",
		afterModel: {
			canJumpTo: ["model"],
			hook: (state) => {
				const lastMessage = state.messages[state.messages.length - 1];
				if (!lastMessage.content?.trim()) {
					return { jumpTo: "model" }
				}
				return;
			}
		}
	});

	const agent = createAgent({
		model: languageModel,
		middleware: [
			validateResponseMiddleware,
			modelRetryMiddleware({              
				maxRetries: 2,
				backoffFactor: 2.0,
				initialDelayMs: 20000,
				jitter: true,
				onFailure: "error",
			}),
		]
	});
	const outputParser = await this.getInputConnectionData('ai_outputParser', 0);
	async function reasonNode({ deepwikiResponse, issueURL }) {
		const userPrompt = buildUserPrompt(deepwikiResponse);
		const reasonResult = await agent.invoke({ 
			messages: [{ role: "user", content: userPrompt }],
		});
		const aiMessage = reasonResult.messages.findLast(m => m.type === "ai")?.content; 
		const parsedMessage = await outputParser.parse(aiMessage);	
		parsedMessage.output.issueURL = issueURL
		return { finalAnswers: [parsedMessage.output] };
	}

	const MessagesState = Annotation.Root({
		deepwikiResponses: Annotation({
			reducer: (current, update) => current.concat(update),
			default: () => [],
		}),
		finalAnswers: Annotation({
			reducer: (current, update) => current.concat(update),
			default: () => [],
		}),
	});
	const workflow = new StateGraph(MessagesState)
		.addNode("deepwikiTool", deepwikiToolNode)
		.addNode("reason", reasonNode)
		.addConditionalEdges(START, (_state) => {
			return issues.map((issue) => new Send("deepwikiTool", { issue }));
		})
		.addConditionalEdges("deepwikiTool", ({ deepwikiResponses }) => {
			return deepwikiResponses.map(({ deepwikiResponse, issueURL }) => new Send("reason", { deepwikiResponse, issueURL }));
		})
		.addEdge("reason", END)
		.compile();

	const result = await workflow.invoke({});
	return result.finalAnswers;
}

module.exports = {
	"code": {
		"execute" : {
			"code" : deepwikiLangchainAgent
				.toString()
				.replace(/{translationLanguage}/g, process.env.TRANSLATION_LANGUAGE)
		}
	},
	"inputs": {
		"input": [
			{
				"type": "ai_outputParser",
				"maxConnections": 1,
				"required": true
			},
			{
				"type": "main",
				"maxConnections": 1,
				"required": true
			},
            {
              "type": "ai_languageModel",
              "maxConnections": 1,
              "required": true
            }
		]
	},
	"outputs": {
		"output": [
			{
				"type": "main"
			}
		]
	}
};
