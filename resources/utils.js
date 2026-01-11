function getFunctionBodyRegex(func) {
  const funcString = func.toString();
  const bodyMatch = /\{([\s\S]*)\}/m.exec(funcString);
  if (bodyMatch && bodyMatch.length > 1) {
    return bodyMatch[1].trim();
  }
  return "";
}

module.exports = { getFunctionBodyRegex };
