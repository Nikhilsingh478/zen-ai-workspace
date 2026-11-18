# Starts the JARVIS Chatterbox TTS sidecar. (Keep this file ASCII-only:
# Windows PowerShell 5.1 misreads UTF-8 without a BOM.)
# Override settings before running, e.g.:
#   $env:CHATTERBOX_VOICE = "D:\jarvis-tts\voices\jarvis.wav"; .\tts-server\start.ps1
param(
    [string]$Root = "D:\jarvis-tts"   # venv + caches live here (C: is nearly full)
)

$python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Error "Python venv not found at $python - see tts-server/README.md for setup."
    exit 1
}

# Keep model downloads and temp files off the system drive.
if (-not $env:HF_HOME) { $env:HF_HOME = Join-Path $Root "hf-cache" }
# Plain HTTPS downloads: the Xet CDN transfer fails on some networks, and
# chatterbox-tts 0.1.7 has no retry fallback for it (newer releases do).
if (-not $env:HF_HUB_DISABLE_XET) { $env:HF_HUB_DISABLE_XET = "1" }
# Once the model is downloaded, start offline: faster, and no network needed.
$snapshots = Join-Path $env:HF_HOME "hub\models--ResembleAI--chatterbox-turbo\snapshots"
if ((Test-Path $snapshots) -and -not $env:HF_HUB_OFFLINE) { $env:HF_HUB_OFFLINE = "1" }

# Web pages allowed to use this server: local dev (any localhost port) and the
# Vercel deployment opened on this laptop. Everything else is refused.
if (-not $env:CHATTERBOX_ALLOWED_ORIGIN_REGEX) {
    $env:CHATTERBOX_ALLOWED_ORIGIN_REGEX = '^(https?://(localhost|127\.0\.0\.1)(:\d+)?|https://aimatrix-eta\.vercel\.app)$'
}

# Use the JARVIS reference voice if one has been set up.
$defaultVoice = Join-Path $Root "voices\jarvis.wav"
if (-not $env:CHATTERBOX_VOICE -and (Test-Path $defaultVoice)) { $env:CHATTERBOX_VOICE = $defaultVoice }
$env:TMP = Join-Path $Root "tmp"; $env:TEMP = $env:TMP   # Windows always sets TMP, so override for this process
New-Item -ItemType Directory -Force $env:TMP, $env:HF_HOME | Out-Null

& $python (Join-Path $PSScriptRoot "server.py")
