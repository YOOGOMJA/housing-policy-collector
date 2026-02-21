# housing-policy-collector

SH/LH 청약 공고를 개인 조건에 맞춰 선별하고 알림을 보내는 1인 사용자용 프로젝트입니다.

## 실행 스택
- 런타임: **Node.js 20+**
- 언어/빌드: **TypeScript (`tsc`)**
- 프로젝트 설정 파일: `package.json`, `tsconfig.json`
- 앱 시작점: `src/main.ts`
- 배치 시작점: `src/batch_main.ts`

## 빠른 실행
```bash
npm run dev
npm run start
npm run start:batch
```

- `npm run dev`: `src/main.ts` 개발 실행
- `npm run start`: 빌드 결과 기준 앱 실행(`src/main.ts`)
- `npm run start:batch`: 빌드 결과 기준 배치 실행(`src/batch_main.ts`)

## 빌드/운영 실행
```bash
npm run build
npm run start
npm run start:batch
```

## TypeScript lint/컨벤션 검증 명령
```bash
npm run lint
npm run build
```

- `npm run lint`: `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` 및 import 정렬 규칙을 포함해 `src/**/*.ts`, `tests/**/*.ts` 중심 TS 코드 컨벤션을 검사합니다.
- `npm run build`: `tsconfig.json`(`rootDir`, `outDir`, `module`, `target`, `strict`) 기준으로 컴파일 가능 여부를 검증합니다.

## 문서 시작점
- 전체 문서 인덱스: `docs/README.md`
- 정기 Slack 리포트 운영 기준: `docs/03-operations/03-scheduled-slack-report-runbook.md`
- Slack 연동 전 단발 실행 테스트 가이드: `docs/03-operations/06-slack-manual-test-guide.md`
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

POC 범위에서는 SH 공고 수집·필수 필드 추출·기본 분류까지를 자동화 대상으로 하며, 파싱 불확실 건(`UNKNOWN`)과 정책 규칙 충돌 건은 수동 검토 범위로 명시합니다. 수동 검토는 배치 회차별 로그/분기율/소요시간을 함께 기록해 다음 자동화 우선순위 입력으로 사용합니다.
