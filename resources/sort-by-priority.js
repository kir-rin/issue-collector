// IMPORTANT: 이 파일은 n8n code 노드의 jsCode 값으로 사용됩니다.
// 내부 템플릿 리터럴의 백틱(`)과 ${}는 반드시 이스케이프(\`와 \${})해야 합니다.
// 그렇지 않으면 Node.js require() 시 즉시 평가되어 "Unexpected token" 에러가 발생합니다.
// 
// toAlias 함수는 build-user-merge-count-query.js와 동일한 로직을 사용해야 합니다.
// GraphQL alias에서 숫자로 시작하는 사용자명을 처리하기 위해 _를 붙입니다.
const sortByPriority = `{
	const prs = $('Fetch Recent Merged PRs').first().json.data.repository.pullRequests.nodes
		.filter(pr => pr.author?.login);
	const issueCounts = $('Fetch Author Merge Counts').first().json.data.data;
	const toAlias = (login) => login ? (s => /^[0-9]/.test(s) ? "_" + s : s)(login.replace(/-/g, "_")) : "";
	const merged = prs.map(pr => ({
		...pr,
		author: {
			...pr.author,
			totalMergedCount: issueCounts[toAlias(pr.author.login)]?.issueCount ?? 0 
		}
	}))

	const sorted = merged.sort((a, b) => {
		const aHasIssues = a.closingIssuesReferences.nodes.length > 0 ? 1 : 0;
		const bHasIssues = b.closingIssuesReferences.nodes.length > 0 ? 1 : 0;
		if (aHasIssues !== bHasIssues) return bHasIssues - aHasIssues;
		if (a.author.totalMergedCount !== b.author.totalMergedCount) {
			return a.author.totalMergedCount - b.author.totalMergedCount;
		}
		const aTotal = a.comments.totalCount + a.reviews.totalCount + 
			a.reviewThreads.nodes.reduce((sum, n) => sum + n.comments.totalCount, 0);
		const bTotal = b.comments.totalCount + b.reviews.totalCount + 
			b.reviewThreads.nodes.reduce((sum, n) => sum + n.comments.totalCount, 0);
		return bTotal - aTotal;
	});

	return { sorted };
	};
`

module.exports = {
    "jsCode": sortByPriority 
};
