# 협업 워크플로우

이 문서는 저장소에서 사용할 기본 이슈/PR/커밋 규칙을 정의합니다.

## 1) 작업 시작 규칙

작업 시작 전 아래 기준으로 **이슈 생성 필요 여부**를 먼저 판단합니다.

### 이슈 생성이 필요한 경우
- 정책/요구사항/운영 기준을 변경하는 작업
- 사용자 영향이 있는 기능 추가/변경/제거 작업
- 장애, 데이터 정합성, 보안 이슈 대응 작업
- 여러 커밋 또는 다수 파일에 걸친 중간 이상 규모 작업

### 이슈 없이 진행 가능한 경우
- 오탈자 수정, 링크 보정, 단순 문장 정리
- 코드 동작에 영향 없는 경미한 리팩터링
- 이슈 생성 기준에 해당하지 않는 1회성 소규모 작업

이슈를 생성하는 경우 `.github/ISSUE_TEMPLATE/정책-변경-작업-이슈.md` 템플릿을 사용합니다.

## 2) 커밋 규칙

커밋 메시지는 **Conventional Commits + commitlint** 규칙을 따릅니다.

- 커밋 메시지는 한국어 사용 권장
- 커밋 스코프는 항상 작성
- 이슈를 생성한 작업은 스코프에 이슈 번호 사용: `#123`
- 이슈 없이 진행한 작업은 도메인 스코프 사용: `docs`, `parser`, `policy`, `ops` 등
- 커밋 바디에 변경 요약 필수

예시:

```bash
feat(#123): PR 템플릿 표준화

- PR 템플릿 섹션을 팀 규칙에 맞게 정리
- 셀프 체크리스트 항목 추가
```

```bash
docs(workflow): 스코프 운영 기준 문서 링크 추가

- 이슈 생성 기준 섹션 신설
- 도메인 스코프 사용 원칙 명시
```

스코프 관리 기준은 `docs/03-operations/04-commit-scope-governance.md`를 참고합니다.
관련 설정은 `commitlint.config.cjs`에 정의되어 있습니다.

## 3) PR 작성 규칙

PR에는 아래 항목을 반드시 포함합니다.

- 배경
- 작업 내용
- 기대효과
- 리뷰가 필요한 항목
- 스스로 필요한 체크리스트
- 비고

`.github/pull_request_template.md`를 기본 템플릿으로 사용합니다.

### 문서 변경 시 추가 체크리스트
- 코드 변경이 포함된 경우 TypeScript 기준 lint/컨벤션 체크를 수행하고 **ESLint 통과**를 확인했는가?
- 문서 변경 시 YAML 파일이 포함된 경우에만 문서 포매팅/문법 체크를 수행했는가?
- 문서를 신규 추가한 경우 `docs/README.md` 및 관련 참조 문서 반영 여부를 확인했는가?
- 루트 에이전트 문서(`AGENTS.md`, `claude.md`) 변경 시 AI 지침 문서와 충돌 여부를 확인했는가?
- AI 지침 문서를 추가/수정했다면 `docs/README.md` 인덱스를 함께 업데이트했는가?
- 정책 문서 변경이 기술/운영 문서에 반영되었는가?
- 정기 리포트/운영 절차 변경 시 `docs/03-operations/03-scheduled-slack-report-runbook.md` 반영 여부를 확인했는가?
- 변경 문서 간 링크/참조 누락이 없는가?
- 코드 구조 변경 시 `docs/02-tech-wiki/01-architecture.md`의 모듈명과 실제 디렉터리(`src/`)가 1:1인지 확인했는가?

## 4) TypeScript 전환 기준 및 검증 명령

### 코드 변경 패턴 예시 (TypeScript 중심)

- 신규 런타임 로직 추가: `src/**/*.ts`에 구현하고 실행 진입점(`src/main.ts`, `src/batch_main.ts`) 연결 여부를 확인합니다.
- 배치/스케줄 로직 변경: `src/batch_main.ts`와 연관 모듈(`src/**`)의 타입 안정성(`typecheck`)을 함께 점검합니다.
- 테스트 코드 변경: `tests/**/*.ts`에서 기존 시나리오와 타입 정의의 일관성을 확인합니다.
- 설정 변경: `tsconfig*.json`, `package.json` 변경 시 lint/typecheck/build를 모두 실행해 TypeScript 실행 경로가 유지되는지 확인합니다.

