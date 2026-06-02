## Two ways to get accuracy

| Path | Who records data | Best for |
|------|------------------|----------|
| **[TRAINING_NO_RECORDING.md](./TRAINING_NO_RECORDING.md)** | **WLASL public dataset** (download once) | **You — no webcam recording** |
| **[TRAINING.md](./TRAINING.md)** | You + team in `/collect` | Personal / domain-specific fine-tuning |

**Start here if you want to skip `/collect`:** `training/train_public.py`

This guide is the multi-week plan to move SignBridge from **demo prototype** to **usable real-world translation**.

---

## The honest baseline

| Today (no training) | After this roadmap |
|---------------------|-------------------|
| ~33 synthetic DTW templates | Your signs + optional public data |
| Wrong words common | 70–90%+ per-word accuracy (domain-limited) |
| Demo vocabulary only | Emergency or daily packs (50+ words) |
| Works for one setup | Works for trained signers + conditions |

Real-world does **not** mean “all of ASL.” It means **reliable in a chosen domain** (emergency, daily chat, medical, etc.) with **real recorded data**.

---

## Architecture (after training)

```
Camera → MediaPipe landmarks
      → motion pause detection (segment each sign)
      → LSTM per segment (trained on YOUR data)
      → GrammarEngine → natural English sentence
```

DTW + built-in templates are fallbacks until `public/models/lstm/model.json` exists.

---

## Week-by-week plan

### Week 1 — Data collection setup

**Goal:** Start building a real dataset.

1. Open **`/collect`** in the app (new page in navbar).
2. Pick a vocabulary pack:
   - **Emergency & Safety** — 18 words (HELP, POLICE, HOSPITAL, …)
   - **Daily Conversation** — 34 words (HELLO, YOU, HUNGRY, …)
3. For each word, record **50 repetitions**:
   - Sign → **pause 1 full second** → next rep
   - Vary slightly: closer/farther, slower/faster, slight angle change
4. Export JSON when you have ~200+ total clips.

**Targets:**

| Metric | Minimum | Good | Strong |
|--------|---------|------|--------|
| Reps per word | 30 | 50 | 100 |
| Total clips | 500 | 1,500 | 3,000+ |
| Signers | 1 (you) | 2–3 people | 5+ |

**Tips:**

- Same room/lighting for first pass; add a “hard conditions” session later (dim light, different shirt).
- Use **640×480** in Settings.
- If it gets “stuck signing,” put hands down completely for 1 second.

---

### Week 2 — First trained model

**Goal:** Replace synthetic DTW with your LSTM.

```powershell
# From project root (fixes tensorflowjs / tf_keras / decision-forests on Python 3.13):
npm run setup:training
# Verify: python -c "import tensorflow; import tensorflowjs; print('OK')"

# Or: python training/setup_env.py
# Python 3.11 only: python training/setup_env.py --legacy

cd signbridge\training

# If multiple exports from different devices:
python merge_datasets.py export1.json export2.json -o exports\merged.json

python train_lstm.py --data exports\merged.json --output ..\public\models\lstm --epochs 60

# Or TCN (recommended — set architecture: "tcn" in config.json):
python train_tcn.py --data exports\merged.json --output ..\public\models\lstm --epochs 80
# npm run train:tcn

### Gloss → English (sentence translation)

```bash
npm run train:gloss2en
# With How2Sign (after download):
python training/prepare_gloss2en.py --how2sign-gloss-dir data/how2sign/gloss --how2sign-en-csv data/how2sign/en.csv
python training/build_gloss2en_index.py
# Optional T5 fine-tune (GPU):
pip install -r training/requirements-ml.txt
python training/train_gloss2en.py --data training/exports/gloss2en_train.jsonl

# Quantize sign classifier for mobile:
npm run export:tfjs
```
python evaluate_model.py --data exports\merged.json --model ..\public\models\lstm
```

Restart the app (`npm run dev`). Translate badge should show **LSTM**.

**Success criteria:**

- Validation accuracy **≥ 65%** (first pass)
- Per-word accuracy **≥ 50%** on every word you care about
- If a word is below 50%, record **30 more reps** for that word only

