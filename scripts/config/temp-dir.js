const os = require('os');
const path = require('path');
const fs = require('fs');

const isLocal = process.env.NODE_ENV !== 'prod';
const tmpDir = isLocal ? path.join(__dirname, '../../tmp') : os.tmpdir();

// 로컬 환경일 경우 tmp 디렉토리 생성
if (isLocal && !fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

module.exports = { tmpDir, isLocal };
