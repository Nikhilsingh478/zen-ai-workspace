import { useState, useEffect, useRef } from "react";
import "./_group.css";

// ─── Animated orb ─────────────────────────────────────────────────────────────
function OrbCore({ state }: { state: string }) {
  const isListening  = state === "listening";
  const isProcessing = state === "processing";
  const isSpeaking   = state === "speaking";
  const isActive     = state !== "idle";

  return (
    <div className="orb-wrapper">
      {/* Outer halo rings */}
      <div className={`halo-ring halo-ring-1 ${isActive ? "active" : ""}`} />
      <div className={`halo-ring halo-ring-2 ${isActive ? "active" : ""}`} />
      <div className={`halo-ring halo-ring-3 ${isActive ? "active" : ""}`} />

      {/* Main orb */}
      <div className={`orb-body ${state}`}>
        {/* Inner glow */}
        <div className="orb-inner-glow" />
        {/* Specular */}
        <div className="orb-specular" />
        {/* State icon */}
        <div className="orb-center">
          {isListening  && <MicIcon />}
          {isProcessing && <BrainIcon />}
          {isSpeaking   && <WaveIcon />}
          {state === "idle" && <StandbyIcon />}
        </div>
      </div>

      {/* Rotating arcs */}
      <svg className="orb-arcs" viewBox="0 0 280 280" fill="none">
        <defs>
          <linearGradient id="arc1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0" />
            <stop offset="50%" stopColor="#7DD3FC" stopOpacity={isActive ? "0.9" : "0.35"} />
            <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="arc2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
            <stop offset="50%" stopColor="#38BDF8" stopOpacity={isActive ? "0.7" : "0.25"} />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="arc3" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0" />
            <stop offset="50%" stopColor="#BAE6FD" stopOpacity={isActive ? "0.5" : "0.15"} />
            <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Arc 1 — outer, clockwise */}
        <circle cx="140" cy="140" r="120" stroke="url(#arc1)" strokeWidth="1.5"
          strokeDasharray="314 440" className="arc-spin-cw" />
        {/* Arc 2 — mid, counter */}
        <circle cx="140" cy="140" r="100" stroke="url(#arc2)" strokeWidth="1"
          strokeDasharray="220 408" className="arc-spin-ccw" />
        {/* Arc 3 — inner dotted */}
        <circle cx="140" cy="140" r="80" stroke="url(#arc3)" strokeWidth="0.8"
          strokeDasharray="8 12" className="arc-spin-cw-slow" />
        {/* Corner HUD brackets */}
        <path d="M30 55 L30 30 L55 30" stroke={`rgba(125,211,252,${isActive ? 0.7 : 0.3})`}
          strokeWidth="1.5" strokeLinecap="round" className="bracket" />
        <path d="M250 55 L250 30 L225 30" stroke={`rgba(125,211,252,${isActive ? 0.7 : 0.3})`}
          strokeWidth="1.5" strokeLinecap="round" className="bracket" />
        <path d="M30 225 L30 250 L55 250" stroke={`rgba(125,211,252,${isActive ? 0.7 : 0.3})`}
          strokeWidth="1.5" strokeLinecap="round" className="bracket" />
        <path d="M250 225 L250 250 L225 250" stroke={`rgba(125,211,252,${isActive ? 0.7 : 0.3})`}
          strokeWidth="1.5" strokeLinecap="round" className="bracket" />
        {/* Cross-hairs */}
        <line x1="140" y1="18" x2="140" y2="30" stroke="rgba(125,211,252,0.25)" strokeWidth="1" />
        <line x1="140" y1="250" x2="140" y2="262" stroke="rgba(125,211,252,0.25)" strokeWidth="1" />
        <line x1="18" y1="140" x2="30" y2="140" stroke="rgba(125,211,252,0.25)" strokeWidth="1" />
        <line x1="250" y1="140" x2="262" y2="140" stroke="rgba(125,211,252,0.25)" strokeWidth="1" />
      </svg>

      {/* Pulse rings */}
      {isActive && (
        <>
          <div className="pulse-ring pulse-ring-1" />
          <div className="pulse-ring pulse-ring-2" />
        </>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="orb-icon" stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="orb-icon processing-pulse" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588 4 4 0 0 0 7.636 2.106 3.2 3.2 0 0 0 .164-.546A4 4 0 0 0 19 15a4 4 0 0 0 .557-6.588 4 4 0 0 0-2.527-5.77A3 3 0 1 0 12 5" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <div className="wave-bars">
      {[0.4, 0.8, 1, 0.7, 0.5, 0.9, 0.6].map((h, i) => (
        <div key={i} className="wave-bar" style={{ "--delay": `${i * 0.1}s`, "--height": h } as React.CSSProperties} />
      ))}
    </div>
  );
}

function StandbyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="orb-icon standby" stroke="rgba(125,211,252,0.5)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ─── HUD Panel ────────────────────────────────────────────────────────────────
function HudPanel({ title, accent = "#7DD3FC", children, className = "" }: {
  title: string; accent?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`hud-panel ${className}`} style={{ "--accent": accent } as React.CSSProperties}>
      <div className="hud-panel-title">{title}</div>
      <div className="hud-panel-body">{children}</div>
    </div>
  );
}

