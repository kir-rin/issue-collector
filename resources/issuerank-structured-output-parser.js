const inputSchema = `{
  "type": "object",
  "properties": {
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
            "format": "uri"
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
  "required": ["issues"]
}`;

module.exports = {
    "schemaType": "manual",
    "inputSchema": `${inputSchema}`,
    "autoFix": true 
}