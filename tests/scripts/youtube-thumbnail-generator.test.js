const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { buildThumbnailPlan, run } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'thumbnail-generator.js'));

const { collectKeywords } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'keyword-collector.js'));
const { run: runTopicSelector } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'topic-selector.js'));

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-thumb-'));
}

function runTests() {
  console.log('\n=== Testing scripts/youtube/thumbnail-generator.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('buildThumbnailPlan uses topic title and keywords', () => {
    const plan = buildThumbnailPlan({ title: 'AI', related_keywords: ['AI', '뉴스'] });
    assert.strictEqual(plan.title, 'AI');
    assert.ok(Array.isArray(plan.keywords));
    assert.ok(plan.keywords.includes('AI'));
  })) passed++; else failed++;

  if (test('run() writes thumbnail plans and png placeholders', () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.writeFileSync(path.join(outputDir, 'trending_keywords.json'), JSON.stringify({ source: 'youtube', range: {}, items: [{ keyword: 'K', frequency: 1 }] }, null, 2));
    fs.writeFileSync(path.join(outputDir, 'news_keywords.json'), JSON.stringify({ source: 'news', range: {}, items: [{ keyword: 'N', frequency: 1 }] }, null, 2));
    runTopicSelector({ baseDir, now: new Date('2025-01-08T12:00:00Z') });

    const { thumbnails } = run({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    assert.strictEqual(thumbnails.length, 5);
    assert.ok(fs.existsSync(path.join(outputDir, 'thumbnail_1_plan.json')));
    assert.ok(fs.existsSync(path.join(outputDir, 'thumbnail_1.png')));
  })) passed++; else failed++;

  if (test('run() throws when topics.json missing', () => {
    const baseDir = createTempDir();
    assert.throws(() => run({ baseDir, now: new Date('2025-01-08T12:00:00Z') }), /Missing topics\.json/);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

