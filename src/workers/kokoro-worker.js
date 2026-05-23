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
    self.postMessage({ type: "loading", message: "Downloading voice model (82MB, one-time)..." });
    try {
      tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0_fp16", {
        dtype: "fp16",
      });
      isLoading = false;
      self.postMessage({ type: "load_status", ready: true });
    } catch (err) {
      isLoading = false;
      self.postMessage({ type: "load_error", error: err.message });
    }
  }

  if (type === "synthesize") {
    if (!tts) {
      self.postMessage({ type: "synth_error", id, error: "Model not loaded" });
      return;
    }
    try {
      const audio = await tts.generate(text, { voice: voice || "am_adam" });
      const audioData = audio.audio;
      const sampleRate = audio.sampling_rate;
      self.postMessage({ type: "synth_result", id, audioData, sampleRate }, [audioData.buffer]);
    } catch (err) {
      self.postMessage({ type: "synth_error", id, error: err.message });
    }
  }
};
