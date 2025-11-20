const parseYaml = function() {
  const YAML = require('yaml');
  let response = $input.first().json.output;
  let responseText = response
          .replace(/^(\n)+/, '')
          .replace(/^yaml/, '')
          .replace(/^```yaml/, '')
          .trimEnd()
            .replace(/```$/, '');
  $input.first().json = YAML.parse(responseText, options={uniqueKeys: false}); 
  return $input.first();
};

module.exports = {
  "jsCode": parseYaml.toString()
};