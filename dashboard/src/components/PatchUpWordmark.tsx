export function PatchUpWordmark({ compact = false }: { compact?: boolean }) {
  const iconSize = compact ? 22 : 26;
  return (
    <span
      className="inline-flex items-center gap-2 font-bold tracking-[-0.03em] text-[#181614] leading-none select-none"
      style={{ fontSize: compact ? 16 : 18 }}
      aria-label="PatchUP"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        className="shrink-0"
        aria-hidden="true"
      >
        <path
          d="M4 9.5C4 6.46 6.46 4 9.5 4H13a2 2 0 0 1 2 2v6.5a2.5 2.5 0 0 1-2.5 2.5H6a2 2 0 0 1-2-2V9.5Z"
          fill="#FF5500"
        />
        <path
          d="M17 6a2 2 0 0 1 2-2h3.5C25.54 4 28 6.46 28 9.5V13a2 2 0 0 1-2 2h-6.5A2.5 2.5 0 0 1 17 12.5V6Z"
          fill="#F89B6C"
        />
        <path
          d="M4 19a2 2 0 0 1 2-2h6.5a2.5 2.5 0 0 1 2.5 2.5V26a2 2 0 0 1-2 2H9.5C6.46 28 4 25.54 4 22.5V19Z"
          fill="#F89B6C"
        />
        <path
          d="M17 19.5a2.5 2.5 0 0 1 2.5-2.5H26a2 2 0 0 1 2 2v3.5c0 3.04-2.46 5.5-5.5 5.5H19a2 2 0 0 1-2-2v-6.5Z"
          fill="#FF5500"
        />
      </svg>
      <span>PatchUP</span>
    </span>
  );
}
