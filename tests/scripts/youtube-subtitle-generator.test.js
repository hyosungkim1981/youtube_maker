const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  scriptToLines,
  formatSrtTime,
  linesToSrt,
  validateSrt,
  generateSubtitlesFromScript,
  run,
} = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'subtitle-generator.js'));

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-srt-'));
}

function runTests() {
  console.log('\n=== Testing scripts/youtube/subtitle-generator.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('scriptToLines strips headers and returns non-empty lines', () => {
    const md = '# Title\n\n## 1. 오프닝\n\nHello world.\n\nBye.';
    const lines = scriptToLines(md);
    assert.ok(lines.includes('Hello world.'));
    assert.ok(lines.includes('Bye.'));
    assert.ok(!lines.some((l) => l.startsWith('#')));
  })) passed++; else failed++;

  if (test('formatSrtTime formats seconds to SRT timestamp', () => {
    assert.strictEqual(formatSrtTime(0), '00:00:00,000');
    assert.strictEqual(formatSrtTime(65.5), '00:01:05,500');
  })) passed++; else failed++;

  if (test('linesToSrt produces valid SRT with index and timestamps', () => {
    const srt = linesToSrt(['First', 'Second'], 10);
    assert.ok(srt.includes('1\n'));
    assert.ok(srt.includes('00:00:00,000 -->'));
    assert.ok(srt.includes('First'));
    assert.ok(srt.includes('2\n'));
    assert.ok(srt.includes('Second'));
  })) passed++; else failed++;

  if (test('validateSrt accepts valid SRT content', () => {
    const valid = '1\n00:00:00,000 --> 00:00:02,000\nHello\n\n2\n00:00:02,000 --> 00:00:04,000\nWorld\n';
    assert.strictEqual(validateSrt(valid), true);
  })) passed++; else failed++;

  if (test('generateSubtitlesFromScript writes .srt file', () => {
    const tmp = createTempDir();
    const scriptPath = path.join(tmp, 'script_1.md');
    fs.writeFileSync(scriptPath, '# T\n\n## 1. 오프닝\n\n안녕하세요.\n\n## 2. 본문\n\n내용.\n\n## 3. 마무리\n\n감사합니다.', 'utf8');
    const outPath = path.join(tmp, 'subtitles_1.srt');
    const r = generateSubtitlesFromScript(scriptPath, outPath, 60);
    assert.ok(fs.existsSync(outPath));
    assert.ok(r.segmentCount > 0);
  })) passed++; else failed++;

  if (test('run() produces subtitles for existing scripts', () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.writeFileSync(path.join(outputDir, 'trending_keywords.json'), JSON.stringify({ source: 'youtube', range: {}, items: [{ keyword: 'A', frequency: 1 }] }, null, 2));
    fs.writeFileSync(path.join(outputDir, 'news_keywords.json'), JSON.stringify({ source: 'news', range: {}, items: [{ keyword: 'B', frequency: 1 }] }, null, 2));
    runTopicSelector({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    runScriptWriter({ baseDir, now: new Date('2025-01-08T12:00:00Z') });

    const { subtitles } = run({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    assert.strictEqual(subtitles.length, 5);
    assert.ok(fs.existsSync(path.join(outputDir, 'subtitles_1.srt')));
  })) passed++; else failed++;

  if (test('run() throws when no script_*.md found', () => {
    const baseDir = createTempDir();
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.mkdirSync(outputDir, { recursive: true });
    assert.throws(
      () => run({ baseDir, now: new Date('2025-01-08T12:00:00Z') }),
      (err) => err.message.includes('No script_')
    );
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
