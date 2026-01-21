const titleGeneratorLangchainAgent = async () => {
		const { createAgent, modelFallbackMiddleware, toolRetryMiddleware } = require("langchain");
    const { ChatPromptTemplate } = require("@langchain/core/prompts");
		
		const workflowStaticData = $getWorkflowStaticData('global');
  	const { mainModel, otherModels } = workflowStaticData.ModelSelector.allModels;

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
        Please create a newsletter title for the issue below.

        ### Issue
        Title: {issueTitle}
        Body: {issueDescription}
				Summary: {summary}
				Analogy: {analogy}

        Output:
    `;
		const userPromptTemplate = ChatPromptTemplate.fromMessages([
			["user", userPrompt]
		]);

    const systemPrompt = `
        You are an AI assistant who creates newsletter titles based on GitHub issues.

				You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
				"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

				Follow this JSON Schema:
				${JSON.stringify(wrappedSchema, null, 2)}

        Rules:
        - Do not include markdown code blocks in the output.
        - Translate all user-facing string values into ${translationLanguage}. Keep the keys in English.

        Instructions:
        1. Read the provided GitHub issue.
        2. Generate a short, catchy newsletter title.
        3. The title should meet these criteria:
            - Include a relevant emoji at the beginning.
            - Be easy for a non-technical audience to understand.
            - Be fun and intriguing to maximize open rates.
        4. Translate the final title into ${translationLanguage}.
    `;
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
	const userMessages = await userPromptTemplate.invoke({...issue});
	const result = await agent.invoke({ 
		messages: userMessages.messages, 
	});
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
