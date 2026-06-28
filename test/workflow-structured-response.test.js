const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildWorkflow } = require('../scripts/lib/workflow-builder');

const agentNodeNames = [
  'Deepwiki Langchain agent',
  'Title Generator Langchain Agent',
  'Issue Analysis Langchain Agent',
  'PR Analysis Langchain Agent',
];

test('LangChain agent nodes trace parser failures for the last AI message', () => {
  const outputPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-build-')), 'workflow.json');
  const result = buildWorkflow({
    workflowPath: path.join(__dirname, '..', 'n8n.json'),
    resourcesDir: path.join(__dirname, '..', 'resources'),
    outputPath,
  });

  assert.equal(result.success, true);

  const workflow = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  for (const nodeName of agentNodeNames) {
    const node = workflow.nodes.find((candidate) => candidate.name === nodeName);
    assert.ok(node, `${nodeName} should exist`);

    const code = node.parameters.code?.execute?.code ?? node.parameters.jsCode ?? '';
    assert.match(code, /(?:parseAiMessageWithTrace|createParseAiMessageWithTrace)/, `${nodeName} should parse through a traced wrapper`);
    assert.match(code, /outputParser\.parse\(aiMessage\)/, `${nodeName} should parse the last AI message`);
    assert.match(code, /findLast\(m => m\.type === "ai"\)\?\.content/, `${nodeName} should read the last AI message content`);
    assert.match(code, /Failed to parse last AI message as structured output/, `${nodeName} should add parse context to thrown errors`);
    assert.match(code, /Last AI message:/, `${nodeName} should include the received AI message in parse errors`);
  }
});

test('Deepwiki difficulty prompt matches the lowercase schema enum', () => {
  const outputPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-build-')), 'workflow.json');
  const result = buildWorkflow({
    workflowPath: path.join(__dirname, '..', 'n8n.json'),
    resourcesDir: path.join(__dirname, '..', 'resources'),
    outputPath,
  });

  assert.equal(result.success, true);

  const workflow = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const node = workflow.nodes.find((candidate) => candidate.name === 'Deepwiki Langchain agent');
  assert.ok(node, 'Deepwiki Langchain agent should exist');

  const code = node.parameters.code?.execute?.code ?? node.parameters.jsCode ?? '';
  assert.match(code, /technicalDifficulty\.level must be one of: high, medium, low/);
  assert.match(code, /"level": "medium"/);
  assert.doesNotMatch(code, /technicalDifficulty\.level must be one of: High, Medium, Low/);
  assert.doesNotMatch(code, /"level": "Medium"/);
});
