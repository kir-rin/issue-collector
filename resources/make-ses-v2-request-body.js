const makeSESV2RequestBody = () => {
	const repoInfo = `${$('Load Repo Info').first().json.owner}/${$('Load Repo Info').first().json.name}`;
	const title = $('Title Generator Langchain Agent').first().json.title;
	const requestBody = {
		FromEmailAddress: "noreply@dst03106.link",
		Destination: { ToAddresses: ["{email}"] },
		Content: {
			Simple: {
				Subject: { Data: `[Issue Report] ${repoInfo} - ${title}`, Charset: "UTF-8" },
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
							.replace(/{email}/g, process.env.EMAIL)
};
