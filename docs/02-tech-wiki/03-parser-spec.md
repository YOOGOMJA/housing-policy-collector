# 파서 규격

## 1. 수집/보존
- SH/LH 원문 스냅샷 저장
- 변경 감지를 위한 공고 식별키(기관, 공고번호, 모집차수) 보존

## 2. 필수 파싱 필드
- `source_org` : `SH` | `LH`
- `announcement_id` : 공고 식별자
- `application_type_raw` : 원문 청약 유형 문자열
- `application_type` : 정규화 유형
  - `PUBLIC_RENTAL` / `PUBLIC_SALE` / `JEONSE_RENTAL` / `PURCHASE_RENTAL` / `REDEVELOPMENT_SPECIAL` / `UNKNOWN`
- `eligibility_rules_raw` : 자격요건 원문 블록
- `region_requirement` / `household_requirement` / `income_requirement` / `asset_requirement`

## 3. 실패/불확실 처리
- 파싱 실패 시 사유 로깅
- 필수 필드 누락 시 `검토필요`
- 유형 분류 실패 시 `application_type=UNKNOWN` + 원문 유지

## 4. 정책 문서 연동 규칙
- `application_type` enum 변경 시 `docs/01-policy/01-eligibility-policy.md` 동시 업데이트
- 판정 규칙 변경 시 본 문서의 필드 정의 및 실패 처리 규칙을 동시 검토
