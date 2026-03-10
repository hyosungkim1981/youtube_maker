const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseScriptSections, planScenesFromScript, runForScript, run } = require(path.join(__dirname, '..', '..', 'scripts', 'youtube', 'image-planner.js'));
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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-imgplan-'));
}

function runTests() {
  console.log('\n=== Testing scripts/youtube/image-planner.js ===\n');
  let passed = 0;
  let failed = 0;

  if (test('parseScriptSections splits by ## headers', () => {
    const md = '# T\n\n## 1. 오프닝\n\nHello.\n\n## 2. 본문\n\nWorld.';
    const sections = parseScriptSections(md);
    assert.ok(sections.length >= 2);
    assert.ok(sections.some((s) => s.title.includes('오프닝')));
  })) passed++; else failed++;

  if (test('planScenesFromScript returns at least MIN_SCENES', () => {
    const tmp = createTempDir();
    const scriptPath = path.join(tmp, 'script_1.md');
    fs.writeFileSync(scriptPath, '# T\n\n## 1. 오프닝\n\nA.\n\n## 2. 본문\n\nB.\n\n## 3. 마무리\n\nC.', 'utf8');
    const scenes = planScenesFromScript(scriptPath, 300);
    assert.ok(Array.isArray(scenes));
    assert.ok(scenes.length >= 8);
    assert.ok(scenes[0].sceneIndex === 1);
    assert.ok(Array.isArray(scenes[0].timeRangeSeconds));
    assert.ok(scenes[0].searchPrompt);
  })) passed++; else failed++;

  if (test('runForScript writes images_plan.json', () => {
    const tmp = createTempDir();
    const scriptPath = path.join(tmp, 'script_1.md');
    fs.writeFileSync(scriptPath, '# T\n\n## 1. 오프닝\n\nHi.\n\n## 2. 본문\n\nBye.', 'utf8');
    const { planPath, imagesDir, sceneCount } = runForScript(scriptPath, tmp, 'script_1.md');
    assert.ok(fs.existsSync(planPath));
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.strictEqual(plan.scriptFile, 'script_1.md');
    assert.ok(Array.isArray(plan.scenes));
    assert.ok(sceneCount >= 8);
  })) passed++; else failed++;

  if (test('run() produces plans for existing scripts', () => {
    const baseDir = createTempDir();
    collectKeywords({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.writeFileSync(path.join(outputDir, 'trending_keywords.json'), JSON.stringify({ source: 'youtube', range: {}, items: [{ keyword: 'K', frequency: 1 }] }, null, 2));
    fs.writeFileSync(path.join(outputDir, 'news_keywords.json'), JSON.stringify({ source: 'news', range: {}, items: [{ keyword: 'N', frequency: 1 }] }, null, 2));
    runTopicSelector({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    runScriptWriter({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    const { plans } = run({ baseDir, now: new Date('2025-01-08T12:00:00Z') });
    assert.strictEqual(plans.length, 5);
    assert.ok(fs.existsSync(path.join(outputDir, 'images_1', 'images_plan.json')));
  })) passed++; else failed++;

  if (test('run() throws when no script_*.md found', () => {
    const baseDir = createTempDir();
    const outputDir = path.join(baseDir, 'output', '2025-01-08');
    fs.mkdirSync(outputDir, { recursive: true });
    assert.throws(() => run({ baseDir, now: new Date('2025-01-08T12:00:00Z') }), (e) => e.message.includes('No script_'));
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
