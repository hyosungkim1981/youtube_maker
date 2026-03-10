const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  buildScriptFromTopic,
  validateScript,
  writeScriptForTopic,
  run,
} = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'script-writer.js'));

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
    if (err.stack) console.log(`    Stack: ${err.stack}`);
    return false;
  }
}

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-scripts-'));
}

function runTests() {
  console.log('\n=== Testing scripts/youtube/script-writer.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('buildScriptFromTopic produces markdown with sections', () => {
    const topic = {
      id: 1,
      title: 'AI 트렌드',
      summary: 'AI 관련 요약',
      key_points: ['포인트1', '포인트2', '포인트3'],
      related_keywords: ['AI'],
    };
    const content = buildScriptFromTopic(topic);
    assert.ok(content.includes('# AI 트렌드'));
    assert.ok(/##\s*1\.\s*오프닝/i.test(content));
    assert.ok(/##\s*2\.\s*본문\s*전개/i.test(content));
    assert.ok(/##\s*3\.\s*마무리/i.test(content));
    assert.ok(content.includes('포인트1'));
  })) passed++; else failed++;

  if (test('validateScript passes for well-formed script', () => {
    const good = [
      '# 제목',
      '',
      '## 1. 오프닝',
      '',
      '안녕하세요. 오늘은 테스트입니다. 이 영상에서는 주요 내용을 다룹니다.',
      '',
      '## 2. 본문 전개',
      '',
      '본문 내용이 여기 있습니다. 충분한 분량을 확보하기 위한 추가 문장들입니다.',
      '',
      '## 3. 마무리',
      '',
      '감사합니다. 구독과 좋아요 부탁드립니다.',
    ].join('\n');
    const v = validateScript(good);
    assert.strictEqual(v.ok, true);
    assert.strictEqual(v.structureOk, true);
  })) passed++; else failed++;

  if (test('validateScript fails for missing sections', () => {
    const bad = '# 제목\n\n본문만 있음';
    const v = validateScript(bad);
    assert.strictEqual(v.ok, false);
  })) passed++; else failed++;

  if (test('writeScriptForTopic writes file and returns path', () => {
    const tmp = createTempDir();
    const topic = {
      title: '테스트',
      summary: '요약',
      key_points: ['a', 'b', 'c'],
    };
    const { scriptPath, charCount } = writeScriptForTopic(topic, 1, tmp);
    assert.ok(fs.existsSync(scriptPath));
    assert.strictEqual(path.basename(scriptPath), 'script_1.md');
    assert.ok(charCount > 0);
  })) passed++; else failed++;

  if (test('run() requires topic-selector output and produces script files', () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.writeFileSync(
      path.join(outputDir, 'trending_keywords.json'),
      JSON.stringify({ source: 'youtube', range: {}, items: [{ keyword: '테스트', frequency: 1 }] }, null, 2)
    );
    fs.writeFileSync(
      path.join(outputDir, 'news_keywords.json'),
      JSON.stringify({ source: 'news', range: {}, items: [{ keyword: '뉴스', frequency: 1 }] }, null, 2)
    );
    runTopicSelector({ baseDir, now: new Date('2025-01-08T12:00:00Z') });

    const { scripts } = run({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    assert.strictEqual(scripts.length, 5);
    for (let i = 1; i <= 5; i++) {
      const p = path.join(outputDir, `script_${i}.md`);
      assert.ok(fs.existsSync(p), `script_${i}.md should exist`);
    }
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
