export function PatchUpWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="relative inline-flex items-baseline pb-1 font-extrabold tracking-[-0.04em] text-[#181614] leading-none select-none"
      style={{ fontSize: compact ? 17 : 20 }}
      aria-label="PatchUP"
    >
      PatchUP
      <svg
        className="pointer-events-none absolute -bottom-0.5 -left-0.5 h-[6px] w-[calc(100%+4px)] text-[#FF5500]"
        viewBox="0 0 110 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 8C28 3.5 75 3 108 7.5C88 10 50 10.5 2 8Z"
          fill="currentColor"
          fillOpacity="0.92"
        />
      </svg>
    </span>
  );
}
