#!/usr/bin/env node

/**
 * topic-selector.js
 *
 * trending_keywords.json, news_keywords.json 을 읽어
 * 5개의 영상 주제를 선정하고 /output/{date}/topics.json 에 저장한다.
 *
 * NOTE:
 * - 실제 주제 선정은 LLM(에이전트) 영역. 이 스크립트는 규칙 기반 폴백을 제공한다.
 * - LLM이 topics를 생성하면 validateTopics + writeTopics 로 검증·저장만 수행 가능.
 */

const fs = require('fs');
const path = require('path');

const { formatDate, getOutputDir, ensureDirExists, writeJson } = require('./keyword-collector.js');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function extractKeywords(payload) {
  if (!payload || !Array.isArray(payload.items)) return [];
  return payload.items.map((item) => ({
    keyword: typeof item.keyword === 'string' ? item.keyword : String(item.keyword || ''),
    origin: item.origin || payload.source || 'unknown',
    frequency: typeof item.frequency === 'number' ? item.frequency : 1,
  })).filter((item) => item.keyword.length > 0);
}

function mergeAndRank(trendingItems, newsItems) {
  const map = new Map();
  for (const item of [...trendingItems, ...newsItems]) {
    const key = item.keyword.trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    const freq = item.frequency || 1;
    if (existing) {
      existing.frequency += freq;
      existing.sources.add(item.origin);
    } else {
      map.set(key, {
        keyword: item.keyword.trim(),
        frequency: freq,
        sources: new Set([item.origin]),
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.frequency - a.frequency)
    .map((x) => ({ ...x, sources: Array.from(x.sources) }));
}

function selectFiveTopics(ranked) {
  const topics = [];
  const seen = new Set();
  for (const item of ranked) {
    if (topics.length >= 5) break;
    const kw = item.keyword;
    if (seen.has(kw)) continue;
    seen.add(kw);
    topics.push({
      id: topics.length + 1,
      title: kw,
      summary: `${kw} 관련 최신 트렌드와 뉴스를 종합한 요약`,
      reason: `빈도 ${item.frequency}, 출처: ${item.sources.join(', ')}`,
      key_points: [
        `${kw}의 최근 동향`,
        `관련 뉴스 및 이슈`,
        `시청자 관심 포인트`,
      ],
      related_keywords: [kw],
    });
  }
  while (topics.length < 5) {
    topics.push({
      id: topics.length + 1,
      title: `주제 ${topics.length + 1} (키워드 부족)`,
      summary: '추가 키워드 수집 후 보완 필요',
      reason: '키워드 수 부족으로 자동 생성',
      key_points: ['보완 필요', '추가 조사 필요', 'LLM 재선정 권장'],
      related_keywords: [],
    });
  }
  return topics.slice(0, 5);
}

function validateTopicsSchema(topics) {
  if (!Array.isArray(topics) || topics.length !== 5) {
    return { ok: false, error: 'topics must be array of length 5' };
  }
  const required = ['id', 'title', 'summary', 'reason', 'key_points', 'related_keywords'];
  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    if (!t || typeof t !== 'object') {
      return { ok: false, error: `topic ${i} is not an object` };
    }
    for (const key of required) {
      if (!(key in t)) {
        return { ok: false, error: `topic ${i} missing field: ${key}` };
      }
    }
    if (!Array.isArray(t.key_points) || t.key_points.length < 3) {
      return { ok: false, error: `topic ${i} key_points must have at least 3 items` };
    }
    if (!Array.isArray(t.related_keywords)) {
      return { ok: false, error: `topic ${i} related_keywords must be array` };
    }
  }
  return { ok: true };
}

function selectTopicsFromKeywords({ trendingPath, newsPath, outputDir, dateStr }) {
  const trending = readJson(trendingPath);
  const news = readJson(newsPath);
  const trendingItems = extractKeywords(trending);
  const newsItems = extractKeywords(news);
  const ranked = mergeAndRank(trendingItems, newsItems);
  const topics = selectFiveTopics(ranked);
  const validation = validateTopicsSchema(topics);
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  const payload = { date: dateStr || formatDate(new Date()), topics };
  const topicsPath = path.join(outputDir, 'topics.json');
  ensureDirExists(outputDir);
  writeJson(topicsPath, payload);
  return { topicsPath, topics };
}

function run({ baseDir = process.cwd(), now = new Date() } = {}) {
  const outputDir = getOutputDir(baseDir, now);
  const dateStr = formatDate(now);
  const trendingPath = path.join(outputDir, 'trending_keywords.json');
  const newsPath = path.join(outputDir, 'news_keywords.json');
  if (!fs.existsSync(trendingPath) || !fs.existsSync(newsPath)) {
    throw new Error(`Missing input files. Run keyword-collector first.`);
  }
  return selectTopicsFromKeywords({
    trendingPath,
    newsPath,
    outputDir,
    dateStr,
  });
}

module.exports = {
  readJson,
  extractKeywords,
  mergeAndRank,
  selectFiveTopics,
  validateTopicsSchema,
  selectTopicsFromKeywords,
  run,
};

if (require.main === module) {
  try {
    const { topicsPath, topics } = run();
    console.log(`Wrote ${topics.length} topics to ${topicsPath}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
