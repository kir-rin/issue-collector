const fs = require('fs');
const path = require('path');

/**
 * 노드 이름을 kebab-case로 변환
 * @param {string} name - 변환할 노드 이름
 * @returns {string} kebab-case 문자열
 */
function toKebabCase(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * resources 폴더의 모든 파일을 읽어서 Map으로 반환
 * @returns {Map<string, string>} 파일명(확장자 제외) -> 파일 내용
 */
function readResourceFiles() {
  const resourcesDir = path.join(__dirname, '../resources');
  const resourceMap = new Map();

  try {
    const files = fs.readdirSync(resourcesDir);
    
    for (const file of files) {
      const filePath = path.join(resourcesDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        const ext = path.extname(file);
        const nameWithoutExt = path.basename(file, ext);
        try {
          const moduleExports = require(filePath);

          const getResource = (resource) => {
            if (!Object.hasOwn(resource, 'jsCode') || typeof resource.jsCode !== 'string') {
              return resource;
            }
            const functionString = resource.jsCode;
            const match = functionString.match(/\{([\s\S]*)\}/m);
            // 각 줄의 시작 부분에서 탭 한 개 또는 공백 두 개만 제거하여 첫 번째 들여쓰기만 없앱니다.
            const body = match ? match[1].split('\n').map(line => line.replace(/^(\t|  )/, '')).join('\n').trim() : '';
            return { ...resource, "jsCode": body };
          };

          if (moduleExports && Object.keys(moduleExports).length > 0) {
            resourceMap.set(nameWithoutExt, getResource(moduleExports));
          }
        } catch (error) {
          console.warn(`  ⚠️  ${file} 파일을 import하는 중 오류 발생:`, error.message);
        }
      }
    }
    
    console.log(`✓ ${resourceMap.size}개의 리소스 파일을 읽었습니다.`);
    return resourceMap;
  } catch (error) {
    console.error('리소스 폴더를 읽는 중 오류 발생:', error.message);
    return resourceMap;
  }
}

/**
 * workflow를 빌드하는 메인 함수
 */
function buildWorkflow() {
  console.log('🔨 n8n workflow 빌드를 시작합니다...\n');

  // 1. workflow 파일 읽기 (인자로 받거나 기본값 사용)
  const inputFile = process.argv[2] || '.github/workflows/n8n.json';
  const workflowPath = path.join(__dirname, '..', inputFile);
  
  if (!fs.existsSync(workflowPath)) {
    console.error('❌ n8n.json 파일을 찾을 수 없습니다:', workflowPath);
    process.exit(1);
  }

  const workflowContent = fs.readFileSync(workflowPath, 'utf8');
  const workflow = JSON.parse(workflowContent);

  // 2. 리소스 파일들 읽기
  const resourceMap = readResourceFiles();

  if (resourceMap.size === 0) {
    console.warn('⚠️  리소스 파일이 없습니다. 원본 workflow를 그대로 출력합니다.');
  }

  // 3. 각 노드 순회하며 빈 필드 채우기
  let updatedCount = 0;
  
  for (const node of workflow.nodes || []) {
    const nodeName = node.name;
    const kebabName = toKebabCase(nodeName);
   
    if (node.parameters && resourceMap.has(kebabName)) {
        const resourceContent = resourceMap.get(kebabName);
        node.parameters = resourceContent;
        console.log(`  ✓ "${nodeName}" 노드의 파라미터를 업데이트했습니다. (${kebabName})`);
        updatedCount++;
    }
  }

  // 4. dist 폴더 생성 (없으면)
  const distDir = path.join(__dirname, '../dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log('\n✓ dist 폴더를 생성했습니다.');
  }

  // 5. workflow.json으로 출력
  const outputPath = path.join(distDir, 'workflow.json');
  fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2), 'utf8');

  console.log(`\n✅ 빌드 완료!`);
  console.log(`   - ${updatedCount}개의 노드를 업데이트했습니다.`);
  console.log(`   - 결과: ${outputPath}`);
}

// 스크립트 실행
if (require.main === module) {
  try {
    buildWorkflow();
  } catch (error) {
    console.error('❌ 빌드 중 오류 발생:', error);
    process.exit(1);
  }
}

module.exports = { buildWorkflow, toKebabCase, readResourceFiles };