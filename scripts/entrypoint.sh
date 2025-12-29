#!/bin/sh

sh scripts/import-workflow.sh
WORKFLOW_ID=$(sqlite3 $N8N_USER_FOLDER/.n8n/database.sqlite "SELECT id FROM workflow_entity ORDER BY createdAt DESC LIMIT 1;")
npx n8n execute workflow --id $WORKFLOW_ID
