---
name: image-planner
description: >
  스크립트를 장면 단위로 나누고, 각 장면에 필요한 이미지 유형과 간단한 구도 설명을 설계하는 스킬.
origin: user
---

# image-planner 스킬 (개요 버전)

## 1. 역할

- `script_{n}.md`를 읽고 자연스러운 **장면(Scene) 단위**로 분할한다.
- 각 장면마다:
  - 어떤 종류의 이미지가 필요한지
  - 어떤 구도/톤이 적합한지
  - 어떤 키워드를 사용해 검색/생성할지
  를 정의한다.

## 2. 입력

- `/output/{date}/script_{n}.md` 경로
- (옵션) 이미지 스타일/브랜드 가이드 (예: 썸네일 스타일, 색감)

## 3. 출력

- `/output/{date}/images_{n}/images_plan.json`

예시 구조:

```json
{
  "scriptFile": "script_1.md",
  "scenes": [
    {
      "sceneIndex": 1,
      "timeRangeSeconds": [0, 30],
      "description": "오프닝 인트로 화면",
      "imageType": "배경 + 텍스트",
      "searchPrompt": "현대적인 뉴스 스튜디오 배경",
      "styleHints": ["밝은 톤", "간결한 디자인"]
    }
  ]
}
```

## 4. 성공 기준

- 전체 영상 길이(약 5분)를 커버할 수 있을 만큼 충분한 장면 수를 가진다.
- 각 scene에 `description`, `imageType`, `searchPrompt`가 빠짐없이 정의된다.

## 5. 검증과 실패 처리

- **검증**
  - 스키마 검증: `scenes` 배열과 필드 존재 여부
  - 규칙 기반: scene 개수 하한(예: 최소 8~10개 이상)
- **실패 처리**
  - scene 수 부족 또는 필드 누락 → 자동 재생성(최대 2회)
  - 여전히 부족하면, 일부 구간은 **단색 배경+텍스트**로 대체 가능하도록 표시하고 진행.

