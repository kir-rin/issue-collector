const { execFile } = require('child_process');

function executeWorkflow({
	translation_language,
	repo,
	email,
	openrouter_api_key,
	n8n_github_access_token,
	google_app_password,
}) {
	const options = {
		env: {
			...process.env,
			N8N_LOG_LEVEL: "error",
			NODE_FUNCTION_ALLOW_EXTERNAL: "mjml",
			TRANSLATION_LANGUAGE: translation_language,
			REPO: repo,
			EMAIL: email,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || openrouter_api_key,
			N8N_GITHUB_ACCESS_TOKEN: process.env.N8N_GITHUB_ACCESS_TOKEN || n8n_github_access_token,
			GOOGLE_APP_PASSWORD: process.env.GOOGLE_APP_PASSWORD || google_app_password,
		},
		timeout: 300000, // 5분 타임아웃 (밀리초)
		maxBuffer: 1024 * 1024, // 1MB 버퍼
	};
	return new Promise((resolve, reject) => {
		execFile('./scripts/entrypoint.sh', [], options, (error, stdout, stderr) => {
			if (stderr || error) {
				reject({ error, stderr, stdout });
			} else {
				resolve({ error, stderr, stdout }); 
			}
		});
	});
}

	exports.handler = async (event) => {
		console.log(event);
		const config = {
			translation_language: event.translation_language,
			repo: event.repo,
			email: event.email,
			openrouter_api_key: event.openrouter_api_key,
			n8n_github_access_token: event.n8n_github_access_token,
			google_app_password: event.google_app_password
		};

		try {
			await executeWorkflow(config)
				.then(({ error, stderr, stdout }) => {
					if (stdout) console.log(`[STDOUT] ${stdout}`);
					if (stderr) console.error(`[STDERR] ${stderr}`);
					if (error) console.error(`Exec error: ${error.message}`);
				})
				.catch(({ error, stderr, stdout }) => {
					if (stdout) console.log(`[STDOUT] ${stdout}`);
					if (stderr) console.error(`[STDERR] ${stderr}`);
					if (error) throw new Error(`Workflow failed: ${error?.message || stderr}`);
				});
			return {
				statusCode: 200,
				body: JSON.stringify({ message: 'Success' }),
			};
		} catch (error) {
			console.error(`Workflow failed: ${error.message}`);
			return {
				statusCode: 500,
				body: JSON.stringify({ message: 'Workflow execution failed' }),
			};
		}
	}
