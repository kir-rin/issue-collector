const prAnalysisSchema = () => {
	const prAnalysisOutputSchema = {
		title: "pr_analysis_output",
		description: "Analysis result of a PR contribution from a new open-source contributor",
		type: "object",
		properties: {
			translationLanguageCode: {
				type: "string",
				description: "Language code"
			},
			analogy: {
				type: "array",
				items: { type: "string" },
				minItems: 1,
				maxItems: 1,
				description: "An analogy to help newcomers understand the PR's purpose"
			},
			summary: {
				type: "array",
				items: { type: "string" },
				minItems: 1,
				maxItems: 1,
				description: "1 concise line summarizing what the PR solves and how"
			},
			linkedIssue: {
				type: "object",
				properties: {
					analogy: {
						type: "array",
						items: { type: "string" },
						minItems: 1,
						maxItems: 1,
						description: "An analogy to help newcomers understand the issue's context"
					},
					summary: {
						type: "array",
						items: { type: "string" },
						minItems: 1,
						maxItems: 1,
						description: "1 concise line summarizing the issue"
					},
					whyGoodForContribution: {
						type: "array",
						items: { type: "string" },
						minItems: 1,
						maxItems: 1,
						description: "1 reason why this issue was good for contribution"
					}
				},
				required: ["analogy", "summary", "whyGoodForContribution"],
				description: "First linked issue and its analysis"
			},
			review: {
				type: "object",
				properties: {
					url: {
						type: "string",
						pattern: "^https://github\\.com/[^/]+/[^/]+/pull/\\d+#.+$",
						description: "URL of the review for verification"
					},
					summary: {
						type: "array",
						items: { type: "string" },
						minItems: 1,
						maxItems: 1,
						description: "1 key point from reviews and discussions"
					},
					insights: {
						type: "array",
						items: { type: "string" },
						minItems: 1,
						maxItems: 1,
						description: "1 insight for future contributors extracted from review comments"
					}
				},
				required: ["url", "summary", "insights"],
				description: "Review analysis with summary and insights"
			}
		},
		required: ["translationLanguageCode", "analogy", "summary", "linkedIssue", "review"]
	};
	return prAnalysisOutputSchema;
};

module.exports = {
	"jsCode": prAnalysisSchema.toString()
};
