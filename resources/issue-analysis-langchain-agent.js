const issueAnalysisLangchainAgent = async () => {
		const { createAgent, modelFallbackMiddleware, toolRetryMiddleware } = require("langchain");
    const { ChatPromptTemplate } = require("@langchain/core/prompts");
		
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
			[ISSUES]
			{issuesJson}

			[RELEASE]
			{releaseJson}

			Please analyze the issues and release above. Output the JSON result.
    `.trim();
		const userPromptTemplate = ChatPromptTemplate.fromMessages([
			["user", userPrompt]
		]);

    const systemPrompt = `
			You are a 10-year experienced developer with extensive open-source contribution experience.

			You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
			"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

			Follow this JSON Schema:
			${JSON.stringify(wrappedSchema, null, 2)}

			First, summarize the key changes from the latest release (1-3 lines, in ${translationLanguage}).

			Next, analyze each issue and classify their contribution opportunity level based on:

			[Criteria for good contribution opportunities]
			1. Issues with detailed and well-written content
			2. Issues where bug/error logs and reproduction steps are clearly specified
			3. Issues where the location of suspicious source code has been identified
			4. Issues where the maintainer has confirmed the problem or requested contributions
			5. Issues directly created by the maintainer
			6. Issues with "good first issue" label (no "blocked" or "wait-for-triage" labels)
			7. Issues without an existing PR

			For each issue, provide:
			- level: "high" | "medium" | "low"
			- reasons: array of 2-4 reasons explaining the level

			Finally, select the top 3-5 most suitable issues and output as JSON.

			Rules:
			- Translate all user-facing strings into ${translationLanguage}
			- Keep keys in English
			- Do not include markdown code blocks in the output
    `.trim();

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
		const userMessages = await userPromptTemplate.invoke({ 
			issuesJson: JSON.stringify(issues, null, 2),
			releaseJson: JSON.stringify(release)
		});
		const result = await agent.invoke({ 
			messages: userMessages.messages, 
		});
		const aiMessage = result.messages.findLast(m => m.type === "ai")?.content; 

		const parsedMessage = await outputParser.parse(aiMessage)
		parsedMessage.output.latestRelease.url = release.url
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
