const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { buildReportSection, run } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'review-report.js'));

const { collectKeywords } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'keyword-collector.js'));
const { run: runTopicSelector } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'topic-selector.js'));
const { run: runScriptWriter } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'script-writer.js'));

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-review-'));
}

function runTests() {
  console.log('\n=== Testing scripts/youtube/review-report.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('buildReportSection includes topic title and points', () => {
    const topic = { title: 'AI', summary: '요약', key_points: ['a', 'b', 'c'], related_keywords: ['AI'] };
    const section = buildReportSection(1, topic, '# AI\n\n내용');
    assert.ok(section.includes('## 영상 1'));
    assert.ok(section.includes('**주제:** AI'));
    assert.ok(section.includes('요약'));
    assert.ok(section.includes('권장 태그'));
  })) passed++; else failed++;

  if (test('run() produces review_report.md', () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.writeFileSync(path.join(outputDir, 'trending_keywords.json'), JSON.stringify({ source: 'youtube', range: {}, items: [{ keyword: 'K', frequency: 1 }] }, null, 2));
    fs.writeFileSync(path.join(outputDir, 'news_keywords.json'), JSON.stringify({ source: 'news', range: {}, items: [{ keyword: 'N', frequency: 1 }] }, null, 2));
    runTopicSelector({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    runScriptWriter({ baseDir, now: new Date('2025-01-08T12:00:00Z') });

    const { reportPath } = run({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    assert.ok(fs.existsSync(reportPath));
    const content = fs.readFileSync(reportPath, 'utf8');
    assert.ok(content.includes('유튜브 영상 검수 리포트'));
    assert.ok(content.includes('## 영상 1'));
    assert.ok(content.includes('## 영상 5'));
  })) passed++; else failed++;

  if (test('run() throws when topics.json missing', () => {
    const baseDir = createTempDir();
    assert.throws(
      () => run({ baseDir, now: new Date('2025-01-08T12:00:00Z') }),
      /Missing topics\.json/
    );
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
