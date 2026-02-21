# housing-policy-collector

SH/LH 청약 공고를 개인 조건에 맞춰 선별하고 알림을 보내는 1인 사용자용 프로젝트입니다.

## 실행 스택
- 단일 실행 스택: **Python 3.10+**
- 프로젝트 설정 파일: `pyproject.toml`
- 앱 시작점: `src/main.py`
- 배치 시작점: `src/batch_main.py`

## 빠른 실행
```bash
python src/main.py
python src/batch_main.py
```

## 문서 시작점
- 전체 문서 인덱스: `docs/README.md`
- 정기 Slack 리포트 운영 기준: `docs/03-operations/03-scheduled-slack-report-runbook.md`
- 에이전트 운영 규칙: `AGENTS.md`
- 커밋 스코프 운영 가이드: `docs/03-operations/04-commit-scope-governance.md`
- Open PR 충돌/우선순위 기록: `docs/03-operations/05-open-pr-conflict-priority-report.md`
- Claude 작업 가이드: `claude.md`

## 현재 원칙
1. 기획 문서 확정 후 정책 문서 확정
2. 정책 문서 확정 후 기술/운영 구현
3. 모든 구현 변경은 문서 동시 업데이트
4. AI 지침 문서 변경 시 인덱스/워크플로우 문서 동기화
5. PR CI에서 변경 유형별 자동 검증(lint/commitlint/YAML 문서 검사)
