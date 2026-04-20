const issueScoreSchema = () => {
	const { owner, name } = $('Load Repo Info').first().json;

	const issueScoreOutputSchema = {
		title: "issue_score_output",
		description: "Score result for GitHub issues",
		type: "object",
		properties: {
			scoredIssues: {
				type: "array",
				items: {
					type: "object",
					properties: {
						url: {
							type: "string",
							pattern: `^https://github.com/${owner}/${name}/issues/\\d+$`,
							description: "Issue URL"
						},
						score: {
							type: "integer",
							minimum: 1,
							maximum: 10,
							description: "Score from 1-10 based on contribution opportunity criteria"
						},
						reasons: {
							type: "array",
							items: { type: "string" },
							minItems: 2,
							maxItems: 4,
							description: "2-4 reasons explaining the score"
						}
					},
					required: ["url", "score", "reasons"]
				},
				description: "Array of scored issues"
			}
		},
		required: ["scoredIssues"]
	};
	return issueScoreOutputSchema;
};

module.exports = {
	"jsCode": issueScoreSchema.toString()
};
