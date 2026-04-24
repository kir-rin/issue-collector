const sortByPriority = `{
	const prs = $('Fetch Recent Merged PRs').first().json.data.repository.pullRequests.nodes;
	const issueCounts = $('Fetch Author Merge Counts').first().json.data.data;
	const merged = prs.map(pr => ({
		...pr,
		author: {
			...pr.author,
			totalMergedCount: issueCounts[pr.author.login?.replace(/-/g, '_')]?.issueCount ?? 0 
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
