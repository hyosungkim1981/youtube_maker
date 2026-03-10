const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  formatDate,
  getOutputDir,
  ensureDirExists,
  writeJson,
  createEmptyKeywordPayload,
  collectKeywords
} = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'keyword-collector.js'));

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    if (err.stack) console.log(`    Stack: ${err.stack}`);
    return false;
  }
}

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-keywords-'));
}

function runTests() {
  console.log('\n=== Testing scripts/youtube/keyword-collector.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('formatDate returns YYYY-MM-DD string', () => {
    const d = new Date('2025-01-02T00:00:00Z');
    const s = formatDate(d);
    assert.strictEqual(s, '2025-01-02');
  })) passed++; else failed++;

  if (test('getOutputDir builds date-based output path', () => {
    const baseDir = '/project-root';
    const date = new Date('2025-01-02T00:00:00Z');
    const result = getOutputDir(baseDir, date);
    assert.strictEqual(result, path.join(baseDir, 'output', '2025-01-02'));
  })) passed++; else failed++;

  if (test('ensureDirExists creates directory recursively', () => {
    const tmp = createTempDir();
    const target = path.join(tmp, 'nested', 'dir');
    ensureDirExists(target);
    assert.ok(fs.existsSync(target), 'directory should exist');
  })) passed++; else failed++;

  if (test('writeJson writes pretty-printed JSON', () => {
    const tmp = createTempDir();
    const file = path.join(tmp, 'test.json');
    writeJson(file, { foo: 'bar' });
    const contents = fs.readFileSync(file, 'utf8').trim();
    assert.strictEqual(contents, '{\n  "foo": "bar"\n}');
  })) passed++; else failed++;

  if (test('createEmptyKeywordPayload builds empty payload with source and range', () => {
    const range = { from: '2025-01-01', to: '2025-01-08' };
    const payload = createEmptyKeywordPayload('youtube', range);
    assert.strictEqual(payload.source, 'youtube');
    assert.deepStrictEqual(payload.range, range);
    assert.ok(Array.isArray(payload.items));
    assert.strictEqual(payload.items.length, 0);
  })) passed++; else failed++;

  if (test('collectKeywords creates output directory and JSON files', () => {
    const baseDir = createTempDir();
    const now = new Date('2025-01-08T12:00:00Z');

    const { outputDir, trendingPath, newsPath } = collectKeywords({ baseDir, now });

    assert.ok(fs.existsSync(outputDir), 'outputDir should exist');
    assert.ok(fs.existsSync(trendingPath), 'trending file should exist');
    assert.ok(fs.existsSync(newsPath), 'news file should exist');

    const trending = JSON.parse(fs.readFileSync(trendingPath, 'utf8'));
    const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));

    assert.strictEqual(trending.source, 'youtube');
    assert.strictEqual(news.source, 'news');
    assert.ok(typeof trending.range.from === 'string');
    assert.strictEqual(trending.range.to, '2025-01-08');
    assert.ok(Array.isArray(trending.items));
    assert.ok(Array.isArray(news.items));
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

