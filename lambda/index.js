const { execFile } = require('child_process');

function executeWorkflow({
	translation_language,
	repo,
	email,
}) {
	const options = {
		env: {
			...process.env,
			TRANSLATION_LANGUAGE: translation_language,
			REPO: repo,
			EMAIL: email,
		},
		timeout: 300000, // 5분 타임아웃 (밀리초)
		maxBuffer: 1024 * 1024, // 1MB 버퍼
	};
	return new Promise((resolve, reject) => {
		execFile('./scripts/entrypoint.sh', [], options, (error, stdout, stderr) => {
			if (error) {
				reject({ error, stdout, stderr });
			} else {
				resolve({ stdout, stderr }); 
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
	};
		await executeWorkflow(config)
			.then(({ stderr, stdout }) => {
				if (stdout) console.log(`[STDOUT] ${stdout}`);
				if (stderr) console.log(`[STDERR] ${stderr}`);
			})
			.catch(({ error, stderr, stdout }) => {
				console.log(`[STDOUT] ${stdout || ''}`);
				console.log(`[STDERR] ${stderr || ''}`);
				console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
  			console.error('Stack:', error.stack);
  			console.error('Message:', error.message);
				throw err;
			});
		return {
			statusCode: 200,
			body: JSON.stringify({ message: 'Success' }),
		};
	}
