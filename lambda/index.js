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
		timeout: 15 * 60 * 1000, 		
		maxBuffer: 1024 * 1024, 	
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
	const data = event.Records ? JSON.parse(event.Records[0].body) : event;
	console.log(data);
	const config = {
		translation_language: data.translation_language,
		repo: data.repo,
		email: data.email,
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
				throw error;
			});
		return {
			statusCode: 200,
			body: JSON.stringify({ message: 'Success' }),
		};
	}
