# 데이터 모델

본 문서는 핵심 엔티티(`user_profile`, `notice`, `eligibility_result`, `notification_log`)의 필드 스펙과 개인정보 보호 적용 방식을 정의합니다.

관련 정책 문서: `docs/01-policy/02-data-privacy-policy.md`

## 1. 공통 규칙

### 1.1 `application_type` enum
- 타입: `TEXT`(또는 DB enum)
- 허용값: `PUBLIC_RENTAL`, `PUBLIC_SALE`, `JEONSE_RENTAL`, `PURCHASE_RENTAL`, `REDEVELOPMENT_SPECIAL`, `UNKNOWN`
- 적용 엔티티/컬럼:
  - `notice.application_type`
  - `eligibility_result.application_type`
- 규칙:
  1. 파서가 공고 원문 유형을 식별하면 정규화된 enum 값을 저장합니다.
  2. 유형 문자열이 모호하거나 근거가 부족하면 `UNKNOWN`을 저장하고 `application_type_raw`를 보존합니다.
  3. `UNKNOWN`은 오류가 아닌 **정상 보정 상태**이며, 후속 재파싱/수동검토 대상입니다.
  4. `UNKNOWN` 상태의 데이터는 판정(`eligibility_result`)에서 `검토필요` 우선순위를 높입니다.

### 1.2 `source_org` enum
- 타입: `TEXT`(또는 DB enum)
- 허용값: `SH`, `LH`, `UNKNOWN`
- 적용 엔티티/컬럼:
  - `notice.source_org`
- 규칙:
  1. 수집 출처를 확정할 수 있으면 `SH` 또는 `LH`를 저장합니다.
  2. 출처를 판별할 수 없으면 `UNKNOWN`을 저장하고 재수집 큐에 등록합니다.

### 1.3 개인정보/민감정보 및 암호화 기준
- PII(개인정보) 또는 민감정보 컬럼은 `encrypted=true` 정책을 기본으로 합니다.
- 암호화 키(`key_id`)는 데이터와 분리된 저장소(KMS/Secret Manager)에 보관합니다.
- 상세 기준과 운영 절차는 `docs/01-policy/02-data-privacy-policy.md`를 따릅니다.

---

## 2. 엔티티 스펙

### 2.1 `user_profile`

| 컬럼명 | 타입 | Nullable | 기본값 | Unique / Index | FK 관계 | 개인정보/민감정보 | 암호화 |
|---|---|---|---|---|---|---|---|
| id | UUID | N | gen_random_uuid() | PK, UNIQUE | - | N | N |
| user_key | TEXT | N | - | UNIQUE INDEX | - | 간접식별자 | N |
| name_enc | BYTEA | N | - | - | - | 개인정보(이름) | Y |
| phone_enc | BYTEA | N | - | UNIQUE INDEX(해시 보조 인덱스 권장) | - | 개인정보(연락처) | Y |
| birthdate_enc | BYTEA | Y | NULL | - | - | 개인정보(생년월일) | Y |
| region_code | TEXT | Y | NULL | INDEX | - | 개인정보(거주지역, 준식별자) | N |
| income_bracket | TEXT | Y | NULL | INDEX | - | 민감정보(소득구간) | N(필요 시 Y) |
| household_size | INT | Y | NULL | - | - | 민감정보(가구정보) | N |
| preference_json | JSONB | Y | '{}'::jsonb | GIN INDEX | - | 조건정보(민감 가능) | 부분 Y(민감 키만) |
| consent_version | TEXT | N | 'v1' | - | - | N | N |
| consent_at | TIMESTAMPTZ | N | now() | INDEX | - | N | N |
| key_id | TEXT | N | - | INDEX | - | N(키 메타) | N |
| created_at | TIMESTAMPTZ | N | now() | INDEX | - | N | N |
| updated_at | TIMESTAMPTZ | N | now() | - | - | N | N |
| deleted_at | TIMESTAMPTZ | Y | NULL | INDEX | - | N | N |

> 참고: `name_enc`, `phone_enc`, `birthdate_enc`는 애플리케이션 계층에서 envelope encryption 후 저장합니다.

### 2.2 `notice`

