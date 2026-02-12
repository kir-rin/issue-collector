const titleGeneratorLangchainAgent = async () => {
	const { createAgent, createMiddleware, modelRetryMiddleware, providerStrategy } = require("langchain");
	const { traceable } = require("langsmith/traceable");

	const languageModel = await this.getInputConnectionData('ai_languageModel', 0);

	const outputParser = await this.getInputConnectionData('ai_outputParser', 0);

	const issue = $('Merge').first().json;

	const NewsletterTitleSchema = $('Title Generator Schema').item.json;
	const wrappedSchema = {
		type: "object",
		properties: {
			output: NewsletterTitleSchema 
		},
		required: ["output"]
	};

	const userPrompt = `
				[ROLE]
				You are an AI assistant who creates newsletter titles based on GitHub issues.

				[OUTPUT RULES]
				You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
				"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
				Do not include markdown code blocks in the output.
				Translate all user-facing string values into ${translationLanguage}. Keep the keys in English.

				[JSON SCHEMA]
				${JSON.stringify(wrappedSchema, null, 2)}

				[TASK]
				1. Read the provided GitHub issue.
				2. Generate a short, catchy newsletter title.
				3. The title should meet these criteria:
						- Include a relevant emoji at the beginning.
						- Be easy for a non-technical audience to understand.
						- Be fun and intriguing to maximize open rates.
				4. Translate the final title into ${translationLanguage}.

				[INPUT]
				Please create a newsletter title for the issue below.

				### Issue
				Title: ${issue.issueTitle}
				Body: ${issue.issueDescription}
				Summary: ${issue.summary}
				Analogy: ${issue.analogy}

				Output:
		`;
	const validateResponseMiddleware = createMiddleware({
		name: "validateResponseTitleMiddleware",
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
		responseFormat: providerStrategy(wrappedSchema),
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
	const config = $('Get Workflow Run Id').first().json;
	const result = await traceable(
		async () => {
			return await agent.invoke({ 
				messages: [{ role: "user", content: userPrompt }],
			});
		},
		{ 
			name: "Title Generation",
			...config
		},
	)();
	const aiMessage = result.messages.findLast(m => m.type === "ai")?.content; 

	const parsedMessage = await outputParser.parse(aiMessage)
	return [parsedMessage.output];
}

module.exports = {
	"code": {
		"execute" : {
			"code" : titleGeneratorLangchainAgent
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
