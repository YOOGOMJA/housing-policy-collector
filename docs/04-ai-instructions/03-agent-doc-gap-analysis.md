# AI 에이전트 문서 갭 분석

## 기준 문서
- AGENTS.md 표준 가이드: https://agents.md/
- Claude Context Windows: https://platform.claude.com/docs/en/build-with-claude/context-windows
- Claude Prompt Engineering Overview: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview

## 현재 상태 요약
현재 저장소의 AI 문서는 아래 2개 중심이며, 목적/원칙 수준의 선언이 대부분입니다.
- `01-agent-guidelines.md`: 고수준 원칙만 존재
- `02-subagent-workflow.md`: 역할 순서 중심의 간단한 단계 정의

## 누락된 핵심 항목

### A. AGENTS.md 관점 누락
- 에이전트가 우선 따를 "작업 규칙 파일의 탐색 범위/우선순위"가 구체화되어 있지 않음
- 디렉터리 스코프 기반 규칙 상속/충돌 해소 규칙 부재
- PR/커밋/문서 동기화 체크리스트의 표준 포맷 부재

### B. Context Window 관점 누락
- 긴 컨텍스트 작업에서 필요한 "핵심 요약본(working summary)" 문서 부재
- 토큰 예산 관리(필수/선택 문맥 구분) 규칙 부재
- 대규모 문서 변경 시 단계별 로딩 전략(필수 문서 → 관련 문서 → 부가 문서) 부재

### C. Prompt Engineering 관점 누락
- 시스템/개발자/사용자 지시 우선순위 적용 템플릿 부재
- 멀티샷 예시, 출력 포맷 고정, 자기검증(체크리스트) 프롬프트 템플릿 부재
- 실패 패턴(환각/누락/과도한 수정) 대응용 프롬프트 가드레일 부재

## 추가가 필요한 문서 (우선순위)
1. `docs/04-ai-instructions/04-context-window-playbook.md`
   - 컨텍스트 예산, 요약 전략, 문서 로딩 순서, 긴 작업 분할 규칙
2. `docs/04-ai-instructions/05-prompt-engineering-playbook.md`
   - 작업 유형별 프롬프트 템플릿(분석/수정/리뷰/릴리즈)
3. `docs/04-ai-instructions/06-agents-md-ops.md`
   - AGENTS.md 배치 규칙, 스코프 우선순위, 변경 시 운영 절차

## 실행 제안
- 1단계: 본 문서 기준으로 누락 문서를 생성
- 2단계: `docs/README.md` 인덱스에 새 문서를 추가
- 3단계: `docs/workflow.md`의 이슈/PR 체크리스트에 "AI 문서 동기화 확인" 항목 추가
