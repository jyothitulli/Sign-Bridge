# Train Without Recording — Public Dataset Guide

You **do not** need to use `/collect` for hundreds of reps.  
You **do** need a **public dataset** (WLASL videos) — that *is* the dataset. One download, then train.

> **Truth:** There is no magic “train with zero data.” Accuracy requires **real sign videos**.  
> This path uses **WLASL** (~12,000 ASL videos) instead of your webcam.

---

## What you get

| Step | Time | Result |
|------|------|--------|
| Download WLASL (once) | 1–3 hours | ~5 GB videos |
| Extract + train (CPU) | 2–8 hours | `model.json` in app |
| Restart app | 1 min | **LSTM** mode, much better than DTW |

Expected: **65–85%** word accuracy on WLASL test clips.  
Live webcam may be **lower** until you add a few personal reps (optional).

---

## Quick start (Windows PowerShell)

### 1. Install Python tools

```powershell
cd c:\Users\preet\webspace\Sign-Bridge\signbridge\training
pip install -r requirements.txt
```

### 2. Download WLASL videos (Kaggle — easiest)

1. Account: https://www.kaggle.com  
2. Install CLI: `pip install kaggle`  
3. Kaggle → **Account** → **Create New Token** → saves `kaggle.json`  
4. Move token to: `C:\Users\YOURNAME\.kaggle\kaggle.json`

```powershell
cd c:\Users\preet\webspace\Sign-Bridge\signbridge\training
mkdir data\kaggle -Force
kaggle datasets download -d risangbaskoro/wlasl-processed -p data\kaggle --unzip
```

If `kaggle` is not in PATH, use full path or run from Python environment where it was installed.

### 3. One-command train

Point `--videos-dir` at the folder that contains `.mp4` files (search inside `data\kaggle` if unsure):

```powershell
# Auto-download WLASL JSON + extract landmarks + train LSTM
python train_public.py --videos-dir data\kaggle --download-json --epochs 60
```

### 4. Run the app

```powershell
cd ..
npm run dev
```

Open **http://localhost:3000/translate** — engine badge should say **LSTM**.

---

## If Kaggle does not work

### Plan B — JSON only + official videos

1. Download annotation file:

```powershell
python prepare_from_wlasl.py --download-json --videos-dir data\videos
```

(Will fail on videos — but creates `data/WLASL_v0.3.json`)

2. Request videos from official WLASL:  
   https://github.com/dxli94/WLASL  
   Or use their `video_downloader.py` + YouTube (many links expire).

3. Put all `.mp4` under `training/data/videos/`

4. Train:

```powershell
python train_public.py --videos-dir data\videos --skip-prepare
# or full pipeline:
python train_public.py --videos-dir data\videos --download-json
```

---

## Smaller / faster test (10 words only)

```powershell
python prepare_from_wlasl.py `
  --videos-dir data\kaggle `
  --vocabulary ../public/vocabularies/emergency.json `
  --output exports/wlasl_emergency.json `
  --max-words 10 `
  --max-clips-per-word 25 `
  --download-json

python train_lstm.py --data exports/wlasl_emergency.json --output ../public/models/lstm --epochs 40
```

---

## Why live camera may still feel wrong

WLASL was filmed by **other signers** in **other rooms**. Your webcam sees **you**.

| Fix | Effort | Gain |
|-----|--------|------|
| Use trained LSTM only | Done after train | Big vs DTW |
| Add **10–20 reps** per word in `/collect` | 30 min | Matches your body/lighting |
| Merge + retrain | 10 min | Best real-world feel |

```powershell
python merge_datasets.py exports\wlasl_prepared.json your-export.json -o exports\merged.json
python train_lstm.py --data exports\merged.json --output ../public/models/lstm
```

---

## Words not in WLASL

Some SignBridge words (e.g. `POLICE`, `HOSPITAL`, `STOP`) may be missing from WLASL.  
The script skips them. Options:

- Use **daily** vocabulary (more overlap with WLASL)
- Record **only missing words** in `/collect` (5–10 reps each)
- Merge and retrain

---

## Fully developed product checklist

- [ ] WLASL downloaded  
- [ ] `train_public.py` finished without errors  
- [ ] `public/models/lstm/model.json` exists  
- [ ] Translate shows **LSTM**  
- [ ] Validation accuracy ≥ 65% in terminal  
- [ ] Optional: personal fine-tune via `/collect`  

---

## Commands cheat sheet

```powershell
cd signbridge\training

# Full pipeline
python train_public.py --videos-dir data\kaggle --download-json

# Prepare only
python prepare_from_wlasl.py --videos-dir data\kaggle --download-json

# Train only (if JSON already prepared)
python train_lstm.py --data exports\wlasl_prepared.json --output ../public/models/lstm

# Evaluate
python evaluate_model.py --data exports\wlasl_prepared.json --model ../public/models/lstm
```

---

## What this does NOT do (yet)

- Translate **any** ASL word (only trained vocabulary)
- Perfect accuracy on **your** face without fine-tuning  
- Full sentence understanding without pauses between signs  

For **production-grade** open vocabulary, you need WLASL-2000 + GPU + larger models (Phase 2).
