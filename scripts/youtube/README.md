## YouTube Automation Scripts

이 디렉토리는 `youtube-orchestrator` 에이전트가 사용하는
유튜브/뉴스 기반 영상 자동 생성 파이프라인용 Node.js 스크립트를 담는다.

### 구성

- **keyword-collector.js**  
  유튜브/뉴스 키워드 수집 및 `/output/{date}/trending_keywords.json`, `news_keywords.json` 생성.

- **topic-selector.js**  
  키워드 JSON을 읽어 5개 주제를 선정하고 `/output/{date}/topics.json` 생성.  
  규칙 기반 폴백 제공 (LLM 선정 시 validateTopicsSchema + writeTopics 로 검증·저장).

- **script-writer.js**  
  topics.json의 각 주제에 대해 5분 분량 스크립트 초안을 생성하고 `/output/{date}/script_{1..5}.md` 저장.  
  규칙 기반 템플릿 폴백 제공 (LLM 생성 시 validateScript + writeScript 로 검증·저장).

- **subtitle-generator.js**  
  script_{n}.md를 읽어 SRT 자막을 생성하고 `/output/{date}/subtitles_{n}.srt` 저장.  
  타임스탬프는 분량 비례 균등 배분 (기본 5분).

- **review-report.js**  
  topics.json + script_*.md를 읽어 검수용 리포트를 생성하고 `/output/{date}/review_report.md` 저장.

- **image-planner.js**  
  script_{n}.md를 장면 단위로 나누고 `/output/{date}/images_{n}/images_plan.json` 생성.

- **image-fetcher.js**  
  images_plan.json을 읽어 각 장면용 이미지를 준비. (현재는 placeholder PNG + images_meta.json)

- **video-assembler.js**  
  images_meta.json과 이미지 파일로 FFmpeg 합성 → `/output/{date}/video_{n}.mp4`. (FFmpeg 없으면 해당 영상 스킵)

### 실행 순서

1. `node scripts/youtube/keyword-collector.js`
2. `node scripts/youtube/topic-selector.js`
3. `node scripts/youtube/script-writer.js`
4. `node scripts/youtube/image-planner.js`
5. `node scripts/youtube/image-fetcher.js`
6. `node scripts/youtube/video-assembler.js` (FFmpeg 필요)
7. `node scripts/youtube/subtitle-generator.js`
8. `node scripts/youtube/review-report.js`

### 테스트

```bash
node tests/scripts/youtube-keyword-collector.test.js
node tests/scripts/youtube-topic-selector.test.js
node tests/scripts/youtube-script-writer.test.js
node tests/scripts/youtube-image-planner.test.js
node tests/scripts/youtube-image-fetcher.test.js
node tests/scripts/youtube-video-assembler.test.js
node tests/scripts/youtube-subtitle-generator.test.js
node tests/scripts/youtube-review-report.test.js
```

