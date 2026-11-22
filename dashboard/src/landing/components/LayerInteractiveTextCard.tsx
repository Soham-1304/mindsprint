import React, { useRef, useState } from 'react'
import type { Layer } from './LayerComparisonCard'

type LayerInteractiveTextCardProps = {
  layer: Layer
}

const LEGACY_BEFORE_INFO: Record<
  number,
  {
    serifLead: string
    titleRest: string
    desc: string
    inputOutput: string
    painPoints: string[]
  }
> = {
  1: {
    serifLead: 'Firefighting raw logs',
    titleRest: 'and 42 un-correlated alert storms.',
    desc: 'Before AIA-02, engineers manually SSH into instances, grepping through multi-gigabyte log dumps while Prometheus alerts fire with zero deployment correlation.',
    inputOutput: 'Raw unparsed logs, siloed metrics → 4.5h MTTR & alert fatigue',
    painPoints: [
      'Un-correlated alerts firing in isolation at 3 AM',
      'Missing commit context on production error spikes',
      'Docker restart loops require manual container inspection',
      'No unified operational telemetry envelope',
    ],
  },
  2: {
    serifLead: 'Digging Git blame',
    titleRest: 'across 2,400 unmapped commit diffs.',
    desc: 'Before AIA-02, production stack traces are disconnected from release hashes. Engineering teams spend hours manually bisecting commits in Slack war rooms.',
    inputOutput: '2,400 unlinked commit lines → 12 engineers in war room',
    painPoints: [
      'Production stack traces lack linked commit hashes',
      'Manual line-by-line Git blame inspection',
      'Alert floods obscure the actual culprit release',
      'War room debates delay incident remediation',
    ],
  },
  3: {
    serifLead: 'War room deadlock',
    titleRest: 'debating code vs infra faults for 3+ hours.',
    desc: 'Before AIA-02, diagnosing root cause relies on guesswork. Teams lack automated multi-model reasoning to decouple infrastructure spikes from application code bugs.',
    inputOutput: 'Siloed logs & metrics → Unscored, speculative RCA',
    painPoints: [
      'No automated root-cause reasoning across signals',
      'Unable to decouple code bugs from network drift',
      'Speculative incident hypotheses without proof',
      'Zero confidence scoring before taking actions',
    ],
  },
  4: {
    serifLead: 'Risky production patching',
    titleRest: 'without hermetic Docker testing.',
    desc: 'Before AIA-02, emergency hotfixes are merged directly to production branches without regression tests, while npm packages enter without sandboxed canary inspection.',
    inputOutput: 'Unvetted hotfixes, uninspected npm → Supply chain risks',
    painPoints: [
      'Hotfix scripts committed directly to main branch',
      'No disposable Docker containers for regression suites',
      'npm dependency changes skip install-time sandboxing',
      'Uncontrolled infrastructure mutations risk further downtime',
    ],
  },
  5: {
    serifLead: 'Premature closure',
    titleRest: 'followed by recurring service regressions.',
    desc: 'Before AIA-02, incidents are marked resolved based on intuition while error rates quietly climb back up. Postmortems and audit trails are lost.',
    inputOutput: 'Intuitive manual closure → 38% incident reopening rate',
    painPoints: [
      'Incidents closed prematurely before SLO recovery stabilizes',
      'Undetected post-deployment regressions trigger secondary outages',
      'Postmortems written days later with missing telemetry timelines',
      'No immutable decision audit trail or MTTD scorecard',
    ],
  },
}

/* ============================================================================
   LAYER INTERACTIVE TEXT CARD
   - Implements the Before / After slider & feature style on the TEXT side
   - Spacious, non-compact alignment & breathing room (Reference Image)
   - Preserves 100% of the website's text info (Kicker, Title, Purpose, Detail, IO, Bullets)
   - Tilted stamps: BEFORE / AFTER
   - Yellow callout badges on left: AI kicker, Italic serif, Side-tab border, AI beige
   - Interactive prompt switcher pills below: • /polish (After) | • /distill (Split) | • /clarify (Before)
   ============================================================================ */
