const issueAnalysisLangchainAgent = async () => {
	const { createAgent, createMiddleware, modelRetryMiddleware, providerStrategy } = require("langchain");
	const { traceable } = require("langsmith/traceable");
	 
	const outputParser = await this.getInputConnectionData('ai_outputParser', 0);
	const languageModel = await this.getInputConnectionData('ai_languageModel', 0);

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

	const getLanguageDisplayName = (code) => {
		try {
			return new Intl.DisplayNames([code], { type: 'language' }).of(code);
		} catch {
			return '';
		}
	};

	const userPrompt = `
			[ROLE]
			You are a 10-year experienced developer with extensive open-source contribution experience.

			[OUTPUT RULES]
			You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
			"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
			Do not include markdown code blocks in the output.
			Keep keys in English.
			Translate all user-facing strings into ___TRANSLATION_LANGUAGE___.

		[TRANSLATE EXAMPLE]
		___TRANSLATION_LANGUAGE___ -> ${getLanguageDisplayName("___TRANSLATION_LANGUAGE___")}

			[JSON SCHEMA]
			${JSON.stringify(wrappedSchema, null, 2)}

			[TASK]
		1) First, summarize the key changes from the latest release (1-3 lines, in ___TRANSLATION_LANGUAGE___).
		2) For each issue, analyze and summarize the issueDescription in 1-2 concise lines (in ___TRANSLATION_LANGUAGE___), capturing the core problem or feature request - do NOT copy the original description verbatim.
			3) Classify each issue's contribution opportunity level based on the criteria below.
			4) For each issue, provide level and reasons (2-4 reasons).
			5) Finally, select the top 3-5 most suitable issues and output as JSON.

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

	class TimeoutError extends Error {
		constructor(message = 'Operation timed out') {
			super(message);
			this.name = 'TimeoutError';
		}
	}

	const timeoutMiddleware = (timeout = 90 * 1000) => {
		const middlewareName = "timeoutMiddleware";
		return createMiddleware({
			name: middlewareName,
			wrapModelCall: async (request, handler) => {
				let timeoutObj;
				try {
					return await Promise.race([
						handler(request),
						new Promise((_, reject) => {
							timeoutObj = setTimeout(() => reject(new TimeoutError()), timeout);
						})
					]);
				} finally {
					clearTimeout(timeoutObj);
				}
			},
		});
	};

	const validateResponseMiddleware = createMiddleware({
		name: "validateResponseMiddleware",
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
			timeoutMiddleware(120 * 1000),
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
				name: "Issue Analysis",
				...config
			},
	)();
	const aiMessage = result.messages.findLast(m => m.type === "ai")?.content; 

	const parsedMessage = await outputParser.parse(aiMessage)
	parsedMessage.output.latestRelease = {
		...parsedMessage.output.latestRelease,
		url: release.url,
		name: release.name,
	};
	return [parsedMessage.output];
}

module.exports = {
	"code": {
		"execute" : {
			"code" : issueAnalysisLangchainAgent
			.toString()
			.replace(/___TRANSLATION_LANGUAGE___/g, process.env.TRANSLATION_LANGUAGE)
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
