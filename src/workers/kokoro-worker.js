// kokoro-worker.js
// Uses @huggingface/transformers directly instead of kokoro-js wrapper
// to get full control over CDN URL and model loading.
//
// Message protocol (unchanged — KokoroManager in jarvis.ts depends on these):
//   IN:  { type: 'load' }
//   IN:  { type: 'synthesize', text, id }
//   OUT: { type: 'loading',    message }
//   OUT: { type: 'load_status', ready }
//   OUT: { type: 'load_error',  error }
//   OUT: { type: 'synth_result', id, audioData, sampleRate }
//   OUT: { type: 'synth_error',  id, error }

import { pipeline, env } from "@huggingface/transformers";

// ─── CDN overrides ────────────────────────────────────────────────────────────
// HuggingFace's primary CDN requires auth tokens in sandboxed environments
// (e.g. Replit). These overrides route WASM binaries through jsDelivr, which
// proxies public HuggingFace models without authentication.
env.allowRemoteModels = true;
env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

// ─── State ────────────────────────────────────────────────────────────────────

let synthesizer = null;
let isLoading = false;

// ─── Model registry ───────────────────────────────────────────────────────────
// Ordered lightest → heaviest. speecht5_tts is the Xenova-maintained,
// sandbox-confirmed TTS model. bdl = CMU Arctic male speaker (natural, deep).

const MODELS = [
  {
    model: "Xenova/speecht5_tts",
    vocoder: "Xenova/speecht5_hifigan",
    speaker_embeddings:
      "https://huggingface.co/datasets/Matthijs/cmu-arctic-xvectors/resolve/main/cmu_us_bdl_arctic-wav-arctic_a0009.bin",
  },
];

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (event) => {
  const { type, text, id } = event.data;

  // ── Load ────────────────────────────────────────────────────────────────────
  if (type === "load") {
    // If already loaded or loading, report current status and return
    if (synthesizer || isLoading) {
      self.postMessage({ type: "load_status", ready: !!synthesizer });
      return;
    }

    isLoading = true;
    self.postMessage({ type: "loading", message: "Loading voice model..." });

    let loaded = false;

    for (const config of MODELS) {
      try {
        self.postMessage({
          type: "loading",
          message: `Loading ${config.model}...`,
        });

        synthesizer = await pipeline("text-to-speech", config.model, {
          progress_callback: (progress) => {
            if (progress.status === "downloading") {
              const pct = progress.progress
                ? Math.round(progress.progress)
                : 0;
              self.postMessage({
                type: "loading",
                message: `Loading voice model... ${pct}%`,
              });
            }
          },
        });

        // Attach speaker config so synthesize() can access it
        synthesizer._speakerConfig = config;
        loaded = true;
        console.log(`[Kokoro Worker] Loaded: ${config.model}`);
        break;
      } catch (err) {
        console.warn(
          `[Kokoro Worker] ${config.model} failed:`,
          err.message,
        );
        synthesizer = null;
      }
    }

    isLoading = false;

    if (loaded) {
      self.postMessage({ type: "load_status", ready: true });
    } else {
      self.postMessage({
        type: "load_error",
        error: "All voice models failed to load — using browser TTS",
      });
    }
  }

  // ── Synthesize ──────────────────────────────────────────────────────────────
  if (type === "synthesize") {
    if (!synthesizer) {
      self.postMessage({
        type: "synth_error",
        id,
        error: "Model not loaded",
      });
      return;
    }

    try {
      const config = synthesizer._speakerConfig;

      const output = await synthesizer(text, {
        speaker_embeddings: config.speaker_embeddings,
      });

      // Ensure we have a clean Float32Array before transferring
      const audioData =
        output.audio instanceof Float32Array
          ? output.audio
          : new Float32Array(output.audio);

      // Slice to get a fresh ArrayBuffer aligned to this typed array's view —
      // required so the buffer can be transferred (detached) correctly.
      const buffer = audioData.buffer.slice(
        audioData.byteOffset,
        audioData.byteOffset + audioData.byteLength,
      );

      self.postMessage(
        {
          type: "synth_result",
          id,
          audioData: buffer,
          sampleRate: output.sampling_rate ?? 16000,
        },
        [buffer], // transfer list — detaches buffer for zero-copy transfer
      );
    } catch (err) {
      self.postMessage({
        type: "synth_error",
        id,
        error: err.message,
      });
    }
  }
};
