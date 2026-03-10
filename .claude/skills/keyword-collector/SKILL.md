---
name: keyword-collector
description: >
  최근 1주일간 유튜브 트렌드 키워드와 최신 뉴스 키워드를 수집하고
  구조화된 JSON 산출물로 저장하는 스킬.
origin: user
---

# keyword-collector 스킬 (개요 버전)

> NOTE: 이 파일은 구조/역할 정의용 개요 버전이다.  
> 실제 구현 시, 사용할 API·엔드포인트·파라미터 예시 등을 채운다.

## 1. 역할

- 유튜브 트렌드/관련 동영상에서 키워드 후보를 수집한다.
- 지정한 뉴스 소스(뉴스 API 또는 RSS 등)에서 최신 뉴스 키워드를 수집한다.
- 중복/노이즈를 1차 정리한 후, `/output/{date}` 하위에 JSON 파일로 저장한다.

## 2. 입력

- 대상 날짜 또는 날짜 범위 (기본: 오늘 기준 -7일)
- 실행 모드: `"test"` 또는 `"production"`

## 3. 출력

- `/output/{date}/trending_keywords.json`
- `/output/{date}/news_keywords.json`

각 파일은 최소 아래 구조를 가진다 (스키마 예시, 실제 구현 시 확정):

```json
{
  "source": "youtube|news",
  "range": {
    "from": "YYYY-MM-DD",
    "to": "YYYY-MM-DD"
  },
  "items": [
    {
      "keyword": "예시 키워드",
      "origin": "채널명 또는 매체명",
      "frequency": 42
    }
  ]
}
```

## 4. 성공 기준

- 두 JSON 모두에서:
  - `items.length >= 최소 개수` (예: 30개 이상)을 만족한다.
  - `keyword`, `origin`, `frequency` 등의 필수 필드가 존재하고 타입이 맞는다.

## 5. 검증과 실패 처리

- **검증**
  - 스키마/타입 검증 (구조/필드 체크)
  - 개수/중복 비율에 대한 규칙 기반 검증
- **실패 처리**
  - API/네트워크 오류 또는 스키마 불일치 → 자동 재시도(최대 2회)
  - 재시도 후에도 실패 → 해당 날짜 실행을 실패로 표시하고, 이유를 로그로 남긴다.

