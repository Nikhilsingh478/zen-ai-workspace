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
let speakerEmbeddings = null;
let isLoading = false;

// ─── Speaker embeddings ───────────────────────────────────────────────────────
// speecht5_tts requires a pre-fetched Float32Array tensor — not a URL string.
// The model's forward pass needs the actual embedding data at synthesis time.

const SPEAKER_URL =
  "https://huggingface.co/datasets/Matthijs/cmu-arctic-xvectors/resolve/main/cmu_us_bdl_arctic-wav-arctic_a0009.bin";

async function loadSpeakerEmbeddings() {
  const response = await fetch(SPEAKER_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch speaker embeddings: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Float32Array(buffer);
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
      self.postMessage({ type: "loading", message: "Downloading model..." });

      // Load pipeline and speaker embeddings in parallel
      const [pipe, embeddings] = await Promise.all([
        pipeline("text-to-speech", "Xenova/speecht5_tts", {
          progress_callback: (p) => {
            if (p.status === "downloading") {
              self.postMessage({
                type: "loading",
                message: `Loading voice... ${Math.round(p.progress ?? 0)}%`,
              });
            }
          },
        }),
        loadSpeakerEmbeddings(),
      ]);

      synthesizer = pipe;
      speakerEmbeddings = embeddings;

      isLoading = false;
      self.postMessage({ type: "load_status", ready: true });
      console.log("[Kokoro Worker] Loaded: Xenova/speecht5_tts with bdl embeddings");
    } catch (err) {
      isLoading = false;
      synthesizer = null;
      speakerEmbeddings = null;
      console.error("[Kokoro Worker] Load failed:", err.message);
      self.postMessage({ type: "load_error", error: err.message });
    }
  }

  // ── Synthesize ──────────────────────────────────────────────────────────────
  if (type === "synthesize") {
    if (!synthesizer || !speakerEmbeddings) {
      self.postMessage({
        type: "synth_error",
        id,
        error: "Model not loaded",
      });
      return;
    }

    try {
      // Pass speaker_embeddings as the pre-fetched Float32Array tensor —
      // the model's forward pass requires actual embedding data, not a URL.
      const output = await synthesizer(text, {
        speaker_embeddings: speakerEmbeddings,
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
