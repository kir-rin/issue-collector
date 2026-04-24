const releaseSummarySchema = () => {
	const releaseSummaryOutputSchema = {
		title: "release_summary_output",
		description: "Summary result of GitHub release",
		type: "object",
		properties: {
			translationLanguageCode: {
				type: "string",
				description: "Language code for translation"
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
									maxItems: 2,
									description: "Compressed release descriptions (maximum 3 items)"
								}
							},
							required: ["category", "descriptions"]
						},
						maxItems: 2,
						description: "Array of release details (maximum 3 items)"
					}
				},
				required: ["details"]
			}
		},
		required: ["translationLanguageCode", "latestRelease"]
	};
	return releaseSummaryOutputSchema;
};

module.exports = {
	"jsCode": releaseSummarySchema.toString()
};
