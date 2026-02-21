#!/usr/bin/env python3
"""Open PR 일괄 안내 코멘트 + Close 자동화 스크립트.

요구사항:
- 모든 Open PR에 동일한 구조의 코멘트를 남긴다.
- 코멘트에는 중단 사유, 새 작업 방식, 후속 추적 링크를 포함한다.
- 코멘트 작성 후 PR을 Close 처리한다.
"""

from __future__ import annotations

import argparse
import subprocess
from typing import Iterable


def run_gh(args: list[str], dry_run: bool = False) -> str:
    cmd = ["gh", *args]
    print("$", " ".join(cmd))
    if dry_run:
        return ""
    return subprocess.check_output(cmd, text=True).strip()


def list_open_pr_numbers(limit: int, dry_run: bool = False) -> list[int]:
    if dry_run:
        print("[dry-run] Open PR 조회를 생략합니다.")
        return []

    output = run_gh(
        [
            "pr",
            "list",
            "--state",
            "open",
            "--limit",
            str(limit),
            "--json",
            "number",
            "--jq",
            ".[].[\"number\"]",
        ],
        dry_run=dry_run,
    )
    if not output:
        return []
    return [int(line.strip()) for line in output.splitlines() if line.strip()]


def build_comment_template(tracking_link: str) -> str:
    return f"""안내드립니다. 현재 PR은 누적된 merge 실패로 인해 진행을 중단합니다.

## 중단 사유
- merge 실패가 반복적으로 누적되어 현재 브랜치 기준으로 안정적인 통합이 어렵습니다.

## 새 작업 방식
- 최신 base branch에서 **새 브랜치**를 생성합니다.
- 변경사항을 재정리한 뒤 **새 PR**로 다시 등록합니다.
- 기존 PR은 중복 커뮤니케이션 방지를 위해 본 코멘트 후 Close 처리합니다.

## 후속 추적 링크
- {tracking_link}
"""


def close_prs(pr_numbers: Iterable[int], comment: str, dry_run: bool = False) -> None:
    for pr_number in pr_numbers:
        run_gh(["pr", "comment", str(pr_number), "--body", comment], dry_run=dry_run)
        run_gh(["pr", "close", str(pr_number)], dry_run=dry_run)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Open PR에 공통 코멘트를 남기고 Close 처리합니다."
    )
    parser.add_argument(
        "--tracking-link",
        required=True,
        help="후속 추적 링크(이슈/트래킹 문서 URL)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=200,
        help="조회할 Open PR 최대 개수 (기본값: 200)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제 코멘트/Close 없이 실행 명령만 출력합니다.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    comment = build_comment_template(args.tracking_link)
    pr_numbers = list_open_pr_numbers(limit=args.limit, dry_run=args.dry_run)

    if not pr_numbers:
        print("처리할 Open PR이 없습니다.")
        return

    print(f"Open PR {len(pr_numbers)}건을 처리합니다: {pr_numbers}")
    close_prs(pr_numbers, comment=comment, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
