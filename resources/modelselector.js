const modelselector = () => {
	class ModelSelector {
		constructor() {
			this.aiLanguageModels = $('Loop Over Items').all().map(data => data.json);
			this.lastUsedMainModel = null;
		}

		get allModels() {
			const candidates = this.getOtherModels(this.lastUsedMainModel);
			const mainModel = candidates[this.getRandomNum(candidates.length)];
			this.lastUsedMainModel = mainModel;
			return { mainModel, otherModels: this.getOtherModels(mainModel) };
		}

		getOtherModels(mainModel) {
			return mainModel ? 
				this.aiLanguageModels.filter(data => data.model != mainModel.model) : 
				this.aiLanguageModels;
		}

		getRandomNum(length) {
			return Math.floor(Math.random() * length);
		}
	}

	const workflowStaticData = $getWorkflowStaticData('global');
	workflowStaticData.ModelSelector = new ModelSelector()

	return workflowStaticData
}

module.exports = {
	"code": {
		"execute": {
			"code": modelselector.toString() 
		}
	},
	"inputs": {
		"input": [
			{
				"type": "main",
				"maxConnections": 1
			}
		]
	},
	"outputs": {
		"output": [
			{
				"type": "main"
			}
		]
	}
};