// ─── Live clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  const hh = t.getHours().toString().padStart(2, "0");
  const mm = t.getMinutes().toString().padStart(2, "0");
  const ss = t.getSeconds().toString().padStart(2, "0");
  const date = t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div className="clock-block">
      <div className="clock-time">
        <span className="clock-hhmm">{hh}:{mm}</span>
        <span className="clock-ss">{ss}</span>
      </div>
      <div className="clock-date">{date}</div>
    </div>
  );
}

// ─── Stat row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, color = "#7DD3FC" }: { label: string; value: number; color?: string }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color }}>{value}</span>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ role, text, time }: { role: "user" | "jarvis"; text: string; time: string }) {
  const isUser = role === "user";
  return (
    <div className={`bubble-row ${isUser ? "bubble-user" : "bubble-jarvis"}`}>
      {!isUser && <div className="bubble-avatar">J</div>}
      <div className={`bubble ${isUser ? "bubble-right" : "bubble-left"}`}>
        {!isUser && <div className="bubble-sender">J.A.R.V.I.S</div>}
        <p className="bubble-text">{text}</p>
        <p className="bubble-time">{time}</p>
      </div>
    </div>
  );
}

// ─── Waveform EQ ──────────────────────────────────────────────────────────────
function WaveformEQ({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.85, 0.6, 0.9, 0.5, 0.75, 0.45, 0.8];
  return (
    <div className="waveform-eq">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`eq-bar ${active ? "eq-active" : "eq-idle"}`}
          style={{ "--base": h, "--delay": `${i * 0.07}s` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Signal strength ──────────────────────────────────────────────────────────
function SignalBars() {
  return (
    <div className="signal-bars">
      {[3, 5, 7, 9].map((h, i) => (
        <div key={i} className="signal-bar" style={{ height: h * 1.5, opacity: i < 3 ? 1 : 0.25 }} />
      ))}
    </div>
  );
}

// ─── Command quick-chips ──────────────────────────────────────────────────────
function Chip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button className="cmd-chip" onClick={onClick}>
      <span className="cmd-arrow">›</span> {text}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function Desktop() {
  const STATES = ["idle", "listening", "processing", "speaking"] as const;
  const [stateIdx, setStateIdx] = useState(0);
  const voiceState = STATES[stateIdx];
  const [enabled, setEnabled] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "jarvis" as const, text: "Good evening. All systems operational. How can I assist you today, sir?", time: "10:14 AM" },
    { role: "user"   as const, text: "What are my pending tasks for today?", time: "10:15 AM" },
    { role: "jarvis" as const, text: "You have 3 pending tasks today: Review PRs at 2PM, Client call at 4PM, and a gym session at 7PM. Shall I set reminders for any of these?", time: "10:15 AM" },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const STATE_LABEL: Record<string, string> = {
    idle: "STANDBY", listening: "LISTENING", processing: "PROCESSING", speaking: "RESPONDING",
  };
  const STATE_COLOR: Record<string, string> = {
    idle: "rgba(125,211,252,0.35)", listening: "#93C5FD", processing: "#7DD3FC", speaking: "#BAE6FD",
  };

  const isActive = voiceState !== "idle";

  function cycleState() { setStateIdx((i) => (i + 1) % STATES.length); }

  function sendMsg() {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", text: input.trim(), time: "Now" }]);
    const q = input.trim();
    setInput("");
    setTimeout(() => {
      setMessages((m) => [...m, { role: "jarvis", text: `Understood. Processing your request: "${q}". Standing by for further instructions.`, time: "Now" }]);
    }, 800);
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="jarvis-desktop">
      {/* ── Background ── */}
      <div className="jbg" />
      <div className="jgrid" />
      <div className="jvignette" />

      {/* ── Header ── */}
      <header className="jheader">
        <div className="jheader-left">
          <div className={`status-dot ${enabled ? "dot-online" : "dot-offline"}`} />
          <span className="brand-title">J.A.R.V.I.S</span>
          <span className="brand-sub">PERSONAL AI OPERATING SYSTEM</span>
          <div className="version-badge">v2.0</div>
        </div>
        <div className="jheader-right">
          <WaveformEQ active={isActive} />
          <div className="header-divider" />
          <SignalBars />
          <button className={`enable-btn ${enabled ? "btn-active" : "btn-inactive"}`} onClick={() => setEnabled((v) => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="btn-icon">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {enabled ? "ACTIVE" : "ENABLE"}
          </button>
          <button className="demo-btn" onClick={cycleState} title="Cycle voice state">
            DEMO ↺
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="jbody">

        {/* Left panel */}
        <aside className="jpanel jpanel-left">
          <HudPanel title="AI STATUS">
            <div className="status-row">
              <div className={`status-indicator ${enabled ? "indicator-online" : "indicator-offline"}`} />
              <span className={`status-text ${enabled ? "text-online" : "text-offline"}`}>
                {enabled ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </HudPanel>

          <HudPanel title="VOICE MODE">
            <div className="voice-mode-display">
              <div className="voice-mode-dot" style={{ background: STATE_COLOR[voiceState] }} />
              <span className="voice-mode-label" style={{ color: STATE_COLOR[voiceState] }}>
                {STATE_LABEL[voiceState]}
              </span>
            </div>
          </HudPanel>

          <HudPanel title="SYSTEM TIME">
            <LiveClock />
          </HudPanel>

          <HudPanel title="HORIZON TASKS">
            <div className="stats-list">
              <StatRow label="Pending Today"   value={3} />
              <StatRow label="Completed Today" value={2} color="#34D399" />
              <StatRow label="Total Active"    value={12} color="#93C5FD" />
            </div>
            {/* Mini progress bar */}
            <div className="task-progress-wrap">
              <div className="task-progress-bar">
                <div className="task-progress-fill" style={{ width: "40%" }} />
              </div>
              <span className="task-progress-pct">40%</span>
            </div>
          </HudPanel>

          <HudPanel title="WAKE PHRASES">
            {["Jarvis", "Hey Jarvis", "Okay Jarvis"].map((w) => (
              <div key={w} className="wake-phrase">"{w}"</div>
            ))}
          </HudPanel>

          <HudPanel title="QUICK COMMANDS">
            {["What's pending today?", "Open Horizon", "Schedule a meeting"].map((c) => (
              <Chip key={c} text={c} onClick={() => setInput(c)} />
            ))}
          </HudPanel>
        </aside>

        {/* Center */}
        <section className="jcenter">
          {/* Scan line overlay */}
          <div className="scan-line" />

          {/* Orb */}
          <div className="orb-section" onClick={cycleState} title="Click to cycle state">
            <OrbCore state={voiceState} />
          </div>

          {/* State label */}
          <div className="state-label-block">
            <p className="state-primary" style={{ color: isActive ? "#7DD3FC" : "rgba(125,211,252,0.4)" }}>
              {voiceState === "idle"       ? "Standing by, sir."
               : voiceState === "listening"  ? "Listening…"
               : voiceState === "processing" ? "Processing…"
               : "Responding…"}
            </p>
            <p className="state-secondary">
              {voiceState === "idle"       ? 'Say "Hey Jarvis" to activate'
               : voiceState === "listening"  ? "Speak your command"
               : voiceState === "processing" ? "One moment, sir"
               : "J.A.R.V.I.S is speaking"}
            </p>
          </div>

          {/* Frequency bars at bottom */}
          <div className="freq-bars-row">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className={`freq-bar ${isActive ? "freq-active" : ""}`}
                style={{ "--i": i, "--h": Math.random() * 0.6 + 0.2 } as React.CSSProperties}
              />
            ))}
          </div>
        </section>

        {/* Right panel */}
        <aside className="jpanel jpanel-right">
          <div className="chat-header">
            <span className="chat-title-label">NEURAL LINK</span>
            <button className="clear-btn" onClick={() => setMessages([])}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="clear-icon">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              CLEAR
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.text} time={m.time} />
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-footer">
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
        </aside>
      </main>

      {/* ── Footer scan line ── */}
      <footer className="jfooter">
        <span className="jfooter-text">SYSTEM SECURE · NEURAL LINK ACTIVE · ALL SENSORS NOMINAL</span>
        <div className="jfooter-dots">
          {[1,1,1,0,1,0,0,1].map((v,i) => (
            <div key={i} className={`jfooter-dot ${v ? "fdot-on" : "fdot-off"}`} />
          ))}
        </div>
      </footer>
    </div>
  );
}
