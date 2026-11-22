import { animate } from "animejs";
import { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

/** Signature PatchUP wordmark with safety-orange studio brush stroke */
export function PatchUpWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="patchup-wordmark"
      style={{ fontSize: compact ? 18 : 22 }}
      aria-label="PatchUP"
    >
      Patch<span className="patchup-wordmark-accent">UP</span>
      <svg
        className="patchup-wordmark-stroke"
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

/** ReactBits-inspired cursor-tracked warm peach spotlight card */
export function SpotlightCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
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
      className={`spotlight-card ${className}`.trim()}
      style={style}
      onMouseMove={handleMove}
    >
      {children}
    </div>
  );
}

/** MagicUI-inspired subtle rotating orange hairline border beam */
export function BorderBeam({ active = true }: { active?: boolean }) {
  if (!active) return null;
  return <span className="border-beam" aria-hidden="true" />;
}

/** MagicUI + anime.js smooth tabular-nums counter */
export function NumberTicker({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const stateRef = useRef({ val: value });

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      stateRef.current.val = value;
      setDisplay(value);
      return;
    }

    const anim = animate(stateRef.current, {
      val: value,
      duration: 680,
      ease: "outExpo",
      onUpdate: () => {
        setDisplay(stateRef.current.val);
      },
    });

    return () => {
      anim.pause();
    };
  }, [value]);

  return (
    <span className={`mono tabular ${className}`.trim()}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Bklit-inspired crisp daylight SVG area + line metric chart with hover tooltip */
export function BklitMetricChart({
  points,
  unit,
  accentColor = "#FF5500",
  ariaLabel = "Telemetry metric chart",
}: {
  points: Array<{ label: string; value: number; baseline: number }>;
  unit: string;
  accentColor?: string;
  ariaLabel?: string;
}) {
  const gradId = useId().replace(/:/g, "");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const safePoints = points.length > 0 ? points : [{ label: "Now", value: 0, baseline: 0 }];
  const maxVal = Math.max(...safePoints.map((p) => Math.max(p.value, p.baseline)), 1) * 1.15;
  const width = 460;
  const height = 148;
  const padL = 34;
  const padR = 18;
  const padT = 18;
  const padB = 26;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const toX = (i: number) =>
    padL + (safePoints.length <= 1 ? innerW / 2 : (i / (safePoints.length - 1)) * innerW);
  const toY = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const linePath = safePoints
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(pt.value).toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${toX(safePoints.length - 1).toFixed(1)} ${(padT + innerH).toFixed(
    1,
  )} L ${toX(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const baselineVal = safePoints[0]?.baseline ?? 0;
  const baselineY = toY(baselineVal);
  const activePt = hoverIdx !== null ? safePoints[hoverIdx] : safePoints[safePoints.length - 1];

  return (
    <div className="bklit-chart-wrap">
      <div className="bklit-chart-head">
        <span className="bklit-chart-reading mono">
          <strong>
            {activePt.value}
            {unit}
          </strong>{" "}
          <span>at {activePt.label}</span>
        </span>
        <span className="bklit-chart-baseline mono">
          baseline {baselineVal}
          {unit}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="bklit-chart-svg"
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.20" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal subtle grid lines */}
        {[0, 0.5, 1].map((frac) => {
          const y = padT + innerH * (1 - frac);
          const lbl = Math.round(maxVal * frac);
          return (
            <g key={frac}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="#EFE8E1"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fill="#78716C"
                fontSize="9.5"
                fontFamily="JetBrains Mono, monospace"
              >
                {lbl}
              </text>
            </g>
          );
        })}

        {/* Baseline reference */}
        <line
          x1={padL}
          y1={baselineY}
          x2={width - padR}
          y2={baselineY}
          stroke="#15803D"
          strokeOpacity="0.55"
          strokeDasharray="4 4"
          strokeWidth="1.2"
        />

        {/* Area + crisp curve */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive nodes */}
        {safePoints.map((pt, i) => {
          const x = toX(i);
          const y = toY(pt.value);
          const isActive = hoverIdx === i || (hoverIdx === null && i === safePoints.length - 1);
          return (
            <g key={`${pt.label}-${i}`} onMouseEnter={() => setHoverIdx(i)} style={{ cursor: "pointer" }}>
              {isActive && (
                <line
                  x1={x}
                  y1={padT}
                  x2={x}
                  y2={padT + innerH}
                  stroke="#E6DFD7"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              )}
              <circle cx={x} cy={y} r={isActive ? 4.5 : 3} fill="#FFFFFF" stroke={accentColor} strokeWidth="2" />
              <circle cx={x} cy={y} r={14} fill="transparent" />
              <text
                x={x}
                y={height - 6}
                textAnchor="middle"
                fill={isActive ? "#181614" : "#78716C"}
                fontSize="10"
                fontWeight={isActive ? "600" : "400"}
                fontFamily="JetBrains Mono, monospace"
              >
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