export function LayerInteractiveTextCard({ layer }: LayerInteractiveTextCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [sliderPos, setSliderPos] = useState(52) // Default 52% split
  const [isDragging, setIsDragging] = useState(false)
  const [activePreset, setActivePreset] = useState<'polish' | 'distill' | 'clarify'>('distill')

  const legacy = LEGACY_BEFORE_INFO[layer.id] || LEGACY_BEFORE_INFO[1]

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
    const clamped = Math.max(6, Math.min(94, rawPos))
    setSliderPos(clamped)
    if (clamped <= 18) setActivePreset('polish')
    else if (clamped >= 82) setActivePreset('clarify')
    else setActivePreset('distill')
  }

  const selectPreset = (preset: 'polish' | 'distill' | 'clarify') => {
    setActivePreset(preset)
    if (preset === 'polish') setSliderPos(8) // Full After
    if (preset === 'distill') setSliderPos(52) // Balanced Split
    if (preset === 'clarify') setSliderPos(92) // Full Before
  }

  return (
    <div className="layer-text-feature-wrap">
      {/* TILTED EDITORIAL BEFORE / AFTER BADGE STAMPS (REFERENCE IMAGE) */}
      <div className="comp-stamp comp-stamp--before" aria-hidden="true">
        BEFORE
      </div>
      <div className="comp-stamp comp-stamp--after" aria-hidden="true">
        AFTER
      </div>

      {/* CALLOUT BADGES DOCKED CLEANLY ON THE LEFT MARGIN (REFERENCE IMAGE) */}
      <aside className="comp-left-gutter-callouts" aria-hidden="true">
        <div className="gutter-callout-item callout-item--kicker">
          <span className="callout-pill-tag">AI kicker</span>
          <span className="gutter-callout-line" />
        </div>
        <div className="gutter-callout-item callout-item--serif">
          <span className="callout-pill-tag">Italic serif</span>
          <span className="gutter-callout-line" />
        </div>
        <div className="gutter-callout-item callout-item--border">
          <span className="callout-pill-tag">Side-tab border</span>
          <span className="gutter-callout-line" />
        </div>
        <div className="gutter-callout-item callout-item--beige">
          <span className="callout-pill-tag">AI beige</span>
          <span className="gutter-callout-line" />
        </div>
      </aside>

      {/* MAIN INTERACTIVE CARD */}
      <div
        ref={containerRef}
        className={`layer-text-feature-card ${isDragging ? 'is-dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* ===================================================================
            LAYER A: "AFTER" STATE (CLEAN, SPACIOUS AIA-02 TEXT)
            Full width in the background
           =================================================================== */}
        <div className="text-card-layer text-card-layer--after">
          <div className="text-card-top-bar">
            <span className="text-card-meta-tag">
              0{layer.id} // AIA-02 ACTIVE RELIABILITY
            </span>
            <span className="comp-status-pill comp-status-pill--green">
              ■ On track
            </span>
          </div>

          <div className="text-card-body">
            <div className="text-card-kicker-row">
              <span className="kicker-dot-orange" />
              <span className="kicker-label">0{layer.id} · {layer.kicker}</span>
            </div>

            <h3 className="text-card-headline">{layer.headline}</h3>

            <p className="text-card-purpose">{layer.purpose}</p>
            <p className="text-card-detail">{layer.detail}</p>

            {/* Clean Input / Output row without heavy clunky boxes */}
            <div className="text-card-io-flow">
              <div className="io-flow-box">
                <span className="io-flow-label">INPUT</span>
                <span className="io-flow-val">{layer.input}</span>
              </div>
              <span className="io-flow-arrow" aria-hidden="true">→</span>
              <div className="io-flow-box">
                <span className="io-flow-label">OUTPUT</span>
                <span className="io-flow-val">{layer.output}</span>
              </div>
            </div>

            {/* Clean Capabilities Checkmark Grid */}
            <ul className="text-card-capabilities">
              {layer.capabilities.slice(0, 4).map(c => (
                <li key={c}>
                  <span className="check-mark">✓</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ===================================================================
            LAYER B: "BEFORE" STATE (IMAGE 2 REFERENCE: AI BEIGE + SIDE-TAB BORDER)
            Clipped horizontally by the draggable vertical slider
           =================================================================== */}
        <div
          className="text-card-layer text-card-layer--before"
          style={{ clipPath: `inset(0 calc(100% - ${sliderPos}%) 0 0)` }}
        >
          {/* PURPLE SIDE-TAB BORDER (IMAGE 2 REFERENCE) */}
          <div className="comp-side-tab-bar" aria-hidden="true" />

          <div className="text-card-top-bar text-card-top-bar--before">
            <span className="text-card-meta-tag text-card-meta-tag--amber">
              LAUNCH / 0{layer.id} // LEGACY INCIDENT STATE
            </span>
            <span className="comp-status-pill comp-status-pill--amber">
              ▲ 4.5h Incident Lag
            </span>
          </div>

          <div className="text-card-body">
            <div className="text-card-kicker-row text-card-kicker-row--before">
              <span className="kicker-label">0{layer.id} · {layer.kicker}</span>
            </div>

            <h3 className="text-card-headline text-card-headline--before">
              <em className="comp-italic-serif">{legacy.serifLead}</em>{' '}
              <span className="comp-title-rest">{legacy.titleRest}</span>
            </h3>

            <p className="text-card-purpose text-card-purpose--before">{legacy.desc}</p>

            <div className="text-card-io-flow text-card-io-flow--before">
              <div className="io-flow-box">
                <span className="io-flow-label io-flow-label--amber">LEGACY FLOW</span>
                <span className="io-flow-val">{legacy.inputOutput}</span>
              </div>
            </div>

            <ul className="text-card-capabilities text-card-capabilities--before">
              {legacy.painPoints.map((p, idx) => (
                <li key={idx}>
                  <span className="cross-mark">✕</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ===================================================================
            DRAGGABLE SLIDER DIVIDER LINE & HANDLE PILL [ ||| ]
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
            aria-label="Drag to compare Before and After on text"
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

      {/* INTERACTIVE SWITCHER PILLS BELOW CARD (EXACT REPLICA OF REFERENCE IMAGE) */}
      <div className="comp-switcher-bar">
        <div className="comp-switcher-capsule">
          <button
            type="button"
            className={`switcher-pill-btn ${activePreset === 'polish' ? 'is-active' : ''}`}
            onClick={() => selectPreset('polish')}
            title="View full clean AIA-02 text"
          >
            <span className="switcher-dot dot-cyan" />
            <span>/polish</span>
          </button>
          <button
            type="button"
            className={`switcher-pill-btn ${activePreset === 'distill' ? 'is-active' : ''}`}
            onClick={() => selectPreset('distill')}
            title="Split view comparison"
          >
            <span className="switcher-dot dot-amber" />
            <span>/distill</span>
          </button>
          <button
            type="button"
            className={`switcher-pill-btn ${activePreset === 'clarify' ? 'is-active' : ''}`}
            onClick={() => selectPreset('clarify')}
            title="View legacy incident problem state"
          >
            <span className="switcher-dot dot-muted" />
            <span>/clarify</span>
          </button>
        </div>
        <span className="comp-drag-cue">Drag center handle ↔</span>
      </div>
    </div>
  )
}