---

### Week 3 — Multi-signer + domain hardening

**Goal:** Generalize beyond one person.

1. Have 2–3 friends record the **same vocabulary** on their laptops/phones.
2. Merge all exports → retrain.
3. Test in:
   - Different rooms
   - Different times of day
   - Slightly faster/slower signing
4. Fix weak words with targeted collection (not more random data).

**Optional:** Add custom words to `public/vocabularies/` and `training/vocabularies/` (same JSON format).

**Success criteria:**

- Validation **≥ 75%**
- Real-world test: 8 scripted sentences from `/practice` challenges score **≥ 70%**

---

### Week 4 — Production polish

**Goal:** Reliable enough for a pilot (school, clinic, event).

1. **Freeze vocabulary** — no new words without retraining.
2. **Script user flows** — emergency page + translate for your domain.
3. **Deploy:**
   - Frontend: Vercel / Netlify
   - Backend (sync): Railway / Render + MongoDB Atlas
4. Document known limits for users (“works best indoors, waist-up, pause between signs”).

**Stretch goals:**

- Integrate **WLASL** or **MS-ASL** for common signs (requires video → MediaPipe landmark extraction pipeline).
- Sentence-level model (CTC / transformer) instead of word-by-word.
- Cloud fallback API for low-confidence signs.

---

## Commands reference

```powershell
# Collect in browser → /collect → Export JSON

# Merge team exports
python training/merge_datasets.py team_a.json team_b.json -o training/exports/merged.json

# Train
python training/train_lstm.py --data training/exports/merged.json --output public/models/lstm

# Evaluate
python training/evaluate_model.py --data training/exports/merged.json --model public/models/lstm
```

---

## Data requirements (real-world)

| Use case | Words | Clips | Signers | Expected accuracy |
|----------|-------|-------|---------|-------------------|
| Emergency pilot | 15–20 | 750–1,000 | 2+ | 75–85% |
| Daily chat (limited) | 40–50 | 2,000–2,500 | 3+ | 70–80% |
| Single-user personal | 10–15 | 300–500 | 1 | 80–90% (your room only) |

More data beats fancier models at this stage.

---

## Fixing “stuck” and wrong results

| Problem | Fix |
|---------|-----|
| Stuck on “Signing…” | Pause 1s with hands down; avoid holding final pose |
| Wrong word | Record 30+ more reps for that word in `/collect` |
| “Could not recognize” | Confidence &lt; 40% — retrain or add samples |
| Slow processing | Settings → 480×360; turn off live preview |
| Works for you, not others | Multi-signer data + retrain |

---

## Public datasets (Phase 2 — after custom data works)

For vocabulary beyond your recordings:

1. **WLASL** — ~2,000 ASL signs (video)
2. **MS-ASL** — large-scale Microsoft dataset

Pipeline: download videos → extract MediaPipe landmarks offline → convert to SignBridge JSON format → merge with your exports → retrain.

This is a **separate 2–4 week engineering task** (Python + GPU recommended on Colab/Kaggle).

---

## What “real-world ready” means for SignBridge

You are ready for a **limited pilot** when:

- [ ] LSTM model trained on **≥ 1,500 real clips**
- [ ] **≥ 2 signers** in training data
- [ ] Validation accuracy **≥ 75%**
- [ ] 8 practice sentences work **≥ 7/8** in live testing
- [ ] Emergency page + translate tested by a non-developer

You are **not** ready for “translate any ASL freely” — that requires industry-scale data and models.

---

## File map

| Path | Purpose |
|------|---------|
| `/collect` | Structured recording (50 reps/word) |
| `/practice` | Sentence challenges + quick train |
| `/translate` | Live translation |
| `training/train_lstm.py` | Train + write `model.json` |
| `training/merge_datasets.py` | Combine team exports |
| `training/evaluate_model.py` | Per-word accuracy report |
| `training/vocabularies/` | Word lists for collection |
| `public/models/lstm/` | Deploy trained model here |

---

## Critical fix (v2.0)

Training and inference now both use **84-dim shoulder-normalized hand vectors** (same as DTW). Older models trained with the 54-feature spec must be **retrained**.
