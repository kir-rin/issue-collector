module.exports = {
    "fromEmail": process.env.FROM_EMAIL || process.env.EMAIL,
    "toEmail": process.env.EMAIL,
		"subject": "=[Issue Report] {{ $('Load Repo Info').first().json.owner }}/{{ $('Load Repo Info').first().json.name }} - {{ $('Title Generator Langchain Agent').first().json.title }}",
    "html": "={{ $('convert MJML to HTML').item.json.htmlOutput.html }}",
    "options": {}
};
