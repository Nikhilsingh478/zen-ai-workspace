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
$env:TMP = Join-Path $Root "tmp"; $env:TEMP = $env:TMP   # Windows always sets TMP, so override for this process
New-Item -ItemType Directory -Force $env:TMP, $env:HF_HOME | Out-Null

& $python (Join-Path $PSScriptRoot "server.py")
