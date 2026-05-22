import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ExternalLink, Search, Newspaper, Cloud, Scale, List, HelpCircle, MapPin, Code2, Calculator } from "lucide-react";
import type { SearchSource, SearchType } from "@/lib/gemini";

function getSafeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

const SEARCH_HEADER: Record<SearchType, { icon: React.ReactNode; label: string }> = {
  general:    { icon: <Search size={11} />,      label: "Search Result" },
  news:       { icon: <Newspaper size={11} />,   label: "Latest News" },
  weather:    { icon: <Cloud size={11} />,        label: "Weather" },
  comparison: { icon: <Scale size={11} />,        label: "Comparison" },
  howto:      { icon: <List size={11} />,         label: "How To" },
  definition: { icon: <HelpCircle size={11} />,   label: "Definition" },
  local:      { icon: <MapPin size={11} />,       label: "Local Results" },
  code:       { icon: <Code2 size={11} />,        label: "Code / Technical" },
  math:       { icon: <Calculator size={11} />,   label: "Math" },
};

interface SearchResultProps {
  text: string;
  sources: SearchSource[];
  searchType: SearchType;
}

export function SearchResult({ text, sources, searchType }: SearchResultProps) {
  const header = SEARCH_HEADER[searchType] ?? SEARCH_HEADER.general;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(24,24,27,0.8)",
        border: "1px solid rgba(63,63,70,0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 12px",
          borderBottom: "1px solid rgba(63,63,70,0.4)",
        }}
      >
        <span style={{ color: "#52525b" }}>{header.icon}</span>
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#52525b",
            fontFamily: "'Space Mono', monospace",
          }}
        >
          {header.label}
        </span>
      </div>

      <div
        style={{
          padding: "12px",
          fontSize: 13,
          color: "#a1a1aa",
          lineHeight: 1.65,
        }}
        className="jarvis-markdown"
      >
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>

      {sources.length > 0 && (
        <div style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(63,63,70,0.3)" }}>
          <p
            style={{
              fontSize: 9,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#3f3f46",
              marginBottom: 8,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            Sources
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sources.slice(0, 4).map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  justifyContent: "space-between",
                  textDecoration: "none",
                  color: "#38bdf8",
                  fontSize: 11,
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#7dd3fc";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#38bdf8";
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {s.title || getSafeHostname(s.url)}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 10, color: "#52525b" }}>
                    {getSafeHostname(s.url)}
                  </span>
                  <ExternalLink size={9} style={{ color: "#52525b" }} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
