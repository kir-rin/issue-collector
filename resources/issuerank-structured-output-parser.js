const inputSchema = `{
  "type": "object",
  "properties": {
		"translationLanguageCode" : {
      "type": "string",
      "enum": ["en", "ko", "ja", "zh", "es", "fr", "de", "ru", "ar", "pt"]
    },
    "latestRelease": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "description": {
          "type": "string"
        }
      },
      "required": ["name", "description"]
    },
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "issueTitle": {
            "type": "string"
          },
          "issueURL": {
            "type": "string",
						"pattern": "^https://github\\\\.com/.+/issues/\\\\d+$"
          },
          "issueDescription": {
            "type": "string"
          },
          "issueSuitability": {
            "type": "object",
            "properties": {
              "level": {
                "type": "string",
                "enum": ["high", "medium", "low"]
              },
              "reasons": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": ["level", "reasons"]
          }
        },
        "required": ["issueTitle", "issueURL", "issueDescription", "issueSuitability"]
      }
    }
  },
  "required": ["translationLanguageCode", "latestRelease", "issues"]
}`;

module.exports = {
    "schemaType": "manual",
    "inputSchema": `${inputSchema}`,
    "autoFix": true 
}
