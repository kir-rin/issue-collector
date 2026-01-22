#!/bin/sh

node scripts/import-workflow.js
WORKFLOW_ID=$(sqlite3 $N8N_USER_FOLDER/.n8n/database.sqlite "SELECT id FROM workflow_entity ORDER BY createdAt DESC LIMIT 1;")

# Retry logic: up to 3 attempts (initial + 2 retries)
attempts=0
while [ $attempts -lt 3 ]; do
    echo "Attempting n8n execute (attempt $(expr $attempts + 1)/3)..."
    if npx n8n execute workflow --id $WORKFLOW_ID --loglevel=verbose --logs-max=0; then
        echo "n8n execute succeeded."
        break
    else
        attempts=$(expr $attempts + 1)
        if [ $attempts -lt 3 ]; then
            echo "n8n execute failed, retrying in 5 seconds..."
            sleep 5
        fi
    fi
done

if [ $attempts -eq 3 ]; then
    echo "n8n execute failed after 3 attempts."
    exit 1
fi
