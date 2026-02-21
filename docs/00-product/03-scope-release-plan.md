# 범위 및 릴리즈 계획

- MVP: 1인 사용자, SH/LH, 기본 판정/알림
- Next: 다중 프로필, 대시보드, 추가 공급기관

## POC 완료 Acceptance Criteria

POC 완료 여부는 아래 정량 지표를 **연속 5회 배치 실행 기준**으로 판단합니다.

- SH 최근 N건 수집 성공률: 최근 `N=50` 공고 기준 `95%` 이상
- 필수 필드 추출률: `title`/`source_org`/`application_period`/`original_link` 4개 필드 기준 `98%` 이상
- `검토필요` 분기율: 수집 성공 건수 대비 `15%` 이하

### 측정 및 집계 기준

- 수집 성공률 분모: 실행 시점의 SH 대상 최근 50건
- 수집 성공률 분자: 수집 파이프라인 완료 + 저장 성공 건수
- 필수 필드 추출률 분모: 수집 성공 건수
- 필수 필드 추출률 분자: 필수 필드 4개(`title`, `source_org`, `application_period`, `original_link`)가 모두 채워진 건수
- `검토필요` 분기율 분모: 수집 성공 건수
- `검토필요` 분기율 분자: 파서/정책 규칙에서 자동으로 `검토필요`로 분류된 건수

### 테스트 계산식(코드 구현 기준)

아래 3개 지표는 테스트 코드에서 그대로 계산 가능한 수식으로 고정합니다.

- 수집 성공률(`collection_success_rate`) = `collected_success_count / sh_recent_target_count`
  - PASS 기준: `collection_success_rate >= 0.95`
  - 기본 샘플 분모: `sh_recent_target_count = 50`
- 필수 필드 추출률(`required_field_extraction_rate`) = `required_fields_complete_count / collected_success_count`
  - PASS 기준: `required_field_extraction_rate >= 0.98`
- `검토필요` 분기율(`review_needed_branch_rate`) = `review_needed_count / collected_success_count`
  - PASS 기준: `review_needed_branch_rate <= 0.15`

연속 5회 배치 acceptance 판정은 각 회차별로 위 3개 PASS 기준을 모두 충족해야 합니다.