| 컬럼명 | 타입 | Nullable | 기본값 | Unique / Index | FK 관계 | 개인정보/민감정보 | 암호화 |
|---|---|---|---|---|---|---|---|
| id | UUID | N | gen_random_uuid() | PK, UNIQUE | - | N | N |
| source_org | TEXT(enum) | N | - | INDEX | - | N | N |
| external_notice_id | TEXT | N | - | UNIQUE(source, external_notice_id) | - | N | N |
| application_type | TEXT(enum) | N | 'UNKNOWN' | INDEX | - | N | N |
| application_type_raw | TEXT | Y | NULL | INDEX | - | N | N |
| title | TEXT | N | - | INDEX(FTS 권장) | - | N | N |
| body_raw | TEXT | Y | NULL | - | - | N | N |
| posted_at | TIMESTAMPTZ | Y | NULL | INDEX | - | N | N |
| deadline_at | TIMESTAMPTZ | Y | NULL | INDEX | - | N | N |
| region_code | TEXT | Y | NULL | INDEX | - | N | N |
| supply_type | TEXT | Y | NULL | INDEX | - | N | N |
| notice_url | TEXT | Y | NULL | UNIQUE INDEX(선택) | - | N | N |
| parse_status | TEXT | N | 'PARSED' | INDEX | - | N | N |
| created_at | TIMESTAMPTZ | N | now() | INDEX | - | N | N |
| updated_at | TIMESTAMPTZ | N | now() | - | - | N | N |

### 2.3 `eligibility_result`

| 컬럼명 | 타입 | Nullable | 기본값 | Unique / Index | FK 관계 | 개인정보/민감정보 | 암호화 |
|---|---|---|---|---|---|---|---|
| id | UUID | N | gen_random_uuid() | PK, UNIQUE | - | N | N |
| user_profile_id | UUID | N | - | INDEX | FK -> user_profile.id | 개인정보 연결키 | N |
| notice_id | UUID | N | - | INDEX | FK -> notice.id | N | N |
| application_type | TEXT(enum) | N | 'UNKNOWN' | INDEX | - | N | N |
| eligibility_grade | TEXT | N | '검토필요' | INDEX | - | N | N |
| score | NUMERIC(5,2) | Y | NULL | INDEX | - | N | N |
| reason_json | JSONB | Y | '{}'::jsonb | GIN INDEX | - | 조건 해석정보(민감 가능) | 부분 Y(민감 키만) |
| evaluated_at | TIMESTAMPTZ | N | now() | INDEX | - | N | N |
| rule_version | TEXT | N | - | INDEX | - | N | N |
| created_at | TIMESTAMPTZ | N | now() | INDEX | - | N | N |

제약 조건 권장:
- UNIQUE(`user_profile_id`, `notice_id`, `rule_version`)

### 2.4 `notification_log`

| 컬럼명 | 타입 | Nullable | 기본값 | Unique / Index | FK 관계 | 개인정보/민감정보 | 암호화 |
|---|---|---|---|---|---|---|---|
| id | UUID | N | gen_random_uuid() | PK, UNIQUE | - | N | N |
| user_profile_id | UUID | N | - | INDEX | FK -> user_profile.id | 개인정보 연결키 | N |
| notice_id | UUID | N | - | INDEX | FK -> notice.id | N | N |
| eligibility_result_id | UUID | Y | NULL | INDEX | FK -> eligibility_result.id | N | N |
| channel | TEXT | N | 'SLACK' | INDEX | - | N | N |
| recipient_ref_enc | BYTEA | N | - | INDEX(해시 보조 인덱스 권장) | - | 개인정보(수신자 식별자) | Y |
| payload_summary | TEXT | Y | NULL | - | - | 개인정보 비포함 원칙 | N |
| send_status | TEXT | N | 'PENDING' | INDEX | - | N | N |
| error_code | TEXT | Y | NULL | INDEX | - | N | N |
| sent_at | TIMESTAMPTZ | Y | NULL | INDEX | - | N | N |
| created_at | TIMESTAMPTZ | N | now() | INDEX | - | N | N |

제약 조건 권장:
- UNIQUE(`user_profile_id`, `notice_id`, `channel`, `created_at::date`)

---

## 3. 개인정보 정책 교차 참조

- 키 분리 보관 규칙 반영:
  - `user_profile.key_id`로 데이터 암호화에 사용된 키 식별자를 저장합니다.
  - 실제 암호화 키는 DB에 저장하지 않고 외부 키 관리 시스템에서 조회합니다.
- 로그/알림 최소 수집 반영:
  - `notification_log.payload_summary`에는 원문 개인정보를 저장하지 않습니다.
  - 실패 로그(`error_code`)에도 원문 PII를 포함하지 않습니다.
- 상세 정책은 `docs/01-policy/02-data-privacy-policy.md`를 단일 출처(Source of Truth)로 참조합니다.
