#!/usr/bin/env python3
"""
Build gloss → English training pairs for SignBridge.

Sources (any combination):
  1. Built-in seed pairs (GrammarEngine spec examples)
  2. Tab/comma file: gloss<TAB>english  (gloss = space-separated ASL tokens)
  3. How2Sign-style CSV: sentence_id, english (requires --gloss-dir with matching .txt)
  4. Existing JSONL append

Output: training/exports/gloss2en_train.jsonl
  {"gloss": ["YOU", "NAME", "WHAT"], "english": "What is your name?", "questionType": "WH"}

Example:
  python prepare_gloss2en.py --output exports/gloss2en_train.jsonl
  python prepare_gloss2en.py --pairs-csv data/how2sign_gloss_en.tsv --output exports/gloss2en_train.jsonl
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

SEED_PAIRS: list[tuple[list[str], str, str]] = [
    (["YOU", "NAME", "WHAT"], "What is your name?", "WH"),
    (["YOU", "EAT", "WHAT"], "What did you eat?", "WH"),
    (["TODAY", "WEATHER", "HOT"], "Today the weather is hot.", "STATEMENT"),
    (["YESTERDAY", "I", "GO", "STORE"], "Yesterday I went to the store.", "STATEMENT"),
    (["YOU", "HUNGRY"], "Are you hungry?", "YES_NO"),
    (["I", "FEEL", "HEADACHE"], "I feel a headache.", "STATEMENT"),
    (["TIME", "WHAT"], "What is the time?", "WH"),
    (["I", "TIRED", "VERY"], "I am very tired.", "STATEMENT"),
    (["WHERE", "YOU", "GO"], "Where did you go?", "WH"),
    (["I", "WANT", "WATER"], "I want water.", "STATEMENT"),
    (["YOU", "UNDERSTAND", "ME"], "Do you understand me?", "YES_NO"),
    (["TOMORROW", "I", "GO", "SCHOOL"], "Tomorrow I will go to school.", "STATEMENT"),
    (["I", "NOT", "KNOW"], "I don't know.", "STATEMENT"),
    (["HOW", "YOU", "FEEL"], "How do you feel?", "WH"),
    (["I", "NEED", "HELP"], "I need help.", "STATEMENT"),
]


def normalize_gloss_tokens(text: str) -> list[str]:
    text = text.strip().upper()
    text = re.sub(r"[^\w\s:+]", " ", text)
    return [w for w in text.split() if w]


def infer_question_type(gloss: list[str]) -> str:
    if any(w in gloss for w in ("WHAT", "WHERE", "WHEN", "WHY", "WHO", "HOW", "WHICH")):
        return "WH"
    if len(gloss) <= 3 and "YOU" in gloss:
        return "YES_NO"
    return "STATEMENT"


def record(gloss: list[str], english: str, qtype: str | None = None) -> dict:
    return {
        "gloss": gloss,
        "english": english.strip(),
        "questionType": qtype or infer_question_type(gloss),
    }


def gloss_key(gloss: list[str]) -> str:
    return " ".join(gloss)


def load_pairs_csv(path: Path) -> list[dict]:
    rows: list[dict] = []
    with open(path, encoding="utf-8", newline="") as f:
        sample = f.read(2048)
        f.seek(0)
        delimiter = "\t" if "\t" in sample else ","
        reader = csv.reader(f, delimiter=delimiter)
        for row in reader:
            if len(row) < 2:
                continue
            g, e = row[0], row[1]
            if g.lower() in ("gloss", "asl") or e.lower() in ("english", "translation"):
                continue
            tokens = normalize_gloss_tokens(g)
            if not tokens or not e.strip():
                continue
            rows.append(record(tokens, e))
    return rows


def load_how2sign(gloss_dir: Path, en_csv: Path) -> list[dict]:
    """Match How2Sign sentence_id between gloss .txt and English CSV."""
    gloss_map: dict[str, list[str]] = {}
    for txt in gloss_dir.rglob("*.txt"):
        sid = txt.stem
        raw = txt.read_text(encoding="utf-8", errors="ignore")
        tokens = normalize_gloss_tokens(raw.replace("\n", " "))
        if tokens:
            gloss_map[sid] = tokens

    rows: list[dict] = []
    with open(en_csv, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return rows
        fields = {h.lower(): h for h in reader.fieldnames}
        id_col = fields.get("sentence_id") or fields.get("id") or reader.fieldnames[0]
        en_col = (
            fields.get("english")
            or fields.get("translation")
            or fields.get("text")
            or reader.fieldnames[-1]
        )
        for row in reader:
            sid = row.get(id_col, "").strip()
            english = row.get(en_col, "").strip()
            if not sid or not english:
                continue
            tokens = gloss_map.get(sid)
            if not tokens:
                continue
            rows.append(record(tokens, english))
    return rows


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            gloss = obj.get("gloss", [])
            if isinstance(gloss, str):
                gloss = normalize_gloss_tokens(gloss)
            english = obj.get("english", "")
            if gloss and english:
                rows.append(
                    record(gloss, english, obj.get("questionType"))
                )
    return rows


def dedupe(rows: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}
    for r in rows:
        key = gloss_key(r["gloss"])
        seen[key] = r
    return list(seen.values())


def main():
    parser = argparse.ArgumentParser(description="Prepare gloss→English JSONL")
    parser.add_argument("--output", default="exports/gloss2en_train.jsonl")
    parser.add_argument("--pairs-csv", help="TSV/CSV: gloss<TAB>english")
    parser.add_argument("--how2sign-gloss-dir", help="Directory of per-sentence gloss .txt files")
    parser.add_argument("--how2sign-en-csv", help="English translation CSV with sentence_id")
    parser.add_argument("--append-jsonl", help="Merge existing JSONL")
    parser.add_argument("--no-seed", action="store_true", help="Skip built-in seed pairs")
    args = parser.parse_args()

    all_rows: list[dict] = []

    if not args.no_seed:
        for gloss, english, qtype in SEED_PAIRS:
            all_rows.append(record(gloss, english, qtype))

    if args.pairs_csv:
        all_rows.extend(load_pairs_csv(Path(args.pairs_csv)))

    if args.how2sign_gloss_dir and args.how2sign_en_csv:
        all_rows.extend(
            load_how2sign(Path(args.how2sign_gloss_dir), Path(args.how2sign_en_csv))
        )

    if args.append_jsonl:
        all_rows.extend(load_jsonl(Path(args.append_jsonl)))

    all_rows = dedupe(all_rows)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    with open(out, "w", encoding="utf-8") as f:
        for row in all_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Wrote {len(all_rows)} pairs -> {out}")
    print("Next: python build_gloss2en_index.py --data", out)


if __name__ == "__main__":
    main()
