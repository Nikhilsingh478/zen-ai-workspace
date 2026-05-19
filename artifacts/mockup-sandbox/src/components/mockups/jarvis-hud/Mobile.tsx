import { useState, useEffect, useRef } from "react";
import "./_group.css";

function OrbCoreMobile({ state }: { state: string }) {
  const isActive = state !== "idle";
  return (
    <div className="mob-orb-wrapper">
      <div className={`halo-ring halo-ring-1 ${isActive ? "active" : ""}`} style={{ width: 150, height: 150 }} />
      <div className={`halo-ring halo-ring-2 ${isActive ? "active" : ""}`} style={{ width: 150, height: 150 }} />

      <div className={`orb-body ${state}`} style={{ width: 76, height: 76 }}>
        <div className="orb-inner-glow" />
        <div className="orb-specular" style={{ top: "18%", left: "24%", width: "20%", height: "10%" }} />
        <div className="orb-center">
          {state === "listening"  && <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }} stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round"><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="9" y1="22" x2="15" y2="22" /></svg>}
          {state === "processing" && <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }} stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="processing-pulse"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588 4 4 0 0 0 7.636 2.106 3.2 3.2 0 0 0 .164-.546A4 4 0 0 0 19 15a4 4 0 0 0 .557-6.588 4 4 0 0 0-2.527-5.77A3 3 0 1 0 12 5" /></svg>}
          {state === "speaking"   && <div className="wave-bars">{[0.4,0.8,1,0.7,0.5].map((h,i) => <div key={i} className="wave-bar" style={{ "--delay": `${i*0.1}s`, "--base": h } as React.CSSProperties} />)}</div>}
          {state === "idle"       && <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }} stroke="rgba(125,211,252,0.5)" strokeWidth="1.5" strokeLinecap="round" className="standby"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>}
        </div>
      </div>

      <svg className="orb-arcs" viewBox="0 0 214 214" fill="none">
        <defs>
          <linearGradient id="marc1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0" />
            <stop offset="50%" stopColor="#7DD3FC" stopOpacity={isActive ? "0.8" : "0.3"} />
            <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="marc2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
            <stop offset="50%" stopColor="#38BDF8" stopOpacity={isActive ? "0.6" : "0.2"} />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="107" cy="107" r="96" stroke="url(#marc1)" strokeWidth="1.2"
          strokeDasharray="252 350" className="arc-spin-cw" />
        <circle cx="107" cy="107" r="80" stroke="url(#marc2)" strokeWidth="0.8"
          strokeDasharray="180 322" className="arc-spin-ccw" />
        <path d="M22 40 L22 22 L40 22" stroke={`rgba(125,211,252,${isActive ? 0.65 : 0.25})`} strokeWidth="1.5" strokeLinecap="round" className="bracket" />
        <path d="M192 40 L192 22 L174 22" stroke={`rgba(125,211,252,${isActive ? 0.65 : 0.25})`} strokeWidth="1.5" strokeLinecap="round" className="bracket" />
        <path d="M22 174 L22 192 L40 192" stroke={`rgba(125,211,252,${isActive ? 0.65 : 0.25})`} strokeWidth="1.5" strokeLinecap="round" className="bracket" />
        <path d="M192 174 L192 192 L174 192" stroke={`rgba(125,211,252,${isActive ? 0.65 : 0.25})`} strokeWidth="1.5" strokeLinecap="round" className="bracket" />
      </svg>

      {isActive && (
        <>
          <div className="pulse-ring pulse-ring-1" style={{ width: 76, height: 76 }} />
          <div className="pulse-ring pulse-ring-2" style={{ width: 76, height: 76 }} />
        </>
      )}
    </div>
  );
}

