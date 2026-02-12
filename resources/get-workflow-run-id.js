const getWorkflowRunId = function() {
	const workflowRunId = crypto.randomUUID();
	const repoInfo = `${$('Load Repo Info').first().json.owner}/${$('Load Repo Info').first().json.name}`;
	const config = {
		metadata: {
			run_id: workflowRunId,
			repo: repoInfo,
			email: "___EMAIL___",
		}
	};
	return config
};

module.exports = {
	"jsCode": getWorkflowRunId
							.toString()
							.replace(/___EMAIL___/g, process.env.EMAIL)
};
