const convertMJML = function () {
	const marked = require('marked');
	
	const escapeHtml = (str) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
	
	const convertMarkdownToHTML = (markdown) => {
		const renderer = new marked.Renderer();
		
		renderer.link = ({text}) => {                       
         return text;       
		};

		renderer.codespan = ({text}) => {
			return `<span class="notion-code">${escapeHtml(text)}</span>`;
		};
		
		renderer.code = ({text}) => {
			return `<pre class="notion-code-block"><code>${escapeHtml(text)}</code></pre>`;
		};
		
		let html = marked.parse(markdown, { renderer });
		html = html.replace(/<\/?p>/g, '');  // <p> 태그 제거
		
		return html;
	};
	
	const processData = (data) => {
		if (typeof data === 'string') {
			return convertMarkdownToHTML(data);
		}
		if (Array.isArray(data)) {
			return data.map(item => processData(item));
		}
		if (typeof data === 'object' && data !== null) {
			const result = {};
			for (const key in data) {
				result[key] = processData(data[key]);
			}
			return result;
		}
		return data;
	};
	const createBulletedList = (items) => {
		if (!Array.isArray(items) || items.length === 0) {
			return '';
		}
		return items.map(item => `<mj-text mj-class="section-content">• ${item}</mj-text>`).join('<br/>');
	};
	const prAgent = $('PR Analysis Langchain Agent');
	const prData = prAgent.isExecuted ? processData(prAgent.first()?.json) : null;
	
	let referencePR = '';
	if (prData) {
		referencePR = `
			<mj-text mj-class="issue-title" align="center">🌟 Newcomer's Reference PR</mj-text>
			<mj-text align="center" padding-top="0" padding-bottom="0">
				<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
					<tr>
						<td style="
							background-color: #3C3489;
							color: #EEEDFE;
							font-size: 12px;
							font-family: Nanum, Times, sans-serif;
							padding: 6px 16px;
							border-radius: 20px;
							white-space: nowrap;
						">
							&#9432;&nbsp; Check out this exemplary PR to get started
						</td>
					</tr>
				</table>
			</mj-text>
			<mj-spacer/>
			<mj-text mj-class="section-title" align="center"><a href="${prData.url}">${prData.title}</a></mj-text>
			<mj-spacer/>
			${createBulletedList(prData.analogy)}
			${createBulletedList(prData.summary)}
			<mj-spacer/>
			${prData.linkedIssue?.url ? `
			<mj-divider border-width="1px"></mj-divider>
			<mj-text mj-class="issue-title" align="center">🔗 Related Issue</mj-text>
			<mj-text mj-class="section-title" align="center"><a href="${prData.linkedIssue.url}">${prData.linkedIssue.title}</a></mj-text>
			<mj-spacer/>
			${createBulletedList(prData.linkedIssue.analogy)}
			${createBulletedList(prData.linkedIssue.summary)}
			<mj-text mj-class="section-title" font-weight="bold">Why Good for Contribution</mj-text>
			${createBulletedList(prData.linkedIssue.whyGoodForContribution)}
			<mj-spacer/>
			` : ''}
			${prData.review?.url ? `
			<mj-divider border-width="1px"></mj-divider>
			<mj-text mj-class="issue-title" align="center">💡 Review</mj-text>
			<mj-text mj-class="section-content">• ${prData.review.summary?.[0]} <a href="${prData.review.url}" style="font-weight: bold;">(Link)</a></mj-text>
			<mj-text mj-class="section-title" font-weight="bold">Key Takeaway</mj-text>
			${createBulletedList(prData.review.insights)}
			<mj-spacer/>
			` : ''}
			`;
	}

	const latestReleaseInfo = processData($('Issue Analysis Langchain Agent').first().json.latestRelease);
	let latestRelease = `
			 <mj-section padding="15px">
					 <mj-column border="3px solid #52af0f">
							 <mj-text mj-class="section-title">🚀 Latest Release <a href="${latestReleaseInfo.url}">(${latestReleaseInfo.name})</a></mj-text>
			`;
	for (const { category, descriptions } of latestReleaseInfo.details) {
		latestRelease += `<mj-text mj-class="section-content" font-weight="bold">[${category}]</mj-text>`;
		latestRelease += createBulletedList(descriptions);
	}
	latestRelease += '</mj-column></mj-section>';
	const processedIssues = $('Merge').all().map(item => processData(item.json));
	let summary = `
			 <mj-section padding="15px">
					 <mj-column border="3px solid #193404">
							 <mj-text mj-class="section-title">📌 Quick Summary</mj-text>
							 ${createBulletedList(processedIssues.map(item => item.summary))}
					 </mj-column>
			 </mj-section>`;

	let issues = [];
	for (const issue of processedIssues) {
		let issueInfo = `<mj-text mj-class="issue-title">${issue.title}</mj-text>
												<mj-spacer/>
												<mj-text mj-class="section-title">🔑 Keywords</mj-text>
												<mj-text mj-class="section-content">${issue.keyword.join(', ')}</mj-text>
											`;

		let analogy = `<mj-text mj-class="section-title">🔄 Analogy</mj-text>`;
		analogy += createBulletedList(issue.analogy)

		let description = `<mj-text mj-class="section-title">🧾 Issue Description</mj-text>`;
		description += createBulletedList(issue.description);

		let rootCause = `<mj-text mj-class="section-title">🧩 Root Cause</mj-text>`
		rootCause += createBulletedList(issue.rootCause);

		let resolutionApproach = `<mj-text mj-class="section-title">🛠️ Resolution Approach</mj-text><mj-text font-size="14px" line-height="1.6">`;
		resolutionApproach += createBulletedList(issue.resolutionApproach);
		resolutionApproach += '</mj-text>';

		let suitability = `<mj-text mj-class="section-title">✅ Issue Suitability: ${issue.suitability.level}</mj-text><mj-text font-size="14px" line-height="1.6">`
		suitability += createBulletedList(issue.suitability.reasons);
		suitability += '</mj-text>';

		let technicalDifficulty = `<mj-text mj-class="section-title">🧗 Technical Difficulty: ${issue.technicalDifficulty.level}</mj-text><mj-text font-size="14px" line-height="1.6">`
		technicalDifficulty += createBulletedList(issue.technicalDifficulty.reasons);
		technicalDifficulty += '</mj-text>';

		let issuelink = `<mj-text mj-class="section-title"><p>👉 Go to the Issue <a href="${issue.url}">(Link)</a></p></mj-text>`;
		let deepwikiLink = `<mj-text mj-class="section-title"><p>🌀 Check the code-level explanation on Deepwiki <a href="${issue.deepwikiLink}">(Link)</a></p></mj-text>`;

		issues.push(
			issueInfo + analogy + description +
			rootCause + resolutionApproach + suitability +
			technicalDifficulty + issuelink + deepwikiLink
		);
	}

	return {
		issueHTML: `
					<mjml>
						<mj-head>
							<mj-style>
								.notion-code {
									line-height: normal !important;
									background: rgba(135, 131, 120, 0.15) !important;
									color: rgb(191, 97, 106) !important;
									font-family: 'Courier New', monospace !important;
									font-weight: 600;
									font-size: 85% !important;
									border-radius: 6px !important;
									padding: 0.2em 0.4em !important;
									margin-right: 0.2em !important;
									display: inline-block !important;
								}
							</mj-style>
								<mj-style>
									.notion-code-block {
										background: rgba(135, 131, 120, 0.15) !important;
										border-radius: 6px !important;
										padding: 1em !important;
										margin: 0.5em 0 !important;
										overflow-x: auto !important;
									}
									.notion-code-block code {
										font-family: 'Courier New', monospace !important;
										font-size: 85% !important;
										color: rgb(191, 97, 106) !important;
										background: transparent !important;
										padding: 0 !important;
									}
								</mj-style>
								<mj-style>
									.dark .notion-code {
										color: rgb(250, 156, 96) !important;
									}
									.dark .notion-code-block code {
										color: rgb(250, 156, 96) !important;
									}
								</mj-style>
									<mj-attributes>
											<mj-class name="issue-title" font-family="Nanum, Times, sans-serif" font-size="22px" />
											<mj-class name="section-title" font-family="Nanum, Times, sans-serif" font-size="15px" font-weight="bold"/>
											<mj-class name="section-content" font-size="14px" line-height="1.6"/>
									</mj-attributes>
							</mj-head>
							<mj-body>
									<mj-section>
											<mj-column>
													<mj-image src="https://lh3.googleusercontent.com/d/1Kb9oLEzdcJp0LGtIYFlWWPKqgatJDzlB" width="1000" height="150"/>
											</mj-column>
									</mj-section>
									<mj-divider  border-width="1px" border-color="#D3D3D3"/> 
									<mj-section background-color="transparent" padding="0px">
										<mj-column padding="0px">
											<mj-image padding="0px" src="https://lh3.googleusercontent.com/d/1rpH-BMWzsI06hl5cT1A7agwt7o0G9zH_"></mj-image>
										</mj-column>
									</mj-section>
									<mj-section background-color="#F3E8FF" padding="30px 40px">
										<mj-column width="100%">
											${referencePR}
										</mj-column>
									</mj-section>
									<mj-wrapper>
											${latestRelease}
											${summary}
											<mj-section>
													<mj-column>
															${issues.join(`<mj-divider  border-width="1px" border-color="#D3D3D3"/>`)}
													</mj-column>
											</mj-section>
									</mj-wrapper>
					</mj-body>
					</mjml>`
	}
}

module.exports = {
	"jsCode": convertMJML.toString()
};
