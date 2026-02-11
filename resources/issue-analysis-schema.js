const issueAnalysisSchema = () => {
	const { owner, name } = $('Load Repo Info').first().json;

	const issueAnalysisOutputSchema = {
		title: "issue_analysis_output",
		description: "Analysis result of GitHub issues and latest release",
		type: "object",
		properties: {
			translationLanguageCode: {
				type: "string",
				description: "Language code"
			},
			latestRelease: {
				type: "object",
				properties: {
					details: {
						type: "array",
						items: {
							type: "object",
							properties: {
								category: {
									type: "string",
									description: "Category for the descriptions (e.g., 'breaking change', 'internal change')"
								},
								descriptions: {
									type: "array",
									items: { type: "string" },
									maxItems: 3,
									description: "Compressed release descriptions (maximum 3 items)"
								}
						},
						required: ["category", "descriptions"]
					},
					maxItems: 3,
					description: "Array of release details (maximum 3 items)"
					}
				},
				required: ["details"]
			},
			issues: {
				type: "array",
				items: {
					type: "object",
					properties: {
						issueTitle: { type: "string", description: "Issue title" },
						issueURL: {
							type: "string",
							pattern: `^https://github.com/${owner}/${name}/issues/\\d+$`,
							description: "Issue URL"
						},
						issueDescription: { 
							type: "array", 
							items: { type: "string" },
							description: "A 1-2 line concise summary of the original issue description capturing the core problem or feature request (NOT a verbatim copy)"
						},
						issueSuitability: {
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
					required: ["issueTitle", "issueURL", "issueDescription", "issueSuitability"]
				},
				description: "Top 3-5 suitable issues"
			}
		},
		required: ["translationLanguageCode", "latestRelease", "issues"]
	};
	return issueAnalysisOutputSchema
};

module.exports = {
	"jsCode": issueAnalysisSchema.toString()
};
