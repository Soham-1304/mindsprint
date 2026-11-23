import { AlertTriangle, CheckCircle2, FileCode2, GripVertical } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BeforeAfterDiffSliderProps {
  diff: string;
  filePath: string;
  beforeTitle?: string;
  afterTitle?: string;
  beforeBadge?: string;
  afterBadge?: string;
}

interface AlignedRow {
  beforeLine: string | null;
  afterLine: string | null;
  kind: "ctx" | "changed" | "added" | "removed";
  lineNumBefore?: number;
  lineNumAfter?: number;
}

interface ParsedFileDiff {
  fileName: string;
  rows: AlignedRow[];
}

function parseUnifiedDiffToFiles(diff: string, fallbackFile: string): ParsedFileDiff[] {
  if (!diff.trim()) return [];

  const rawLines = diff.split("\n");
  const files: Array<{ fileName: string; lines: string[] }> = [];
  let current: { fileName: string; lines: string[] } | null = null;

  for (const line of rawLines) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/b\/(.+)$/);
      current = { fileName: match ? match[1] : fallbackFile, lines: [] };
      files.push(current);
      continue;
    }
    if (line.startsWith("+++ b/")) {
      if (!current) {
        current = { fileName: line.slice(6).trim(), lines: [] };
        files.push(current);
      } else {
        current.fileName = line.slice(6).trim();
      }
      continue;
    }
    if (
      line.startsWith("index ") ||
      line.startsWith("new file mode") ||
      line.startsWith("--- ") ||
      line.startsWith("\\ No newline") ||
      line.startsWith("# ") ||
      line.startsWith("commit ") ||
      line.startsWith("Author: ")
    ) {
      continue;
    }
    if (!current) {
      current = { fileName: fallbackFile, lines: [] };
      files.push(current);
    }
    current.lines.push(line);
  }

  return files.map((file) => {
    const rows: AlignedRow[] = [];
    let beforeNum = 1;
    let afterNum = 1;
    let i = 0;

    while (i < file.lines.length) {
      const line = file.lines[i];
      if (line.startsWith("@@")) {
        const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (m) {
          beforeNum = Number(m[1]) || 1;
          afterNum = Number(m[2]) || 1;
        }
        i++;
        continue;
      }

      if (line.startsWith("-")) {
        const dels: string[] = [];
        while (i < file.lines.length && file.lines[i].startsWith("-")) {
          dels.push(file.lines[i].slice(1));
          i++;
        }
        const adds: string[] = [];
        while (i < file.lines.length && file.lines[i].startsWith("+")) {
          adds.push(file.lines[i].slice(1));
          i++;
        }
        const count = Math.max(dels.length, adds.length);
        for (let k = 0; k < count; k++) {
          const b = k < dels.length ? dels[k] : null;
          const a = k < adds.length ? adds[k] : null;
          rows.push({
            beforeLine: b,
            afterLine: a,
            kind: b !== null && a !== null ? "changed" : b !== null ? "removed" : "added",
            lineNumBefore: b !== null ? beforeNum++ : undefined,
            lineNumAfter: a !== null ? afterNum++ : undefined,
          });
        }
        continue;
      }

      if (line.startsWith("+")) {
        rows.push({
          beforeLine: null,
          afterLine: line.slice(1),
          kind: "added",
          lineNumAfter: afterNum++,
        });
        i++;
        continue;
      }

      const content = line.startsWith(" ") ? line.slice(1) : line;
      rows.push({
        beforeLine: content,
        afterLine: content,
        kind: "ctx",
        lineNumBefore: beforeNum++,
        lineNumAfter: afterNum++,
      });
      i++;
    }

    return { fileName: file.fileName, rows: rows.slice(0, 28) };
  });
}

