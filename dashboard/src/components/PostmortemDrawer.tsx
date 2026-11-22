import { Check, Copy, Download, ExternalLink, FileText, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PostmortemRecord } from "@/types";

interface PostmortemDrawerProps {
  open: boolean;
  postmortems: PostmortemRecord[];
  selectedIncidentId: string | null;
  onClose: () => void;
}

export function PostmortemDrawer({
  open,
  postmortems,
  selectedIncidentId,
  onClose,
}: PostmortemDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [activeId, setActiveId] = useState<string>(postmortems[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (selectedIncidentId) {
      const match = postmortems.find((p) => p.incidentId === selectedIncidentId);
      if (match) setActiveId(match.id);
    } else if (!postmortems.some((p) => p.id === activeId) && postmortems[0]) {
      setActiveId(postmortems[0].id);
    }
  }, [selectedIncidentId, postmortems, activeId]);

  const active = postmortems.find((p) => p.id === activeId) ?? postmortems[0];

  function handleCopy() {
    if (!active) return;
    navigator.clipboard?.writeText(active.markdown).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function handleDownload() {
    if (!active) return;
    const blob = new Blob([active.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postmortem-${active.incidentId}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-[min(640px,100dvw)] border-l border-[#EAE2D9] bg-white p-0 text-[#181614] shadow-2xl open:flex open:flex-col"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#EFE8E0] px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-[#FF5500]" />
          <h2 id={titleId} className="text-[15px] font-semibold text-[#181614]">
            Incident Postmortem Reports
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close postmortem drawer"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#78716C] hover:bg-[#F4EFE9] cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {postmortems.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[#78716C]">
            No postmortems generated yet.
          </div>
        ) : (
          <>
            {postmortems.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {postmortems.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setActiveId(pm.id)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 font-mono text-[11.5px] cursor-pointer",
                      pm.id === active?.id
                        ? "border-[#FBD3B7] bg-[#FFF5EE] font-semibold text-[#B83B00]"
                        : "border-[#EAE2D9] bg-[#FAF8F5] text-[#5C5650]",
                    )}
                  >
                    {pm.incidentId}
                  </button>
                ))}
              </div>
            )}

            {active && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#EAE2D9] bg-[#FAF8F5] p-3.5 text-[12.5px]">
                  <div>
                    <div className="font-semibold text-[#181614]">{active.title}</div>
                    <div className="mt-0.5 font-mono text-[11.5px] text-[#78716C]">
                      {active.service} · TTD {(active.totalTtdMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {active.fixPrUrl && (
                      <a
                        href={active.fixPrUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E5DCD2] bg-white px-2.5 text-[12px] font-medium text-[#181614] hover:bg-[#F4EFE9]"
                      >
                        <ExternalLink size={11} />
                        <span>PR</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E5DCD2] bg-white px-2.5 text-[12px] font-medium text-[#181614] hover:bg-[#F4EFE9] cursor-pointer"
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-[#FF5500] px-2.5 text-[12px] font-medium text-white hover:bg-[#E04B00] cursor-pointer"
                    >
                      <Download size={11} />
                      <span>.md</span>
                    </button>
                  </div>
                </div>

                <pre className="whitespace-pre-wrap rounded-xl border border-[#EAE2D9] bg-[#FAF8F5] p-4 font-mono text-[12px] leading-relaxed text-[#181614]">
                  {active.markdown}
                </pre>
              </>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
