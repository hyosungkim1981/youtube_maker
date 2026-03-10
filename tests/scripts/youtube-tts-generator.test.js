const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  writeWavSilence,
  estimateDurationSecFromScript,
  generateAudioForScript,
  run,
} = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'tts-generator.js'));

const { collectKeywords } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'keyword-collector.js'));
const { run: runTopicSelector } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'topic-selector.js'));
const { run: runScriptWriter } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'script-writer.js'));

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-tts-'));
}

async function runTests() {
  console.log('\n=== Testing scripts/youtube/tts-generator.js ===\n');
  let passed = 0;
  let failed = 0;

  if (await test('estimateDurationSecFromScript returns bounded duration', async () => {
    const script = '# T\n\n## 1. 오프닝\n\n안녕하세요.\n\n## 2. 본문\n\n' + '가나다라마바사아자차카타파하'.repeat(50);
    const d = estimateDurationSecFromScript(script);
    assert.ok(d >= 30);
    assert.ok(d <= 300);
  })) passed++; else failed++;

  if (await test('writeWavSilence writes RIFF header', async () => {
    const tmp = createTempDir();
    const out = path.join(tmp, 'a.wav');
    writeWavSilence(out, 1);
    const buf = fs.readFileSync(out);
    assert.strictEqual(buf.slice(0, 4).toString('utf8'), 'RIFF');
    assert.strictEqual(buf.slice(8, 12).toString('utf8'), 'WAVE');
  })) passed++; else failed++;

  if (await test('generateAudioForScript creates audio file', async () => {
    const tmp = createTempDir();
    const scriptPath = path.join(tmp, 'script_1.md');
    fs.writeFileSync(scriptPath, '# T\n\n## 1. 오프닝\n\n안녕하세요.\n\n## 2. 본문\n\n내용.\n\n## 3. 마무리\n\n감사합니다.', 'utf8');
    const out = path.join(tmp, 'audio_1.wav');
    process.env.TTS_PROVIDER = 'openai'; // key missing -> fallback
    const r = await generateAudioForScript(scriptPath, out);
    assert.ok(fs.existsSync(out));
    const buf = fs.readFileSync(out);
    assert.strictEqual(buf.slice(0, 4).toString('utf8'), 'RIFF');
    assert.ok(r.provider === 'silence' || r.provider === 'openai');
  })) passed++; else failed++;

  if (await test('run() produces audio_*.wav for scripts', async () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.writeFileSync(path.join(outputDir, 'trending_keywords.json'), JSON.stringify({ source: 'youtube', range: {}, items: [{ keyword: 'K', frequency: 1 }] }, null, 2));
    fs.writeFileSync(path.join(outputDir, 'news_keywords.json'), JSON.stringify({ source: 'news', range: {}, items: [{ keyword: 'N', frequency: 1 }] }, null, 2));
    runTopicSelector({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    runScriptWriter({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    process.env.TTS_PROVIDER = 'openai'; // key missing -> fallback
    const { audios } = await run({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    assert.strictEqual(audios.length, 5);
    assert.ok(fs.existsSync(path.join(outputDir, 'audio_1.wav')));
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

