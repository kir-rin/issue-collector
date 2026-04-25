// IMPORTANT: 이 파일은 n8n code 노드의 jsCode 값으로 사용됩니다.
// 내부 템플릿 리터럴의 백틱(`)과 ${}는 반드시 이스케이프(\`와 \${})해야 합니다.
// 그렇지 않으면 Node.js require() 시 즉시 평가되어 "Unexpected token" 에러가 발생합니다.
// 
// GraphQL alias는 문자 또는 _로 시작해야 합니다. 숫자로 시작하는 사용자명(예: 0xuser)을
// 처리하기 위해 toAlias 함수에서 숫자로 시작하는 경우 앞에 _를 붙입니다.
const buildUserMergeCountQuery = `{
	const nodes = $input.first().json.data.repository.pullRequests.nodes;
	const users = nodes
		.filter(node => node.author?.login)
		.map(node => node.author.login);
	const owner = $('Load Repo Info').first().json.owner; 
	const name = $('Load Repo Info').first().json.name;
	const repoInfo = \`\${owner}/\${name}\`;
	const toAlias = (login) => login ? (s => /^[0-9]/.test(s) ? "_" + s : s)(login.replace(/-/g, "_")) : "";
	const query = \`
		query {
			\${users.map(user => {
				const alias = toAlias(user);
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