function Bubble({ role, text, time }: { role: "user" | "jarvis"; text: string; time: string }) {
  const isUser = role === "user";
  return (
    <div className={`bubble-row ${isUser ? "bubble-user" : "bubble-jarvis"}`}>
      {!isUser && <div className="bubble-avatar" style={{ width: 22, height: 22, fontSize: 8, borderRadius: 7 }}>J</div>}
      <div className={`bubble ${isUser ? "bubble-right" : "bubble-left"}`} style={{ borderRadius: 12 }}>
        {!isUser && <div className="bubble-sender">J.A.R.V.I.S</div>}
        <p className="bubble-text" style={{ fontSize: 12 }}>{text}</p>
        <p className="bubble-time">{time}</p>
      </div>
    </div>
  );
}

export function Mobile() {
  const STATES = ["idle", "listening", "processing", "speaking"] as const;
  const [stateIdx, setStateIdx] = useState(0);
  const voiceState = STATES[stateIdx];
  const [tab, setTab] = useState<"orb" | "chat" | "stats">("orb");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "jarvis" as const, text: "All systems online. Ready for your commands, sir.", time: "10:14" },
    { role: "user"   as const, text: "What's on my schedule today?", time: "10:15" },
    { role: "jarvis" as const, text: "3 tasks pending: PR review at 2PM, client call at 4PM, gym at 7PM.", time: "10:15" },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const STATE_COLOR: Record<string, string> = {
    idle: "rgba(125,211,252,0.35)", listening: "#93C5FD", processing: "#7DD3FC", speaking: "#BAE6FD",
  };
  const STATE_LABEL: Record<string, string> = {
    idle: "STANDBY", listening: "LISTENING", processing: "PROCESSING", speaking: "RESPONDING",
  };

  const isActive = voiceState !== "idle";

  function cycleState() { setStateIdx((i) => (i + 1) % STATES.length); }

  function sendMsg() {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", text: input.trim(), time: "Now" }]);
    const q = input.trim();
    setInput("");
    setTimeout(() => {
      setMessages((m) => [...m, { role: "jarvis", text: `Processing: "${q}". Command acknowledged.`, time: "Now" }]);
    }, 700);
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="jarvis-mobile">
      <div className="jbg" />
      <div className="jgrid" />

      {/* Header */}
      <header className="mob-header">
        <div className="mob-brand">
          <div className="status-dot" style={{ width: 6, height: 6 }} />
          <span className="mob-title">J.A.R.V.I.S</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 7, letterSpacing: "0.2em", color: "rgba(125,211,252,0.3)" }}>
            {STATE_LABEL[voiceState]}
          </div>
          <button
            onClick={cycleState}
            style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, padding: "3px 8px", borderRadius: 5, background: "rgba(125,211,252,0.06)", border: "1px solid rgba(125,211,252,0.18)", color: "rgba(125,211,252,0.5)", cursor: "pointer", letterSpacing: "0.1em" }}
          >
            DEMO ↺
          </button>
        </div>
      </header>

      {/* Tab strip */}
      <div className="mob-tab-strip">
        {(["orb", "chat", "stats"] as const).map((t) => (
          <button key={t} className={`mob-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "orb" ? "CORE" : t === "chat" ? "NEURAL LINK" : "STATUS"}
          </button>
        ))}
      </div>

      {/* Body */}
      <main className="mob-body">

        {/* ORB VIEW */}
        {tab === "orb" && (
          <div className="mob-orb-view">
            {/* State chips */}
            <div className="mob-status-chips">
              <div className="mob-chip" style={{ color: STATE_COLOR[voiceState], borderColor: `${STATE_COLOR[voiceState]}40` }}>
                {STATE_LABEL[voiceState]}
              </div>
              <div className="mob-chip">SYSTEM ONLINE</div>
            </div>

            {/* Orb */}
            <OrbCoreMobile state={voiceState} />

            {/* State text */}
            <div className="mob-state-label">
              <p className="mob-state-primary" style={{ color: isActive ? "#7DD3FC" : "rgba(125,211,252,0.4)" }}>
                {voiceState === "idle" ? "Standing by, sir." : voiceState === "listening" ? "Listening…" : voiceState === "processing" ? "Processing…" : "Responding…"}
              </p>
              <p className="mob-state-secondary">
                {voiceState === "idle" ? "Tap the button to speak" : voiceState === "listening" ? "Speak your command" : voiceState === "processing" ? "One moment, sir" : "J.A.R.V.I.S is speaking"}
              </p>
            </div>

            {/* Frequency */}
            <div className="mob-freq">
              {Array.from({ length: 18 }, (_, i) => (
                <div key={i} className={`mob-fbar ${isActive ? "freq-active" : ""}`}
                  style={{ "--i": i, "--h": Math.random() * 0.5 + 0.2 } as React.CSSProperties} />
              ))}
            </div>

            {/* Tap to talk */}
            <button className="mob-tap-btn" onClick={cycleState}>
              <svg viewBox="0 0 24 24" fill="none" className="mob-mic-icon" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="9" y1="22" x2="15" y2="22" />
              </svg>
            </button>

            {/* Wake words hint */}
            <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, letterSpacing: "0.14em", color: "rgba(125,211,252,0.22)", textAlign: "center" }}>
              "Hey Jarvis" · "Okay Jarvis" · "Jarvis"
            </p>
          </div>
        )}

        {/* CHAT VIEW */}
        {tab === "chat" && (
          <div className="mob-chat-view">
            <div className="mob-chat-messages">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.text} time={m.time} />
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="mob-input-bar">
              <div className="input-row">
                <input
                  className="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMsg()}
                  placeholder="Enter command, sir…"
                />
                <button className="send-btn" onClick={sendMsg}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="send-icon">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STATS VIEW */}
        {tab === "stats" && (
          <div className="mob-stats-view">
            <div className="mob-hud-card">
              <div className="mob-card-title">HORIZON TASKS</div>
              <div className="mob-card-grid">
                <div className="mob-stat-box">
                  <div className="mob-stat-num">3</div>
                  <div className="mob-stat-lbl">Pending Today</div>
                </div>
                <div className="mob-stat-box">
                  <div className="mob-stat-num" style={{ color: "#34D399" }}>2</div>
                  <div className="mob-stat-lbl">Completed</div>
                </div>
                <div className="mob-stat-box">
                  <div className="mob-stat-num" style={{ color: "#93C5FD" }}>12</div>
                  <div className="mob-stat-lbl">Total Active</div>
                </div>
                <div className="mob-stat-box">
                  <div className="mob-stat-num" style={{ color: "#F59E0B" }}>40%</div>
                  <div className="mob-stat-lbl">Completion</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="mob-progress-row">
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: "rgba(125,211,252,0.35)", letterSpacing: "0.1em" }}>TODAY</span>
                  <div className="mob-progress-bar"><div className="mob-progress-fill" style={{ width: "40%" }} /></div>
                  <span className="mob-progress-pct">40%</span>
                </div>
              </div>
            </div>

            <div className="mob-hud-card">
              <div className="mob-card-title">VOICE ENGINE</div>
              {[["WAKE WORDS", "3 active"], ["LANGUAGE", "en-US"], ["SILENCE GATE", "1.2s"], ["MAX COMMAND", "20s"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(125,211,252,0.05)" }}>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: "rgba(125,211,252,0.35)", letterSpacing: "0.1em" }}>{k}</span>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: "#7DD3FC" }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="mob-hud-card">
              <div className="mob-card-title">WAKE PHRASES</div>
              {["Jarvis", "Hey Jarvis", "Okay Jarvis"].map((w) => (
                <div key={w} className="wake-phrase" style={{ fontSize: 11, padding: "4px 0" }}>"{w}"</div>
              ))}
            </div>

            <div className="mob-hud-card">
              <div className="mob-card-title">QUICK COMMANDS</div>
              {["What's pending today?", "Open Horizon", "Schedule a task", "Open Ask"].map((c) => (
                <button key={c} className="cmd-chip" onClick={() => { setInput(c); setTab("chat"); }}>{c}</button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
