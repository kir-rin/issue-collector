module.exports = {
    "fromEmail": process.env.EMAIL,
    "toEmail": process.env.EMAIL,
		"subject": "=[Issue Report] {{ $('Load Repo Info').first().json.owner }}/{{ $('Load Repo Info').first().json.name }} - {{ $('Title Generator Agent').first().json.output.title }}",
    "html": "={{ $('convert MJML to HTML').item.json.htmlOutput.html }}",
    "options": {}
};
