#!/usr/bin/env node

/**
 * thumbnail-generator.js
 *
 * topics.json과 (옵션) images_1/image_*.png 를 기반으로 썸네일 후보를 생성한다.
 *
 * NOTE:
 * - 기본 구현은 placeholder PNG + 계획 JSON을 생성한다.
 * - 이후 실제 이미지 합성(텍스트 오버레이, 템플릿)을 FFmpeg 또는 이미지 라이브러리로 확장한다.
 */

const fs = require('fs');
const path = require('path');

const { getOutputDir, ensureDirExists, writeJson } = require('./keyword-collector.js');
const { createPlaceholderPng } = require('./image-fetcher.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildThumbnailPlan(topic) {
  const title = topic?.title || '오늘의 이슈';
  const keywords = Array.isArray(topic?.related_keywords) ? topic.related_keywords.slice(0, 5) : [];
  return {
    title,
    subtitle: '5분 요약',
    keywords,
    style: {
      theme: 'clean',
      textColor: '#ffffff',
      accentColor: '#ff3b30',
    },
  };
}

function generateThumbnailPlaceholder(outputPath) {
  const png = createPlaceholderPng();
  ensureDirExists(path.dirname(outputPath));
  fs.writeFileSync(outputPath, png);
}

function run({ baseDir = process.cwd(), now = new Date() } = {}) {
  const outputDir = getOutputDir(baseDir, now);
  const topicsPath = path.join(outputDir, 'topics.json');
  if (!fs.existsSync(topicsPath)) {
    throw new Error('Missing topics.json. Run topic-selector first.');
  }
  const { topics } = readJson(topicsPath);
  const results = [];
  for (let n = 1; n <= 5; n++) {
    const topic = Array.isArray(topics) ? topics[n - 1] : null;
    const plan = buildThumbnailPlan(topic);
    const planPath = path.join(outputDir, `thumbnail_${n}_plan.json`);
    const pngPath = path.join(outputDir, `thumbnail_${n}.png`);
    writeJson(planPath, plan);
    generateThumbnailPlaceholder(pngPath);
    results.push({ n, planPath, pngPath });
  }
  return { outputDir, thumbnails: results };
}

module.exports = {
  buildThumbnailPlan,
  generateThumbnailPlaceholder,
  run,
};

if (require.main === module) {
  try {
    const { thumbnails } = run();
    console.log(`Wrote ${thumbnails.length} thumbnail candidate(s)`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

