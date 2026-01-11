const convertMJML = function () {
	const createBulletedList = (items) => {
      if (!Array.isArray(items) || items.length === 0) {
          return '';
      }
      return items.map(item => `<mj-text mj-class="section-content">• ${item}</mj-text>`).join('<br/>');
  };
  let latestRelease = `
      <mj-section padding="15px">
          <mj-column border="3px solid #52af0f">
              <mj-text mj-class="section-title">🚀 Latest Release (${$('IssueRank Agent').first().json.output.latestRelease.name})</mj-text>
              <mj-text mj-class="section-content">${$('IssueRank Agent').first().json.output.latestRelease.description}</mj-text>
          </mj-column>
      </mj-section>`;

  let summary = `
      <mj-section padding="15px">
          <mj-column border="3px solid #193404">
              <mj-text mj-class="section-title">📌 Quick Summary</mj-text>
              ${createBulletedList($('Merge').all().map(item => item.json.summary))}
          </mj-column>
      </mj-section>`;

  let issues = [];

  for (const issue of $('Merge').all()) {
      let issueInfo = `<mj-text mj-class="issue-title">${issue.json.issueTitle}</mj-text>
                      <mj-spacer/>
                      <mj-text mj-class="section-title">🔑 Keywords</mj-text>
                      <mj-text mj-class="section-content">${issue.json.keyword.join(', ')}</mj-text>
                      <mj-text mj-class="section-title">🔄 Analogy</mj-text>
                      <mj-text mj-class="section-content">${issue.json.analogy}</mj-text>
                      <mj-text mj-class="section-title">🧾 Issue Description</mj-text>
                      <mj-text mj-class="section-content">${issue.json.issueDescription}</mj-text>
                      <mj-text mj-class="section-title">🧩 Root Cause</mj-text>
                      <mj-text mj-class="section-content">${issue.json.rootCause}</mj-text>`;
      let resolutionApproach = `<mj-text mj-class="section-title">🛠️ Resolution Approach</mj-text><mj-text font-size="14px" line-height="1.6">`;
      resolutionApproach += createBulletedList(issue.json.resolutionApproach);
      resolutionApproach += '</mj-text>';

      
      let issueSuitability = `<mj-text mj-class="section-title">✅ Issue Suitability: ${issue.json.issueSuitability.level}</mj-text><mj-text font-size="14px" line-height="1.6">`
      issueSuitability += createBulletedList(issue.json.issueSuitability.reasons);
      issueSuitability += '</mj-text>';
      
      let technicalDifficulty = `<mj-text mj-class="section-title">🧗 Technical Difficulty: ${issue.json.technicalDifficulty.level}</mj-text><mj-text font-size="14px" line-height="1.6">`
      technicalDifficulty += createBulletedList(issue.json.technicalDifficulty.reasons);
      technicalDifficulty += '</mj-text>';

      let issuelink = `<mj-text mj-class="section-title"><p>👉 Go to Issue <a href="${issue.json.issueURL}">(Link)</a></p></mj-text>`;
      let deepwikiLink = `<mj-text mj-class="section-title"><p>🌀 Go to Deepwiki search result <a href="${issue.json.deepwikiLink}">(Link)</a></p></mj-text>`;

      issues.push(issueInfo + resolutionApproach + issueSuitability + technicalDifficulty + issuelink + deepwikiLink)
  }

  return {
      issueHTML: `
          <mjml>
            <mj-head>
                  <mj-attributes>
                      <mj-class name="issue-title" font-size="22px" />
                      <mj-class name="section-title" font-size="15px" font-weight="bold"/>
                      <mj-class name="section-content" font-size="14px" line-height="1.6"/>
                  </mj-attributes>
              </mj-head>
              <mj-body>
                  <mj-section>
                      <mj-column>
                          <mj-image src="https://lh3.googleusercontent.com/d/1VYyXuiNQOnHCBELXh4_6ZDEoL30x7OQk" width="1000" height="150"/>
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
