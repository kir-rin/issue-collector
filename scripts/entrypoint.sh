#!/bin/sh

sh /app/scripts/import-workflow.sh
WORKFLOW_ID=$(sqlite3 ~/.n8n/database.sqlite "SELECT id FROM workflow_entity ORDER BY createdAt DESC LIMIT 1;")
npx n8n execute workflow --id $WORKFLOW_ID
