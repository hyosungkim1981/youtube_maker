const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { findFfmpeg, buildConcatList, assembleVideo, run } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'video-assembler.js'));
const { collectKeywords } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'keyword-collector.js'));
const { run: runTopicSelector } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'topic-selector.js'));
const { run: runScriptWriter } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'script-writer.js'));
const { run: runImagePlanner } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'image-planner.js'));
const { run: runImageFetcher } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'image-fetcher.js'));

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-vid-'));
}

function runTests() {
  console.log('\n=== Testing scripts/youtube/video-assembler.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('findFfmpeg returns string or null', () => {
    const out = findFfmpeg();
    assert.ok(out === null || out === 'ffmpeg');
  })) passed++; else failed++;

  if (test('buildConcatList returns list content when image files exist', () => {
    const tmp = createTempDir();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(path.join(tmp, 'image_1.png'), png);
    fs.writeFileSync(path.join(tmp, 'image_2.png'), png);
    const meta = {
      images: [
        { file: 'image_1.png', sceneIndex: 1 },
        { file: 'image_2.png', sceneIndex: 2 },
      ],
    };
    const content = buildConcatList(tmp, meta, 60);
    assert.ok(typeof content === 'string');
    assert.ok(content.includes('duration'));
    assert.ok(content.includes('image_1.png'));
  })) passed++; else failed++;

  if (test('buildConcatList returns null for empty images', () => {
    const content = buildConcatList('/tmp', { images: [] }, 60);
    assert.strictEqual(content, null);
  })) passed++; else failed++;

  if (test('run() returns summary with success/skipped arrays', () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.writeFileSync(path.join(outputDir, 'trending_keywords.json'), JSON.stringify({ source: 'youtube', range: {}, items: [{ keyword: 'K', frequency: 1 }] }, null, 2));
    fs.writeFileSync(path.join(outputDir, 'news_keywords.json'), JSON.stringify({ source: 'news', range: {}, items: [{ keyword: 'N', frequency: 1 }] }, null, 2));
    runTopicSelector({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    runScriptWriter({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    runImagePlanner({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    runImageFetcher({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const { summary } = run({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    assert.ok(Array.isArray(summary.success));
    assert.ok(Array.isArray(summary.skipped));
    assert.strictEqual(summary.success.length + summary.skipped.length, 5);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
