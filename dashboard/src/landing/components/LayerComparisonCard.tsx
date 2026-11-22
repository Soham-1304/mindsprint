import React, { useRef, useState } from 'react'

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

const BEFORE_LAYER_DATA: Record<
  number,
  {
    kicker: string
    titleLead: string
    titleRest: string
    desc: string
    metric: string
    logLines: { tag: string; tagType: 'warn' | 'err' | 'info'; text: string }[]
  }
> = {
  1: {
    kicker: 'LEGACY TELEMETRY CHAOS',
    titleLead: 'Firefighting raw logs',
    titleRest: 'and 42 un-correlated alert storms.',
    desc: 'Engineers manually SSH into hosts, grepping through 2GB raw log dumps while alerts trigger without context.',
    metric: '4.5h Incident Lag',
    logLines: [
      { tag: 'WARN', tagType: 'warn', text: '502 Bad Gateway burst (24 un-grouped triggers)' },
      { tag: 'ERR', tagType: 'err', text: 'container restart loop: exit code 137 (OOMKilled)' },
      { tag: 'INFO', tagType: 'info', text: 'webhook #4829 received without commit context' },
    ],
  },
  2: {
    kicker: 'MANUAL TRIAGE OVERHEAD',
    titleLead: 'Digging Git blame',
    titleRest: 'across 2,400 unmapped commit diffs.',
    desc: 'No linkage between runtime exception traces and deployment hashes. Teams debate in Slack war rooms.',
    metric: '12 Eng in War Room',
    logLines: [
      { tag: 'WARN', tagType: 'warn', text: 'searching 2,400 commit diffs manually' },
      { tag: 'ERR', tagType: 'err', text: 'NullPointerException at OrderWorker.java:142' },
      { tag: 'INFO', tagType: 'info', text: '#incident-war-room: 14 engineers debating culprit' },
    ],
  },
  3: {
    kicker: 'BLACK-BOX GUESSWORK',
    titleLead: 'War room deadlock',
    titleRest: 'debating code vs infra faults for 3+ hours.',
    desc: 'Zero automated root-cause reasoning. Engineers guess whether latency is caused by a memory leak or network drift.',
    metric: '0% Confidence Proof',
    logLines: [
      { tag: 'WARN', tagType: 'warn', text: 'un-instrumented service: black box diagnosis' },
      { tag: 'ERR', tagType: 'err', text: 'p99 spiked to 4,200ms with zero culprit attribution' },
      { tag: 'INFO', tagType: 'info', text: 'team guessing infrastructure vs software bug' },
    ],
  },
  4: {
    kicker: 'UNVERIFIED PATCHING',
    titleLead: 'Risky production hot-patching',
    titleRest: 'without hermetic Docker testing.',
    desc: 'Unvetted hotfix scripts committed directly to main branch. Sietch supply-chain security disabled.',
    metric: '0 Sandbox Isolation',
    logLines: [
      { tag: 'WARN', tagType: 'warn', text: '12 packages updated without canary secret scan' },
      { tag: 'ERR', tagType: 'err', text: 'patch pushed directly to master without test suite' },
      { tag: 'INFO', tagType: 'info', text: 'unverified production mutation executed' },
    ],
  },
  5: {
    kicker: 'UNDETECTED REGRESSION',
    titleLead: 'Premature closure',
    titleRest: 'followed by recurring service regressions.',
    desc: 'Incidents marked resolved manually based on hope while error rates quietly climb again. Postmortems lost.',
    metric: '38% Reopen Rate',
    logLines: [
      { tag: 'WARN', tagType: 'warn', text: 'latency regression detected 15m after manual close' },
      { tag: 'ERR', tagType: 'err', text: 'missing immutable decision and action audit trail' },
      { tag: 'INFO', tagType: 'info', text: 'MTTD untracked; recovery verification failed' },
    ],
  },
}

