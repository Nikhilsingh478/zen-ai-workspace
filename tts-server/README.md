# JARVIS voice — Chatterbox TTS (local)

JARVIS speaks with [Chatterbox-Turbo](https://github.com/resemble-ai/chatterbox) (Resemble AI, MIT
licence), running on your own GPU. Nothing is sent to a paid TTS service.

- **If the server is running:** JARVIS uses the Chatterbox voice (your cloned voice if set up).
- **If it isn't (or it fails):** JARVIS falls back to the browser voice. Text replies are never affected.

## Daily use

```powershell
cd C:\Users\neels\Desktop\ai_matrix
.\tts-server\start.ps1
```

Wait for `Warm-up done` (~40–60 s), keep the window open, then use JARVIS as normal (`npm run dev`).
Close the window to stop it.

If PowerShell blocks the script, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Where things live (all outside the repo, on D:)

| Path | What |
| --- | --- |
| `D:\jarvis-tts\.venv` | Python 3.11 environment (PyTorch CUDA + Chatterbox) |
| `D:\jarvis-tts\hf-cache` | Model files (~2.8 GB) |
| `D:\jarvis-tts\voices\jarvis.wav` | Reference voice — used automatically if present |

Total ≈ 8 GB. Voice recordings and model files are gitignored — never commit them.

## Changing the voice

Replace `D:\jarvis-tts\voices\jarvis.wav` with a new clip and restart the server. A good clip is
10–20 s of one person speaking naturally, quiet room, no music. Must be longer than 5 s.
Only clone voices you have the right to use.

To use the model's built-in voice instead, rename or remove `jarvis.wav`.

## Settings (optional, set before `start.ps1`)

| Variable | Default | Effect |
| --- | --- | --- |
| `CHATTERBOX_VOICE` | `voices\jarvis.wav` if present | Path to a reference clip (>5 s) |
| `CHATTERBOX_TEMPERATURE` | `0.8` | Lower = steadier, higher = more varied |
| `CHATTERBOX_TOP_P` / `CHATTERBOX_TOP_K` | `0.95` / `1000` | Sampling controls |
| `CHATTERBOX_REPETITION_PENALTY` | `1.2` | Discourages repeated sounds |
| `CHATTERBOX_DEVICE` | `auto` | `cuda` or `cpu` (CPU is much slower) |
| `CHATTERBOX_PORT` | `8765` | Port the app talks to |
| `CHATTERBOX_ALLOWED_ORIGIN_REGEX` | localhost only | Which web origins may call the server |

Example: `$env:CHATTERBOX_TEMPERATURE = "0.6"; .\tts-server\start.ps1`

The app side needs `VITE_CHATTERBOX_URL=http://127.0.0.1:8765` in `.env` (restart `npm run dev`
after changing it). Leave it unset to disable Chatterbox entirely.

## Performance on this laptop (RTX 2050 4 GB, 12 GB RAM)

Measured with the cloned voice:

- Model load: ~40–60 s (once per start)
- ~4 s sentence: ~3.4 s to generate (faster than real time)
- Short reply ("Done."): ~1 s
- GPU memory: ~3.3 GB of 4 GB

So JARVIS starts speaking ~1–3.5 s after Gemini replies, then speaks continuously — the next
sentence is generated while the current one plays. Half precision (fp16) was tested and was
*slower* on this GPU, so it isn't used.

Close heavy apps (lots of Chrome tabs, Android Studio) while using it — with too little free RAM
the first load took 3 minutes instead of under one.

## Fresh install (new machine)

```powershell
py -3.11 -m venv D:\jarvis-tts\.venv
D:\jarvis-tts\.venv\Scripts\python -m pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
D:\jarvis-tts\.venv\Scripts\python -m pip install -r tts-server\requirements.txt
.\tts-server\start.ps1    # first start downloads the model (~3 GB)
```

## Limitations

- Works only on the PC running the server. Other devices (phones, other laptops) fall back to the
  browser voice; the Android app keeps its own Kokoro voice.
- English only (Turbo). Generated audio carries Resemble AI's inaudible PerTh watermark.

## Using it from the deployed site (https://nikhilaimatrix-eta.vercel.app)

The voice code runs in the browser, so the Vercel site opened **on this laptop** talks straight to
the server on `127.0.0.1` — Vercel itself never runs the model.

1. Vercel → Project → Settings → Environment Variables: add
   `VITE_CHATTERBOX_URL` = `http://127.0.0.1:8765` (Production), then redeploy. It's read at build
   time, so a redeploy is required after adding or changing it.
2. Start the server here (`.\tts-server\start.ps1`). `start.ps1` already allows
   `https://nikhilaimatrix-eta.vercel.app` and answers Chrome's private-network check.
3. First visit: if Chrome asks to let the site access devices on your local network, click Allow.

Only localhost and that exact domain are accepted — preview deployments and other sites are refused.
If the domain changes, update `CHATTERBOX_ALLOWED_ORIGIN_REGEX` in `start.ps1`.

## API

- `GET /health` → `{"status": "ready" | "loading" | "error", ...}`
- `POST /tts` with `{"text": "...", "temperature": 0.7}` (overrides optional) → `audio/wav`
