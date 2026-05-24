import { KokoroTTS } from "kokoro-js";

let tts = null;
let isLoading = false;

self.onmessage = async (event) => {
  const { type, text, voice, id } = event.data;

  if (type === "load") {
    if (tts || isLoading) {
      self.postMessage({ type: "load_status", ready: !!tts });
      return;
    }

    isLoading = true;
    self.postMessage({ type: "loading", message: "Loading voice model..." });

    try {
      const dtypes = ["q8", "fp16", "fp32"];
      let loadError = null;

      for (const dtype of dtypes) {
        try {
          tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0", {
            dtype,
            progress_callback: (progress) => {
              if (progress.status === "progress") {
                self.postMessage({
                  type: "loading",
                  message: `Loading voice model... ${Math.round(progress.progress || 0)}%`,
                });
              }
            },
          });
          loadError = null;
          break;
        } catch (err) {
          loadError = err;
          console.warn(`[Kokoro Worker] Failed with dtype ${dtype}:`, err.message);
        }
      }

      if (!tts) {
        throw loadError;
      }

      isLoading = false;
      self.postMessage({ type: "load_status", ready: true });
      console.log("[Kokoro Worker] Model loaded successfully");
    } catch (err) {
      isLoading = false;
      console.error("[Kokoro Worker] Load failed:", err.message);
      self.postMessage({ type: "load_error", error: err.message });
    }
  }

  if (type === "synthesize") {
    if (!tts) {
      self.postMessage({ type: "synth_error", id, error: "Model not loaded" });
      return;
    }

    try {
      // am_adam = American male voice — deep, natural, NOT robotic female
      const result = await tts.generate(text, {
        voice: voice || "am_adam",
      });

      const audioData =
        result.audio instanceof Float32Array ? result.audio : new Float32Array(result.audio);

      self.postMessage(
        {
          type: "synth_result",
          id,
          audioData: audioData.buffer,
          sampleRate: result.sampling_rate ?? 24000,
        },
        [audioData.buffer],
      );
    } catch (err) {
      self.postMessage({ type: "synth_error", id, error: err.message });
    }
  }
};
