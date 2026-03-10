#!/usr/bin/env node

/**
 * image-fetcher.js
 *
 * images_plan.json 을 읽어 각 장면용 이미지를 준비하고
 * /output/{date}/images_{n}/image_{k}.png, images_meta.json 에 저장한다.
 *
 * NOTE:
 * - 기본은 placeholder PNG를 생성한다.
 * - 환경변수로 이미지 검색/생성 API를 연동할 수 있다.
 *   - IMAGE_PROVIDER=placeholder|pexels|openai (기본: placeholder)
 *   - PEXELS_API_KEY=... (pexels 사용 시)
 *   - OPENAI_API_KEY=... (openai 사용 시)
 */

const fs = require('fs');
const path = require('path');

const { ensureDirExists, writeJson } = require('./keyword-collector.js');

// Minimal 1x1 grey PNG (valid PNG file, no external deps)
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function createPlaceholderPng() {
  return Buffer.from(MINIMAL_PNG_BASE64, 'base64');
}

function getImageProvider() {
  return (process.env.IMAGE_PROVIDER || 'placeholder').toLowerCase();
}

async function downloadToFile(url, filePath) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`download failed: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
}

async function fetchFromPexels(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const url = `https://api.pexels.com/v1/search?per_page=1&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.photos?.[0];
  const imgUrl = first?.src?.large || first?.src?.original;
  return typeof imgUrl === 'string' ? imgUrl : null;
}

async function fetchFromOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const url = data?.data?.[0]?.url;
  return typeof url === 'string' ? url : null;
}

async function fetchFromPlan(planPath) {
  const raw = fs.readFileSync(planPath, 'utf8');
  const plan = JSON.parse(raw);
  const imagesDir = path.dirname(planPath);
  ensureDirExists(imagesDir);
  const provider = getImageProvider();
  const png = createPlaceholderPng();
  const images = [];
  for (const scene of plan.scenes) {
    const k = scene.sceneIndex;
    const fileName = `image_${k}.png`;
    const filePath = path.join(imagesDir, fileName);
    let source = 'placeholder';
    let usedUrl = null;
    if (provider === 'pexels') {
      usedUrl = await fetchFromPexels(scene.searchPrompt || scene.description || 'background');
    } else if (provider === 'openai') {
      usedUrl = await fetchFromOpenAI(scene.searchPrompt || scene.description || 'background');
    }
    try {
      if (usedUrl) {
        await downloadToFile(usedUrl, filePath);
        source = provider;
      } else {
        fs.writeFileSync(filePath, png, null);
      }
    } catch {
      fs.writeFileSync(filePath, png, null);
      source = 'placeholder';
      usedUrl = null;
    }
    images.push({
      sceneIndex: k,
      file: fileName,
      source,
      prompt: scene.searchPrompt || '',
      url: usedUrl || undefined,
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

async function run({ baseDir = process.cwd(), now = new Date() } = {}) {
  const { getOutputDir } = require('./keyword-collector.js');
  const outputDir = getOutputDir(baseDir, now);
  const results = [];
  for (let n = 1; n <= 5; n++) {
    const planPath = path.join(outputDir, `images_${n}`, 'images_plan.json');
    if (!fs.existsSync(planPath)) continue;
    const r = await fetchFromPlan(planPath);
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
  getImageProvider,
};

if (require.main === module) {
  run()
    .then(({ results }) => {
      console.log(`Fetched images for ${results.length} video(s)`);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
