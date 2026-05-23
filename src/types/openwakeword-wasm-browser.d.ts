declare module "openwakeword-wasm-browser" {
  export interface WakeWordDetectEvent {
    keyword: string;
    score: number;
  }

  export interface WakeWordEngineConfig {
    keywords: string[];
    baseAssetUrl: string;
    detectionThreshold?: number;
    cooldownMs?: number;
  }

  export class WakeWordEngine {
    constructor(config: WakeWordEngineConfig);
    load(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    on(event: "detect", handler: (event: WakeWordDetectEvent) => void): () => void;
    on(event: "error", handler: (err: Error) => void): () => void;
    off(event: string, handler: (...args: unknown[]) => void): void;
  }
}
