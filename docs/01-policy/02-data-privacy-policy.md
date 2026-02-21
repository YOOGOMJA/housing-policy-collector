# 개인정보 정책

본 문서는 개인정보 처리 최소화, 암호화, 키 분리 보관 원칙을 정의합니다.

연관 기술 문서: `docs/02-tech-wiki/02-data-model.md`

## 1. 기본 원칙

- 로컬 우선 저장
- 민감정보 암호화
- 키/데이터 분리 보관
- 로그 최소 수집(PII 원문 금지)

## 2. 키 분리 보관 정책

1. 데이터 저장소(DB)에는 암호화된 값(ciphertext)과 `key_id`만 저장합니다.
2. 실제 암호화 키(KEK/DEK)는 KMS 또는 Secret Manager 등 외부 키 저장소에 보관합니다.
3. 애플리케이션은 `key_id`를 통해 실행 시점에만 키를 조회하며, 키 평문을 영속 저장하지 않습니다.
4. 키 회전 시 `key_id`를 기준으로 점진적 재암호화(re-encryption)를 수행합니다.

## 3. 데이터 모델 반영 규칙 (교차 참조)

아래 규칙은 `docs/02-tech-wiki/02-data-model.md`에 반영되어야 합니다.

- `user_profile`
  - `name_enc`, `phone_enc`, `birthdate_enc`는 암호화 저장.
  - `key_id` 필수 저장으로 키 식별자/데이터 분리를 강제.
- `notification_log`
  - `recipient_ref_enc` 암호화 저장.
  - `payload_summary`, `error_code`에는 개인정보 원문 저장 금지.
- `eligibility_result`
  - `reason_json`은 민감 키를 부분 암호화 또는 마스킹.
- `notice`
  - `source_org`(SH/LH)와 `application_type`(청약 형태 enum)을 분리 저장해 분류 기준 충돌을 방지.
  - 공고 데이터 자체는 원칙적으로 비개인정보로 관리하되, 외부 URL/원문 수집 시 개인정보 유입 여부를 점검.

## 4. 운영 통제

- 접근 통제: 최소 권한(least privilege) 기반으로 운영 계정 분리.
- 감사 로그: 키 조회, 복호화 요청, 개인정보 접근 이벤트 기록.
- 보존/삭제: 서비스 목적 달성 후 보존 주기 정책에 따라 파기.
- 장애 대응: 키 저장소 장애 시 복호화 의존 기능은 안전 실패(fail-safe) 처리.
