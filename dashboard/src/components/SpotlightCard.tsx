import { type CSSProperties, type MouseEvent, type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function SpotlightCard({ children, className, style, onClick }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      className={cn(
        "spotlight-card rounded-xl border border-[#EAE2D9] bg-white shadow-[0_1px_2px_rgba(24,22,20,0.04)] transition-colors hover:border-[#D9CEC2]",
        className,
      )}
      style={style}
      onMouseMove={handleMove}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
