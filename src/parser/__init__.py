"""Parser 모듈."""


def parse(source_ids: list[str]) -> list[dict[str, str]]:
    """파싱 단계 최소 골격."""
    return [{"source_id": source_id, "title": "샘플 공고"} for source_id in source_ids]