- `pyproject.toml`은 저장소에서 제거되어 Python 빌드/실행 경로는 운영하지 않습니다.
- TS 코드 변경 시 아래 명령으로 lint/컨벤션 적용 여부를 검증합니다.

```bash
npm run lint
npm run typecheck
npm run build
```

- `npm run lint`: ESLint(TypeScript 규칙) + `@typescript-eslint/*` + import 정렬 규칙 적용 확인 (TypeScript 파일 중심 검사: `src/**/*.ts`, `tests/**/*.ts`)
- `npm run typecheck`: TypeScript 타입 오류를 `--noEmit` 기준으로 검증
- `npm run build`: `tsconfig.json` 컴파일 기준(`rootDir`, `outDir`, `module`, `target`, `strict`) 검증

## 5) PR CI 자동 검증 기준

PR 생성/수정 시 `.github/workflows/ci.yml`의 아래 Job이 자동 실행됩니다.

### Job 이름과 실행 명령
- **Detect changed file groups**
  - 변경 파일 분류만 수행 (실행 명령 없음)
- **Code lint check**
  - 실행 명령: `npm run lint`
- **Commit convention check**
  - 실행 명령: `echo "$PR_TITLE" | npm run commitlint:pr-title`
  - 검사 기준: 커밋 스코프 규칙과 동일하게 `#이슈번호` 또는 허용된 도메인 스코프
- **Code typecheck**
  - 실행 명령: `npm run typecheck`
- **Docs YAML format & syntax check**
  - 실행 명령 1: `npm run docs:yaml:format:check`
  - 실행 명령 2: `npm run docs:yaml:lint`

### 조건별 실행 규칙
- 코드 변경(PR에서 아래 패턴 중 하나 이상 변경):
  - `AGENTS.md`, `claude.md`, `.github/**`
  - `src/**/*.ts`, `tests/**/*.ts`, `tsconfig*.json`, `package.json`, `package-lock.json`
  - TypeScript/Node.js 실행·설정 파일(`*.ts`, `*.js`, `*.cjs`, `*.mjs`, `*.json`, 단 `docs/**` 제외)
  - 실행 Job: `Code lint check` + `Commit convention check` + `Code typecheck`
- 문서 변경(PR에서 `docs/**/*.yml`, `docs/**/*.yaml` 포함):
  - 실행 Job: `Docs YAML format & syntax check`
- 일반 문서(`.md`) 변경만 있는 경우:
  - 문서 포맷/문법 체크는 실행하지 않음

## 6) 권장 진행 순서

1. 이슈 필요 여부 판단 (생성 기준 체크)
2. 필요 시 이슈 생성 (템플릿 기반)
3. 브랜치 생성 및 작업
4. 커밋 (이슈 작업은 이슈번호 스코프, 비이슈 작업은 도메인 스코프 + 바디 요약)
5. PR 생성 (템플릿 기반)
6. 리뷰 반영 및 머지

## 7) Remote 연결 가이드 (로컬/에이전트 공통)

PR 충돌 확인이나 브랜치 fetch가 필요할 때는 먼저 Git remote 연결 상태를 점검합니다.

### 기본 점검 명령

```bash
git remote -v
git branch -a
git fetch --all --prune
```

### remote가 없는 경우

```bash
git remote add origin https://github.com/YOOGOMJA/housing-policy-collector.git
git fetch origin
```

### 연결이 실패할 수 있는 대표 원인
- 저장소 URL 오타 또는 repository 권한 없음
- HTTPS 인증 실패(PAT 만료/권한 부족)
- 조직 정책(SSO, IP allowlist)으로 접근 차단
- 사내 네트워크/프록시/DNS 문제

### 점검 체크리스트
- `git ls-remote origin` 명령이 정상 응답하는지 확인
- `git fetch origin` 실행 시 인증 프롬프트/에러 메시지 확인
- private repository인 경우 PAT scope(`repo`) 및 SSO 승인 상태 확인
