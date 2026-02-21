"""애플리케이션 시작점."""

from collector import collect
from matcher import match
from notifier import notify
from parser import parse
from storage import save


def run_pipeline() -> dict[str, int]:
    """모듈 경계를 확인하는 최소 파이프라인."""
    source_ids = collect()
    parsed_items = parse(source_ids)
    matched_items = match(parsed_items)
    saved_count = save(matched_items)
    notified_count = notify(matched_items)
    return {
        "collected": len(source_ids),
        "parsed": len(parsed_items),
        "saved": saved_count,
        "notified": notified_count,
    }


def main() -> None:
    result = run_pipeline()
    print(f"app started: {result}")


if __name__ == "__main__":
    main()
