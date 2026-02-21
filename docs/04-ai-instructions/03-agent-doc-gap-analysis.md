# AI 에이전트 문서 갭 분석

## 기준 문서
- AGENTS.md 표준 가이드: https://agents.md/
- Claude Context Windows: https://platform.claude.com/docs/en/build-with-claude/context-windows
- Claude Prompt Engineering Overview: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview

## 현재 상태 요약
현재 저장소의 AI 문서는 아래 2개 중심이며, 목적/원칙 수준의 선언이 대부분입니다.
- `01-agent-guidelines.md`: 고수준 원칙만 존재
- `02-subagent-workflow.md`: 역할 순서 중심의 간단한 단계 정의

## 누락된 핵심 항목

### A. 문서 간 링크/참조 정합성 관리 미흡
- AI 지침 문서가 늘어난 이후, 문서 간 상호 참조가 수동 점검에 의존하고 있음
- `docs/README.md` 인덱스 항번/순서와 개별 문서의 참조 문구가 주기적으로 동기화되는 절차가 약함
- `README.md`의 "문서 시작점"과 세부 운영 문서의 링크 일관성을 검증하는 기준이 없음

### B. 체크리스트 실행성(Operationalization) 미흡
- `docs/workflow.md`의 문서 변경 체크리스트가 "확인했는가" 수준에 머물러, 실제 검증 로그(무엇을 어떻게 확인했는지)를 남기는 규칙이 없음
- AI 문서 수정 시 "대상 문서 + 연관 문서"를 세트로 검증했다는 증빙 포맷(예: PR 본문 표)이 정의되어 있지 않음
- 문서 정합성 확인이 개인 숙련도에 좌우되어, 재현 가능한 리뷰 루틴으로 고정되지 않음

### C. 규칙 중복/경계 불명확
- 동일한 원칙(문서 동기화, 우선순위 적용, 체크리스트)이 `AGENTS.md`, `docs/workflow.md`, `docs/04-ai-instructions/*`에 분산되어 있어 책임 경계가 모호함
- 일부 규칙은 "저장소 전역 규칙"인지 "AI 문서 작업 한정 규칙"인지 구분이 약해 해석 편차가 발생할 수 있음
- 규칙 변경 시 단일 기준 원본(source of truth) 문서가 명시되지 않아, 업데이트 누락 위험이 존재함

## 추가가 필요한 문서 (우선순위)
1. `docs/workflow.md` (보강)
   - 문서 변경 체크리스트에 "검증 근거 기록 방식(명령어/대상 문서/결과)"을 명시
2. `docs/README.md` (보강)
   - AI 지침 문서 섹션에 "교차 점검 대상"을 명문화해 인덱스-운영문서 연결 강화
3. `docs/04-ai-instructions/06-agents-md-ops.md` (보강)
   - 전역 규칙과 하위 스코프 규칙의 책임 경계를 표 형태로 정리
4. `README.md` (보강)
   - 루트 "문서 시작점"에 문서 정합성 점검 원칙(인덱스/워크플로우 동기화)을 간단히 고정

## 실행 제안
- 1단계: 월 1회 "문서 정합성 점검" 루틴을 운영하여 링크/참조/항번 일치 여부를 점검
- 2단계: PR 본문에 "문서 검증 로그"(확인 문서, 수행 명령, 결과)를 남기도록 팀 규칙을 고정
- 3단계: 중복 규칙을 분류해 전역 규칙은 `AGENTS.md`, 협업 절차는 `docs/workflow.md`, 실행 가이드는 `docs/04-ai-instructions/*`로 역할을 재정의
