"""Массовые операции с object storage для бэкапа.

Тонкие обёртки над ``minio``-клиентом из ``app.common.storage`` — НЕ раздуваем
общий storage.py операциями, нужными только бэкапу.
"""

from __future__ import annotations

from pathlib import Path

from app.common.storage import _client
from app.core.config import get_settings


def iter_keys() -> list[str]:
    settings = get_settings()
    client = _client()
    return [
        obj.object_name
        for obj in client.list_objects(settings.s3_bucket, recursive=True)
    ]


def download_all(dest: Path) -> int:
    """Скачать все объекты бакета в ``dest/<key>``. Вернуть число файлов."""
    settings = get_settings()
    client = _client()
    count = 0
    for key in iter_keys():
        target = dest / key
        target.parent.mkdir(parents=True, exist_ok=True)
        client.fget_object(settings.s3_bucket, key, str(target))
        count += 1
    return count


def upload_all(src: Path) -> int:
    """Залить все файлы из ``src`` обратно в бакет (overwrite по ключу)."""
    settings = get_settings()
    client = _client()
    count = 0
    for path in src.rglob("*"):
        if not path.is_file():
            continue
        key = str(path.relative_to(src))
        client.fput_object(settings.s3_bucket, key, str(path))
        count += 1
    return count
