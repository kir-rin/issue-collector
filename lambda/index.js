const { execFile } = require('child_process');

function executeWorkflow({
	transaction_language,
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
			TRANSLATION_LANGUAGE: transaction_language,
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
			if (stderr) {
				reject({ error, stderr, stdout });
			} else {
				resolve(stdout);
			}
		});
	});
}

exports.handler = async (event) => {
	const config = {
		transaction_language: event.transaction_language,
		repo: event.repo,
		email: event.email,
		openrouter_api_key: event.openrouter_api_key,
		n8n_github_access_token: event.n8n_github_access_token,
		google_app_password: event.google_app_password
	};
	await executeWorkflow(config)
    .then(result => console.log(result))
    .catch(({ error, stderr, stdout}) => {
			if (stdout) console.log(`[STDOUT] ${stdout}`);
			if (stderr) console.error(`[STDERR] ${stderr}`); 
			if (error) console.error(`[EXEC ERROR] ${error.message}`);
		});
	return {                                                                            
		statusCode: 200,                                                                  
		body: JSON.stringify({ message: 'Success' })                          
 }; 
}