export function BeforeAfterDiffSlider({
  diff,
  filePath,
  beforeTitle = "Broken production code",
  afterTitle = "PatchUP surgical fix",
  beforeBadge = "500 Fault",
  afterBadge = "Verified Fix",
}: BeforeAfterDiffSliderProps) {
  const [position, setPosition] = useState(46);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const parsedFiles = useMemo(() => parseUnifiedDiffToFiles(diff, filePath), [diff, filePath]);
  const activeFile = parsedFiles[Math.min(activeFileIdx, Math.max(0, parsedFiles.length - 1))];

  const updateFromClientX = useCallback((clientX: number) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(4, Math.min(96, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPosition((p) => Math.max(4, p - 5));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPosition((p) => Math.min(96, p + 5));
    } else if (e.key === "Home") {
      e.preventDefault();
      setPosition(4);
    } else if (e.key === "End") {
      e.preventDefault();
      setPosition(96);
    }
  };

  if (!activeFile || activeFile.rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#DFD5CA] bg-white p-8 text-center text-[13px] text-[#665E56]">
        No code diff available to compare for this incident.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2.5">
      {/* Top Bar: File Switcher + Quick Snap Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {parsedFiles.map((f, idx) => {
            const shortName = f.fileName.split("/").slice(-2).join("/");
            const isSelected = idx === Math.min(activeFileIdx, parsedFiles.length - 1);
            return (
              <button
                key={f.fileName}
                type="button"
                onClick={() => setActiveFileIdx(idx)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11.5px] transition-colors cursor-pointer",
                  isSelected
                    ? "border-[#EAE2D9] bg-white font-semibold text-[#181614] shadow-xs"
                    : "border-transparent bg-transparent text-[#665E56] hover:bg-white/70 hover:text-[#181614]",
                )}
              >
                <FileCode2 size={12} className={isSelected ? "text-[#FF5500]" : "text-[#78716C]"} />
                <span className="truncate max-w-[260px]">{shortName}</span>
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-[#EAE2D9] bg-white p-0.5 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setPosition(92)}
            className={cn(
              "rounded px-2 py-0.5 transition-colors cursor-pointer",
              position >= 75
                ? "bg-[#FEF2F2] font-semibold text-[#B91C1C]"
                : "text-[#665E56] hover:text-[#181614]",
            )}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => setPosition(50)}
            className={cn(
              "rounded px-2 py-0.5 transition-colors cursor-pointer",
              position > 25 && position < 75
                ? "bg-[#FFF3EB] font-semibold text-[#B83B00]"
                : "text-[#665E56] hover:text-[#181614]",
            )}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setPosition(8)}
            className={cn(
              "rounded px-2 py-0.5 transition-colors cursor-pointer",
              position <= 25
                ? "bg-[#F0FDF4] font-semibold text-[#15803D]"
                : "text-[#665E56] hover:text-[#181614]",
            )}
          >
            After
          </button>
        </div>
      </div>

      {/* Interactive Before / After Comparison Stage */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative select-none overflow-hidden rounded-2xl border border-[#E5DCD2] bg-white shadow-[0_6px_24px_rgba(24,22,20,0.06)] touch-none cursor-ew-resize"
      >
        {/* UNDERLAY: AFTER (PatchUP Surgical Fix — Revealed on the Right) */}
        <div className="w-full bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[#EFE8E0] bg-[#FCFAF7] px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2 font-mono text-[11.5px] font-semibold text-[#181614]">
              <span className="h-2 w-2 rounded-full bg-[#15803D]" />
              <span className="truncate">AFTER · {afterTitle}</span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F0FDF4] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#15803D] border border-[#BBF7D0]">
              <CheckCircle2 size={11} />
              {afterBadge}
            </span>
          </div>

          <div className="py-2 font-mono text-[12px] leading-[1.65]">
            {activeFile.rows.map((row, idx) => (
              <div
                key={`after-${idx}`}
                className={cn(
                  "flex items-start gap-3 px-4",
                  row.kind === "added" || row.kind === "changed"
                    ? "bg-[#DCFCE7]/85 text-[#14532D]"
                    : row.kind === "removed"
                      ? "bg-[#FAF8F5] text-[#A8A29E]"
                      : "text-[#292524]",
                )}
              >
                <span className="w-7 shrink-0 select-none text-right text-[11px] text-[#A8A29E] tabular-nums">
                  {row.lineNumAfter ?? ""}
                </span>
                <span className="w-3 shrink-0 select-none font-bold text-[#15803D]">
                  {row.kind === "added" || row.kind === "changed" ? "+" : " "}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                  {row.afterLine !== null ? row.afterLine || " " : " "}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* OVERLAY: BEFORE (Broken Production Code — Clipped to Left Side) */}
        <div
          aria-hidden="true"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          className="pointer-events-none absolute inset-0 bg-[#FBF6F0]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#EADFD4] bg-[#F5EDE4] px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2 font-mono text-[11.5px] font-semibold text-[#7F1D1D]">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              <span className="truncate">BEFORE · {beforeTitle}</span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FEF2F2] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#B91C1C] border border-[#FECACA]">
              <AlertTriangle size={11} />
              {beforeBadge}
            </span>
          </div>

          <div className="py-2 font-mono text-[12px] leading-[1.65]">
            {activeFile.rows.map((row, idx) => (
              <div
                key={`before-${idx}`}
                className={cn(
                  "flex items-start gap-3 px-4",
                  row.kind === "removed" || row.kind === "changed"
                    ? "bg-[#FEE2E2]/90 text-[#7F1D1D]"
                    : row.kind === "added"
                      ? "bg-[#F5EDE4]/60 text-[#A8A29E]"
                      : "text-[#5C5650]",
                )}
              >
                <span className="w-7 shrink-0 select-none text-right text-[11px] text-[#A8A29E] tabular-nums">
                  {row.lineNumBefore ?? ""}
                </span>
                <span className="w-3 shrink-0 select-none font-bold text-[#DC2626]">
                  {row.kind === "removed" || row.kind === "changed" ? "−" : " "}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                  {row.beforeLine !== null
                    ? row.beforeLine || " "
                    : "// missing guard — throws unhandled TypeError"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Vertical Orange Divider Line + Tactile Pill Handle (Impeccable-inspired) */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Drag to compare broken production code before and PatchUP fix after"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          onKeyDown={onKeyDown}
          style={{ left: `${position}%` }}
          className="absolute inset-y-0 z-20 -translate-x-1/2 flex items-center justify-center focus-visible:outline-none group"
        >
          <div className="h-full w-[2.5px] bg-[#FF5500] shadow-[0_0_12px_rgba(255,85,0,0.35)]" />
          <div className="absolute flex h-9 w-11 items-center justify-center rounded-xl border-[2.5px] border-[#FF5500] bg-white text-[#78716C] shadow-[0_4px_14px_rgba(24,22,20,0.16)] transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-[#FF5500] group-focus-visible:ring-offset-2">
            <GripVertical size={16} strokeWidth={2.2} />
          </div>
        </div>
      </div>

      {/* Subtle Footer Hint */}
      <div className="flex items-center justify-between px-1 font-mono text-[11px] text-[#78716C]">
        <span>Drag handle left to reveal verified PatchUP fix · right for broken production code</span>
        <span className="tabular-nums">{Math.round(100 - position)}% fix revealed</span>
      </div>
    </div>
  );
}
