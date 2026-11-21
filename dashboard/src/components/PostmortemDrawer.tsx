import { Check, Clock, Copy, Download, ExternalLink, FileText, X } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { PostmortemRecord } from "../types";

interface PostmortemDrawerProps {
  open: boolean;
  postmortems: PostmortemRecord[];
  selectedIncidentId: string | null;
  onClose: () => void;
}

function formatIsoShort(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const mins = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${mins}m ${String(rem).padStart(2, "0")}s`;
}

/** Safe inline Markdown formatter (bold, inline code, links) without innerHTML. */
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} style={{ color: "var(--ink-primary)" }}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={match.index}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a key={match.index} href={linkMatch[2]} target="_blank" rel="noreferrer">
            {linkMatch[1]}
          </a>,
        );
      }
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  return (
    <div className="markdown-doc">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <Fragment key={idx} />;
        if (trimmed.startsWith("# ")) {
          return <h1 key={idx}>{renderInline(trimmed.slice(2))}</h1>;
        }
        if (trimmed.startsWith("## ")) {
          return <h2 key={idx}>{renderInline(trimmed.slice(3))}</h2>;
        }
        if (trimmed.startsWith("- ") || /^\d+\.\s/.test(trimmed)) {
          const text = trimmed.replace(/^(?:- |\d+\.\s)/, "");
          return (
            <div key={idx} style={{ display: "flex", gap: 8, paddingLeft: 6 }}>
              <span style={{ color: "var(--accent)" }}>•</span>
              <p>{renderInline(text)}</p>
            </div>
          );
        }
        return <p key={idx}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

export function PostmortemDrawer({
  open,
  postmortems,
  selectedIncidentId,
  onClose,
}: PostmortemDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const headingId = useId();
  const [activeId, setActiveId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const selected =
    postmortems.find((p) => p.id === activeId) ??
    (selectedIncidentId ? postmortems.find((p) => p.incidentId === selectedIncidentId) : undefined) ??
    postmortems[0];

  useEffect(() => {
    if (selectedIncidentId) {
      const match = postmortems.find((p) => p.incidentId === selectedIncidentId);
      if (match) setActiveId(match.id);
    }
  }, [selectedIncidentId, postmortems]);

  // Synchronize React `open` state with native modal <dialog>.showModal() / .close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Native close listener + light-dismiss fallback when `closedby="any"` is unsupported (Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const isOutside = (e: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        );
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) dialog.close();
      };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      return () => {
        dialog.removeEventListener("close", handleClose);
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  async function handleCopy() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  }

  function handleDownload() {
    if (!selected) return;
    const blob = new Blob([selected.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.id.toLowerCase()}-${selected.incidentId.toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <dialog
      ref={dialogRef}
      className="postmortem-drawer"
      aria-labelledby={headingId}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="drawer-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileText size={18} color="var(--accent)" />
          <div>
            <h2 id={headingId} style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              Auto-Generated Postmortems
            </h2>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              Generated automatically on RESOLVED transition with 3-timestamp TTD proof
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn"
          aria-label="Close postmortems drawer"
          autoFocus
          onClick={() => dialogRef.current?.close()}
        >
          <X size={15} />
          <span>Close</span>
        </button>
      </div>

      <div className="drawer-body">
        {/* Postmortem Selector Strip */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {postmortems.map((pm) => (
            <button
              key={pm.id}
              type="button"
              className={`btn ${selected?.id === pm.id ? "btn-primary" : ""}`}
              style={{ padding: "6px 10px", fontSize: 12 }}
              onClick={() => setActiveId(pm.id)}
            >
              <span className="mono">{pm.incidentId}</span>
              <span>{pm.service}</span>
            </button>
          ))}
        </div>

        {selected ? (
          <>
            {/* 3-Timestamp TTD Breakdown */}
            <div className="panel" style={{ background: "var(--bg-canvas)" }}>
              <div className="panel-header" style={{ padding: "10px 14px" }}>
                <span className="panel-title" style={{ fontSize: 13 }}>
                  <Clock size={14} color="var(--accent)" />
                  <span>3-Timestamp TTD Breakdown (vs. {formatMs(selected.manualBaselineMs)} Manual)</span>
                </span>
                <span className="speedup-tag mono">
                  {Math.max(1, Math.round(selected.manualBaselineMs / Math.max(1, selected.diagnosisDurationMs)))}x
                  faster
                </span>
              </div>
              <div className="panel-body" style={{ padding: "12px 14px" }}>
                <div className="ttd-strip">
                  <div className="kv-item">
                    <div className="kv-key mono">1. faultStartAt</div>
                    <div className="kv-val mono">{formatIsoShort(selected.faultStartAt)}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Fault injected</div>
                  </div>
                  <div className="kv-item">
                    <div className="kv-key mono">2. alarmRaisedAt</div>
                    <div className="kv-val mono" style={{ color: "var(--warn)" }}>
                      {formatIsoShort(selected.alarmRaisedAt)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      +{formatMs(selected.detectionLagMs)} Watcher lag
                    </div>
                  </div>
                  <div className="kv-item">
                    <div className="kv-key mono">3. causeNamedAt</div>
                    <div className="kv-val mono" style={{ color: "var(--accent)" }}>
                      {formatIsoShort(selected.causeNamedAt)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--safe)" }}>
                      +{formatMs(selected.diagnosisDurationMs)} Brain TTD
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 1-Click Export Controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" className="btn btn-primary" onClick={handleDownload}>
                  <Download size={14} />
                  <span>Export .md</span>
                </button>
                <button type="button" className="btn" onClick={handleCopy}>
                  {copied ? <Check size={14} color="var(--safe)" /> : <Copy size={14} />}
                  <span>{copied ? "Copied Markdown" : "Copy Markdown"}</span>
                </button>
              </div>
              {selected.fixPrUrl && (
                <a href={selected.fixPrUrl} target="_blank" rel="noreferrer" className="btn">
                  <ExternalLink size={14} />
                  <span>Open Fix PR</span>
                </a>
              )}
            </div>

            {/* Formatted Postmortem Document */}
            <MarkdownPreview markdown={selected.markdown} />
          </>
        ) : (
          <div style={{ color: "var(--ink-muted)" }}>No postmortems have been generated yet.</div>
        )}
      </div>
    </dialog>
  );
}
