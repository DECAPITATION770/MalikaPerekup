"""Lightweight i18n: load JSON dictionaries once, look up by flat key.

Usage::

    from app.common.i18n import t

    t("errors.not_found", lang="ru")   # → "Не найдено"
    t("errors.not_found", lang="uz")   # → "Topilmadi"

If a key is missing in the requested language we fall back to Russian
(the default locale). If it is missing in both, the key itself is
returned so missing translations are visible during development.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

Language = Literal["ru", "uz"]
DEFAULT_LANGUAGE: Language = "ru"

_I18N_DIR = Path(__file__).resolve().parent.parent / "i18n"


@lru_cache
def _load(lang: Language) -> dict[str, str]:
    """Load and cache the JSON dictionary for one language."""
    path = _I18N_DIR / f"{lang}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def t(key: str, lang: Language = DEFAULT_LANGUAGE, **params: str | int) -> str:
    """Translate ``key`` to ``lang`` and substitute ``{name}`` placeholders.

    Falls back to Russian, then to the raw key.
    """
    value = _load(lang).get(key) or _load(DEFAULT_LANGUAGE).get(key) or key
    if params:
        try:
            return value.format(**params)
        except (KeyError, IndexError):
            return value
    return value
