# 서브에이전트 워크플로우 (항번 재작성)

## 0. 공통 전제
- 모든 단계는 이전 단계 산출물 버전을 명시하고 시작합니다.
- 병렬 작업은 인터페이스 계약(스키마/상태코드) 고정 후에만 허용합니다.
- 완료 보고에는 변경 파일, 결정 근거, 리스크, 다음 액션을 포함합니다.

## 1. 순차 기본 플로우
1. Product-Agent: 문제정의/요구사항/범위 확정
2. Policy-Agent: 판정/개인정보/알림 정책 확정
3. Data-Agent: 데이터모델/암호화 필드 확정
4. Collector-Agent: 수집기 + 실패감지 구현
5. Matcher-Agent: 적합도 엔진 구현
6. Notifier-Agent: 알림/중복방지 구현
7. Ops-Agent: 모니터링/SLA/장애대응 자동화

## 2. 병렬 허용 구간
- 병렬 가능 A: Collector-Agent ↔ Notifier-Agent
  - 조건: 이벤트 페이로드/실패 코드 계약이 고정되어야 함
- 병렬 가능 B: Matcher-Agent ↔ Ops-Agent
  - 조건: 판정 결과 상태코드와 지표 정의가 고정되어야 함

## 3. 품질 게이트
- 코드 변경 시: 린트 + 컨벤션 체크 필수
- 문서 변경 시: YAML 문서에 한해 포맷/문법 체크 수행
- 문서 추가/수정 시: `docs/README.md` 및 연관 문서 반영 여부 확인

## 4. 승인 규칙
- 정책 영향 변경: Product-Agent + Policy-Agent 공동 승인
- 개인정보 영향 변경: Policy-Agent + Data-Agent 공동 승인
- 알림 정책 변경: Policy-Agent + Notifier-Agent 공동 승인

## 5. Git worktree 기반 병렬 실행 규칙
- 동시다발 작업은 기본 브랜치(`work` 등) 1개 + 에이전트별 worktree 분리 전략을 사용합니다.
- 각 서브에이전트는 자신의 worktree에서만 변경하고, 공통 계약 문서 변경은 선승인 후 반영합니다.
- worktree 네이밍 예시: `../wt-collector`, `../wt-notifier`, `../wt-ops`
- 병합 순서: 정책/계약 변경 브랜치 선병합 → 기능 브랜치 순차 리베이스/병합
- 충돌이 잦은 파일(`docs/02-tech-wiki/02-data-model.md` 등)은 섹션 오너 승인 없이 직접 수정하지 않습니다.
