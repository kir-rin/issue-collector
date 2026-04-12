const os = require('os');
const path = require('path');
const fs = require('fs');

const isLambda = process.env.RUNTIME_ENV === 'lambda';
const tmpDir = isLambda ? os.tmpdir() : path.join(__dirname, '../../tmp');

// 로컬 환경일 경우 tmp 디렉토리 생성
if (!isLambda && !fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

module.exports = { tmpDir, isLambda };
