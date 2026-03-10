#!/usr/bin/env node

/**
 * video-assembler.js
 *
 * script_{n}.md, images_{n}/images_meta.json 를 사용해 FFmpeg으로
 * 5분 분량 영상 초안을 합성하고 /output/{date}/video_{n}.mp4 에 저장한다.
 *
 * NOTE:
 * - FFmpeg 미설치 시 해당 영상은 스킵하고 로그만 남긴다 (파이프라인은 계속 진행).
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const { getOutputDir, ensureDirExists } = require('./keyword-collector.js');

const TARGET_DURATION_SEC = 300;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore', windowsHide: true });
    return 'ffmpeg';
  } catch {
    return null;
  }
}

function buildConcatList(imagesDir, meta, durationSec) {
  const images = meta.images || [];
  const count = Math.max(images.length, 1);
  const durationPerImage = durationSec / count;
  const lines = [];
  for (let i = 0; i < images.length; i++) {
    const file = images[i].file;
    const absPath = path.join(imagesDir, file);
    if (!fs.existsSync(absPath)) continue;
    lines.push(`file '${path.basename(absPath)}'`);
    lines.push(`duration ${durationPerImage}`);
  }
  if (lines.length === 0) {
    return null;
  }
  const last = images[images.length - 1];
  if (last) {
    lines.push(`file '${last.file}'`);
  }
  return lines.join('\n');
}

function assembleVideo(imagesDir, metaPath, outputPath, durationSec = TARGET_DURATION_SEC) {
  const meta = readJson(metaPath);
  const listContent = buildConcatList(imagesDir, meta, durationSec);
  if (!listContent) {
    return { ok: false, reason: 'no images' };
  }
  const listPath = path.join(imagesDir, 'concat_list.txt');
  fs.writeFileSync(listPath, listContent, 'utf8');

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    return { ok: false, reason: 'ffmpeg not found' };
  }

  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
  ];

  // Optional audio track
  const outputDir = path.dirname(outputPath);
  const match = outputPath.match(/video_(\d+)\.mp4$/);
  const n = match ? match[1] : null;
  const audioPath = n ? path.join(outputDir, `audio_${n}.wav`) : null;
  if (audioPath && fs.existsSync(audioPath)) {
    args.push('-i', audioPath);
    args.push('-c:a', 'aac');
    args.push('-shortest');
  }

  args.push(
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-t', String(durationSec),
    outputPath,
  );

  const result = spawnSync(ffmpeg, args, {
    cwd: imagesDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    return { ok: false, reason: result.stderr?.slice(-200) || 'ffmpeg failed' };
  }
  if (!fs.existsSync(outputPath)) {
    return { ok: false, reason: 'output file not created' };
  }
  return { ok: true, path: outputPath };
}

function run({ baseDir = process.cwd(), now = new Date() } = {}) {
  const outputDir = getOutputDir(baseDir, now);
  ensureDirExists(outputDir);
  const summary = { success: [], skipped: [] };
  for (let n = 1; n <= 5; n++) {
    const imagesDir = path.join(outputDir, `images_${n}`);
    const metaPath = path.join(imagesDir, 'images_meta.json');
    const outputPath = path.join(outputDir, `video_${n}.mp4`);
    if (!fs.existsSync(metaPath)) {
      summary.skipped.push({ n, reason: 'no images_meta.json' });
      continue;
    }
    const result = assembleVideo(imagesDir, metaPath, outputPath);
    if (result.ok) {
      summary.success.push(n);
    } else {
      summary.skipped.push({ n, reason: result.reason || 'unknown' });
    }
  }
  return { outputDir, summary };
}

module.exports = {
  findFfmpeg,
  buildConcatList,
  assembleVideo,
  run,
};

if (require.main === module) {
  try {
    const { outputDir, summary } = run();
    console.log(`Video assembly: ${summary.success.length} ok, ${summary.skipped.length} skipped`);
    if (summary.skipped.length) {
      summary.skipped.forEach((s) => console.warn(`  video_${s.n}: ${s.reason}`));
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
