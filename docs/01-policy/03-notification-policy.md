# 알림 정책

## 사용자 알림
- 신규 공고 알림
- 마감 3일/1일/당일 리마인드
- dedupe key로 중복 방지

## 운영 알림 (Slack bot)
- 배치 실행 결과를 Daily report로 운영 채널에 전송
- 실패 시 즉시 alert 전송 후 자동 재시도 1회
- 2회 연속 실패 시 Incident 대응 절차로 전환

## 연관 문서
- `docs/03-operations/03-scheduled-slack-report-runbook.md`
- `docs/03-operations/02-incident-response.md`
