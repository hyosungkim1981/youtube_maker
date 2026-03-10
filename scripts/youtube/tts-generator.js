#!/usr/bin/env node

/**
 * tts-generator.js
 *
 * script_{n}.md 를 기반으로 나레이션 오디오 파일을 생성해
 * /output/{date}/audio_{n}.wav 로 저장한다.
 *
 * NOTE:
 * - 기본 구현은 외부 TTS API 없이도 동작하도록 "무음 WAV"를 생성한다.
 * - OpenAI TTS 연동:
 *   - TTS_PROVIDER=openai
 *   - OPENAI_API_KEY=...
 *   - OPENAI_TTS_MODEL=... (기본: gpt-4o-mini-tts)
 *   - OPENAI_TTS_VOICE=... (기본: alloy)
 * - 키가 없거나 호출 실패 시 무음 WAV로 폴백한다.
 */

const fs = require('fs');
const path = require('path');

const { getOutputDir, ensureDirExists } = require('./keyword-collector.js');
const { scriptToLines } = require('./subtitle-generator.js');

const DEFAULT_DURATION_SEC = 300;
const SAMPLE_RATE = 16000;
const DEFAULT_TTS_PROVIDER = 'silence';
const DEFAULT_OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_OPENAI_TTS_VOICE = 'alloy';

function getTtsProvider() {
  return (process.env.TTS_PROVIDER || DEFAULT_TTS_PROVIDER).toLowerCase();
}

function getOpenAIKey() {
  return process.env.OPENAI_API_KEY || '';
}

async function synthesizeOpenAIWav(text) {
  const key = getOpenAIKey();
  if (!key) return null;

  const model = process.env.OPENAI_TTS_MODEL || DEFAULT_OPENAI_TTS_MODEL;
  const voice = process.env.OPENAI_TTS_VOICE || DEFAULT_OPENAI_TTS_VOICE;

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      format: 'wav',
    }),
  });

  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  // WAV should start with RIFF
  if (buf.length < 12 || buf.slice(0, 4).toString('utf8') !== 'RIFF') {
    return null;
  }
  return buf;
}

function writeWavSilence(filePath, durationSec, sampleRate = SAMPLE_RATE) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const dataSize = numSamples * blockAlign;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const data = Buffer.alloc(dataSize); // zero = silence
  ensureDirExists(path.dirname(filePath));
  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}

function estimateDurationSecFromScript(scriptContent) {
  const lines = scriptToLines(scriptContent);
  const text = lines.join(' ');
  const chars = text.replace(/\s/g, '').length;
  // 매우 러프한 휴리스틱: 한국어 1초당 6~8자 수준 → 7자로 가정
  return Math.min(DEFAULT_DURATION_SEC, Math.max(30, Math.round(chars / 7)));
}

async function generateAudioForScript(scriptPath, outputPath) {
  const script = fs.readFileSync(scriptPath, 'utf8');
  const provider = getTtsProvider();
  const lines = scriptToLines(script);
  const text = lines.join(' ');

  if (provider === 'openai') {
    try {
      const wav = await synthesizeOpenAIWav(text);
      if (wav) {
        ensureDirExists(path.dirname(outputPath));
        fs.writeFileSync(outputPath, wav);
        return { outputPath, durationSec: null, provider: 'openai' };
      }
    } catch {
      // fall through to silence
    }
  }

  const durationSec = estimateDurationSecFromScript(script);
  writeWavSilence(outputPath, durationSec);
  return { outputPath, durationSec, provider: 'silence' };
}

async function run({ baseDir = process.cwd(), now = new Date() } = {}) {
  const outputDir = getOutputDir(baseDir, now);
  ensureDirExists(outputDir);
  const results = [];
  for (let n = 1; n <= 5; n++) {
    const scriptPath = path.join(outputDir, `script_${n}.md`);
    if (!fs.existsSync(scriptPath)) continue;
    const outPath = path.join(outputDir, `audio_${n}.wav`);
    // sequential to avoid rate limits; can be parallelized with a limit later
    // eslint-disable-next-line no-await-in-loop
    results.push(await generateAudioForScript(scriptPath, outPath));
  }
  if (results.length === 0) {
    throw new Error('No script_*.md found. Run script-writer first.');
  }
  return { outputDir, audios: results };
}

module.exports = {
  writeWavSilence,
  estimateDurationSecFromScript,
  generateAudioForScript,
  run,
  DEFAULT_DURATION_SEC,
  SAMPLE_RATE,
  getTtsProvider,
  synthesizeOpenAIWav,
};

if (require.main === module) {
  run()
    .then(({ audios }) => {
      console.log(`Wrote ${audios.length} audio file(s)`);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

