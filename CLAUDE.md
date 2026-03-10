# CLAUDE.md

> Claude Code에서 이 파일을 자동으로 읽어 프로젝트 컨텍스트를 파악합니다.

## 프로젝트 개요

**Claude Code Plugin** — Claude Code를 더 강력하게 사용하기 위한 프로덕션 수준의 agents, skills, hooks, commands, rules, MCP 설정 모음집입니다.

바이브코딩 워크플로우를 자동화하여 AI가 계획 → 코딩 → 리뷰 → 테스트까지 일관되게 처리합니다.

---

## 빠른 시작

### 1. 설치

```bash
# 의존성 설치
npm install

# 전역 패키지 매니저 설정 (선택)
export CLAUDE_PACKAGE_MANAGER=pnpm  # npm | pnpm | yarn | bun
```

### 2. 지원 환경

- **OS**: Windows, macOS, Linux (Node.js 기반 크로스플랫폼)
- **패키지 매니저**: npm, pnpm, yarn, bun
  - 자동 감지 또는 `CLAUDE_PACKAGE_MANAGER` 환경 변수로 명시 설정
  - 프로젝트 루트 config 파일로도 지정 가능

### 3. 테스트 실행

```bash
# 전체 테스트
node tests/run-all.js

# 개별 테스트
node tests/lib/utils.test.js
node tests/lib/package-manager.test.js
node tests/hooks/hooks.test.js
```

---

## 아키텍처

```
claude-code-plugin/
├── agents/          # 특화된 서브에이전트 (계획, 리뷰, TDD 등)
├── skills/          # 워크플로우 지식 및 코딩 패턴
├── commands/        # 슬래시 커맨드 (/tdd, /plan, /e2e 등)
├── hooks/           # 이벤트 트리거 자동화
├── rules/           # 항상 적용되는 코딩 규칙
├── mcp-configs/     # 외부 서비스 MCP 설정
├── scripts/         # 크로스플랫폼 Node.js 유틸리티
└── tests/           # 테스트 스위트
```

### agents/
특화된 역할을 수행하는 서브에이전트 모음. Claude Code가 복잡한 작업을 위임할 때 사용합니다.

| 에이전트 | 역할 |
|---|---|
| `planner` | 구현 계획 수립 |
| `code-reviewer` | 코드 품질 리뷰 |
| `tdd-guide` | TDD 워크플로우 가이드 |

**파일 포맷**: YAML frontmatter + Markdown

```markdown
---
name: code-reviewer
description: 코드 품질을 리뷰하고 개선사항을 제안합니다
tools: [read_file, search]
model: claude-opus-4-5
---

# Code Reviewer Agent
...
```

### skills/
도메인 지식과 워크플로우 패턴을 담은 문서. 에이전트가 참조하는 "How-to" 가이드입니다.

**파일 포맷**: Markdown (섹션 구조 필수)

```markdown
# 스킬 이름

## 언제 사용하나
## 작동 방식
## 예시
```

### commands/
사용자가 슬래시(`/`)로 직접 호출하는 명령어입니다.

| 커맨드 | 설명 |
|---|---|
| `/tdd` | 테스트 주도 개발 워크플로우 시작 |
| `/plan` | 구현 계획 수립 |
| `/e2e` | E2E 테스트 생성 및 실행 |
| `/code-review` | 현재 코드 품질 리뷰 |
| `/build-fix` | 빌드 에러 자동 수정 |
| `/learn` | 세션에서 패턴 학습 및 추출 |
| `/skill-create` | git 히스토리 기반 스킬 자동 생성 |

**파일 포맷**: Markdown (description frontmatter 포함)

```markdown
---
description: 테스트 주도 개발 워크플로우를 시작합니다
---

# /tdd 커맨드
...
```

### hooks/
특정 이벤트 발생 시 자동 실행되는 트리거입니다.

**파일 포맷**: JSON

```json
{
  "matcher": { "event": "post-tool", "tool": "write_file" },
  "hooks": [
    { "type": "command", "command": "node scripts/lint.js" },
    { "type": "notification", "message": "파일 저장 완료" }
  ]
}
```

주요 훅 이벤트:
- `session-start` / `session-end`: 세션 시작/종료 시
- `pre-tool` / `post-tool`: 툴 실행 전/후
- `on-error`: 에러 발생 시

### rules/
Claude Code가 항상 따르는 규칙입니다. 보안, 코딩 스타일, 테스트 요구사항 등을 정의합니다.

### mcp-configs/
외부 서비스와의 MCP(Model Context Protocol) 연동 설정입니다.

| 설정 파일 | 연동 서비스 |
|---|---|
| `github.json` | GitHub API |
| `notion.json` | Notion |
| `slack.json` | Slack |

---

## 환경 변수

| 변수명 | 설명 | 기본값 |
|---|---|---|
| `CLAUDE_PACKAGE_MANAGER` | 사용할 패키지 매니저 | 자동 감지 |
| `CLAUDE_MODEL` | 기본 모델 지정 | `claude-opus-4-5` |
| `CLAUDE_DEBUG` | 디버그 로그 활성화 | `false` |

---

## 파일 네이밍 규칙

모든 파일은 **소문자 + 하이픈** 형식을 사용합니다.

```
✅ python-reviewer.md
✅ tdd-workflow.md
✅ build-fix.md

❌ PythonReviewer.md
❌ tddWorkflow.md
```

---

## 기여 가이드

자세한 내용은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

**컴포넌트별 포맷 요약:**

- **Agents**: YAML frontmatter (name, description, tools, model) + Markdown 본문
- **Skills**: Markdown — "언제 사용", "작동 방식", "예시" 섹션 필수
- **Commands**: description frontmatter + Markdown 본문
- **Hooks**: JSON — matcher 조건 + hooks 배열

---

## 라이선스

MIT
