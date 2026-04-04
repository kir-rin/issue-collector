const deepwikiLangchainAgent = async () => {
	const { createAgent, createMiddleware, modelRetryMiddleware, providerStrategy } = require("langchain");
	const { traceable } = require("langsmith/traceable");
	const { StateGraph, START, END, Annotation, Send } = require("@langchain/langgraph");
	const { webkit } = require("playwright");

	const languageModel = await this.getInputConnectionData('ai_languageModel', 0);

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

	const getLanguageDisplayName = (code) => {
		try {
			return new Intl.DisplayNames([code], { type: 'language' }).of(code);
		} catch {
			return '';
		}
	};

	const buildUserPrompt = (deepwikiResponse) => `
		[ROLE]
		You are an AI assistant that processes DeepWiki GitHub issue analysis.
		
		[OUTPUT RULES]
		You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
		"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
		Do not include markdown code blocks in the output.
		Output ONLY the JSON object. No additional text.

		[TRANSLATE EXAMPLE]
		___TRANSLATION_LANGUAGE___ -> ${getLanguageDisplayName("___TRANSLATION_LANGUAGE___")}

		[JSON SCHEMA]
		${JSON.stringify(wrappedSchema, null, 2)}

		[TASK]
		Extract and return ONLY a JSON object following the exact schema.
		Preserve the full length and content of the original text rather than summarizing.

		[REQUIREMENTS]
		- All content must be in "___TRANSLATION_LANGUAGE___"
		- translationLanguageCode should be "___TRANSLATION_LANGUAGE___"
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
		const url = `https://deepwiki.com/${repoName}`;
		const textareaSelector = 'textarea[data-deepwiki-input="question"]';

		const question = `Here is a GitHub issue.
Title: ${issue.issueTitle}
Body: ${issue.issueDescription}
How can this issue be resolved, what is its root cause, what is the recommended resolution approach, what is the technical difficulty, and what is a simple analogy for the issue and its resolution approach? Please provide the answer in ___TRANSLATION_LANGUAGE___.`;

		let browser;
		let answerText = "";
		let finalUrl = "";

		try {
			browser = await webkit.launch({ headless: true });
			const context = await browser.newContext();
			const page = await context.newPage();

			// 1) DeepWiki 페이지로 이동
			await page.goto(url, { waitUntil: "networkidle" });

			// 2) 질문 입력 textarea가 나타날 때까지 대기
			await page.waitForSelector(textareaSelector, { timeout: 15000 });

			// 3) 질문 입력 후 Enter
			await page.fill(textareaSelector, question);
			await page.keyboard.press("Enter");

			// 4) URL이 검색 결과(/search/...)로 바뀔 때까지 대기
			const initialUrl = url;
			try {
				await page.waitForURL(/\/search\//, { timeout: 30000 });
			} catch {
				// /search/ 로 안 바뀌는 경우에도 최소한 URL 변화는 한 번 더 기다려 본다.
				await page.waitForURL(
					(current) => current.href !== initialUrl,
					{ timeout: 5000 },
				).catch(() => {});
			}

			finalUrl = page.url();

			// 5) Devin 답변 본문 컨테이너에서 텍스트 추출
			try {
				const answerLocator = page
					.locator("div.prose-custom.prose-custom-md.prose-custom-gray")
					.first();

				await answerLocator.waitFor({ state: "visible", timeout: 60000 });
				answerText = (await answerLocator.innerText()).trim();
			} catch {
				answerText = "";
			}
		} catch (error) {
			console.error("deepwikiToolNode failed", {
				message: error.message,
				name: error.name,
				stack: error.stack,
				raw: (() => {
					try { return JSON.stringify(error); } catch { return String(error); }
				})(),
			});
			answerText = "";
		} finally {
			if (browser) {
				try {
					await browser.close();
				} catch {}
			}
		}

		const deepwikiResponse = [
			`DeepWiki URL: ${finalUrl || url}`,
			"",
			answerText || "",
		].join("\n");

		return { deepwikiResponses: [{
			deepwikiResponse,
			issueURL: issue.issueURL,
		}] };
	}

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
	const outputParser = await this.getInputConnectionData('ai_outputParser', 0);

	async function reasonNode({ deepwikiResponse, issueURL }) {
		const userPrompt = buildUserPrompt(deepwikiResponse);
		const reasonResult = await agent.invoke({ messages: [{ role: "user", content: userPrompt }] });
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

	const config = $('Get Workflow Run Id').first().json;
	const result = await traceable(
		async () => {
			return await workflow.invoke({});
		},
		{ 
			name: "DeepWiki Analysis",
			...config
		},
	)();
	return result.finalAnswers;
}

module.exports = {
	"code": {
		"execute" : {
			"code" : deepwikiLangchainAgent
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
