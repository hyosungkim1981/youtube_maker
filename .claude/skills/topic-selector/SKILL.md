---
name: topic-selector
description: >
  유튜브/뉴스 키워드 JSON을 분석해, 수익 잠재력과 트렌드 적합도가 높은
  5개의 영상 주제를 선정하는 스킬.
origin: user
---

# topic-selector 스킬 (개요 버전)

> NOTE: 구조/역할만 정의하며, 세부 프롬프트는 구현 시점에 채운다.

## 1. 역할

- `trending_keywords.json`과 `news_keywords.json`을 통합 분석한다.
- 중복/유사 키워드를 묶어 **주제 후보 클러스터**를 만든다.
- 유튜브 조회/클릭 잠재력 관점에서 상위 5개 주제를 선정한다.

## 2. 입력

- `/output/{date}/trending_keywords.json` 경로
- `/output/{date}/news_keywords.json` 경로

## 3. 출력

- `/output/{date}/topics.json`

예시 구조:

```json
{
  "date": "YYYY-MM-DD",
  "topics": [
    {
      "id": 1,
      "title": "영상 주제 제목 예시",
      "summary": "한 줄 요약",
      "reason": "선정 이유 (트렌드/뉴스 연관성, 수익 잠재력 등)",
      "key_points": [
        "핵심 포인트 1",
        "핵심 포인트 2"
      ],
      "related_keywords": ["키워드1", "키워드2"]
    }
  ]
}
```

## 4. 성공 기준

- `topics` 배열 길이가 **정확히 5개**이다.
- 각 topic에:
  - `title`, `summary`, `reason`, `key_points`(3개 이상), `related_keywords`가 존재한다.
- 유튜브 트렌드 키워드와 뉴스 키워드가 **적절히 혼합**되어 있다.

## 5. 검증과 실패 처리

- **검증**
  - 스키마 검증 (필수 필드 존재 여부, 타입)
  - LLM 자기 검증:
    - 주제간 중복 과다 여부
    - 원본 키워드 세트와의 관련성
- **실패 처리**
  - 중복/관련성 부족 → 다른 조합으로 재생성 (자동 재시도, 최대 2회)
  - 여전히 품질 부족 또는 모호할 경우 → 에스컬레이션 플래그를 남기고, 사람이 직접 주제를 조정하도록 안내.

