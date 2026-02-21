# Open PR 일괄 Close Runbook

누적된 merge 실패로 Open PR들을 중단해야 할 때, 중복 커뮤니케이션 없이 동일한 안내를 남기고 Close 처리하는 운영 절차입니다.

## 1) 목적
- 모든 Open PR에 **동일 구조 코멘트**를 남깁니다.
- 코멘트에는 아래 3가지 필수 항목을 포함합니다.
  - 중단 사유: merge 실패 누적
  - 새 작업 방식: 새 브랜치 + 새 PR
  - 후속 추적 링크: 이슈 또는 트래킹 문서
- 코멘트 등록 후 PR을 Close 처리합니다.

## 2) 공통 코멘트 템플릿
아래 템플릿을 모든 대상 PR에 동일하게 사용합니다.

```md
안내드립니다. 현재 PR은 누적된 merge 실패로 인해 진행을 중단합니다.

## 중단 사유
- merge 실패가 반복적으로 누적되어 현재 브랜치 기준으로 안정적인 통합이 어렵습니다.

## 새 작업 방식
- 최신 base branch에서 **새 브랜치**를 생성합니다.
- 변경사항을 재정리한 뒤 **새 PR**로 다시 등록합니다.
- 기존 PR은 중복 커뮤니케이션 방지를 위해 본 코멘트 후 Close 처리합니다.

## 후속 추적 링크
- <이슈 또는 트래킹 문서 링크>
```

## 3) 실행 방법
아래 스크립트는 Open PR을 조회한 뒤, 각 PR에 공통 코멘트를 남기고 Close 처리합니다.

```bash
python scripts/close_open_prs.py --tracking-link "https://github.com/<org>/<repo>/issues/<id>"
```

### Dry-run
명령 확인만 하고 실제 반영을 하지 않으려면:

```bash
python scripts/close_open_prs.py --tracking-link "https://github.com/<org>/<repo>/issues/<id>" --dry-run
```

## 4) 사전/사후 체크리스트
- 사전
  - 후속 추적 링크(이슈/트래킹 문서)가 생성되어 있는가?
  - 코멘트 템플릿이 최신 운영 원칙과 일치하는가?
- 사후
  - 대상 Open PR 전부에 코멘트가 등록되었는가?
  - 대상 Open PR 전부가 Close 상태로 전환되었는가?
  - 후속 이슈/문서에서 재작업 브랜치와 새 PR 계획이 추적되는가?
