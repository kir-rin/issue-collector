const fetchTopPRDetails = `
		query {
			repository(owner: "{{ $('Load Repo Info').item.json.owner }}", name: "{{ $('Load Repo Info').item.json.name }}") {
				pullRequest(number: {{ $json.sorted[0].number }}) {
					title
					body
					additions
					deletions
					changedFiles
					url
					author {
						... on User {
							login
						}
					}
					closingIssuesReferences(first: 10) {
						nodes {
							url
							title
							body
							labels(first: 5) {
								nodes { name }
							}
						}
					}
					comments(last: 10) {
							nodes { 
								body 
								url
								author { login }
							}
						}
					reviews(last: 10, states: [CHANGES_REQUESTED, COMMENTED, DISMISSED]) {
						nodes { 
							body 
							state 
							url
							author { login }
						}
					}
					reviewThreads(last: 10) {
						nodes {
							comments(last: 10) {
								nodes { 
									body 
									path 
									line 
									url
									author { login }
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
    "query": `=${fetchTopPRDetails}`,
    "variables": "="
}
