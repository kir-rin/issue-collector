const getFreeModels = function() {
	const requiredModelLength = 9;
	var freeModels = [];
	var requiredModels = [];
	for (const item of $input.first().json.data) {
		if (item.pricing.prompt === "0" && item.pricing.completion === "0") {
			freeModels.push(item)
		}
	}
	freeModels.sort((a, b) => b.created - a.created)
	Array.from({ length: requiredModelLength }).forEach((_item, index) => {
		requiredModels.push({id : freeModels[index % freeModels.length].id});
	});
	return requiredModels
};

module.exports = {
	"jsCode": getFreeModels.toString()
};
