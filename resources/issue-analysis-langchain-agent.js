const issueAnalysisLangchainAgent = async () => {
	const { createAgent, initChatModel, modelRetryMiddleware, createMiddleware } = require("langchain");

	const workflowStaticData = $getWorkflowStaticData('global');
	const { mainModel, otherModels } = workflowStaticData.ModelSelector.allModels;

	const outputParser = await this.getInputConnectionData('ai_outputParser', 0);

	const repositoryInfo = $('Get Issue From Github').item.json.data.repository;
	const issues = repositoryInfo.issues.nodes;
	const release =	repositoryInfo.releases.nodes[0];

	const IssueAnalysisSchema = $('Issue Analysis Schema').item.json;
	const wrappedSchema = {
		type: "object",
		properties: {
			output: IssueAnalysisSchema 
		},
		required: ["output"]
	};

	const userPrompt = `
			[ROLE]
			You are a 10-year experienced developer with extensive open-source contribution experience.

			[OUTPUT RULES]
			You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
			"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
			Do not include markdown code blocks in the output.
			Keep keys in English.
			Translate all user-facing strings into ${translationLanguage}.

			[JSON SCHEMA]
			${JSON.stringify(wrappedSchema, null, 2)}

			[TASK]
			1) First, summarize the key changes from the latest release (1-3 lines, in ${translationLanguage}).
			2) Next, analyze each issue and classify their contribution opportunity level based on the criteria below.
			3) For each issue, provide level and reasons (2-4 reasons).
			4) Finally, select the top 3-5 most suitable issues and output as JSON.

			[CRITERIA FOR GOOD CONTRIBUTION OPPORTUNITIES]
			1. Issues with detailed and well-written content
			2. Issues where bug/error logs and reproduction steps are clearly specified
			3. Issues where the location of suspicious source code has been identified
			4. Issues where the maintainer has confirmed the problem or requested contributions
			5. Issues directly created by the maintainer
			6. Issues with "good first issue" label (no "blocked" or "wait-for-triage" labels)
			7. Issues without an existing PR

			[OUTPUT FORMAT]
			- level: "high" | "medium" | "low"
			- reasons: array of 2-4 reasons explaining the level
			- Output JSON only, no extra text

			[INPUT]
			[ISSUES]
			${JSON.stringify(issues, null, 2)}

			[RELEASE]
			${JSON.stringify(release)}
		`.trim();

	function customFallbackMiddleware(...fallbackModels) {
		return createMiddleware({
			name: "customFallbackMiddleware",
			wrapModelCall: async (request, handler) => {
				try {
					const response = await handler(request);
					if (!response.content?.trim()) {
						throw new Error("The AI model's response content is empty or contains only whitespace.")
					}
					return response;
				} catch (error) {
					for (let i = 0; i < Math.min(3, fallbackModels.length); i++) {
						try {
							const fallbackModel = fallbackModels[i];
							const model =
								typeof fallbackModel === "string"
								? await initChatModel(fallbackModel)
								: fallbackModel;

							const response = await handler({
								...request,
								model,
							});
							if (response.content?.trim()) {
								return response;
							}
						} catch (fallbackError) {
							if (i === fallbackModels.length - 1) {
								throw fallbackError;
							}
						}
					}
					throw error;
				}
			}});
	}
	const agent = createAgent({
		model: mainModel,
		middleware: [
			modelRetryMiddleware({              
				maxRetries: 1,
				backoffFactor: 2.0,
				initialDelayMs: 20000,
				jitter: true,
				onFailure: "error",
			}),
			customFallbackMiddleware(...otherModels),
		]
	});

	const result = await agent.invoke({ 
		messages: [{ role: "user", content: userPrompt }],
	});
	const aiMessage = result.messages.findLast(m => m.type === "ai")?.content; 

	const parsedMessage = await outputParser.parse(aiMessage)
	parsedMessage.output.latestRelease.url = release.url
	parsedMessage.output.latestRelease.name = release.name
	return [parsedMessage.output];
}

module.exports = {
	"code": {
		"execute" : {
			"code" : issueAnalysisLangchainAgent
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
