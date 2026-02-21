# 정기 Slack Report Runbook

정기 실행되는 배치 결과를 Slack bot으로 리포트할 때 필요한 운영 기준을 정의합니다.

## 1) 목적
- 수집/파싱/알림 배치의 상태를 매일 같은 형식으로 확인합니다.
- 실패 신호를 조기에 발견하고 Incident 대응 시간을 단축합니다.

## 2) 범위
- 대상 채널: 운영 채널 1개(`#ops-housing-bot`)
- 전송 주기: 하루 1회(권장 09:00 KST), 주간 요약 1회(월요일 09:30 KST)
- 전송 주체: Scheduler(CRON) + Slack bot(Webhook 또는 Bot Token)

## 3) 리포트 최소 포함 항목
- 실행 시각(start/end, duration)
- 수집 결과(총 공고 수, 신규 공고 수)
- 파싱 결과(성공/실패 건수, 실패율)
- 알림 결과(발송 성공/실패 건수, dedupe 적용 건수)
- 에러 요약(Top N 메시지, trace id)
- 다음 액션(재시도 여부, 담당자 mention)

## 4) 메시지 템플릿
```text
[Housing Policy Collector] Daily Report ({{date}})
- Job: {{job_name}} / {{status}} / {{duration}}s
- Collect: total={{collect_total}}, new={{collect_new}}
- Parse: success={{parse_success}}, fail={{parse_fail}} ({{parse_fail_rate}}%)
- Notify: success={{notify_success}}, fail={{notify_fail}}, dedupe={{notify_dedupe}}
- Error: {{error_summary}}
- Action: {{next_action}}
```

## 5) 실패/누락 대응 기준
- 1회 실패: 즉시 Slack alert + 10분 뒤 1회 자동 재시도
- 2회 연속 실패: `docs/03-operations/02-incident-response.md` 절차로 Incident 전환
- 리포트 미수신(예정 시각 + 15분): Scheduler 상태 점검 후 수동 실행

## 6) 보안/권한
- Slack Secret(Bot Token, Webhook URL)은 Secret Manager에 저장
- 로그에 Secret 원문 출력 금지
- 운영 채널 외 전송 금지(테스트는 sandbox 채널 사용)

## 7) 문서 동기화 규칙
- 지표 항목 변경 시 `docs/03-operations/01-monitoring-sla.md`를 함께 수정
- 리포트 정책 변경 시 `docs/01-policy/03-notification-policy.md`를 함께 수정
- 운영 절차 변경 시 `docs/workflow.md` 체크리스트를 함께 점검
