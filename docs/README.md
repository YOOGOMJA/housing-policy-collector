# 문서 인덱스 (정제본)

아래는 지금 프로젝트에 **필수로 필요한 문서 목록**입니다.

## A. 필수 문서 리스트업 (항번)
1. `docs/00-product/01-problem-statement.md`
   - 문제정의, 사용자 페인포인트, 해결 목표
2. `docs/00-product/02-requirements.md`
   - 기능/비기능 요구사항, 제외 범위
3. `docs/00-product/03-scope-release-plan.md`
   - MVP/차기 범위, 단계별 릴리즈 계획
4. `docs/01-policy/01-eligibility-policy.md`
   - 적합도 판정 등급/규칙/예외 처리
5. `docs/01-policy/02-data-privacy-policy.md`
   - 개인정보 저장/암호화/삭제 정책
6. `docs/01-policy/03-notification-policy.md`
   - 알림 채널, 중복방지, 리마인드 정책
7. `docs/02-tech-wiki/01-architecture.md`
   - 시스템 구성도, 모듈 경계, 데이터 흐름
   - 문서 모듈명과 `src/` 디렉터리 1:1 매핑(Collector/Parser/Matcher/Notifier/Storage)
8. `docs/02-tech-wiki/02-data-model.md`
   - 엔티티/스키마/필드 정의(암호화 포함)
9. `docs/02-tech-wiki/03-parser-spec.md`
   - SH/LH 수집/파싱 규격, 실패 처리
10. `docs/03-operations/01-monitoring-sla.md`
    - 모니터링 지표, 목표 지연시간(SLA)
11. `docs/03-operations/02-incident-response.md`
    - 장애 분류, 대응 절차, 복구 체크리스트
12. `docs/03-operations/04-commit-scope-governance.md`
    - 이슈 생성 기준, commit scope 사용 원칙, 도메인 스코프 목록
13. `docs/03-operations/05-pr-freeze-branch-lifecycle.md`
    - Closed PR head 브랜치 정리/보존/예외 및 PR 동결 문서 동기화 기준
14. `docs/04-ai-instructions/01-agent-guidelines.md`
    - AI 작업 공통 규칙(문서 동기화/보수적 판단)
15. `docs/04-ai-instructions/02-subagent-workflow.md`
    - 서브에이전트 순차 실행 계획과 산출물
16. `docs/04-ai-instructions/03-agent-doc-gap-analysis.md`
    - AI 작업 문서의 누락 분석 및 보강 우선순위
17. `docs/04-ai-instructions/03-multi-agent-collaboration-rules.md`
    - 동시다발 협업 규칙, 소유권, 품질 게이트
18. `docs/04-ai-instructions/04-context-window-playbook.md`
    - 컨텍스트 윈도우 예산/로딩/분할 전략
19. `docs/04-ai-instructions/05-prompt-engineering-playbook.md`
    - 프롬프트 템플릿/가드레일/작업 유형별 스캐폴드
20. `docs/04-ai-instructions/06-agents-md-ops.md`
    - AGENTS.md 배치/우선순위/운영 절차

## B. 작성 순서 (재정렬)
1. 문제정의
2. 요구사항
3. 범위/릴리즈
4. 판정정책
5. 개인정보정책
6. 알림정책
7. 아키텍처
8. 데이터모델
9. 파서규격
10. 모니터링SLA
11. 장애대응
12. 커밋 스코프 운영
13. PR 동결 브랜치 수명주기
14. AI 가이드
15. 서브에이전트 워크플로우
16. AI 문서 갭 분석
17. 멀티에이전트 협업 규칙
18. 컨텍스트 플레이북
19. 프롬프트 플레이북
20. AGENTS 운영

## C. 운영 규칙
- 정책 문서 변경 시 기술 문서를 같은 커밋에서 동기화합니다.
- 청약 형태(application_type) enum 변경 시 `01-policy/01-eligibility-policy.md`와 `02-tech-wiki/03-parser-spec.md`를 함께 갱신합니다.
- 파싱 불확실성은 자동으로 `검토필요`로 분류합니다.
- 개인정보 원문 로그는 금지합니다.
- AI 지침 문서 추가/변경 시 문서 인덱스와 워크플로우 문서를 함께 점검합니다.
- 정기 리포트 정책 변경 시 `03-operations/03-scheduled-slack-report-runbook.md`와 `01-policy/03-notification-policy.md`를 함께 점검합니다.
- PR 자동 검증 기준은 `docs/workflow.md`와 `.github/workflows/ci.yml`을 동일 기준으로 유지합니다.

## D. 루트 에이전트 운영 문서
- `AGENTS.md`
  - 저장소 전역 에이전트 작업 규칙(우선순위/검증/커밋·PR 원칙)
- `claude.md`
  - Claude 작업 입력 템플릿, 컨텍스트 운용, 프롬프트 체크리스트

## E. 운영 보강 문서 (충돌 완화용 분리 항목)
- `docs/03-operations/03-scheduled-slack-report-runbook.md`
  - 정기 Slack bot 리포트 항목/주기/실패 대응 Runbook
  - 기존 필수 문서 항번 체계를 유지하여 main 변경과의 병합 충돌 가능성을 줄입니다.
- `docs/03-operations/04-commit-scope-governance.md`
  - 이슈 생성 기준과 commit scope 사용 원칙 운영 가이드
- `docs/03-operations/05-pr-freeze-branch-lifecycle.md`
  - Closed PR head 브랜치 정리/보존/예외 및 PR 동결 문서 동기화 가이드
