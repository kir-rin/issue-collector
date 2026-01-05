const inputSchema = `{
	"type": "object",
	"properties": {
		"translationLanguageCode": {
			"type": "string",
			"enum": ["en", "ko", "ja", "zh", "es", "fr", "de", "ru", "ar", "pt"]
		},
		"issueURL": {
			"type": "string",
			"pattern": "^https://github\\\\.com/.+/issues/\\\\d+$"
		},
		"deepwikiLink": {
			"type": "string",
			"format": "uri"
		},
		"rootCause": {
			"type": "string"
		},
		"resolutionApproach": {
			"type": "array",
			"items": {
				"type": "string"
			}
		},
		"technicalDifficulty": {
			"type": "object",
			"properties": {
				"level": {
					"type": "string",
					"enum": ["High", "Medium", "Low"]
				},
				"reasons": {
					"type": "array",
					"items": {
						"type": "string"
					}
				}
			},
			"required": ["level", "reasons"]
		},
		"summary": {
			"type": "string"
		},
		"keyword": {
			"type": "array",
			"items": {
				"type": "string"
			}
		},
		"analogy": {
			"type": "string"
		}
	},
	"required": [
		"translationLanguageCode",
		"issueURL",
		"deepwikiLink",
		"rootCause",
		"resolutionApproach",
		"technicalDifficulty",
		"summary"
	]
}`;

module.exports = {
	"schemaType": "manual",
	"inputSchema": `${inputSchema}`,
	"autoFix": true
}
