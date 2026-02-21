"""배치 실행용 엔트리포인트."""

from datetime import datetime, timezone

from main import run_pipeline


def main() -> None:
    started_at = datetime.now(tz=timezone.utc).isoformat()
    result = run_pipeline()
    print(f"batch executed at {started_at}: {result}")


if __name__ == "__main__":
    main()
