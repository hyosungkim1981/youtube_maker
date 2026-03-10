#!/usr/bin/env node

/**
 * subtitle-generator.js
 *
 * script_{n}.md 를 읽어 SRT 자막 파일을 생성하고
 * /output/{date}/subtitles_{n}.srt 에 저장한다.
 *
 * NOTE:
 * - 타임스탬프는 스크립트 분량에 비례해 균등 배분 (목표 길이 기본 300초).
 * - 실제 오디오/영상이 있으면 duration 인자로 맞춰 배분 가능.
 */

const fs = require('fs');
const path = require('path');

const { getOutputDir, ensureDirExists } = require('./keyword-collector.js');

const DEFAULT_DURATION_SEC = 300; // 5 min

function scriptToLines(content) {
  const text = content
    .replace(/^#\s+.+$/gm, '')
    .replace(/^##\s+.+$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .trim();
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const time = [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
  return `${time},${String(ms).padStart(3, '0')}`;
}

function linesToSrt(lines, totalDurationSec = DEFAULT_DURATION_SEC) {
  if (lines.length === 0) {
    return '1\n00:00:00,000 --> 00:00:01,000\n(자막 없음)\n';
  }
  const durationPerLine = totalDurationSec / lines.length;
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const start = i * durationPerLine;
    const end = (i + 1) * durationPerLine;
    blocks.push(
      `${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${lines[i]}\n`
    );
  }
  return blocks.join('\n');
}

function validateSrt(content) {
  const blocks = content.trim().split(/\n\n+/);
  const timeLine = /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/;
  let ok = true;
  for (let i = 0; i < blocks.length; i++) {
    const parts = blocks[i].split('\n');
    if (parts.length < 3) {
      ok = false;
      break;
    }
    if (!/^\d+$/.test(parts[0]) || !timeLine.test(parts[1])) {
      ok = false;
      break;
    }
  }
  return ok;
}

function generateSubtitlesFromScript(scriptPath, outputPath, durationSec = DEFAULT_DURATION_SEC) {
  const content = fs.readFileSync(scriptPath, 'utf8');
  const lines = scriptToLines(content);
  const srt = linesToSrt(lines, durationSec);
  if (!validateSrt(srt)) {
    throw new Error('Generated SRT failed validation');
  }
  ensureDirExists(path.dirname(outputPath));
  fs.writeFileSync(outputPath, srt, 'utf8');
  return { outputPath, segmentCount: lines.length };
}

function run({ baseDir = process.cwd(), now = new Date(), durationSec = DEFAULT_DURATION_SEC } = {}) {
  const outputDir = getOutputDir(baseDir, now);
  const results = [];
  for (let n = 1; n <= 5; n++) {
    const scriptPath = path.join(outputDir, `script_${n}.md`);
    if (!fs.existsSync(scriptPath)) continue;
    const outPath = path.join(outputDir, `subtitles_${n}.srt`);
    const r = generateSubtitlesFromScript(scriptPath, outPath, durationSec);
    results.push(r);
  }
  if (results.length === 0) {
    throw new Error('No script_*.md found. Run script-writer first.');
  }
  return { outputDir, subtitles: results };
}

module.exports = {
  scriptToLines,
  formatSrtTime,
  linesToSrt,
  validateSrt,
  generateSubtitlesFromScript,
  run,
  DEFAULT_DURATION_SEC,
};

if (require.main === module) {
  try {
    const { subtitles } = run();
    console.log(`Wrote ${subtitles.length} subtitle files`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
