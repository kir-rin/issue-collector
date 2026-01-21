const deepwikiLangchainAgent = async () => {
	const { createAgent, modelFallbackMiddleware, toolRetryMiddleware } = require("langchain");
	const { ChatPromptTemplate } = require("@langchain/core/prompts");
	const { AIMessage } = require("@langchain/core/messages");
	const { StateGraph, START, END, Annotation, Send } = require("@langchain/langgraph");
	const { ToolNode } = require("@langchain/langgraph/prebuilt");
	const { MultiServerMCPClient } = require("@langchain/mcp-adapters");

	const workflowStaticData = $getWorkflowStaticData('global');
  const { mainModel, otherModels } = workflowStaticData.ModelSelector.allModels;

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

	const userPrompt = `
		DeepWiki Analysis:
		{deepwikiResponse}

		Extract and return ONLY a JSON object following the exact schema. No markdown, no code blocks, just raw JSON.
		Preserve the full length and content of the original text rather than summarizing
	`;

	const systemPrompt = `
		You are an AI assistant that processes DeepWiki GitHub issue analysis.
		
		You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
		"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

		Follow this JSON Schema:
		${JSON.stringify(wrappedSchema, null, 2)}

		Requirements:
		- All content must be in "${translationLanguage}"
		- translationLanguageCode should be "${translationLanguage}"
		- deepwikiLink must start with https://deepwiki.com/
		- technicalDifficulty.level must be one of: High, Medium, Low
		- keyword should contain 1-5 relevant keywords

		Example output:
		{
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

		Output ONLY the JSON object. No additional text.
	`;
	const userPromptTemplate = ChatPromptTemplate.fromMessages([
		["user", userPrompt]
	]);

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

	const agent = createAgent({
		model: mainModel,
		middleware: [
			modelFallbackMiddleware(...otherModels),
			toolRetryMiddleware({              
				maxRetries: 3,
				backoffFactor: 2.0
			})
		],
		systemPrompt: systemPrompt,
	});
	const outputParser = await this.getInputConnectionData('ai_outputParser', 0);
	async function reasonNode({ deepwikiResponse, issueURL, retryCount }) {
		const userMessages = await userPromptTemplate.invoke({ 
			deepwikiResponse: deepwikiResponse,
		});
		const reasonResult = await agent.invoke({ 
			messages: userMessages.messages, 
		});
		const aiMessage = reasonResult.messages.findLast(m => m.type === "ai")?.content; 
		if (!aiMessage?.trim()) {
			if (retryCount < 3) return new Send("reason", {
				deepwikiResponse,
				issueURL,
				retryCount: retryCount + 1
			})
			throw new Error(
				`Failed to get structured response from DeepWiki after ${retryCount} retries. ` +
				`Issue URL: ${issueURL}. ` +
				`The model returned an empty structured response.`
			);
		}
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
			return deepwikiResponses.map(({ deepwikiResponse, issueURL }) => new Send("reason", { deepwikiResponse, issueURL, retryCount: 0 }));
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
