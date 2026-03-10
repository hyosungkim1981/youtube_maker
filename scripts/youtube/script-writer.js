#!/usr/bin/env node

/**
 * script-writer.js
 *
 * topics.json 의 각 주제에 대해 5분 분량 스크립트 초안을 생성하고
 * /output/{date}/script_{n}.md 에 저장한다.
 *
 * NOTE:
 * - 실제 스크립트 작성은 LLM 영역. 이 스크립트는 규칙 기반 템플릿 폴백을 제공한다.
 * - LLM이 생성한 스크립트는 validateScript + writeScript 로 검증·저장 가능.
 */

const fs = require('fs');
const path = require('path');

const { formatDate, getOutputDir, ensureDirExists } = require('./keyword-collector.js');

const MIN_CHARS_5MIN = 1800;  // 5분 ±20% 하한 (한국어 말하기 기준)
const MAX_CHARS_5MIN = 3200;  // 5분 ±20% 상한

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function buildScriptFromTopic(topic) {
  const title = topic.title || '주제';
  const summary = topic.summary || '';
  const points = Array.isArray(topic.key_points) ? topic.key_points : [];
  const p1 = points[0] || '주요 포인트 1';
  const p2 = points[1] || '주요 포인트 2';
  const p3 = points[2] || '주요 포인트 3';

  const opening = [
    `안녕하세요. 오늘은 "${title}"에 대해 이야기해 보겠습니다.`,
    summary ? `${summary}` : '',
    `먼저 ${p1}부터 살펴보겠습니다.`,
  ].filter(Boolean).join('\n\n');

  const body = [
    `## ${p1}`,
    `${p1}에 대한 최신 동향과 관련 내용을 정리해 보겠습니다.`,
    '',
    `## ${p2}`,
    `${p2} 역시 많은 관심을 받고 있는 부분입니다.`,
    '',
    `## ${p3}`,
    `마지막으로 ${p3}에 대해 짚어보겠습니다.`,
  ].join('\n');

  const closing = [
    `지금까지 "${title}"에 대해 정리해 봤습니다.`,
    `도움이 되셨다면 구독과 좋아요 부탁드립니다. 감사합니다.`,
  ].join('\n\n');

  return [
    `# ${title}`,
    '',
    '## 1. 오프닝',
    '',
    opening,
    '',
    '## 2. 본문 전개',
    '',
    body,
    '',
    '## 3. 마무리',
    '',
    closing,
  ].join('\n');
}

function validateScript(content) {
  const hasTitle = /^#\s+.+$/m.test(content);
  const hasOpening = /##\s*1\.\s*오프닝/i.test(content);
  const hasBody = /##\s*2\.\s*본문\s*전개/i.test(content);
  const hasClosing = /##\s*3\.\s*마무리/i.test(content);
  const len = content.replace(/\s/g, '').length;

  const structureOk = hasTitle && hasOpening && hasBody && hasClosing;
  const lengthOk = len >= 80; // 최소 분량 (공백 제외, 템플릿/LLM 출력 모두)

  return {
    ok: structureOk && lengthOk,
    structureOk,
    lengthOk,
    charCount: len,
  };
}

function writeScriptForTopic(topic, index, outputDir) {
  const content = buildScriptFromTopic(topic);
  const validation = validateScript(content);
  if (!validation.ok) {
    throw new Error(`Script validation failed: structure=${validation.structureOk} length=${validation.lengthOk}`);
  }
  const scriptPath = path.join(outputDir, `script_${index}.md`);
  fs.writeFileSync(scriptPath, content, 'utf8');
  return { scriptPath, charCount: validation.charCount };
}

function run({ baseDir = process.cwd(), now = new Date() } = {}) {
  const outputDir = getOutputDir(baseDir, now);
  const topicsPath = path.join(outputDir, 'topics.json');
  if (!fs.existsSync(topicsPath)) {
    throw new Error('Missing topics.json. Run topic-selector first.');
  }

  const { topics } = readJson(topicsPath);
  if (!Array.isArray(topics) || topics.length === 0) {
    throw new Error('topics.json has no topics');
  }

  ensureDirExists(outputDir);
  const results = [];
  for (let i = 0; i < Math.min(5, topics.length); i++) {
    const r = writeScriptForTopic(topics[i], i + 1, outputDir);
    results.push(r);
  }
  return { outputDir, scripts: results };
}

module.exports = {
  buildScriptFromTopic,
  validateScript,
  writeScriptForTopic,
  run,
  MIN_CHARS_5MIN,
  MAX_CHARS_5MIN,
};

if (require.main === module) {
  try {
    const { outputDir, scripts } = run();
    console.log(`Wrote ${scripts.length} scripts to ${outputDir}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
