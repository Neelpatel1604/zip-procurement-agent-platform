from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import get_settings


def load_recipe(recipe_id: str) -> dict[str, Any]:
    path = get_settings().recipes_dir / f"{recipe_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Recipe not found: {recipe_id} ({path})")
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    required = {"id", "name", "model", "tools", "output_format", "system_prompt"}
    missing = required - set(data)
    if missing:
        raise ValueError(f"Recipe {recipe_id} missing keys: {missing}")
    return data


def list_recipes() -> list[dict[str, Any]]:
    recipes_dir: Path = get_settings().recipes_dir
    recipes = []
    for path in sorted(recipes_dir.glob("*.json")):
        with path.open(encoding="utf-8") as f:
            recipes.append(json.load(f))
    return recipes
