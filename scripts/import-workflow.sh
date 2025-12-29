#!/bin/sh

strip_quotes() {                                                                                       
	local value="$1"                                                                                   
	value=$(echo "$value" | sed 's/^["'\'']\|["'\'']$//g')
	echo $value                                                                                      
}

GOOGLE_APP_PASSWORD_CLEAN=$(strip_quotes "$GOOGLE_APP_PASSWORD")

if command -v git >/dev/null 2>&1; then
	echo "Git found, using repository root"
	ROOT=$(git rev-parse --show-toplevel)
else
	echo "Git not found, using current directory"
	ROOT="."
fi

cat << EOF > /tmp/cred.json
[
	 {
			"id": "openRouterApi",
			"name": "OpenRouter account",
			"type": "openRouterApi",
			"data": {
					"apiKey": "$OPENROUTER_API_KEY"
				}
		},
		{
			"id": "httpHeaderAuth",
			"name": "Header Auth account",
			"type": "httpHeaderAuth",
			"data": {
					"name": "Authorization",
					"value": "Bearer $N8N_GITHUB_ACCESS_TOKEN"
				}
		},
		{
			 "id": "smtp",
			 "name": "SMTP account",
			 "type": "smtp",
			 "data": {
					"user": "$EMAIL",
					"password": "$GOOGLE_APP_PASSWORD_CLEAN",
					"host": "smtp.gmail.com",
					"port": 465,
					"secure": true,
					"disableStartTls": false,
					"hostName": ""
				}
		}
] 
EOF
npx n8n import:credentials --input="/tmp/cred.json"
node $ROOT/scripts/build-workflow.js n8n.json
npx n8n import:workflow --input="/tmp/workflow.json"
