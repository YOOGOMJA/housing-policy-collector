# Open PR 현황 및 재작업 우선순위 (2026-02-21)

## 1) 수집 범위 및 방법
- 대상 저장소: `YOOGOMJA/housing-policy-collector`
- 수집 시각(UTC): 2026-02-21
- 검색 키워드: `Open pull requests`, `base:`, `head:`, `merge conflict`
- 수집 방식:
  1. `GET /repos/{owner}/{repo}/pulls?state=open`으로 Open pull requests 조회
  2. 각 PR 번호에 대해 `GET /repos/{owner}/{repo}/pulls/{number}` 재조회
  3. `changed_files`, `mergeable`, `mergeable_state`를 기준으로 충돌 여부 판단

## 2) Open PR 목록 요약

| PR 번호 | 제목 | base 브랜치 | head 브랜치 | 변경 파일 수 | 충돌 여부 |
|---|---|---|---|---:|---|
| #18 | docs: CI 필터 패턴-문서 규칙 동기화 기준 명시 | main | codex/update-documentation-for-code-change-detection | 3 | 충돌 있음 (`mergeable=false`, `mergeable_state=dirty`) |
| #17 | chore(#999): Python lint를 ruff 기반으로 CI 표준화 | main | codex/standardize-python-linting-with-ruff-1aofv4 | 3 | 충돌 있음 (`mergeable=false`, `mergeable_state=dirty`) |

## 3) 재작업 대상 우선순위 (충돌 심각도/중요도)

| 우선순위 | PR 번호 | 충돌 심각도 | 중요도 | 재작업 권고 |
|---|---:|---|---|---|
| P1 (최우선) | #17 | 높음 | 높음 (CI lint 체계 표준화는 전체 개발 생산성과 품질 게이트에 직접 영향) | `main` 최신 반영 후 충돌 파일 선해결, lint 파이프라인 회귀 점검을 우선 수행 |
| P2 | #18 | 높음 | 중간 (문서 규칙 동기화는 운영 일관성에 중요하나 코드 실행 영향은 상대적으로 낮음) | #17 정리 후 동일 기준으로 rebase/merge 재시도, 문서 규칙 상호참조 점검 |

## 4) 후속 액션 제안
- 두 PR 모두 `merge conflict` 상태이므로 작성 브랜치에서 `main` 최신 커밋을 반영한 뒤 충돌 해결이 필요합니다.
- #17 해결 직후 CI lint 관련 Job(`Code lint check`, `Commit convention check`)을 우선 재검증합니다.
- #18 해결 시 문서 간 동기화(`README.md` ↔ `docs/README.md` ↔ `docs/workflow.md`) 누락 여부를 함께 점검합니다.
