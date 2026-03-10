#!/usr/bin/env node

/**
 * image-planner.js
 *
 * script_{n}.md 를 읽어 장면 단위로 분할하고, 각 장면에 필요한 이미지 계획을
 * /output/{date}/images_{n}/images_plan.json 에 저장한다.
 */

const fs = require('fs');
const path = require('path');

const { getOutputDir, ensureDirExists, writeJson } = require('./keyword-collector.js');

const DEFAULT_DURATION_SEC = 300;
const MIN_SCENES = 8;

function parseScriptSections(content) {
  const sections = [];
  const lines = content.split('\n');
  let current = { title: '', lines: [] };
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      if (current.title || current.lines.length) {
        sections.push({ ...current, body: current.lines.join('\n').trim() });
      }
      current = { title: headerMatch[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.title || current.lines.length) {
    sections.push({ ...current, body: current.lines.join('\n').trim() });
  }
  return sections;
}

function planScenesFromScript(scriptPath, durationSec = DEFAULT_DURATION_SEC) {
  const content = fs.readFileSync(scriptPath, 'utf8');
  const sections = parseScriptSections(content);
  const total = Math.max(sections.length, MIN_SCENES);
  const durationPerScene = durationSec / total;
  const scenes = [];
  for (let i = 0; i < total; i++) {
    const start = i * durationPerScene;
    const end = (i + 1) * durationPerScene;
    const section = sections[i];
    const title = section?.title || `장면 ${i + 1}`;
    const hint = section?.body?.slice(0, 50) || '';
    scenes.push({
      sceneIndex: i + 1,
      timeRangeSeconds: [Math.round(start * 10) / 10, Math.round(end * 10) / 10],
      description: `${title} 구간`,
      imageType: '배경 + 텍스트',
      searchPrompt: hint ? `${title} ${hint}`.trim().slice(0, 100) : `영상 장면 ${i + 1} 배경`,
      styleHints: ['밝은 톤', '간결한 디자인'],
    });
  }
  return scenes;
}

function runForScript(scriptPath, outputDir, scriptBasename) {
  const base = path.basename(scriptPath, '.md');
  const scriptBasenameFinal = scriptBasename || base + '.md';
  const imagesDir = path.join(outputDir, base.replace('script_', 'images_'));
  const scenes = planScenesFromScript(scriptPath);
  const plan = {
    scriptFile: scriptBasenameFinal,
    scenes,
  };
  ensureDirExists(imagesDir);
  const planPath = path.join(imagesDir, 'images_plan.json');
  writeJson(planPath, plan);
  return { planPath, imagesDir, sceneCount: scenes.length };
}

function run({ baseDir = process.cwd(), now = new Date() } = {}) {
  const outputDir = getOutputDir(baseDir, now);
  const results = [];
  for (let n = 1; n <= 5; n++) {
    const scriptPath = path.join(outputDir, `script_${n}.md`);
    if (!fs.existsSync(scriptPath)) continue;
    const r = runForScript(scriptPath, outputDir, `script_${n}.md`);
    results.push(r);
  }
  if (results.length === 0) {
    throw new Error('No script_*.md found. Run script-writer first.');
  }
  return { outputDir, plans: results };
}

module.exports = {
  parseScriptSections,
  planScenesFromScript,
  runForScript,
  run,
};

if (require.main === module) {
  try {
    const { plans } = run();
    console.log(`Wrote ${plans.length} image plans`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
