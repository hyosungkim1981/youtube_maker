const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  readJson,
  extractKeywords,
  mergeAndRank,
  selectFiveTopics,
  validateTopicsSchema,
  selectTopicsFromKeywords,
  run,
} = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'topic-selector.js'));

const { collectKeywords } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'keyword-collector.js'));

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-topics-'));
}

function runTests() {
  console.log('\n=== Testing scripts/youtube/topic-selector.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('extractKeywords returns empty for invalid payload', () => {
    assert.deepStrictEqual(extractKeywords(null), []);
    assert.deepStrictEqual(extractKeywords({}), []);
    assert.deepStrictEqual(extractKeywords({ items: null }), []);
  })) passed++; else failed++;

  if (test('extractKeywords parses items with keyword, origin, frequency', () => {
    const payload = {
      source: 'youtube',
      items: [
        { keyword: 'AI', origin: 'tech', frequency: 10 },
        { keyword: '뉴스', frequency: 5 },
      ],
    };
    const out = extractKeywords(payload);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].keyword, 'AI');
    assert.strictEqual(out[0].frequency, 10);
    assert.strictEqual(out[1].keyword, '뉴스');
    assert.strictEqual(out[1].frequency, 5);
  })) passed++; else failed++;

  if (test('mergeAndRank merges and sorts by frequency', () => {
    const trending = [
      { keyword: 'AI', origin: 'yt', frequency: 10 },
      { keyword: '경제', origin: 'yt', frequency: 5 },
    ];
    const news = [
      { keyword: 'AI', origin: 'news', frequency: 3 },
      { keyword: '정치', origin: 'news', frequency: 8 },
    ];
    const ranked = mergeAndRank(trending, news);
    assert.strictEqual(ranked.length, 3);
    assert.strictEqual(ranked[0].keyword, 'AI');
    assert.strictEqual(ranked[0].frequency, 13);
  })) passed++; else failed++;

  if (test('selectFiveTopics returns exactly 5 topics', () => {
    const ranked = [
      { keyword: 'A', frequency: 10, sources: ['yt'] },
      { keyword: 'B', frequency: 8, sources: ['news'] },
    ];
    const topics = selectFiveTopics(ranked);
    assert.strictEqual(topics.length, 5);
    assert.strictEqual(topics[0].title, 'A');
    assert.strictEqual(topics[0].key_points.length, 3);
    assert.ok(Array.isArray(topics[0].related_keywords));
  })) passed++; else failed++;

  if (test('validateTopicsSchema rejects invalid topics', () => {
    assert.strictEqual(validateTopicsSchema([]).ok, false);
    assert.strictEqual(validateTopicsSchema([{}, {}, {}, {}, {}]).ok, false);
    const valid = [
      { id: 1, title: 'T', summary: 'S', reason: 'R', key_points: ['a', 'b', 'c'], related_keywords: [] },
      { id: 2, title: 'T', summary: 'S', reason: 'R', key_points: ['a', 'b', 'c'], related_keywords: [] },
      { id: 3, title: 'T', summary: 'S', reason: 'R', key_points: ['a', 'b', 'c'], related_keywords: [] },
      { id: 4, title: 'T', summary: 'S', reason: 'R', key_points: ['a', 'b', 'c'], related_keywords: [] },
      { id: 5, title: 'T', summary: 'S', reason: 'R', key_points: ['a', 'b', 'c'], related_keywords: [] },
    ];
    assert.strictEqual(validateTopicsSchema(valid).ok, true);
  })) passed++; else failed++;

  if (test('selectTopicsFromKeywords reads files and writes topics.json', () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const trendingPath = path.join(baseDir, 'output', '2025-01-08', 'trending_keywords.json');
    const newsPath = path.join(baseDir, 'output', '2025-01-08', 'news_keywords.json');
    fs.writeFileSync(trendingPath, JSON.stringify({
      source: 'youtube',
      range: { from: '2025-01-01', to: '2025-01-08' },
      items: [
        { keyword: 'AI', origin: 'tech', frequency: 10 },
        { keyword: '경제', origin: 'biz', frequency: 5 },
      ],
    }, null, 2));
    fs.writeFileSync(newsPath, JSON.stringify({
      source: 'news',
      range: { from: '2025-01-01', to: '2025-01-08' },
      items: [
        { keyword: 'AI', origin: 'news', frequency: 3 },
        { keyword: '정치', origin: 'news', frequency: 8 },
      ],
    }, null, 2));

    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    const { topicsPath, topics } = selectTopicsFromKeywords({
      trendingPath,
      newsPath,
      outputDir,
      dateStr: '2025-01-08',
    });

    assert.ok(fs.existsSync(topicsPath));
    const written = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
    assert.strictEqual(written.date, '2025-01-08');
    assert.strictEqual(written.topics.length, 5);
  })) passed++; else failed++;

  if (test('run() requires keyword-collector output and produces topics.json', () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    const trendingPath = path.join(outputDir, 'trending_keywords.json');
    const newsPath = path.join(outputDir, 'news_keywords.json');
    fs.writeFileSync(trendingPath, JSON.stringify({ source: 'youtube', range: {}, items: [{ keyword: '테스트', frequency: 1 }] }, null, 2));
    fs.writeFileSync(newsPath, JSON.stringify({ source: 'news', range: {}, items: [{ keyword: '뉴스', frequency: 1 }] }, null, 2));

    const result = run({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    assert.ok(fs.existsSync(result.topicsPath));
    assert.strictEqual(result.topics.length, 5);
  })) passed++; else failed++;

  if (test('run() throws when input files missing', () => {
    const baseDir = createTempDir();
    assert.throws(
      () => run({ baseDir, now: new Date('2025-01-08T12:00:00Z') }),
      /Missing input files/
    );
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
