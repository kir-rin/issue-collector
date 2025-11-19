const convertMJML = function() {
    const createBulletedList = (items) => {
        if (!Array.isArray(items) || items.length === 0) {
            return '';
        }
        return items.map(item => `• ${item}`).join('<br/>');
    };

    let issues = [];
    for (const issue of $input.first().json.issues) {
        let issueInfo = `<mj-text mj-class="issue-title">${issue.issueTitle}</mj-text>
                        <mj-spacer/>
                        <mj-text mj-class="section-title">🧾 이슈 내용</mj-text>
                        <mj-text mj-class="section-content">${issue.issueDescription}</mj-text>
                        <mj-text mj-class="section-title">🧩 원인</mj-text>
                        <mj-text mj-class="section-content">${issue.rootCause}</mj-text>`;
        let resolutionApproach = `<mj-text mj-class="section-title">🛠️ 해결 방향</mj-text><mj-text font-size="14px" line-height="1.6">`;
        resolutionApproach += createBulletedList(issue.resolutionApproach);
        resolutionApproach += '</mj-text>';
        
        let complianceWithStandards = `<mj-text mj-class="section-title">✅ 기준 적합성: ${issue.complianceWithStandards.level}</mj-text><mj-text font-size="14px" line-height="1.6">`
        complianceWithStandards += createBulletedList(issue.complianceWithStandards.reasons);
        complianceWithStandards += '</mj-text>';
        
        let technicalDifficulty = `<mj-text mj-class="section-title">🧗 기술적인 난이도: ${issue.technicalDifficulty.level}</mj-text><mj-text font-size="14px" line-height="1.6">`
        technicalDifficulty += createBulletedList(issue.technicalDifficulty.reasons);
        technicalDifficulty += '</mj-text>';

        let issuelink = `<mj-text mj-class="section-title"><p>👉 이슈 보러가기 <a href="${issue.issueURL}">(링크)</a></p></mj-text>`;

        issues.push(issueInfo + resolutionApproach + complianceWithStandards + technicalDifficulty + issuelink)
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
                    <mj-section background-color="#E9E9E9">
                        <mj-column>
                            <mj-divider/>
                            <mj-image src="https://lh3.googleusercontent.com/d/11VgJS7_uMNmlBLaiN9S68Nz-QWZIsLV4" width="500" height="150"/>
                            <mj-divider  border-width="2px"/>
                        </mj-column>
                    </mj-section>
                    <mj-wrapper border="1px solid #000000" padding="50px 30px">
                        <mj-section>
                            <mj-column>
                                ${issues.join(`<mj-divider  border-width="2px"/>`)}
                            </mj-column>
                        </mj-section>
                    </mj-wrapper>
            </mj-body>
            </mjml>`
    }
};

module.exports = {
    "jsCode": convertMJML.toString()
};
