#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { tmpDir, isLambda } = require('./config/temp-dir');
const { buildWorkflow } = require('./lib/workflow-builder');

function getRootDir() {
  if (process.env.RUNTIME_ENV === 'lambda') {
    console.log('RUNTIME_ENV=lambda, using current directory');
    return '.';
  }

  try {
    const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    console.log('Git found, using repository root');
    return root;
  } catch (error) {
    console.log('Git not found, using current directory');
    return '.';
  }
}

function stripQuotes(value) {
  return value.replace(/^["']|["']$/g, '');
}

function createCredentialsFile(credPath) {
  const googleAppPasswordClean = stripQuotes(process.env.GOOGLE_APP_PASSWORD);
  
  const credentials = [
    {
      "id": "openRouterApi",
      "name": "OpenRouter account",
      "type": "openRouterApi",
      "data": {
        "apiKey": process.env.OPENROUTER_API_KEY
      }
    },
    {
      "id": "httpHeaderAuth",
      "name": "Header Auth account",
      "type": "httpHeaderAuth",
      "data": {
        "name": "Authorization",
        "value": `Bearer ${process.env.N8N_GITHUB_ACCESS_TOKEN}`
      }
    },
    {
      "id": "smtp",
      "name": "SMTP account",
      "type": "smtp",
      "data": {
        "user": process.env.EMAIL,
        "password": googleAppPasswordClean,
        "host": "smtp.gmail.com",
        "port": 465,
        "secure": true,
        "disableStartTls": false,
        "hostName": ""
      }
    }
  ];

	if (process.env.N8N_AWS_ACCESS_KEY_ID && process.env.N8N_AWS_SECRET_ACCESS_KEY) {
		credentials.push(
			{
				"id": "aws",
				"name": "AWS (IAM) account",
				"type": "aws",
				"data" : {
					"region": "ap-northeast-2",
					"accessKeyId" : process.env.N8N_AWS_ACCESS_KEY_ID,
					"secretAccessKey" : process.env.N8N_AWS_SECRET_ACCESS_KEY,
				}
			}
		)
	}

	if (process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL) {
		credentials.push(
			{
				"id": "openAiApi",
				"name": "OpenAi account", 
				"type": "openAiApi", 
				"data" : {
					"apiKey" : process.env.OPENAI_API_KEY,
					"url": process.env.OPENAI_BASE_URL, 
				}
			}
		)
	}

  fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2), 'utf8');
  console.log(`✓ 자격 증명 파일 생성: ${credPath}`);
}

function executeN8nCommands(credPath, workflowPath) {
  try {
    console.log('🔐 n8n 자격 증명 import...');
    execSync(`npx n8n import:credentials --input="${credPath}"`, { stdio: 'inherit' });
    
    console.log('📋 n8n 워크플로우 import...');
    execSync(`npx n8n import:workflow --input="${workflowPath}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ n8n 명령어 실행 중 오류 발생:', error.message);
    process.exit(1);
  }
}

function main() {
  console.log('🚀 n8n 워크플로우 import를 시작합니다...\n');

  const requiredEnvVars = ['OPENROUTER_API_KEY', 'N8N_GITHUB_ACCESS_TOKEN', 'EMAIL', 'GOOGLE_APP_PASSWORD'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 필수 환경변수가 설정되지 않았습니다:', missingVars.join(', '));
    process.exit(1);
  }

  try {
    const rootDir = getRootDir();
    const credPath = path.join(tmpDir, 'cred.json');
    const workflowPath = path.join(tmpDir, 'workflow.json');
    
    console.log('🔨 워크플로우 빌드 중...');
    const workflowSourcePath = process.env.WORKFLOW_PATH || 'n8n.json';
    const buildConfig = {
      workflowPath: path.join(rootDir, workflowSourcePath),
      resourcesDir: path.join(rootDir, 'resources'),
      outputPath: workflowPath
    };
    
    const buildResult = buildWorkflow(buildConfig);
    if (!buildResult.success) {
      console.error('❌ 워크플로우 빌드 실패:', buildResult.error);
      process.exit(1);
    }
    createCredentialsFile(credPath);
    executeN8nCommands(credPath, workflowPath);
    console.log('\n✅ 모든 작업이 완료되었습니다!');
  } catch (error) {
    console.error('❌ 실행 중 오류 발생:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
