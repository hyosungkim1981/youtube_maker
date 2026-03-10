#!/usr/bin/env node

/**
 * keyword-collector.js
 *
 * 최근 1주일간의 유튜브/뉴스 키워드를 수집해
 * /output/{date}/trending_keywords.json, news_keywords.json 에 저장하는 스크립트의 뼈대.
 *
 * NOTE:
 * - 실제 YouTube/뉴스 API 연동 로직은 추후 구현한다.
 * - 현재는 TDD를 위한 최소 구조와 입출력 형태만 정의한다.
 */

const fs = require('fs');
const path = require('path');

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getOutputDir(baseDir = process.cwd(), date = new Date()) {
  const dateStr = formatDate(date);
  return path.join(baseDir, 'output', dateStr);
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeJson(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, 'utf8');
}

function createEmptyKeywordPayload(source, range) {
  return {
    source,
    range,
    items: [],
  };
}

function collectKeywords({ baseDir = process.cwd(), now = new Date() } = {}) {
  const outputDir = getOutputDir(baseDir, now);
  ensureDirExists(outputDir);

  const range = {
    from: formatDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
    to: formatDate(now),
  };

  const trendingPayload = createEmptyKeywordPayload('youtube', range);
  const newsPayload = createEmptyKeywordPayload('news', range);

  const trendingPath = path.join(outputDir, 'trending_keywords.json');
  const newsPath = path.join(outputDir, 'news_keywords.json');

  writeJson(trendingPath, trendingPayload);
  writeJson(newsPath, newsPayload);

  return {
    outputDir,
    trendingPath,
    newsPath,
  };
}

module.exports = {
  formatDate,
  getOutputDir,
  ensureDirExists,
  writeJson,
  createEmptyKeywordPayload,
  collectKeywords
};

if (require.main === module) {
  collectKeywords();
}

