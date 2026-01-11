const { getFunctionBodyRegex } = require('../resources/utils');

const deepwikiLangchainAgent = async () => {
	const { ChatPromptTemplate } = require("@langchain/core/prompts");
	const { StateGraph, START, END, Annotation, MessagesAnnotation, Send } = require("@langchain/langgraph");
	const { MultiServerMCPClient } = require("@langchain/mcp-adapters");
	const { AIMessage } = require("@langchain/core/messages");
	const { ToolNode } = require("@langchain/langgraph/prebuilt");

	const llmModel = await this.getInputConnectionData('ai_languageModel', 0);
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
	const issues = this.getInputData().map(input => input.json);
	
	const TechnicalDifficultySchema = {
		type: "object",
		properties: {
			level: {
				type: "string",
				enum: ["High", "Medium", "Low"],
				description: "High | Medium | Low"
			},
			reasons: {
				type: "array",
				items: { type: "string" },
				description: "Reasons for the difficulty level"
			}
		},
		required: ["level", "reasons"]
	};

	const IssueResponseSchema = {
		type: "object",
		properties: {
			translationLanguageCode: {
				type: "string",
				enum: ["en", "ko", "ja", "zh", "es", "fr", "de", "ru", "ar", "pt"],
				description: "Language code like 'ko'"
			},
			deepwikiLink: {
				type: "string",
				pattern: "^https://deepwiki\\.com/.*",
				errorMessage: "Must start with https://deepwiki.com/"
			},
			rootCause: {
				type: "string",
				description: "Root cause of the issue"
			},
			resolutionApproach: {
				type: "array",
				items: { type: "string" },
				description: "List of resolution approaches"
			},
			technicalDifficulty: {
				...TechnicalDifficultySchema,
				description: "Technical difficulty assessment"
			},
			summary: {
				type: "string",
				description: "One-sentence contribution summary"
			},
			keyword: {
				type: "array",
				items: { type: "string" },
				description: "1-5 relevant keywords"
			},
			analogy: {
				type: "string",
				description: "Simple analogy for issue and resolution"
			}
		},
		required: ["translationLanguageCode", "deepwikiLink", "rootCause", "resolutionApproach", "technicalDifficulty", "summary", "keyword", "analogy"]
	};

	const userPrompt = `                              
	 I have received a DeepWiki analysis for a GitHub issue:
	 ### DeepWiki Analysis     
	 {deepwikiResponse}
														
	 Please process this DeepWiki analysis and extract structured information.        
	`;

	const systemPrompt = `                              
	 You are an AI assistant that processes DeepWiki GitHub issue analysis and extracts structured information.                                        
																									
	 Your task:                                          
	 1. Analyze the provided DeepWiki response           
	 2. Extract the following information:               
			- Root cause of the issue                        
			- Resolution approaches (as array of strings)    
			- Technical difficulty level (High/Medium/Low) with reasons                                 
			- Brief summary of the contribution              
			- Relevant keywords (1-5 keywords)               
			- Simple analogy explaining the issue and resolution
			
	 Output requirements:                                
	 - All content should be in ${process.env.TRANSLATION_LANGUAGE}                         
	 - Use the structured output schema that will be applied automatically
	 - Focus on clarity and accuracy in extracted information
	 `;
	const promptTemplate = ChatPromptTemplate.fromMessages([
		["system", systemPrompt],
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

	async function reasonNode({ deepwikiResponse, issueURL }) {
		const structuredModel = llmModel.withStructuredOutput(IssueResponseSchema);
		const reasonChain = promptTemplate.pipe(structuredModel);
		const reasonResult = await reasonChain.invoke({ 
			deepwikiResponse: deepwikiResponse,
		});
		reasonResult.issueURL = issueURL
		const reasonMessage = new AIMessage({
			content: JSON.stringify(reasonResult, null, 2)
		});
		return { finalAnswers: [reasonMessage] };
	}
	
	const MessagesState = Annotation.Root({
		...MessagesAnnotation.spec,
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

	const result = await workflow.invoke({ messages: [] });
	const aiMessages = result.finalAnswers;
	return aiMessages.map(input => JSON.parse(input.content));
}

module.exports = {
	"code": {
		"execute" : {
			"code" : getFunctionBodyRegex(deepwikiLangchainAgent)
		}
	},
	"inputs": {
		"input": [
			{
				"type": "ai_languageModel",
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
