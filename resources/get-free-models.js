const getFreeModels = function() {
	const requiredModelKeys = [
		"issueRankMainModel",
		"issueRankFallbackModel",
		"issueRankParserModel",
		"titleGeneratorMainModel",
		"titleGeneratorFallbackModel",
		"deepwikiMainModel",
		"deepwikiFallbackModel",
		"deepwikiParserModel",
	]
	var freeModels = [];
	var requiredModels = {};
	for (const item of $input.first().json.data) {
		if (item.pricing.prompt === "0" && item.pricing.completion === "0") {
			freeModels.push(item)
		}
	}
	freeModels.sort((a, b) => b.created - a.created)
	requiredModelKeys.forEach((item, index) => {
		requiredModels[item] = freeModels[index % freeModels.length].id
	});

	return requiredModels
};
  
module.exports = {
    "jsCode": getFreeModels.toString()
};
