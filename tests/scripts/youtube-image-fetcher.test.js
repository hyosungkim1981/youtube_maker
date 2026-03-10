const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { createPlaceholderPng, fetchFromPlan, run } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'image-fetcher.js'));
const { collectKeywords } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'keyword-collector.js'));
const { run: runTopicSelector } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'topic-selector.js'));
const { run: runScriptWriter } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'script-writer.js'));
const { run: runImagePlanner } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'image-planner.js'));

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-imgfetch-'));
}

async function runTests() {
  console.log('\n=== Testing scripts/youtube/image-fetcher.js ===\n');
  let passed = 0;
  let failed = 0;

  if (await test('createPlaceholderPng returns Buffer', async () => {
    const buf = createPlaceholderPng();
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 0);
  })) passed++; else failed++;

  if (await test('fetchFromPlan writes PNGs and images_meta.json', async () => {
    const tmp = createTempDir();
    const planPath = path.join(tmp, 'images_plan.json');
    fs.mkdirSync(tmp, { recursive: true });
    const plan = {
      scriptFile: 'script_1.md',
      scenes: [
        { sceneIndex: 1, searchPrompt: 'A' },
        { sceneIndex: 2, searchPrompt: 'B' },
      ],
    };
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
    // Force placeholder path for deterministic tests
    process.env.IMAGE_PROVIDER = 'placeholder';
    const { metaPath, imageCount } = await fetchFromPlan(planPath);
    assert.ok(fs.existsSync(metaPath));
    assert.strictEqual(imageCount, 2);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.strictEqual(meta.images.length, 2);
    assert.ok(fs.existsSync(path.join(tmp, 'image_1.png')));
    assert.ok(fs.existsSync(path.join(tmp, 'image_2.png')));
  })) passed++; else failed++;

  if (await test('run() produces images for existing plans', async () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.writeFileSync(path.join(outputDir, 'trending_keywords.json'), JSON.stringify({ source: 'youtube', range: {}, items: [{ keyword: 'K', frequency: 1 }] }, null, 2));
    fs.writeFileSync(path.join(outputDir, 'news_keywords.json'), JSON.stringify({ source: 'news', range: {}, items: [{ keyword: 'N', frequency: 1 }] }, null, 2));
    runTopicSelector({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    runScriptWriter({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    runImagePlanner({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    // async run
    const { results } = await run({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    assert.strictEqual(results.length, 5);
    assert.ok(fs.existsSync(path.join(outputDir, 'images_1', 'images_meta.json')));
    assert.ok(fs.existsSync(path.join(outputDir, 'images_1', 'image_1.png')));
  })) passed++; else failed++;

  if (await test('run() throws when no images_plan.json found', async () => {
    const baseDir = createTempDir();
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.mkdirSync(outputDir, { recursive: true });
    await run({ baseDir, now: new Date('2025-01-08T12:00:00Z') })
      .then(() => { throw new Error('Expected error'); })
      .catch((e) => {
        assert.ok(e.message.includes('No images_plan'));
      });
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.log(`  ✗ unhandled error`);
  console.log(`    Error: ${err.message}`);
  console.log('\nResults: Passed: 0, Failed: 1');
  process.exit(1);
});
