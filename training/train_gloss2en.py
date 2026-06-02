#!/usr/bin/env python3
"""
Optional: fine-tune T5-small on gloss→English (GPU recommended).
Always writes browser index via build_gloss2en_index.py.

  pip install transformers datasets sentencepiece accelerate
  python prepare_gloss2en.py
  python train_gloss2en.py --data exports/gloss2en_train.jsonl --epochs 3
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="exports/gloss2en_train.jsonl")
    parser.add_argument("--output-dir", default="checkpoints/gloss2en_t5")
    parser.add_argument("--index-output", default="../public/models/gloss2en/index.json")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--max-samples", type=int, default=0)
    parser.add_argument("--skip-train", action="store_true", help="Only build index")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.is_file():
        print(f"Missing {data_path} — run: python prepare_gloss2en.py")
        sys.exit(1)

    rows = load_jsonl(data_path)
    if args.max_samples > 0:
        rows = rows[: args.max_samples]

    if not args.skip_train:
        try:
            from datasets import Dataset
            from transformers import (
                AutoModelForSeq2SeqLM,
                AutoTokenizer,
                DataCollatorForSeq2Seq,
                Seq2SeqTrainer,
                Seq2SeqTrainingArguments,
            )
        except ImportError:
            print("Install: pip install transformers datasets sentencepiece accelerate")
            sys.exit(1)

        def to_input(r):
            gloss = " ".join(r["gloss"]) if isinstance(r["gloss"], list) else r["gloss"]
            return f"translate gloss to English: {gloss}"

        ds = Dataset.from_list(
            [{"input": to_input(r), "target": r["english"]} for r in rows]
        )

        model_name = "google/t5-small"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

        def preprocess(batch):
            inputs = tokenizer(batch["input"], max_length=64, truncation=True)
            labels = tokenizer(batch["target"], max_length=64, truncation=True)
            inputs["labels"] = labels["input_ids"]
            return inputs

        tokenized = ds.map(preprocess, batched=True, remove_columns=ds.column_names)

        out_dir = Path(args.output_dir)
        training_args = Seq2SeqTrainingArguments(
            output_dir=str(out_dir),
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch_size,
            learning_rate=3e-4,
            save_strategy="epoch",
            logging_steps=50,
            predict_with_generate=True,
        )

        trainer = Seq2SeqTrainer(
            model=model,
            args=training_args,
            train_dataset=tokenized,
            data_collator=DataCollatorForSeq2Seq(tokenizer, model=model),
        )
        trainer.train()
        trainer.save_model(str(out_dir))
        tokenizer.save_pretrained(str(out_dir))
        print(f"T5 checkpoint -> {out_dir}")

        # Augment index with model predictions on training glosses
        model.eval()
        import torch

        entries = {}
        for r in rows:
            gloss = " ".join(r["gloss"]) if isinstance(r["gloss"], list) else r["gloss"]
            inp = tokenizer(to_input(r), return_tensors="pt")
            with torch.no_grad():
                out = model.generate(**inp, max_length=64)
            pred = tokenizer.decode(out[0], skip_special_tokens=True)
            entries[gloss] = {
                "english": pred,
                "questionType": r.get("questionType", "STATEMENT"),
            }

        index_path = Path(args.index_output)
        index_path.parent.mkdir(parents=True, exist_ok=True)
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump({"version": "1.1.0", "count": len(entries), "entries": entries}, f, indent=2)
        print(f"T5-augmented index -> {index_path}")
    else:
        subprocess.run(
            [
                sys.executable,
                str(Path(__file__).parent / "build_gloss2en_index.py"),
                "--data",
                str(data_path),
                "--output",
                args.index_output,
            ],
            check=True,
        )


if __name__ == "__main__":
    main()
