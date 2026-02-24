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
		let issueInfo = `<mj-text mj-class="issue-title">${issue.issueTitle}</mj-text>
												<mj-spacer/>
												<mj-text mj-class="section-title">🔑 Keywords</mj-text>
												<mj-text mj-class="section-content">${issue.keyword.join(', ')}</mj-text>
											`;

		let analogy = `<mj-text mj-class="section-title">🔄 Analogy</mj-text>`;
		analogy += createBulletedList(issue.analogy)

		let issueDescription = `<mj-text mj-class="section-title">🧾 Issue Description</mj-text>`;
		issueDescription += createBulletedList(issue.issueDescription);

		let rootCause = `<mj-text mj-class="section-title">🧩 Root Cause</mj-text>`
		rootCause += createBulletedList(issue.rootCause);

		let resolutionApproach = `<mj-text mj-class="section-title">🛠️ Resolution Approach</mj-text><mj-text font-size="14px" line-height="1.6">`;
		resolutionApproach += createBulletedList(issue.resolutionApproach);
		resolutionApproach += '</mj-text>';

		let issueSuitability = `<mj-text mj-class="section-title">✅ Issue Suitability: ${issue.issueSuitability.level}</mj-text><mj-text font-size="14px" line-height="1.6">`
		issueSuitability += createBulletedList(issue.issueSuitability.reasons);
		issueSuitability += '</mj-text>';

		let technicalDifficulty = `<mj-text mj-class="section-title">🧗 Technical Difficulty: ${issue.technicalDifficulty.level}</mj-text><mj-text font-size="14px" line-height="1.6">`
		technicalDifficulty += createBulletedList(issue.technicalDifficulty.reasons);
		technicalDifficulty += '</mj-text>';

		let issuelink = `<mj-text mj-class="section-title"><p>👉 Go to the Issue <a href="${issue.issueURL}">(Link)</a></p></mj-text>`;
		let deepwikiLink = `<mj-text mj-class="section-title"><p>🌀 Check the code-level explanation on Deepwiki <a href="${issue.deepwikiLink}">(Link)</a></p></mj-text>`;

		issues.push(
			issueInfo + analogy + issueDescription +
			rootCause + resolutionApproach + issueSuitability +
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
											<mj-class name="issue-title" font-size="22px" />
											<mj-class name="section-title" font-size="15px" font-weight="bold"/>
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
