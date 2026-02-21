# Slack 연동 전 수동 실행 테스트 가이드

봇 서버를 상시 운영하기 전, Slack 대화에서 "컨테이너에서 단발 실행"을 요청해 결과를 확인할 때 사용하는 운영 가이드입니다.

## 1) 목적
- 현재 저장소가 제공하는 수집/파싱/매칭/알림 기능을 단발 실행 기준으로 검증합니다.
- Slack 대화에서 어떤 질문을 하면 어떤 결과를 받을 수 있는지 공통 포맷을 제공합니다.
- 향후 Slack bot 상시 운영 전까지 임시 테스트 루틴을 표준화합니다.

## 2) 현재 가능한 범위(기능 계약)
- SH/LH 공고 수집: 기관별 게시판에서 최근 공고를 조회
- 파싱/정규화: `application_type`, 자격요건 관련 필드, 원문 링크/기간 정규화
- 프로필 기반 판정: `확정 가능` / `유력` / `검토필요` / `부적합`
- 알림 포맷 생성: 기관/공고명/판정등급/판정근거/링크

### 현재 미지원 범위
- Slack에서 사용자 입력을 받아 되묻는 대화형 인터랙션(수신 엔드포인트, 세션 상태관리)
- Slack command/mention으로 즉시 트리거되는 양방향 bot 플로우

## 3) Slack에서 요청할 때 권장 질문 템플릿
아래 문장을 복사해 요청하면 단발 실행 결과를 재현하기 쉽습니다.

### A. 기본 수집/판정 요청
```text
컨테이너에서 SH/LH 최신 공고 단발 실행해줘.
수집/파싱/매칭/저장/알림 건수 요약과 기관별 실패 여부를 같이 알려줘.
```

### B. 프로필 기반 추천 요청
```text
아래 프로필로 단발 실행해줘.
- region: 서울
- incomeBand: 도시근로자 월평균소득 100% 이하
- assetBand: 총자산 3억 이하
- householdType: 무주택세대구성원

결과는 상위 추천 N건(공고명/등급/근거/링크)으로 요약해줘.
```

### C. 장애/부분실패 점검 요청
```text
단발 실행 후 SH/LH 기관별 오류코드(NETWORK_ERROR, BAD_STATUS_CODE, PARSE_ERROR)와
has_partial_failure 값을 알려줘.
```

## 4) 응답으로 기대할 수 있는 데이터

### 실행 요약 지표
- `collected`: 수집 건수
- `parsed`: 파싱 건수
- `matched`: 판정 건수
- `saved.created|updated|skipped`: 저장 결과
- `notified`: 실제 전송 건수

### 기관별 상태
- `by_org.SH.error`, `by_org.LH.error` 존재 여부
- 부분 실패 여부(`has_partial_failure`)

### 추천 상세(요약형)
- 공고명(`title`)
- 기관(`source_org`)
- 판정등급(`grade`)
- 판정근거(`reasons`)
- 원문 링크(`original_link`)

## 5) 테스트용 예시 프로필 세트

### Profile-1 (보수적)
- `region`: 서울
- `incomeBand`: 도시근로자 월평균소득 80% 이하
- `assetBand`: 총자산 2억 이하
- `householdType`: 무주택세대구성원

### Profile-2 (중립)
- `region`: 서울
- `incomeBand`: 도시근로자 월평균소득 100% 이하
- `assetBand`: 총자산 3억 이하
- `householdType`: 무주택세대구성원

### Profile-3 (완화)
- `region`: 경기
- `incomeBand`: 도시근로자 월평균소득 120% 이하
- `assetBand`: 총자산 3.6억 이하
- `householdType`: 청년 1인

## 6) 결과 해석 가이드
- `검토필요`가 일정 비율 이상이면 파싱 모호성/요건 누락 가능성을 먼저 확인합니다.
- `notified`가 0인데 `matched`가 존재하면 dedupe(중복 키) 또는 채널 설정을 확인합니다.
- 기관별 `error`가 존재하면 해당 기관만 부분 실패했는지(`has_partial_failure=true`) 함께 확인합니다.

## 7) 운영 주의사항
- 이 가이드는 "Slack 수동 지시 + 컨테이너 단발 실행" 전용입니다.
- Webhook URL 등 Secret은 메시지 본문/로그에 원문 노출하지 않습니다.
- 실운영 채널 전송 전 sandbox 채널로 먼저 검증합니다.

## 8) 문서 동기화 규칙(매 개발 갱신)
아래 항목이 바뀌면 이 문서를 같은 PR에서 반드시 갱신합니다.
- 수집 대상 기관/필드/에러코드
- 판정 등급 또는 판정 근거 코드
- Slack 알림 포맷(메시지 필드)
- 실행 방법/입력 파라미터/출력 요약 포맷

갱신 시 함께 점검할 문서:
- `README.md`
- `docs/README.md`
- `docs/workflow.md`
