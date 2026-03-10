#!/usr/bin/env node

/**
 * review-report.js
 *
 * topics.json 과 script_{n}.md 를 읽어 검수용 리포트를 생성하고
 * /output/{date}/review_report.md 에 저장한다.
 */

const fs = require('fs');
const path = require('path');

const { formatDate, getOutputDir, ensureDirExists } = require('./keyword-collector.js');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function buildReportSection(index, topic, scriptContent) {
  const title = topic?.title || `영상 ${index}`;
  const summary = topic?.summary || '(요약 없음)';
  const points = Array.isArray(topic?.key_points) ? topic.key_points : [];
  const keywords = Array.isArray(topic?.related_keywords) ? topic.related_keywords : [];
  const firstLine = scriptContent.split('\n').find((l) => l.trim().length > 0) || title;

  return [
    `## 영상 ${index}`,
    '',
    `- **주제:** ${title}`,
    `- **요약:** ${summary}`,
    '',
    '**핵심 포인트:**',
    ...points.map((p) => `  - ${p}`),
    '',
    '**민감/주의 포인트:**',
    '  - 업로드 전 내용·저작권 검토 권장',
    '',
    `- **권장 제목:** ${title} | 최신 트렌드 요약`,
    `- **권장 태그:** ${keywords.slice(0, 5).join(', ') || title}`,
    '',
  ].join('\n');
}

function run({ baseDir = process.cwd(), now = new Date() } = {}) {
  const outputDir = getOutputDir(baseDir, now);
  const topicsPath = path.join(outputDir, 'topics.json');
  if (!fs.existsSync(topicsPath)) {
    throw new Error('Missing topics.json. Run topic-selector first.');
  }

  const { topics, date: topicsDate } = readJson(topicsPath);
  const dateStr = topicsDate || formatDate(now);

  ensureDirExists(outputDir);
  const sections = [];
  for (let n = 1; n <= 5; n++) {
    const scriptPath = path.join(outputDir, `script_${n}.md`);
    const topic = Array.isArray(topics) && topics[n - 1] ? topics[n - 1] : {};
    const scriptContent = fs.existsSync(scriptPath)
      ? fs.readFileSync(scriptPath, 'utf8')
      : '';
    sections.push(buildReportSection(n, topic, scriptContent));
  }

  const report = [
    `# ${dateStr} 유튜브 영상 검수 리포트`,
    '',
    '아래 5개 영상에 대해 검수 후 업로드해 주세요.',
    '',
    '---',
    '',
    ...sections,
  ].join('\n');

  const reportPath = path.join(outputDir, 'review_report.md');
  fs.writeFileSync(reportPath, report, 'utf8');
  return { outputDir, reportPath };
}

module.exports = {
  buildReportSection,
  run,
};

if (require.main === module) {
  try {
    const { reportPath } = run();
    console.log(`Wrote review report to ${reportPath}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
