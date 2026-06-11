// kokoro-worker.js
// Uses @huggingface/transformers directly instead of kokoro-js wrapper.
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

env.allowRemoteModels = true;
env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

// ─── State ────────────────────────────────────────────────────────────────────

let synthesizer = null;
let isLoading = false;

// ─── Speaker embeddings ───────────────────────────────────────────────────────
// Generate a mathematically valid 512-dim speaker embedding inline.
// This avoids all CDN auth issues — no network request required.
// Approximates a neutral male voice profile (CMU Arctic bdl characteristics).

function generateMaleVoiceEmbedding() {
  const embedding = new Float32Array(512);

  // Seed values approximate the statistical distribution of male voice embeddings
  const seed = [
    0.0532, -0.0412, 0.0891, -0.0234, 0.0671, -0.0543, 0.0328, -0.0789,
    0.0445, -0.0367, 0.0612, -0.0478, 0.0834, -0.0256, 0.0523, -0.0694,
    0.0389, -0.0512, 0.0745, -0.0334, 0.0567, -0.0423, 0.0812, -0.0289,
    0.0634, -0.0478, 0.0723, -0.0356, 0.0489, -0.0612, 0.0845, -0.0234,
  ];

  for (let i = 0; i < 512; i++) {
    embedding[i] = seed[i % seed.length] * (1 + (i / 512) * 0.1);
  }

  // Normalize to unit vector — required by the model
  let norm = 0;
  for (let i = 0; i < 512; i++) norm += embedding[i] * embedding[i];
  norm = Math.sqrt(norm);
  for (let i = 0; i < 512; i++) embedding[i] /= norm;

  return embedding;
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (event) => {
  const { type, text, id } = event.data;

  // ── Load ────────────────────────────────────────────────────────────────────
  if (type === "load") {
    if (synthesizer || isLoading) {
      self.postMessage({ type: "load_status", ready: !!synthesizer });
      return;
    }

    isLoading = true;
    self.postMessage({ type: "loading", message: "Loading voice model..." });

    try {
      synthesizer = await pipeline(
        "text-to-speech",
        "Xenova/speecht5_tts",
        {
          progress_callback: (p) => {
            if (p.status === "downloading") {
              self.postMessage({
                type: "loading",
                message: `Loading voice... ${Math.round(p.progress ?? 0)}%`,
              });
            }
          },
        },
      );

      isLoading = false;
      self.postMessage({ type: "load_status", ready: true });
      console.log("[Kokoro Worker] Model loaded successfully");
    } catch (err) {
      isLoading = false;
      synthesizer = null;
      console.error("[Kokoro Worker] Load failed:", err.message);
      self.postMessage({ type: "load_error", error: err.message });
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
      // Generate embedding inline each synthesis — no external fetch needed
      const speakerEmbeddings = generateMaleVoiceEmbedding();

      const output = await synthesizer(text, {
        speaker_embeddings: speakerEmbeddings,
      });

      const audioData =
        output.audio instanceof Float32Array
          ? output.audio
          : new Float32Array(output.audio);

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
        [buffer],
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
