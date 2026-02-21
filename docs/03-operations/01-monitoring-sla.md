# 모니터링/SLA

## 핵심 운영 지표
- 수집 성공률
- 파싱 실패율
- 알림 지연시간
- 정기 Slack report 전송 성공률

## SLA 목표
- 신규 공고 감지 후 30분 내 알림
- Daily report 예정 시각 대비 15분 이내 전송

## 측정/대응 기준
- Daily report 누락 시 Scheduler 상태 점검 후 수동 실행
- 2회 연속 전송 실패 시 Incident로 전환

## 연관 문서
- `docs/03-operations/03-scheduled-slack-report-runbook.md`
- `docs/03-operations/02-incident-response.md`
