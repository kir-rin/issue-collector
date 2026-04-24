const prAnalysisLangchainAgent = async () => {
	const { createAgent, createMiddleware, modelRetryMiddleware, providerStrategy } = require("langchain");
	const { traceable } = require("langsmith/traceable");
	const { encodingForModel } = require("js-tiktoken");

	const outputParser = await this.getInputConnectionData('ai_outputParser', 0);
	const languageModel = await this.getInputConnectionData('ai_languageModel', 0);

	const prData = $('Fetch Top PR Details').item.json.data.repository.pullRequest;
	const PrAnalysisSchema = $('PR Analysis Schema').item.json;
	const wrappedSchema = {
		type: "object",
		properties: {
			output: PrAnalysisSchema
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
		You are an AI assistant that analyzes PR contributions from new open-source contributors. 
		Your goal is to help other newcomers understand what makes a good contribution.

		[OUTPUT RULES]
		Keep keys in English.
		Translate all user-facing strings into ___TRANSLATION_LANGUAGE___.

		[TRANSLATE EXAMPLE]
		___TRANSLATION_LANGUAGE___ -> ${getLanguageDisplayName("___TRANSLATION_LANGUAGE___")}

		[TASK]
		1) Create 1 analogy to help newcomers understand the PR's purpose.
		2) Summarize the PR in 1 concise line - what problem it solves and how.
		3) Classify the contribution type based on the changes made.
		4) For the first linked issue, create 1 analogy and summarize it in 1 line, then explain why it was good for contribution.
		5) Summarize key review feedback in 1 key point.
		6) Extract 1 insight for future contributors from review comments.

		[CONTRIBUTION TYPE CLASSIFICATION]
		- "bug fix": Fixes a bug or error
		- "feature": Adds new functionality
		- "docs": Documentation changes only
		- "refactor": Code restructuring without behavior change
		- "test": Adding or modifying tests
		- "chore": Maintenance tasks, dependency updates, etc.

		[WHY GOOD FOR CONTRIBUTION CRITERIA]
		1. Clear and well-defined issue scope
		2. Good first issue label or beginner-friendly tags
		3. Clear reproduction steps or requirements
		4. Available mentorship or guidance in comments
		5. Limited codebase knowledge required

		[INSIGHTS FOR FUTURE CONTRIBUTORS]
		Extract from review comments:
		- Code style and formatting requirements
		- Testing requirements
		- PR description format
		- Common mistakes to avoid
		- Best practices mentioned by reviewers

		[OUTPUT FORMAT]
		- analogy: 1 analogy to help understand the PR
		- summary: 1 concise line
		- contributionType: one of the 6 types
		- linkedIssue.analogy: 1 analogy to help understand the issue
		- linkedIssue.summary: 1 concise line summarizing the issue
		- linkedIssue.whyGoodForContribution: 1 reason
		- review.summary: 1 key point from reviews
		- review.insights: 1 insight for future contributors

		[INPUT]
		[PR DATA]
		${JSON.stringify(prData, null, 2)}
	`.trim();

	const encoder = encodingForModel("gpt-4");
	const inputTokenCount = encoder.encode(userPrompt).length;

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
		name: "validateResponsePrAnalysisMiddleware",
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
				initialDelayMs: 5 * 1000,
				jitter: true,
				onFailure: "error",
			}),
			jitterMiddleware,
			timeoutMiddleware(3 * 60 * 1000),
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
			name: "PR Analysis",
			...config,
			metadata: {
				...config.metadata,
				inputTokenCount,
				prNumber: prData.number,
			},
		},
	)();

	const aiMessage = result.messages.findLast(m => m.type === "ai")?.content;
	const parsedMessage = await outputParser.parse(aiMessage);
	const firstIssue = prData.closingIssuesReferences?.nodes?.[0];

	return [{
		...parsedMessage.output,
		title: prData.title,
		url: prData.url,
		linkedIssue: parsedMessage.output.linkedIssue ? {
			...parsedMessage.output.linkedIssue,
			title: firstIssue?.title,
			url: firstIssue?.url
		} : null
	}];
};

module.exports = {
	"code": {
		"execute": {
			"code": prAnalysisLangchainAgent
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
