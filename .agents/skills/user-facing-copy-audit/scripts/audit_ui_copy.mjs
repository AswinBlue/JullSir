#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Forbidden patterns that represent developer-centric constraints or internal technical specs
const FORBIDDEN_RULES = [
  {
    regex: /(100%[\s]*무료|완전[\s]*무료)/g,
    name: '100% 무료 / 완전 무료',
    suggestion: '"실시간 대기열", "스마트 알림", "간편한 시작"'
  },
  {
    regex: /(비용[\s]*0원|0원[\s]*운영|Zero-Cost)/gi,
    name: '비용 0원 / Zero-Cost',
    suggestion: '"부담 없이 시작하는", "스마트 대기열 서비스"'
  },
  {
    regex: /(Free[\s]*Tier|프리티어|무료[\s]*티어)/gi,
    name: 'Free Tier / 무료 티어',
    suggestion: 'UI 노출 배제 또는 "누구나 간편하게"'
  },
  {
    regex: /Cloud[\s]*Queueing[\s]*Solution/gi,
    name: 'Cloud Queueing Solution',
    suggestion: '"스마트 실시간 대기열 서비스"'
  },
  {
    regex: /원자적[\s]*동시성/g,
    name: '원자적 동시성',
    suggestion: '"중복 없는 안전한 순번 발급"'
  },
  {
    regex: /(WebSocket|Serverless|Postgres|RPC[\s]*함수)/gi,
    name: '엔지니어링 아키텍처 용어',
    suggestion: '"실시간 동기화", "안전한 시스템"'
  }
];

// Target directories and extensions to scan
const SCAN_EXTENSIONS = ['.tsx', '.jsx', '.html'];
const IGNORE_DIRS = ['node_modules', 'dist', '.git', '.agents', 'Knowledges', 'tests', 'supabase'];

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (SCAN_EXTENSIONS.includes(path.extname(file))) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[36m%s\x1b[0m', '   JullSir User-Facing Copy Audit Scanner');
console.log('\x1b[36m%s\x1b[0m', '==================================================');

const rootDir = process.cwd();
const filesToScan = [
  ...getAllFiles(path.join(rootDir, 'src')),
  path.join(rootDir, 'index.html')
].filter(f => fs.existsSync(f));

let totalViolations = 0;
const report = [];

for (const filePath of filesToScan) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((lineText, lineIdx) => {
    // Skip code-only comments or import statements
    const trimmed = lineText.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    FORBIDDEN_RULES.forEach(rule => {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(lineText)) !== null) {
        totalViolations++;
        report.push({
          file: path.relative(rootDir, filePath),
          line: lineIdx + 1,
          matched: match[0],
          rule: rule.name,
          suggestion: rule.suggestion,
          snippet: lineText.trim()
        });
      }
    });
  });
}

if (totalViolations > 0) {
  console.log('\x1b[31m%s\x1b[0m', `\n❌ 총 ${totalViolations}건의 개발자 중심 문구 위반이 발견되었습니다:\n`);

  report.forEach((item, idx) => {
    console.log(`[${idx + 1}] \x1b[33m${item.file}:${item.line}\x1b[0m`);
    console.log(`    발견된 단어: \x1b[31m"${item.matched}"\x1b[0m (분류: ${item.rule})`);
    console.log(`    권장 대체어: \x1b[32m${item.suggestion}\x1b[0m`);
    console.log(`    코드 내용  : ${item.snippet}`);
    console.log('');
  });

  console.log('\x1b[33m%s\x1b[0m', '💡 가이드라인 참고: .agents/skills/user-facing-copy-audit/references/developer_terms_lexicon.md');
  process.exit(1);
} else {
  console.log('\x1b[32m%s\x1b[0m', '\n✅ 축하합니다! 모든 UI 화면에 개발자 중심 문구가 없으며 사용자 친화적입니다.');
  console.log(`검사 완료된 파일 수: ${filesToScan.length}개\n`);
  process.exit(0);
}
