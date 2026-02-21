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
- 필수 필드 누락 시 판정 등급을 최대 `검토필요`로 제한
- 유형 분류 실패 시 `application_type=UNKNOWN` + 원문 유지
- 원문 모호성(조건 해석 불가/충돌) 발견 시 보수적으로 판정 등급 `검토필요` 분기

## 4. 기관별 입력/출력 예시
아래 예시는 SH/LH 원문 일부를 입력으로 받아 파서가 생성해야 하는 JSON 결과(정규화 + 로그)를 정의합니다.

### 케이스 A. 정상 파싱 (SH, `PUBLIC_RENTAL`)
- 목적: 정상 필드 추출 및 정규화 확인

**입력 샘플(원문 발췌)**
```text
기관: SH
공고번호: 2026-001
공고명: 2026년 1차 행복주택 입주자 모집
청약유형: 행복주택(공공임대)
신청자격: 서울시 거주 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 6,100만원 이하
```

**기대 출력(JSON 예시)**
```json
{
  "source_org": "SH",
  "announcement_id": "SH-2026-001-1",
  "application_type_raw": "행복주택(공공임대)",
  "application_type": "PUBLIC_RENTAL",
  "eligibility_rules_raw": "서울시 거주 무주택세대구성원, 도시근로자 월평균소득 100% 이하, 총자산 3억 6,100만원 이하",
  "region_requirement": "서울시 거주",
  "household_requirement": "무주택세대구성원",
  "income_requirement": "도시근로자 월평균소득 100% 이하",
  "asset_requirement": "총자산 3억 6,100만원 이하",
  "judgement_grade_cap": "확정 가능",
  "log": {
    "trace_id": "trace-sh-2026001-a",
    "failure_reason": null,
    "source_snapshot_ref": "snap:SH:2026-001:v1"
  }
}
```

### 케이스 B. 필수 필드 누락 (`검토필요`)
- 목적: 필수 필드 누락 시 판정 등급 상한을 `검토필요`로 강제

**입력 샘플(원문 발췌)**
```text
기관: LH
공고번호: 2026-77
공고명: 2026년 기존주택 전세임대 입주자 모집
청약유형: 전세임대(청년)
신청자격: 무주택세대구성원, 도시근로자 월평균소득 70% 이하
비고: 공고문 본문에 자산 기준 없음
```

**기대 출력(JSON 예시)**
```json
{
  "source_org": "LH",
  "announcement_id": "LH-2026-77-1",
  "application_type_raw": "전세임대(청년)",
  "application_type": "JEONSE_RENTAL",
  "eligibility_rules_raw": "무주택세대구성원, 도시근로자 월평균소득 70% 이하",
  "region_requirement": null,
  "household_requirement": "무주택세대구성원",
  "income_requirement": "도시근로자 월평균소득 70% 이하",
  "asset_requirement": null,
  "judgement_grade_cap": "검토필요",
  "log": {
    "trace_id": "trace-lh-2026077-b",
    "failure_reason": "MISSING_REQUIRED_FIELD: asset_requirement",
    "source_snapshot_ref": "snap:LH:2026-77:v3"
  }
}
```

### 케이스 C. `application_type` 분류 실패 (`UNKNOWN`)
- 목적: 유형 분류 실패 시 원문 보존 + `UNKNOWN` 처리

**입력 샘플(원문 발췌)**
```text
기관: SH
공고번호: 2026-특별-19
공고명: 2026년 미래주거지원형 공급
청약유형: 미래주거지원형(신규)
신청자격: 세부기준 추후 공지
```

**기대 출력(JSON 예시)**
```json
{
  "source_org": "SH",
  "announcement_id": "SH-2026-SP19-1",
  "application_type_raw": "미래주거지원형(신규)",
  "application_type": "UNKNOWN",
  "eligibility_rules_raw": "세부기준 추후 공지",
  "region_requirement": null,
  "household_requirement": null,
  "income_requirement": null,
  "asset_requirement": null,
  "judgement_grade_cap": "검토필요",
  "log": {
    "trace_id": "trace-sh-2026sp19-c",
    "failure_reason": "UNMAPPED_APPLICATION_TYPE",
    "source_snapshot_ref": "snap:SH:2026-SP19:v1"
  }
}
```

### 케이스 D. 원문 모호성으로 인한 보수적 판정 분기
- 목적: 자격요건 해석이 모호한 경우 `검토필요`로 보수적 분기

**입력 샘플(원문 발췌)**
```text
기관: LH
공고번호: 2026-재공급-05
공고명: 2026년 매입임대 재공급
청약유형: 매입임대(신혼부부)
신청자격: 소득기준은 전년도 도시근로자 가구원수별 기준 적용, 단 예외 세대는 별도 심사
추가문구: 자산기준은 유형별 상이(별표 참조)
```

**기대 출력(JSON 예시)**
```json
{
  "source_org": "LH",
  "announcement_id": "LH-2026-RE05-1",
  "application_type_raw": "매입임대(신혼부부)",
  "application_type": "PURCHASE_RENTAL",
  "eligibility_rules_raw": "소득기준은 전년도 도시근로자 가구원수별 기준 적용, 단 예외 세대는 별도 심사 / 자산기준은 유형별 상이(별표 참조)",
  "region_requirement": null,
  "household_requirement": "신혼부부 대상",
  "income_requirement": "전년도 도시근로자 가구원수별 기준 적용(예외 세대 별도 심사)",
  "asset_requirement": "유형별 상이(별표 참조)",
  "judgement_grade_cap": "검토필요",
  "log": {
    "trace_id": "trace-lh-2026re05-d",
    "failure_reason": "AMBIGUOUS_RULE_TEXT: exception-household-review-required",
    "source_snapshot_ref": "snap:LH:2026-RE05:v2"
  }
}
```

## 5. 정책 문서 연동 규칙
- `application_type` enum 변경 시 `docs/01-policy/01-eligibility-policy.md` 동시 업데이트
- 판정 등급/용어는 정책 문서의 `확정 가능` / `유력` / `검토필요` / `부적합`을 그대로 사용
- 판정 규칙 변경 시 본 문서의 필드 정의 및 실패 처리 규칙을 동시 검토
