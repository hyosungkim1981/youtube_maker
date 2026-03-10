---
name: image-fetcher
description: >
  image-planner의 장면/이미지 계획을 기반으로 실제 이미지를 검색/생성하여 파일로 저장하는 스킬.
origin: user
---

# image-fetcher 스킬 (개요 버전)

## 1. 역할

- `images_plan.json`에 정의된 각 scene의 `searchPrompt`/`imageType`에 따라:
  - 이미지 검색 API 또는 이미지 생성 API를 호출한다.
  - 결과 이미지를 `/output/{date}/images_{n}/` 하위에 저장한다.
- 장면-이미지 매핑 메타데이터를 갱신한다.

## 2. 입력

- `/output/{date}/images_{n}/images_plan.json` 경로

## 3. 출력

- `/output/{date}/images_{n}/image_{k}.(png|jpg)`
- `/output/{date}/images_{n}/images_meta.json`

예시 구조:

```json
{
  "scriptFile": "script_1.md",
  "images": [
    {
      "sceneIndex": 1,
      "file": "image_1.png",
      "source": "search|generate",
      "prompt": "현대적인 뉴스 스튜디오 배경"
    }
  ]
}
```

## 4. 성공 기준

- `images_meta.json`에 모든 scene에 대응되는 이미지가 최소 1개 이상 매핑되어 있거나,
  대체 전략(단색 배경+텍스트 등)이 명시되어 있다.
- 실제 이미지 파일이 존재하며, 파일 손상 없이 열 수 있다.

## 5. 검증과 실패 처리

- **검증**
  - 파일 존재 여부, 개수 하한
  - `images_meta.json`의 scene 매핑 여부
- **실패 처리**
  - 특정 프롬프트/scene에서 반복 실패 → 프롬프트를 단순화한 후 자동 재시도(최대 2회)
  - 그래도 실패하면 해당 scene을 **텍스트 오버레이용 단색 배경**으로 대체하고 로그를 남긴다.

