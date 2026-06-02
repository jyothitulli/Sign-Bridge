#!/usr/bin/env python3
"""Build browser-deployable gloss→English lookup index from JSONL."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="exports/gloss2en_train.jsonl")
    parser.add_argument("--output", default="../public/models/gloss2en/index.json")
    args = parser.parse_args()

    entries: dict[str, dict] = {}
    reverse: dict[str, list[str]] = {}
    with open(args.data, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            row = json.loads(line)
            gloss = row.get("gloss", [])
            if isinstance(gloss, str):
                gloss = gloss.upper().split()
            key = " ".join(gloss)
            english = row["english"].strip()
            entries[key] = {
                "english": english,
                "questionType": row.get("questionType", "STATEMENT"),
            }
            norm_en = (
                english.lower()
                .replace("?", "")
                .replace(".", "")
                .replace(",", "")
                .strip()
            )
            if norm_en:
                reverse[norm_en] = gloss

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "version": "1.1.0",
        "count": len(entries),
        "entries": entries,
        "reverse": reverse,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Index: {len(entries)} entries -> {out}")


if __name__ == "__main__":
    main()
