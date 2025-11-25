const getTopFitIssues = function() {
    const suitabilityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    const sortedIssues = $input.first().json.output.issues.sort((a, b) => {
        const suitabilityA = suitabilityOrder[a.issueSuitability.level];
        const suitabilityB = suitabilityOrder[b.issueSuitability.level];
        return suitabilityA - suitabilityB
    }).slice(0, 3);

    return {
        "issues" : sortedIssues
    }
};
  
module.exports = {
    "jsCode": getTopFitIssues.toString()
};