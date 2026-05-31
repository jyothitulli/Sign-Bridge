#!/usr/bin/env python3
"""Merge multiple SignBridge JSON exports into one training file."""

import argparse
import json
from datetime import datetime, timezone


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="+", help="JSON export files")
    parser.add_argument("-o", "--output", default="exports/merged.json")
    args = parser.parse_args()

    all_samples = []
    all_templates = []
    sources = []

    for path in args.inputs:
        data = load(path)
        all_samples.extend(data.get("samples", []))
        all_templates.extend(data.get("templates", []))
        sources.append(path)

    merged = {
        "samples": all_samples,
        "templates": all_templates,
        "mergedAt": datetime.now(timezone.utc).isoformat(),
        "sources": sources,
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)

    words = {}
    for s in all_samples:
        w = s.get("word", "").split("_")[0].upper()
        words[w] = words.get(w, 0) + 1

    print(f"Merged {len(all_samples)} samples, {len(all_templates)} templates")
    print(f"Unique words: {len(words)}")
    print(f"Saved to {args.output}")


if __name__ == "__main__":
    main()
