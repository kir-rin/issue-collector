const issueSummarySchema = () => {
	const { owner, name } = $('Load Repo Info').first().json;

	const issueSummaryOutputSchema = {
		title: "issue_summary_output",
		description: "Summary result of GitHub issues",
		type: "object",
		properties: {
			translationLanguageCode: {
				type: "string",
				description: "Language code for translation"
			},
			issues: {
				type: "array",
				items: {
					type: "object",
					properties: {
						title: {
							type: "string",
							description: "Issue title"
						},
						url: {
							type: "string",
							pattern: `^https://github.com/${owner}/${name}/issues/\\d+$`,
							description: "Issue URL"
						},
						description: {
							type: "array",
							items: { type: "string" },
							description: "A 1-2 line concise summary of the original issue description capturing the core problem or feature request (NOT a verbatim copy)"
						},
						suitability: {
							type: "object",
							properties: {
								level: {
									type: "string",
									enum: ["high", "medium", "low"],
									description: "Contribution opportunity level"
								},
								reasons: {
									type: "array",
									items: { type: "string" },
									description: "Reasons for the level"
								}
							},
							required: ["level", "reasons"]
						}
					},
					required: ["title", "url", "description", "suitability"]
				},
				description: "Top 3-5 suitable issues"
			}
		},
		required: ["translationLanguageCode", "issues"]
	};
	return issueSummaryOutputSchema;
};

module.exports = {
	"jsCode": issueSummarySchema.toString()
};
