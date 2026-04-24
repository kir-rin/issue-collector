const buildUserMergeCountQuery = `{
	const nodes = $input.first().json.data.repository.pullRequests.nodes;
	const users = nodes
		.filter(node => node.author?.login)
		.map(node => node.author.login);
	const owner = $('Load Repo Info').first().json.owner; 
	const name = $('Load Repo Info').first().json.name;
	const repoInfo = \`\${owner}/\${name}\`;
	const query = \`
		query {
			\${users.map(user => {
				const alias = user.replace(/-/g, "_");
				return \`
					\${alias}: search(
						query: "repo:\${repoInfo} is:pr is:merged author:\${user}"
						type: ISSUE
						first: 1
					) {
						issueCount
					}
				\`;
			}).join("")}
		}
	\`;

	return {
		"query" : query
	} 
};
`

module.exports = {
    "jsCode": buildUserMergeCountQuery 
};
