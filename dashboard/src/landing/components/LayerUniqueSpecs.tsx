import React from 'react'

export type Layer = {
  id: number
  short: string
  kicker: string
  name: string
  headline: string
  purpose: string
  detail: string
  input: string
  output: string
  flow: [string, string, string]
  capabilities: string[]
}

/* ============================================================================
   SHARED CLEAN EDITORIAL TEXT BLOCK FOR LAYERS 2, 3, 4, 5
   - Fixes text alignment, spacious & appealing
   - Removes all unnecessary clunky boxes
   - 100% preserves original text info (Kicker, Title, Purpose, Detail, IO, Bullets)
   - Adds layer-specific distinctive technical accent badge
   ============================================================================ */
export function LayerCleanCopy({
  layer,
  badge,
}: {
  layer: Layer
  badge?: React.ReactNode
}) {
  return (
    <div className="layer-unique-copy">
      <div className="layer-clean-tag">
        <span className="layer-tag-dot" />
        <span className="layer-tag-num">0{layer.id}</span>
        <span className="layer-tag-sep">//</span>
        <span className="layer-tag-kicker">{layer.kicker}</span>
      </div>

      <h3 className="layer-clean-title">{layer.headline}</h3>

      <p className="layer-clean-purpose">{layer.purpose}</p>
      <p className="layer-clean-detail">{layer.detail}</p>

      {badge && <div className="layer-clean-badge-wrap">{badge}</div>}

      <div className="layer-clean-io-unboxed">
        <div className="io-meta-item">
          <span className="io-meta-label">INPUT</span>
          <span className="io-meta-val">{layer.input}</span>
        </div>
        <span className="io-meta-arrow" aria-hidden="true">→</span>
        <div className="io-meta-item">
          <span className="io-meta-label io-meta-label--orange">OUTPUT</span>
          <span className="io-meta-val io-meta-val--highlight">{layer.output}</span>
        </div>
      </div>

      <ul className="layer-clean-bullets">
        {layer.capabilities.slice(0, 4).map(c => (
          <li key={c}>
            <span className="bullet-check-badge" aria-hidden="true">✓</span>
            <span className="bullet-text">{c}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ============================================================================
   LAYER 02 DIAGRAM: RELEASE & INCIDENT CONTEXT TIMELINE
   - Correlates deployment timestamps with Prometheus error spike
   - Pinpoints suspected culprit commit #8f4b2a with author & diff stats
   - Fully aligned, spacious layout with zero clipping
   ============================================================================ */
export function Layer02Diagram() {
  return (
    <div className="deep-row__diagram layer-diagram-card">
      <div className="deep-row__frame-top">
        <span>MODULE 02 · RELEASE & INCIDENT CONTEXT</span>
        <span className="comp-status-pill comp-status-pill--green">■ LIVE CORRELATION</span>
      </div>

      <svg className="diagram" viewBox="0 0 580 300" role="img" aria-label="Release and incident timeline correlation diagram">
        <defs>
          <linearGradient id="errorGradientL2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F26627" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#F26627" stopOpacity="0.01" />
          </linearGradient>
          <filter id="shadowL2" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* Background Grid Lines */}
        <line x1="40" y1="218" x2="540" y2="218" stroke="rgba(70,94,115,0.18)" strokeWidth="1" />
        <line x1="40" y1="146" x2="540" y2="146" stroke="rgba(70,94,115,0.12)" strokeDasharray="3 3" />
        <line x1="40" y1="80" x2="540" y2="80" stroke="rgba(70,94,115,0.1)" strokeDasharray="3 3" />

        {/* Normal Metric Baseline Curve with Spike */}
        <path
          d="M 40 216 Q 140 216 200 214 T 270 212 T 320 92 Q 350 72 380 102 T 440 168 T 540 204"
          fill="none"
          stroke="#F26627"
          strokeWidth="2.4"
        />
        <path
          d="M 40 216 Q 140 216 200 214 T 270 212 T 320 92 Q 350 72 380 102 T 440 168 T 540 204 L 540 218 L 40 218 Z"
          fill="url(#errorGradientL2)"
        />

        {/* Timeline Event Marker: T-45m Deploy */}
        <g transform="translate(160, 218)">
          <line x1="0" y1="0" x2="0" y2="28" stroke="#94A3B8" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="0" cy="0" r="4.5" fill="#64748B" />
          <text x="0" y="16" textAnchor="middle" fill="#64748B" fontSize="9.5" fontWeight="600" fontFamily="var(--mono)">T-45m</text>
          <text x="0" y="27" textAnchor="middle" fill="#94A3B8" fontSize="8.5" fontFamily="var(--mono)">deploy v2.1.4</text>
        </g>

        {/* CULPRIT COMMIT SPIKE HIGHLIGHT */}
        <g transform="translate(320, 92)">
          {/* Vertical Pointer Line down to baseline */}
          <line x1="0" y1="6" x2="0" y2="126" stroke="#F26627" strokeWidth="1.5" strokeDasharray="3 3" className="pulse" />
          <circle cx="0" cy="0" r="6" fill="#F26627" />
          <circle cx="0" cy="0" r="12" fill="none" stroke="#F26627" strokeWidth="1.2" opacity="0.45" />

          {/* Vertical connection to callout card above */}
          <line x1="0" y1="-1" x2="0" y2="-18" stroke="#F26627" strokeWidth="1.5" />

          {/* Floating High-Contrast Callout Card */}
          <g transform="translate(-120, -72)" filter="url(#shadowL2)">
            <rect width="240" height="54" rx="8" fill="#1C1D1A" stroke="#F26627" strokeWidth="1.5" />
            <circle cx="18" cy="18" r="4" fill="#F26627" />
            <text x="28" y="22" textAnchor="start" fill="#FDBA74" fontSize="10.5" fontWeight="700" fontFamily="var(--mono)">CULPRIT COMMIT #8f4b2a</text>
            <text x="18" y="40" textAnchor="start" fill="#FFFFFF" fontSize="9.5" fontFamily="var(--mono)">
              auth-worker.ts · <tspan fill="#34D399" fontWeight="700">+14</tspan> / <tspan fill="#F87171" fontWeight="700">-3</tspan> lines
            </text>
            <rect x="184" y="10" width="44" height="20" rx="4" fill="rgba(242,102,39,0.25)" stroke="#F26627" strokeWidth="0.8" />
            <text x="206" y="24" textAnchor="middle" fill="#FFEDD5" fontSize="9" fontWeight="700" fontFamily="var(--mono)">98%</text>
          </g>
        </g>

        {/* Baseline Labels (Properly aligned with start anchor) */}
        <text x="44" y="140" textAnchor="start" fill="#64748B" fontSize="9" fontFamily="var(--mono)">ERROR THRESHOLD (500s / sec)</text>
        <text x="44" y="212" textAnchor="start" fill="#94A3B8" fontSize="9" fontFamily="var(--mono)">NOMINAL BASELINE</text>

        {/* Time Axis Arrow */}
        <line x1="40" y1="265" x2="540" y2="265" stroke="#94A3B8" strokeWidth="1" />
        <polygon points="540,262 546,265 540,268" fill="#94A3B8" />
        <text x="290" y="282" textAnchor="middle" fill="#64748B" fontSize="9" letterSpacing="1.2" fontFamily="var(--mono)">INCIDENT TELEMETRY TIMELINE →</text>
      </svg>
    </div>
  )
}

/* ============================================================================
   LAYER 03 DIAGRAM: MULTI-MODEL REASONING ENGINE (THE BRAIN)
   - Architectural Neural Processor Chip in center (no clipped text)
   - Left input feeds (Watcher, Metrics, Git diff) aligned with comfortable padding
   - Right hypotheses outputs (Infra Drift rejected, Code Bug verified)
   - 100% visible, crisp, spacious and perfectly balanced
   ============================================================================ */
export function Layer03Diagram() {
  return (
    <div className="deep-row__diagram layer-diagram-card layer-diagram-card--featured">
      <div className="deep-row__frame-top">
        <span>MODULE 03 · AI DIAGNOSIS ENGINE (THE BRAIN)</span>
        <span className="comp-status-pill comp-status-pill--green">■ 98.4% CONFIDENCE</span>
      </div>

      <svg className="diagram" viewBox="0 0 580 300" role="img" aria-label="Multi-model reasoning and causal diagnosis matrix">
        <defs>
          <filter id="shadowL3" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Soft Ambient Neural Halo Ring behind Center */}
        <ellipse cx="290" cy="145" rx="86" ry="72" fill="rgba(242,102,39,0.06)" stroke="rgba(242,102,39,0.3)" strokeWidth="1.2" strokeDasharray="4 4" className="pulse" />

        {/* Left Input Feeds (x=16 to 172) */}
        {/* Feed 1: The Watcher */}
        <g transform="translate(16, 44)" filter="url(#shadowL3)">
          <rect width="156" height="42" rx="8" fill="#FFFFFF" stroke="rgba(70,94,115,0.22)" />
          <circle cx="16" cy="21" r="3.5" fill="#F26627" />
          <text x="26" y="18" textAnchor="start" fill="#0F172A" fontSize="10" fontWeight="600">The Watcher</text>
          <text x="26" y="32" textAnchor="start" fill="#64748B" fontSize="8.5" fontFamily="var(--mono)">Anomaly triggers</text>
        </g>
        <path d="M 172 65 L 214 118" stroke="#F26627" strokeWidth="1.3" strokeDasharray="3 3" />

        {/* Feed 2: Prometheus & Logs */}
        <g transform="translate(16, 120)" filter="url(#shadowL3)">
          <rect width="156" height="42" rx="8" fill="#FFFFFF" stroke="rgba(70,94,115,0.22)" />
          <circle cx="16" cy="21" r="3.5" fill="#F26627" />
          <text x="26" y="18" textAnchor="start" fill="#0F172A" fontSize="10" fontWeight="600">Prometheus & Logs</text>
          <text x="26" y="32" textAnchor="start" fill="#64748B" fontSize="8.5" fontFamily="var(--mono)">Raw metric vectors</text>
        </g>
        <path d="M 172 141 L 214 145" stroke="#F26627" strokeWidth="1.4" />

        {/* Feed 3: Git Commit Diff */}
        <g transform="translate(16, 196)" filter="url(#shadowL3)">
          <rect width="156" height="42" rx="8" fill="#FFFFFF" stroke="rgba(70,94,115,0.22)" />
          <circle cx="16" cy="21" r="3.5" fill="#F26627" />
          <text x="26" y="18" textAnchor="start" fill="#0F172A" fontSize="10" fontWeight="600">Git Commit Diff</text>
          <text x="26" y="32" textAnchor="start" fill="#64748B" fontSize="8.5" fontFamily="var(--mono)">Culprit lines #8f4b2a</text>
        </g>
        <path d="M 172 217 L 214 172" stroke="#F26627" strokeWidth="1.3" strokeDasharray="3 3" />

        {/* Central Architectural Neural Processor Chip (x=214 to 366, width=152) */}
        <g transform="translate(214, 85)" filter="url(#shadowL3)">
          <rect width="152" height="120" rx="12" fill="#FFFFFF" stroke="#F26627" strokeWidth="1.8" />
          
          {/* Micro Corner CAD Markers */}
          <circle cx="10" cy="10" r="2" fill="#F26627" opacity="0.6" />
          <circle cx="142" cy="10" r="2" fill="#F26627" opacity="0.6" />
          <circle cx="10" cy="110" r="2" fill="#F26627" opacity="0.6" />
          <circle cx="142" cy="110" r="2" fill="#F26627" opacity="0.6" />

          {/* Chip Typography */}
          <text x="76" y="26" textAnchor="middle" fill="#0F172A" fontSize="11" fontWeight="700" letterSpacing="0.06em">THE BRAIN</text>
          
          {/* Engine Pill */}
          <rect x="22" y="35" width="108" height="18" rx="4" fill="rgba(242,102,39,0.12)" />
          <text x="76" y="47" textAnchor="middle" fill="#F26627" fontSize="8.5" fontWeight="700" letterSpacing="0.06em">MULTI-MODEL ENGINE</text>

          {/* Reasoning & Confidence */}
          <text x="76" y="74" textAnchor="middle" fill="#059669" fontSize="9" fontWeight="700">98.4% Confidence RCA</text>
          <text x="76" y="90" textAnchor="middle" fill="#64748B" fontSize="8.5" letterSpacing="0.04em">Causal Reasoning</text>
          <text x="76" y="104" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="var(--mono)">Cross-Correlated</text>
        </g>

        {/* Connectors from Chip to Right Hypotheses */}
        <path d="M 366 118 L 408 82" stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="3 3" />
        <path d="M 366 166 L 408 184" stroke="#10B981" strokeWidth="1.8" />

        {/* Output Hypotheses on Right (x=408 to 564, width=156) */}
        {/* Hypothesis A (Rejected) */}
        <g transform="translate(408, 56)">
          <rect width="156" height="52" rx="8" fill="#F8FAFC" stroke="rgba(148,163,184,0.3)" strokeDasharray="3 3" />
          <circle cx="16" cy="18" r="3.5" fill="#94A3B8" />
          <text x="26" y="21" textAnchor="start" fill="#64748B" fontSize="9" fontWeight="600">Hypothesis A · Infra Drift</text>
          <text x="26" y="37" textAnchor="start" fill="#94A3B8" fontSize="8.5" fontFamily="var(--mono)">1.6% (Rejected)</text>
        </g>

        {/* Hypothesis B (Verified & Actionable) */}
        <g transform="translate(408, 146)" filter="url(#shadowL3)">
          <rect width="156" height="72" rx="8" fill="#ECFDF5" stroke="#10B981" strokeWidth="1.5" />
          <circle cx="16" cy="19" r="3.5" fill="#10B981" />
          <text x="26" y="22" textAnchor="start" fill="#065F46" fontSize="9.5" fontWeight="700">Hypothesis B · Code Bug</text>
          <text x="26" y="38" textAnchor="start" fill="#047857" fontSize="8.5" fontFamily="var(--mono)">98.4% (Verified)</text>
          <rect x="20" y="47" width="124" height="17" rx="3.5" fill="#10B981" />
          <text x="82" y="59" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="700" letterSpacing="0.05em">TRIGGER FIX AUTO →</text>
        </g>

        {/* Baseline Verification Track */}
        <line x1="20" y1="262" x2="560" y2="262" stroke="rgba(70,94,115,0.14)" strokeWidth="1" />
        <text x="290" y="278" textAnchor="middle" fill="#64748B" fontSize="8.5" letterSpacing="0.08em" fontFamily="var(--mono)">
          CROSS-EXAMINED LOGS · METRICS · GIT COMMITS · ZERO HALLUCINATION
        </text>
      </svg>
    </div>
  )
}

/* ============================================================================
   LAYER 04 DIAGRAM: HERMETIC EXECUTION & DOCKER SANDBOX
   - Sietch package inspection & disposable Docker regression run
   - Cleanly aligned, zero text overlap, high contrast
   ============================================================================ */
export function Layer04Diagram() {
  return (
    <div className="deep-row__diagram layer-diagram-card">
      <div className="deep-row__frame-top">
        <span>MODULE 04 · HERMETIC REMEDIATION & SECURITY</span>
        <span className="comp-status-pill comp-status-pill--green">■ SANDBOX ISOLATED</span>
      </div>

      <svg className="diagram" viewBox="0 0 580 300" role="img" aria-label="Hermetic execution Docker sandbox and pull request generator">
        <defs>
          <filter id="shadowL4" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Isolated Docker Box (x=18, width=310) */}
        <rect x="18" y="30" width="310" height="238" rx="10" fill="#181916" stroke="#F26627" strokeWidth="1.3" />
        
        {/* Docker Header */}
        <rect x="30" y="44" width="8" height="8" rx="2" fill="#F26627" />
        <text x="44" y="52" textAnchor="start" fill="#F26627" fontSize="9.5" fontWeight="700" letterSpacing="0.08em" fontFamily="var(--mono)">
          DISPOSABLE DOCKER CONTAINER
        </text>
        <text x="312" y="52" textAnchor="end" fill="#94A3B8" fontSize="8.5" fontFamily="var(--mono)">
          EPHEMERAL
        </text>

        {/* Sandbox Pipeline Check Steps */}
        {([
          ['01', 'Canary Secret Decoy', '0 leaks detected', 68, '#10B981'],
          ['02', 'Regression Test Suite', '14 passed in 1.8s', 106, '#10B981'],
          ['03', 'Network Egress Lock', 'Outbound blocked', 144, '#10B981'],
          ['04', 'Zero Mutated Hosts', 'Hermetic runner', 182, '#38BDF8'],
        ] as const).map(([num, name, status, y, col]) => (
          <g key={num} transform={`translate(30, ${y})`}>
            <rect width="286" height="30" rx="5" fill="#242522" stroke="rgba(255,255,255,0.06)" />
            <circle cx="12" cy="15" r="3" fill={col} />
            <text x="22" y="19" textAnchor="start" fill="#FAF8F3" fontSize="9" fontWeight="600">{name}</text>
            <text x="274" y="19" textAnchor="end" fill={col} fontSize="8.5" fontFamily="var(--mono)">{status}</text>
          </g>
        ))}

        {/* Docker Footnote */}
        <text x="173" y="248" textAnchor="middle" fill="#64748B" fontSize="8.5" fontFamily="var(--mono)">
          SIETCH SECURED · ZERO PRIVILEGE ESCALATION
        </text>

        {/* Connector to PR Output */}
        <path d="M 328 149 L 376 149" stroke="#F26627" strokeWidth="1.6" strokeDasharray="4 4" className="pulse" />
        <polygon points="376,146 382,149 376,152" fill="#F26627" />

        {/* PR Output Box (x=376 to 562, width=186) */}
        <g transform="translate(376, 48)" filter="url(#shadowL4)">
          <rect width="186" height="202" rx="10" fill="#FFFFFF" stroke="rgba(70,94,115,0.22)" />
          
          <rect x="14" y="14" width="158" height="26" rx="4" fill="#F1F5F9" />
          <text x="26" y="31" textAnchor="start" fill="#0F172A" fontSize="9" fontWeight="700" fontFamily="var(--mono)">PR #142 READY</text>
          <circle cx="158" cy="27" r="3.5" fill="#10B981" />

          <text x="16" y="64" textAnchor="start" fill="#0F172A" fontSize="10.5" fontWeight="600">fix/corrupt-jwt</text>
          <text x="16" y="80" textAnchor="start" fill="#64748B" fontSize="8.5">Verified in Docker</text>
          <text x="16" y="96" textAnchor="start" fill="#10B981" fontSize="8.5" fontFamily="var(--mono)">+12 / -4 lines diff</text>

          <line x1="14" y1="110" x2="172" y2="110" stroke="rgba(70,94,115,0.12)" />

          <text x="16" y="128" textAnchor="start" fill="#64748B" fontSize="8.5">CI/CD Checks: <tspan fill="#10B981" fontWeight="700">14/14</tspan></text>
          <text x="16" y="142" textAnchor="start" fill="#64748B" fontSize="8.5">Branch Protection: <tspan fill="#0F172A">Passed</tspan></text>

          <rect x="14" y="156" width="158" height="32" rx="6" fill="#0F172A" />
          <text x="93" y="176" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="600">Review & Merge →</text>
        </g>
      </svg>
    </div>
  )
}

/* ============================================================================
   LAYER 05 DIAGRAM: CONTINUOUS SLO RECOVERY & POSTMORTEM SCORECARD
   - Proves metric return to baseline before closing incident
   - Crisp resolution stamp, clear axes and zero text collision
   ============================================================================ */
export function Layer05Diagram() {
  return (
    <div className="deep-row__diagram layer-diagram-card">
      <div className="deep-row__frame-top">
        <span>MODULE 05 · CONTINUOUS SLO RECOVERY</span>
        <span className="comp-status-pill comp-status-pill--green">■ INCIDENT CLOSED</span>
      </div>

      <svg className="diagram" viewBox="0 0 580 300" role="img" aria-label="SLO recovery curve and immutable engineering postmortem">
        <defs>
          <linearGradient id="sloRecoveryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.01" />
          </linearGradient>
          <filter id="shadowL5" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Critical Level Line (Peak Error Spike) */}
        <line x1="36" y1="76" x2="330" y2="76" stroke="#EF4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        <text x="42" y="70" textAnchor="start" fill="#EF4444" fontSize="8.5" fontFamily="var(--mono)">PEAK ERROR SPIKE (4.8%)</text>

        {/* Recovery Target Line (SLO Healthy Baseline) */}
        <line x1="36" y1="210" x2="544" y2="210" stroke="#10B981" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
        <text x="42" y="204" textAnchor="start" fill="#10B981" fontSize="8.5" fontFamily="var(--mono)">SLO HEALTHY BASELINE (0.01%)</text>

        {/* Smooth SLO Recovery Curve */}
        <path
          d="M 36 76 Q 80 82 130 102 T 210 186 T 290 210 L 544 210"
          fill="none"
          stroke="#10B981"
          strokeWidth="2.4"
        />
        <path
          d="M 36 76 Q 80 82 130 102 T 210 186 T 290 210 L 544 210 L 544 235 L 36 235 Z"
          fill="url(#sloRecoveryGrad)"
        />

        {/* Verified Resolution Stamp Badge (x=336 to 552, width=216) */}
        <g transform="translate(336, 56)" filter="url(#shadowL5)">
          <rect width="216" height="128" rx="10" fill="#FFFFFF" stroke="#10B981" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="11" fill="#ECFDF5" stroke="#10B981" strokeWidth="1.2" />
          <text x="24" y="28" textAnchor="middle" fill="#047857" fontSize="12" fontWeight="700">✓</text>
          <text x="44" y="21" textAnchor="start" fill="#065F46" fontSize="10" fontWeight="700">SLO RECOVERY PROVEN</text>
          <text x="44" y="34" textAnchor="start" fill="#64748B" fontSize="8.5" fontFamily="var(--mono)">30m Zero-Burn Stabilized</text>

          <line x1="14" y1="48" x2="202" y2="48" stroke="rgba(70,94,115,0.12)" />

          <text x="14" y="66" textAnchor="start" fill="#1E293B" fontSize="9" fontWeight="600">Mean Time to Diagnosis:</text>
          <text x="202" y="66" textAnchor="end" fill="#F26627" fontSize="9.5" fontWeight="700" fontFamily="var(--mono)">4m 12s</text>

          <text x="14" y="84" textAnchor="start" fill="#1E293B" fontSize="9" fontWeight="600">Audit Status:</text>
          <text x="202" y="84" textAnchor="end" fill="#10B981" fontSize="9" fontWeight="600">Signed & Immutable</text>

          <line x1="14" y1="96" x2="202" y2="96" stroke="rgba(70,94,115,0.1)" strokeDasharray="2 2" />

          <text x="14" y="112" textAnchor="start" fill="#64748B" fontSize="8.5">Auto-closed incident #891</text>
          <text x="202" y="112" textAnchor="end" fill="#94A3B8" fontSize="8" fontFamily="var(--mono)">v2.1.5</text>
        </g>

        {/* Time Axis Arrow */}
        <line x1="36" y1="258" x2="544" y2="258" stroke="#94A3B8" strokeWidth="1" />
        <polygon points="544,255 550,258 544,261" fill="#94A3B8" />
        <text x="290" y="276" textAnchor="middle" fill="#64748B" fontSize="9" letterSpacing="1.2" fontFamily="var(--mono)">
          POST-FIX OBSERVABILITY WINDOW (60m) →
        </text>
      </svg>
    </div>
  )
}
