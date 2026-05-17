const makeSESV2RequestBody = () => {
	const repoInfo = `${$('Load Repo Info').first().json.owner}/${$('Load Repo Info').first().json.name}`;
	const title = $('Title Generator Langchain Agent').first().json.title;
	const requestBody = {
		FromEmailAddress: "___FROM_EMAIL___",
		Destination: { ToAddresses: ["___TO_EMAIL___"] },
		Content: {
			Simple: {
				Subject: { Data: `[${repoInfo}] ${title}`, Charset: "UTF-8" },
				Body: {
					Html: { 
						Data: $input.first().json.htmlOutput.html,
						Charset: "UTF-8" 
					}
				}
			}
		}
	};

	const jsonString = JSON.stringify(requestBody);

	return { jsonString }
}

module.exports = {
	"jsCode": makeSESV2RequestBody
							.toString()
							.replace(/___TO_EMAIL___/g, process.env.EMAIL)
							.replace(/___FROM_EMAIL___/g, process.env.FROM_EMAIL || process.env.EMAIL)
};
