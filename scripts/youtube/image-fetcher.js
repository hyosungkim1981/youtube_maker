#!/usr/bin/env node

/**
 * image-fetcher.js
 *
 * images_plan.json 을 읽어 각 장면용 이미지를 준비하고
 * /output/{date}/images_{n}/image_{k}.png, images_meta.json 에 저장한다.
 *
 * NOTE:
 * - 실제 이미지 검색/생성 API 연동은 추후 구현. 현재는 placeholder PNG를 생성한다.
 */

const fs = require('fs');
const path = require('path');

const { ensureDirExists, writeJson } = require('./keyword-collector.js');

// Minimal 1x1 grey PNG (valid PNG file, no external deps)
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function createPlaceholderPng() {
  return Buffer.from(MINIMAL_PNG_BASE64, 'base64');
}

function fetchFromPlan(planPath) {
  const raw = fs.readFileSync(planPath, 'utf8');
  const plan = JSON.parse(raw);
  const imagesDir = path.dirname(planPath);
  ensureDirExists(imagesDir);
  const png = createPlaceholderPng();
  const images = [];
  for (const scene of plan.scenes) {
    const k = scene.sceneIndex;
    const fileName = `image_${k}.png`;
    const filePath = path.join(imagesDir, fileName);
    fs.writeFileSync(filePath, png, null);
    images.push({
      sceneIndex: k,
      file: fileName,
      source: 'placeholder',
      prompt: scene.searchPrompt || '',
    });
  }
  const meta = {
    scriptFile: plan.scriptFile,
    images,
  };
  const metaPath = path.join(imagesDir, 'images_meta.json');
  writeJson(metaPath, meta);
  return { metaPath, imagesDir, imageCount: images.length };
}

function run({ baseDir = process.cwd(), now = new Date() } = {}) {
  const { getOutputDir } = require('./keyword-collector.js');
  const outputDir = getOutputDir(baseDir, now);
  const results = [];
  for (let n = 1; n <= 5; n++) {
    const planPath = path.join(outputDir, `images_${n}`, 'images_plan.json');
    if (!fs.existsSync(planPath)) continue;
    const r = fetchFromPlan(planPath);
    results.push(r);
  }
  if (results.length === 0) {
    throw new Error('No images_plan.json found. Run image-planner first.');
  }
  return { outputDir, results };
}

module.exports = {
  createPlaceholderPng,
  fetchFromPlan,
  run,
};

if (require.main === module) {
  try {
    const { results } = run();
    console.log(`Fetched placeholder images for ${results.length} video(s)`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
