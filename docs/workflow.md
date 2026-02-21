# 협업 워크플로우

이 문서는 저장소에서 사용할 기본 이슈/PR/커밋 규칙을 정의합니다.

## 1) 작업 시작 규칙

모든 작업은 **이슈 생성 후 진행**합니다.

이슈에는 다음 4가지 항목을 반드시 포함합니다.

- 배경
- 목표
- 기대효과
- 리스크

`.github/ISSUE_TEMPLATE/정책-변경-작업-이슈.md` 템플릿을 사용해 이슈를 생성합니다.

## 2) 커밋 규칙

커밋 메시지는 **Conventional Commits + commitlint** 규칙을 따릅니다.

- 커밋 메시지는 한국어 사용 권장
- 커밋 스코프는 이슈 번호 사용: `#123`
- 커밋 바디에 변경 요약 필수

예시:

```bash
feat(#123): PR 템플릿 표준화

- PR 템플릿 섹션을 팀 규칙에 맞게 정리
- 셀프 체크리스트 항목 추가
```

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
- 코드 변경이 포함된 경우 lint/컨벤션 체크를 수행했는가?
- 문서 변경 시 YAML 파일이 포함된 경우에만 문서 포매팅/문법 체크를 수행했는가?
- 문서를 신규 추가한 경우 `docs/README.md` 및 관련 참조 문서 반영 여부를 확인했는가?
- 루트 에이전트 문서(`AGENTS.md`, `claude.md`) 변경 시 AI 지침 문서와 충돌 여부를 확인했는가?
- AI 지침 문서를 추가/수정했다면 `docs/README.md` 인덱스를 함께 업데이트했는가?
- 정책 문서 변경이 기술/운영 문서에 반영되었는가?
- 정기 리포트/운영 절차 변경 시 `docs/03-operations/03-scheduled-slack-report-runbook.md` 반영 여부를 확인했는가?
- 변경 문서 간 링크/참조 누락이 없는가?
- 코드 구조 변경 시 `docs/02-tech-wiki/01-architecture.md`의 모듈명과 실제 디렉터리(`src/`)가 1:1인지 확인했는가?

## 4) PR CI 자동 검증 기준

PR 생성/수정 시 `.github/workflows/ci.yml`의 아래 Job이 자동 실행됩니다.

### Job 이름과 실행 명령
- **Detect changed file groups**
  - 변경 파일 분류만 수행 (실행 명령 없음)
- **Code lint check**
  - 실행 명령: `npm run lint`
- **Commit convention check**
  - 실행 명령: `echo "$PR_TITLE" | npm run commitlint:pr-title`
- **Docs YAML format & syntax check**
  - 실행 명령 1: `npm run docs:yaml:format:check`
  - 실행 명령 2: `npm run docs:yaml:lint`

### 조건별 실행 규칙
- 코드 변경(PR에서 docs 외 파일 변경 포함):
  - `Code lint check` + `Commit convention check` 실행
- 문서 변경(PR에서 `docs/**/*.yml`, `docs/**/*.yaml` 포함):
  - `Docs YAML format & syntax check` 실행
- 일반 문서(`.md`) 변경만 있는 경우:
  - 문서 포맷/문법 체크는 실행하지 않음

## 5) 권장 진행 순서

1. 이슈 생성 (템플릿 기반)
2. 브랜치 생성 및 작업
3. 커밋 (이슈 번호 스코프 + 바디 요약)
4. PR 생성 (템플릿 기반)
5. 리뷰 반영 및 머지
