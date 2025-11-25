const inputSchema = `{
        "type": "object",
        "properties": {
            "issueURL": {
            "type": "string",
            "format": "uri"
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
            }
        },
        "required": [
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