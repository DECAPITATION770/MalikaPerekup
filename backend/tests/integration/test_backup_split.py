from pathlib import Path

from app.features.backup import service


def test_split_and_join_roundtrip(tmp_path):
    src = tmp_path / "archive.tar.gz"
    src.write_bytes(b"X" * (3 * 1024 * 1024 + 123))  # 3MB+
    parts = service.split_file(
        src, part_size_mb=1, backup_id=42, stamp="20260612-000000"
    )
    assert len(parts) == 4
    for i, p in enumerate(parts, 1):
        assert Path(p).name == f"malika-backup-42-20260612-000000.part{i:02d}"
    # склейка
    joined = tmp_path / "joined.bin"
    with open(joined, "wb") as out:
        for p in parts:
            out.write(Path(p).read_bytes())
    assert joined.read_bytes() == src.read_bytes()
