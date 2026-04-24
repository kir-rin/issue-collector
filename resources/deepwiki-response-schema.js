const deepwikiResponseSchema = () => {
	const TechnicalDifficultySchema = {
		type: "object",
		title: "technical_difficulty_assessment",
		description: "Schema for evaluating the technical complexity and difficulty level of resolving a GitHub issue",
		properties: {
			level: {
				type: "string",
				enum: ["high", "medium", "low"],
				description: "high | medium | low"
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
		title: "deepwiki_issue_analysis_response",
		description: "Structured response schema containing comprehensive analysis of GitHub issues including root cause, resolution approach, difficulty assessment, and explanatory content",
		properties: {
			translationLanguageCode: {
				type: "string",
				description: "Language code"
			},
			deepwikiLink: {
				type: "string",
				pattern: "^https://deepwiki\\.com/search/.*",
				errorMessage: "Must start with https://deepwiki.com/search/"
			},
			rootCause: {
				type: "array",
			items: { type: "string" },
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
				type: "array",
				items: { type: "string" },
				description: "Simple analogy for issue and resolution"
			}
		},
		required: ["translationLanguageCode", "deepwikiLink", "rootCause", "resolutionApproach", "technicalDifficulty", "summary", "keyword", "analogy"]
	};
	return IssueResponseSchema;
};

module.exports = {
    "jsCode": deepwikiResponseSchema.toString()
};