/* --- TACTILE 3D HARDWARE SLAB GRAPHIC (REFERENCE FROM FIRST SCREENSHOT) --- */
function LayerSlabGraphic({ layer }: { layer: Layer }) {
  const isMain = layer.id === 3
  const isTop = layer.id === 5

  return (
    <svg
      className="slab-graphic-svg"
      viewBox="0 0 560 270"
      role="img"
      aria-label={`Layer 0${layer.id} ${layer.name} 3D tactile hardware slab`}
    >
      <defs>
        <radialGradient id={`slabGlow-${layer.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F46925" stopOpacity={isMain ? '0.75' : '0.25'} />
          <stop offset="45%" stopColor="#F46925" stopOpacity={isMain ? '0.35' : '0.08'} />
          <stop offset="100%" stopColor="#F46925" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`slabTopGrad-${layer.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F6F4EE" />
          <stop offset="100%" stopColor="#EAE6DA" />
        </linearGradient>
        <linearGradient id={`slabSideGrad-${layer.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E4DFD3" />
          <stop offset="100%" stopColor="#C8C2B3" />
        </linearGradient>
        <linearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7A38" />
          <stop offset="60%" stopColor="#F46925" />
          <stop offset="100%" stopColor="#D94E10" />
        </linearGradient>
      </defs>

      <ellipse
        cx="280"
        cy="158"
        rx="220"
        ry="80"
        fill={`url(#slabGlow-${layer.id})`}
      />

      <g className="slab-callouts" aria-hidden="true">
        <path d="M 390 98 H 470" stroke="#F46925" strokeWidth="1.2" strokeDasharray="3 3" />
        <circle cx="474" cy="98" r="3.5" fill="#F46925" />
        <text x="484" y="101" fill="#78756E" fontSize="9" fontFamily="var(--mono)">0{layer.id} // BEVEL RIM</text>

        <path d="M 405 142 H 470" stroke="#F46925" strokeWidth="1.2" strokeDasharray="3 3" />
        <circle cx="474" cy="142" r="3.5" fill="#F46925" />
        <text x="484" y="145" fill="#F46925" fontSize="9" fontWeight="600" fontFamily="var(--mono)">
          {isMain ? 'ACTIVE // GLOW' : 'SLOT INTERFACE'}
        </text>

        <path d="M 370 186 H 470" stroke="#F46925" strokeWidth="1.2" strokeDasharray="3 3" />
        <circle cx="474" cy="186" r="3.5" fill="#F46925" />
        <text x="484" y="189" fill="#78756E" fontSize="9" fontFamily="var(--mono)">TELEMETRY BUS</text>

        <path d="M 170 142 H 95" stroke="#F46925" strokeWidth="1.2" strokeDasharray="3 3" />
        <circle cx="91" cy="142" r="3.5" fill="#F46925" />
        <text x="82" y="145" textAnchor="end" fill="#F46925" fontSize="9" fontWeight="600" fontFamily="var(--mono)">
          {isMain ? 'LED // STATUS' : 'PINS // L0' + layer.id}
        </text>
      </g>

      <path
        d="M 120 120 L 120 148 Q 120 158 135 166 L 265 220 Q 280 226 295 220 L 425 166 Q 440 158 440 148 L 440 120 L 295 190 Q 280 196 265 190 Z"
        fill={`url(#slabSideGrad-${layer.id})`}
        stroke="#B8B2A2"
        strokeWidth="0.8"
      />

      <path
        d="M 265 72 Q 280 66 295 72 L 425 124 Q 440 130 425 137 L 295 190 Q 280 196 265 190 L 135 137 Q 120 130 135 124 Z"
        fill={`url(#slabTopGrad-${layer.id})`}
        stroke={isMain ? '#F46925' : '#D0CABE'}
        strokeWidth={isMain ? '2' : '1.2'}
      />

      <path
        d="M 268 85 Q 280 80 292 85 L 405 128 Q 416 132 405 137 L 292 180 Q 280 185 268 180 L 155 137 Q 144 132 155 128 Z"
        fill="none"
        stroke={isMain ? 'rgba(244, 105, 37, 0.45)' : '#DFDBD0'}
        strokeWidth="1.2"
      />

      {isMain && (
        <g>
          <ellipse cx="280" cy="133" rx="42" ry="21" fill="none" stroke="#F46925" strokeWidth="1.4" opacity="0.85" />
          <circle cx="238" cy="133" r="2.8" fill="#58544B" />
          <circle cx="322" cy="133" r="2.8" fill="#58544B" />

          <ellipse cx="148" cy="152" rx="3.5" ry="2" fill="#FF5E1E" />
          <circle cx="160" cy="158" r="1.6" fill="#38352F" />

          <path d="M 390 162 L 406 155 L 406 159 L 390 166 Z" fill="#22211E" />
          <path d="M 414 151 L 424 147 L 424 150 L 414 154 Z" fill="#22211E" />
        </g>
      )}

      {isTop && (
        <g transform="translate(280, 126)">
          <path d="M -22 -18 L 0 -26 L 22 -18 L 0 -10 Z" fill="url(#btnGrad)" stroke="#FFA372" strokeWidth="0.8" />
          <path d="M -48 -6 L -26 -14 L -4 -6 L -26 2 Z" fill="url(#btnGrad)" stroke="#FFA372" strokeWidth="0.8" />
          <path d="M 4 -6 L 26 -14 L 48 -6 L 26 2 Z" fill="url(#btnGrad)" stroke="#FFA372" strokeWidth="0.8" />
          <path d="M -22 6 L 0 -2 L 22 6 L 0 14 Z" fill="url(#btnGrad)" stroke="#FFA372" strokeWidth="0.8" />
        </g>
      )}

      {!isTop && (
        <text
          x="280"
          y="180"
          textAnchor="middle"
          fill={isMain ? '#F46925' : '#78756E'}
          fontSize="13"
          fontWeight="700"
          fontFamily="var(--mono)"
          letterSpacing="0.18em"
        >
          {`0 ${layer.id}`}
        </text>
      )}
    </svg>
  )
}

/* --- THE EXACT ORBITAL SPEC DIAGRAM (FROM SCREENSHOT 3) --- */
function LayerOrbitalDiagram({ layer }: { layer: Layer }) {
  return (
    <svg className="diagram" viewBox="0 0 560 270" role="img" aria-label={`Layer 0${layer.id} ${layer.name} orbital blueprint`}>
      <circle cx="280" cy="135" r="108" fill="none" stroke="rgba(79,106,130,0.22)" strokeWidth="1" strokeDasharray="3 6" />
      <circle cx="280" cy="135" r="76" fill="rgba(242,102,39,0.05)" stroke="rgba(242,102,39,0.45)" strokeWidth="1.2" />
      <ellipse cx="280" cy="135" rx="132" ry="44" fill="none" stroke="rgba(79,106,130,0.28)" strokeWidth="1" transform="rotate(-14 280 135)" />
      <ellipse cx="280" cy="135" rx="132" ry="44" fill="none" stroke="rgba(242,102,39,0.34)" strokeWidth="1" strokeDasharray="6 5" className="pulse" transform="rotate(14 280 135)" />
      <path d="M 142 135 H 198 M 362 135 H 418" stroke="#F26627" strokeWidth="1.25" strokeDasharray="4 4" className="pulse" />

      <rect x="16" y="115" width="126" height="40" rx="8" fill="#FAF8F4" stroke="rgba(70,94,115,0.28)" />
      <text x="79" y="139" textAnchor="middle" className="d-caption">{layer.flow[0].toUpperCase()}</text>

      <rect x="198" y="109" width="164" height="52" rx="10" fill="rgba(255,255,255,0.94)" stroke="rgba(242,102,39,0.45)" />
      <text x="280" y="130" textAnchor="middle" className="d-kicker-orange">L0{layer.id} // {layer.short}</text>
      <text x="280" y="149" textAnchor="middle">{layer.flow[1]}</text>

      <rect x="418" y="115" width="126" height="40" rx="8" fill="#FFF6F0" stroke="rgba(242,102,39,0.38)" />
      <text x="481" y="139" textAnchor="middle" className="d-caption">{layer.flow[2].toUpperCase()}</text>
    </svg>
  )
}

/* ============================================================================
   INTERACTIVE BEFORE / AFTER COMPARISON CARD COMPONENT
   - Clean, non-overlapping editorial alignment
   - Callout badges neatly docked in left annotation column with connector lines
   - Preserves the exact orbital diagram (Image 3)
   - Supports 3D tactile hardware slab view (Image 1)
   ============================================================================ */
export function LayerComparisonCard({ layer }: { layer: Layer }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [sliderPos, setSliderPos] = useState(52)
  const [isDragging, setIsDragging] = useState(false)
  const [rightViewMode, setRightViewMode] = useState<'diagram' | 'slab'>('diagram')

  const beforeData = BEFORE_LAYER_DATA[layer.id] || BEFORE_LAYER_DATA[1]

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    updateSlider(e.clientX)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    updateSlider(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      // safe fallback
    }
  }

  const updateSlider = (clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const rawPos = ((clientX - rect.left) / rect.width) * 100
    const clamped = Math.max(5, Math.min(95, rawPos))
    setSliderPos(clamped)
  }

  return (
    <div className="layer-comp-wrap">
      {/* TILTED EDITORIAL BEFORE / AFTER BADGE STAMPS (IMAGE 2 REFERENCE) */}
      <div className="comp-stamp comp-stamp--before" aria-hidden="true">
        BEFORE
      </div>
      <div className="comp-stamp comp-stamp--after" aria-hidden="true">
        AFTER
      </div>

      <div
        ref={containerRef}
        className={`layer-comp-card ${isDragging ? 'is-dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* ===================================================================
            LAYER A: "AFTER" STATE (THE EXACT DIAGRAM FROM SCREENSHOT 3)
           =================================================================== */}
        <div className="comp-layer comp-layer--after">
          <div className="deep-row__frame-top">
            <span className="comp-module-tag">MODULE 0{layer.id} · {layer.name.toUpperCase()}</span>
            <div className="comp-frame-right-controls">
              <span className="comp-status-pill comp-status-pill--green">■ On track</span>
              <button
                type="button"
                className={`comp-mini-toggle ${rightViewMode === 'diagram' ? 'is-active' : ''}`}
                onClick={e => {
                  e.stopPropagation()
                  setRightViewMode('diagram')
                }}
                title="View original orbital schematic"
              >
                ◬ Diagram
              </button>
              <button
                type="button"
                className={`comp-mini-toggle ${rightViewMode === 'slab' ? 'is-active' : ''}`}
                onClick={e => {
                  e.stopPropagation()
                  setRightViewMode('slab')
                }}
                title="View 3D tactile hardware slab from first screenshot"
              >
                ⬡ 3D Slab
              </button>
            </div>
          </div>

          <div className="comp-diagram-stage">
            {rightViewMode === 'diagram' ? (
              <LayerOrbitalDiagram layer={layer} />
            ) : (
              <LayerSlabGraphic layer={layer} />
            )}
          </div>

          {/* Right-Side Callout Badges with Leader Lines */}
          <div className="comp-right-callout-overlay" aria-hidden="true">
            <div className="callout-badge-pill callout-badge-pill--green pill-r1">
              <span className="pill-dot" />
              <span>Real-time Stream</span>
            </div>
            <div className="callout-badge-pill callout-badge-pill--orange pill-r2">
              <span className="pill-dot" />
              <span>Read-Scoped</span>
            </div>
          </div>
        </div>

        {/* ===================================================================
            LAYER B: "BEFORE" STATE (IMAGE 2 REFERENCE - AI BEIGE + SIDE-TAB BORDER)
            Clean, balanced 2-column layout so badges NEVER collide with text!
           =================================================================== */}
        <div
          className="comp-layer comp-layer--before"
          style={{ clipPath: `inset(0 calc(100% - ${sliderPos}%) 0 0)` }}
        >
          {/* PURPLE SIDE-TAB BORDER (IMAGE 2 REFERENCE) */}
          <div className="comp-side-tab-bar" aria-hidden="true" />

          {/* Top Header Bar */}
          <div className="deep-row__frame-top comp-frame-top--before">
            <span className="comp-kicker-before">
              LAUNCH / 0{layer.id} // {beforeData.kicker}
            </span>
            <span className="comp-status-pill comp-status-pill--amber">
              ▲ {beforeData.metric}
            </span>
          </div>

          {/* Balanced 2-Column Body: Left Annotation Column + Right Typography Column */}
          <div className="comp-before-annotated-grid">
            {/* Left Annotation Column: 4 Callout Tags with Connector Lines (Image 2) */}
            <div className="comp-annotations-col" aria-hidden="true">
              <div className="annot-item annot-item--kicker">
                <span className="callout-badge-pill callout-badge-pill--yellow">
                  AI kicker
                </span>
                <span className="annot-line" />
              </div>

              <div className="annot-item annot-item--serif">
                <span className="callout-badge-pill callout-badge-pill--yellow">
                  Italic serif
                </span>
                <span className="annot-line" />
              </div>

              <div className="annot-item annot-item--border">
                <span className="callout-badge-pill callout-badge-pill--yellow">
                  Side-tab border
                </span>
                <span className="annot-line" />
              </div>

              <div className="annot-item annot-item--beige">
                <span className="callout-badge-pill callout-badge-pill--yellow">
                  AI beige
                </span>
                <span className="annot-line" />
              </div>
            </div>

            {/* Right Typography & Content Column (Completely clear, balanced & beautiful) */}
            <div className="comp-before-text-col">
              <div className="comp-before-header-block">
                <p className="comp-section-tag-lead">{beforeData.kicker}</p>
                <h4 className="comp-before-title">
                  <em className="comp-italic-serif">{beforeData.titleLead}</em>{' '}
                  <span className="comp-title-rest">{beforeData.titleRest}</span>
                </h4>
                <p className="comp-before-desc">{beforeData.desc}</p>
              </div>

              {/* Log / Alert Box */}
              <div className="comp-log-box" aria-hidden="true">
                {beforeData.logLines.map((line, idx) => (
                  <div key={idx} className="comp-log-line">
                    <span className={`comp-log-tag comp-log-tag--${line.tagType}`}>{line.tag}</span>
                    <code className="comp-log-text">{line.text}</code>
                  </div>
                ))}
              </div>

              {/* Bottom Progress Bar & Decision Status (Image 2) */}
              <div className="comp-before-bottom">
                <div className="comp-progress-track">
                  <div className="comp-progress-fill" style={{ width: '36%' }} />
                </div>
                <div className="comp-progress-meta">
                  <span className="comp-progress-label">3 of 14 decisions closed</span>
                  <span className="comp-lag-pill">Review triage →</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            DRAGGABLE SLIDER DIVIDER LINE & HANDLE PILL [ ||| ] (IMAGE 2 REFERENCE)
           =================================================================== */}
        <div
          className="comp-slider-divider"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="comp-slider-line" />
          <div
            className="comp-slider-handle"
            role="slider"
            aria-valuenow={Math.round(sliderPos)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Drag to compare Before and After AIA-02"
            tabIndex={0}
          >
            <span className="comp-handle-grip">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      </div>

      {/* QUICK VIEW MODE BUTTONS UNDERNEATH CARD */}
      <div className="comp-quick-toolbar">
        <button
          type="button"
          className={`comp-quick-btn ${sliderPos > 30 && sliderPos < 70 ? 'is-active' : ''}`}
          onClick={() => setSliderPos(52)}
        >
          ◧ Split View
        </button>
        <button
          type="button"
          className={`comp-quick-btn ${sliderPos >= 85 ? 'is-active' : ''}`}
          onClick={() => setSliderPos(92)}
        >
          ◀ Full Before
        </button>
        <button
          type="button"
          className={`comp-quick-btn ${sliderPos <= 15 ? 'is-active' : ''}`}
          onClick={() => setSliderPos(8)}
        >
          Full After ▶
        </button>
        <span className="comp-drag-cue">Drag center handle ↔</span>
      </div>
    </div>
  )
}
