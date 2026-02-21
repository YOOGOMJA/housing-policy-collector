from main import run_pipeline


def test_run_pipeline_smoke() -> None:
    result = run_pipeline()

    assert result == {
        "collected": 1,
        "parsed": 1,
        "saved": 1,
        "notified": 1,
    }
