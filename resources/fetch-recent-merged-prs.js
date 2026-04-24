const fetchRecentMergedPRs = `
		query {
			repository(owner: "{{ $('Load Repo Info').item.json.owner }}", name: "{{ $('Load Repo Info').item.json.name }}") {
				pullRequests(first: 50, states: [MERGED], orderBy: { field: UPDATED_AT, direction: DESC }) {
					nodes {
						url
						number
						author {
							... on User {
								login
							}
						}
						closingIssuesReferences(first: 10) {
							nodes {
								url
							}
						}
		comments(first: 10) {
			totalCount
		}

		reviews(first: 10, states: [CHANGES_REQUESTED, COMMENTED, DISMISSED]) {
			totalCount
		}

		reviewThreads(first: 10) {
			nodes {
				comments(first: 10) {
					totalCount
				}
			}
		}
					}
				}
			}
		}
`
module.exports = {
    "authentication": "headerAuth",
    "endpoint": "https://api.github.com/graphql",
    "query": `=${fetchRecentMergedPRs}`,
    "variables": "="
}
