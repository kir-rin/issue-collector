const issueAnalysisLangchainAgent = async () => {
	const { createAgent, createMiddleware, modelRetryMiddleware, providerStrategy } = require("langchain");
	const { traceable } = require("langsmith/traceable");
	const { encodingForModel } = require("js-tiktoken");
	const { StateGraph, START, END, Annotation, Send } = require("@langchain/langgraph");

	const parsers = await this.getInputConnectionData('ai_outputParser', 0);
	const releaseOutputParser = parsers[0];
	const scoreOutputParser = parsers[1];
	const summaryOutputParser = parsers[2];
	const languageModel = await this.getInputConnectionData('ai_languageModel', 0);

	const repositoryInfo = $('Get Issue From Github').item.json.data.repository;
	const issues = repositoryInfo.issues.nodes;
	const release = repositoryInfo.releases.nodes[0];

	const { owner, name } = $('Load Repo Info').first().json;

	const ReleaseSummarySchema = $('Release Summary Schema').item.json;
	const IssueScoreSchema = $('Issue Score Schema').item.json;
	const IssueSummarySchema = $('Issue Summary Schema').item.json;

	const wrappedReleaseSummarySchema = {
		type: "object",
		properties: {
			output: ReleaseSummarySchema
		},
		required: ["output"]
	};

	const wrappedIssueScoreSchema = {
		type: "object",
		properties: {
			output: IssueScoreSchema
		},
		required: ["output"]
	};

	const wrappedIssueSummarySchema = {
		type: "object",
		properties: {
			output: IssueSummarySchema
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

	const encoder = encodingForModel("gpt-4");

	const countTokens = (text) => {
		return encoder.encode(JSON.stringify(text)).length;
	};

	const truncateToTokens = (text, maxTokens) => {
		const str = typeof text === 'string' ? text : JSON.stringify(text);
		const tokens = encoder.encode(str);
		if (tokens.length <= maxTokens) return str;
		return str.slice(0, Math.floor(str.length * maxTokens / tokens.length));
	};

	const splitIssuesIntoBatches = (issues, maxTokens = 16000) => {
		const batches = [];
		let currentBatch = [];
		let currentTokens = 0;

		for (const issue of issues) {
			const tokens = countTokens(issue);

			if (tokens > maxTokens) {
				if (currentBatch.length) batches.push(currentBatch);
				batches.push([issue]);
				currentBatch = [];
				currentTokens = 0;
				continue;
			}

			if (currentTokens + tokens > maxTokens) {
				batches.push(currentBatch);
				currentBatch = [];
				currentTokens = 0;
			}

			currentBatch.push(issue);
			currentTokens += tokens;
		}

		if (currentBatch.length) batches.push(currentBatch);
		return batches;
	};

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

	const jitterMiddleware = createMiddleware({
		name: "jitterMiddleware",
		wrapModelCall: async (request, handler) => {
			const delay = Math.floor(Math.random() * 100);
			await new Promise(resolve => setTimeout(resolve, delay));
			return handler(request);
		}
	});

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

	const createAgentWithMiddleware = (responseSchema) => {
		const agentConfig = {
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
				jitterMiddleware,
				timeoutMiddleware(6 * 60 * 1000),
			]
		};

		if (responseSchema) {
			agentConfig.responseFormat = providerStrategy(responseSchema);
		}

		return createAgent(agentConfig);
	};

	const IssueAnalysisState = Annotation.Root({
		release: Annotation({ default: () => null }),
		issues: Annotation({ default: () => [] }),
		releaseSummary: Annotation({ default: () => null }),
		currentBatch: Annotation({ default: () => [] }),
		scoredIssues: Annotation({
			reducer: (current, update) => current.concat(update),
			default: () => [],
		}),
		finalOutput: Annotation({ default: () => null }),
	});

	async function summarizeAndTranslateReleaseNode(state) {
		const truncatedRelease = truncateToTokens(state.release, 16000);
		const releaseAgent = createAgentWithMiddleware(wrappedReleaseSummarySchema);

		const prompt = `
			[ROLE]
			You are an AI assistant that summarizes release notes.

			[OUTPUT RULES]
			You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
			Do not include markdown code blocks in the output.
			Output ONLY the JSON object.

			[TRANSLATE EXAMPLE]
			___TRANSLATION_LANGUAGE___ -> ${getLanguageDisplayName("___TRANSLATION_LANGUAGE___")}

			[TASK]
			Analyze the release notes and categorize key changes.
			For each category, provide up to 3 compressed descriptions.
			Maximum 3 categories total.
			Write all descriptions in ___TRANSLATION_LANGUAGE___.

			[INPUT]
			${JSON.stringify(truncatedRelease, null, 2)}
		`.trim();

		const result = await releaseAgent.invoke({
			messages: [{ role: "user", content: prompt }]
		});

		const aiMessage = result.messages.findLast(m => m.type === "ai")?.content;
		const parsed = await releaseOutputParser.parse(aiMessage);

		return {
			releaseSummary: {
				...parsed.output.latestRelease,
				url: state.release.url,
				name: state.release.name
			}
		};
	}

	async function scoreIssuesNode(state) {
		const batch = state.currentBatch;

		const prompt = `
			[ROLE]
			You are a 10-year experienced developer with extensive open-source contribution experience.

			[OUTPUT RULES]
			You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
			Do not include markdown code blocks in the output.
			Keep keys in English.

			[TASK]
			For each issue, assign a score from 1-10 based on contribution opportunity criteria.
			Provide 2-4 reasons for each score.

			[CRITERIA FOR GOOD CONTRIBUTION OPPORTUNITIES]
			1. Issues with detailed and well-written content
			2. Issues where bug/error logs and reproduction steps are clearly specified
			3. Issues where the location of suspicious source code has been identified
			4. Issues with "good first issue" label (no "blocked" or "wait-for-triage" labels)
			5. Issues without an existing PR

			[SCORING GUIDE]
			- 9-10: Excellent opportunity (meets most criteria perfectly)
			- 7-8: Good opportunity (meets several criteria well)
			- 5-6: Moderate opportunity (meets some criteria)
			- 3-4: Limited opportunity (meets few criteria)
			- 1-2: Poor opportunity (meets almost no criteria)

			[INPUT ISSUES]
			${JSON.stringify(batch, null, 2)}
		`.trim();

		const inputTokenCount = countTokens(prompt);

		const batchAgent = createAgentWithMiddleware(wrappedIssueScoreSchema);

		const result = await batchAgent.invoke(
			{ messages: [{ role: "user", content: prompt }] },
			{ metadata: { inputTokenCount, batchSize: batch.length } }
		);

		const aiMessage = result.messages.findLast(m => m.type === "ai")?.content;
		const parsed = await scoreOutputParser.parse(aiMessage);

		return {
			scoredIssues: parsed.output.scoredIssues
		};
	}

	async function summarizeAndTranslateTopIssuesNode(state) {
		const { releaseSummary, scoredIssues, issues } = state;

		const issueMap = new Map(issues.map(i => [i.url, i]));

		const sortedIssues = [...scoredIssues].sort((a, b) => b.score - a.score);
		const topIssues = sortedIssues.slice(0, Math.min(3, sortedIssues.length)).map(scored => ({
			...issueMap.get(scored.url),
			...scored
		}));

		if (topIssues.length === 0) {
			return {
				finalOutput: {
					translationLanguageCode: process.env.TRANSLATION_LANGUAGE,
					latestRelease: releaseSummary,
					issues: []
				}
			};
		}

		const aggregateAgent = createAgentWithMiddleware(wrappedIssueSummarySchema);

		const prompt = `
			[ROLE]
			You are an AI assistant that creates detailed summaries for top issues.

			[OUTPUT RULES]
			You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
			Do not include markdown code blocks in the output.
			Keep keys in English.
			Translate all user-facing strings into ___TRANSLATION_LANGUAGE___.

			[TRANSLATE EXAMPLE]
			___TRANSLATION_LANGUAGE___ -> ${getLanguageDisplayName("___TRANSLATION_LANGUAGE___")}

			[TASK]
			For each top issue:
			1. Write a concise 1-2 line summary in ___TRANSLATION_LANGUAGE___ (as array of strings in description)
			2. Assign a level: "high" (score 8-10), "medium" (score 5-7), or "low" (score 1-4)
			3. Provide 2-4 reasons for the classification

			[TOP ISSUES TO SUMMARIZE]
			${JSON.stringify(topIssues, null, 2)}

			[IMPORTANT]
			- translationLanguageCode must be "___TRANSLATION_LANGUAGE___"
			- url must match the pattern: https://github.com/${owner}/${name}/issues/\\d+
		`.trim();

		const result = await aggregateAgent.invoke({
			messages: [{ role: "user", content: prompt }]
		});

		const aiMessage = result.messages.findLast(m => m.type === "ai")?.content;
		const parsed = await summaryOutputParser.parse(aiMessage);

		return {
			finalOutput: {
				...parsed.output,
				latestRelease: releaseSummary
			}
		};
	}

	const workflow = new StateGraph(IssueAnalysisState)
		.addNode("summarizeAndTranslateRelease", summarizeAndTranslateReleaseNode)
		.addNode("scoreIssues", scoreIssuesNode)
		.addNode("summarizeAndTranslateTopIssues", summarizeAndTranslateTopIssuesNode)
		.addEdge(START, "summarizeAndTranslateRelease")
		.addConditionalEdges("summarizeAndTranslateRelease", (state) => {
			const batches = splitIssuesIntoBatches(state.issues, 10000);
			return batches.map(batch => new Send("scoreIssues", {
				...state,
				currentBatch: batch
			}));
		})
		.addEdge("scoreIssues", "summarizeAndTranslateTopIssues")
		.addEdge("summarizeAndTranslateTopIssues", END)
		.compile();

	const config = $('Get Workflow Run Id').first().json;

	const result = await traceable(
		async () => {
			return await workflow.invoke({
				release,
				issues
			});
		},
		{
			name: "Issue Analysis",
			...config,
			metadata: {
				...config.metadata,
				issueCount: issues.length,
			},
		},
	)();

	return [result.finalOutput];
}

module.exports = {
	"code": {
		"execute": {
			"code": issueAnalysisLangchainAgent
				.toString()
				.replace(/___TRANSLATION_LANGUAGE___/g, process.env.TRANSLATION_LANGUAGE)
		}
	},
	"inputs": {
		"input": [
			{
				"type": "ai_outputParser",
				"maxConnections": 3,
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
}
