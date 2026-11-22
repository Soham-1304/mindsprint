
export type StackLayerInfo = {
  id: number
  code: string
  name: string
  mainLayer?: boolean
  chipsText: string
  side: 'left' | 'right'
}

export const STACK_LAYERS: StackLayerInfo[] = [
  {
    id: 1,
    code: '01',
    name: 'Connected Sources',
    chipsText: 'GitHub · Metrics · Containers · Logs · Pipelines',
    side: 'right',
  },
  {
    id: 2,
    code: '02',
    name: 'Release & Incident Context',
    chipsText: 'Commits · Diffs · Traces · Health · History',
    side: 'left',
  },
  {
    id: 3,
    code: '03',
    name: 'AI Diagnosis Engine',
    mainLayer: true,
    chipsText: 'Watcher · Brain · Root cause · Evidence',
    side: 'right',
  },
  {
    id: 4,
    code: '04',
    name: 'Remediation & Security',
    chipsText: 'Fix PR · Tests · Docker · Approval · Sietch',
    side: 'left',
  },
  {
    id: 5,
    code: '05',
    name: 'Verification & Outcomes',
    chipsText: 'Recovery · Reopen · Postmortems · Audit · Scorecard',
    side: 'right',
  },
]

function BrandMiniIcons({ layerId }: { layerId: number }) {
  if (layerId === 5) {
    return (
      <div className="iso-badges" aria-hidden="true">
        <svg viewBox="0 0 20 20" className="iso-badge-svg">
          <rect x="2" y="13" width="3.5" height="5" rx="1" fill="#F59E0B" />
          <rect x="7.5" y="9" width="3.5" height="9" rx="1" fill="#F97316" />
          <rect x="13" y="4" width="3.5" height="14" rx="1" fill="#EA580C" />
        </svg>
        <svg viewBox="0 0 20 20" className="iso-badge-svg">
          <rect x="3" y="2" width="14" height="16" rx="2.5" fill="#16A34A" />
          <path d="M6.5 7.5h7M6.5 10.5h7M6.5 13.5h7M10 6v9" stroke="#fff" strokeWidth="1.2" />
        </svg>
        <svg viewBox="0 0 20 20" className="iso-badge-svg">
          <rect x="2.5" y="2.5" width="15" height="15" rx="3" fill="#fff" stroke="#18181B" strokeWidth="1.6" />
          <path d="M6.8 14V6.3l6.4 7.7V6.3" fill="none" stroke="#18181B" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  if (layerId === 4) {
    return (
      <div className="iso-badges" aria-hidden="true">
        <svg viewBox="0 0 20 20" className="iso-badge-svg">
          <g stroke="#EA580C" strokeWidth="2" strokeLinecap="round">
            <path d="M10 2.5v15M2.5 10h15M4.7 4.7l10.6 10.6M15.3 4.7L4.7 15.3" />
          </g>
        </svg>
        <svg viewBox="0 0 20 20" className="iso-badge-svg">
          <path
            fill="#18181B"
            d="M10 2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.48c-2.23.48-2.7-.95-2.7-.95-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.89.87 2.35.67.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.58.82-2.14-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.14 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 10 2Z"
          />
        </svg>
        <svg viewBox="0 0 20 20" className="iso-badge-svg">
          <polygon points="10,2.5 17.5,6.2 10,10 2.5,6.2" fill="#FBBF24" />
          <polygon points="2.5,6.2 10,10 10,17.2 2.5,13.4" fill="#EF4444" />
          <polygon points="17.5,6.2 10,10 10,17.2 17.5,13.4" fill="#3B82F6" />
        </svg>
      </div>
    )
  }
  if (layerId === 3) {
    return (
      <div className="iso-model-pills" aria-hidden="true">
        <span className="iso-model-pill">
          <svg viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="5.5" fill="none" stroke="#18181B" strokeWidth="1.4" strokeDasharray="4 2" />
            <polygon points="10,6.2 13.3,8.1 13.3,11.9 10,13.8 6.7,11.9 6.7,8.1" fill="none" stroke="#18181B" strokeWidth="1.2" />
          </svg>
        </span>
        <span className="iso-model-pill">
          <svg viewBox="0 0 20 20">
            <path d="M10 3.2C10.5 7.4 12.6 9.5 16.8 10C12.6 10.5 10.5 12.6 10 16.8C9.5 12.6 7.4 10.5 3.2 10C7.4 9.5 9.5 7.4 10 3.2Z" fill="#3B82F6" />
          </svg>
        </span>
        <span className="iso-model-pill">
          <svg viewBox="0 0 20 20">
            <g stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10 3.5v13M3.5 10h13M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2" />
            </g>
          </svg>
        </span>
      </div>
    )
  }
  if (layerId === 2) {
    return (
      <div className="iso-badges" aria-hidden="true">
        <svg viewBox="0 0 20 20" className="iso-badge-svg">
          <rect x="2.5" y="2.5" width="15" height="15" rx="3" fill="#fff" stroke="#18181B" strokeWidth="1.6" />
          <path d="M6.8 14V6.3l6.4 7.7V6.3" fill="none" stroke="#18181B" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg viewBox="0 0 20 20" className="iso-badge-svg">
          <polygon points="7.5,3 12.5,3 17.5,12 12.5,12" fill="#FACC15" />
          <polygon points="7.5,3 10,7.5 5,16.2 2.5,12" fill="#22C55E" />
          <polygon points="5,16.2 15,16.2 17.5,12 7.5,12" fill="#3B82F6" />
        </svg>
        <svg viewBox="0 0 20 20" className="iso-badge-svg">
          <rect x="3" y="2" width="14" height="16" rx="2.5" fill="#16A34A" />
          <path d="M6.5 7.5h7M6.5 10.5h7M6.5 13.5h7M10 6v9" stroke="#fff" strokeWidth="1.2" />
        </svg>
      </div>
    )
  }
  return (
    <div className="iso-badges" aria-hidden="true">
      <svg viewBox="0 0 20 20" className="iso-badge-svg">
        <path
          fill="#18181B"
          d="M10 2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.48c-2.23.48-2.7-.95-2.7-.95-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.89.87 2.35.67.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.58.82-2.14-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.14 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 10 2Z"
        />
      </svg>
      <svg viewBox="0 0 20 20" className="iso-badge-svg">
        <rect x="4" y="8" width="5" height="2.4" rx="1.2" fill="#E11D48" />
        <circle cx="7.8" cy="5.5" r="1.3" fill="#E11D48" />
        <rect x="8" y="3.5" width="2.4" height="5" rx="1.2" fill="#06B6D4" />
        <circle cx="13" cy="6.8" r="1.3" fill="#06B6D4" />
        <rect x="11" y="9.5" width="5" height="2.4" rx="1.2" fill="#22C55E" />
        <circle cx="12.2" cy="14.5" r="1.3" fill="#22C55E" />
        <rect x="9.5" y="11.5" width="2.4" height="5" rx="1.2" fill="#F59E0B" />
        <circle cx="6.8" cy="13" r="1.3" fill="#F59E0B" />
      </svg>
      <svg viewBox="0 0 20 20" className="iso-badge-svg">
        <polygon points="10,2.5 17.5,6.2 10,10 2.5,6.2" fill="#FBBF24" />
        <polygon points="2.5,6.2 10,10 10,17.2 2.5,13.4" fill="#EF4444" />
        <polygon points="17.5,6.2 10,10 10,17.2 17.5,13.4" fill="#3B82F6" />
      </svg>
    </div>
  )
}

function LeftMiniGlyph({ layerId }: { layerId: number }) {
  if (layerId === 5) {
    return (
      <svg className="callout-glyph" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 13V9.5M7.5 13V6.5M12 13V3.5" stroke="#F26627" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (layerId === 4) {
    return (
      <svg className="callout-glyph" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2.2" y="2.2" width="4.5" height="4.5" rx="1" stroke="#F26627" strokeWidth="1.4" fill="none" />
        <rect x="9.3" y="9.3" width="4.5" height="4.5" rx="1" stroke="#F26627" strokeWidth="1.4" fill="none" />
        <path d="M6.7 4.5h2.2a2 2 0 0 1 2 2v2.8" stroke="#F26627" strokeWidth="1.4" fill="none" />
      </svg>
    )
  }
  if (layerId === 2) {
    return (
      <svg className="callout-glyph" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2.5h5.5L12.5 5.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="#F26627" strokeWidth="1.3" fill="none" />
        <path d="M5.5 8.5h5M5.5 11h3.5" stroke="#F26627" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }
  if (layerId === 1) {
    return (
      <svg className="callout-glyph" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5 3v3M9 3v3M4 6h6v2a3 3 0 0 1-3 3v3M12 7.5a2 2 0 1 1 0 4" stroke="#F26627" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </svg>
    )
  }
  return null
}

function IsometricOrangePetal({
  cx,
  cy,
  gradId,
  className,
}: {
  cx: number
  cy: number
  gradId: string
  className: string
}) {
  const d = [
    `M ${cx - 6} ${cy - 14.5}`,
    `Q ${cx} ${cy - 17.8} ${cx + 6} ${cy - 14.5}`,
    `L ${cx + 22.5} ${cy - 4.8}`,
    `Q ${cx + 28} ${cy - 1.5} ${cx + 22.5} ${cy + 2}`,
    `L ${cx + 6} ${cy + 11.8}`,
    `Q ${cx} ${cy + 15.2} ${cx - 6} ${cy + 11.8}`,
    `L ${cx - 22.5} ${cy + 2}`,
    `Q ${cx - 28} ${cy - 1.5} ${cx - 22.5} ${cy - 4.8}`,
    'Z',
  ].join(' ')

  const extrudeWall = [
    `M ${cx - 25} ${cy - 1.2}`,
    `L ${cx - 25} ${cy + 5.2}`,
    `Q ${cx - 24.5} ${cy + 7.2} ${cx - 21} ${cy + 9.2}`,
    `L ${cx - 6} ${cy + 18}`,
    `Q ${cx} ${cy + 21.4} ${cx + 6} ${cy + 18}`,
    `L ${cx + 21} ${cy + 9.2}`,
    `Q ${cx + 24.5} ${cy + 7.2} ${cx + 25} ${cy + 5.2}`,
    `L ${cx + 25} ${cy - 1.2}`,
    `L ${cx + 6} ${cy + 11.5}`,
    `Q ${cx} ${cy + 14.5} ${cx - 6} ${cy + 11.5}`,
    'Z',
  ].join(' ')

  return (
    <g className={`iso-chip-petal ${className}`}>
      <path d={d} fill="rgba(68, 32, 12, 0.24)" transform="translate(1.5, 8.5)" />
      <path d={extrudeWall} fill="#B9410C" />
      <path d={d} fill={`url(#${gradId})`} stroke="#FFA372" strokeWidth="0.75" />
    </g>
  )
}

type ChipStackProps = {
  active: number | null
  setActive?: (index: number | null) => void
  interactive?: boolean
  variant?: 'hero' | 'stage'
  onSelectNavigate?: (index: number) => void
}

export function ChipStack({
  active,
  setActive,
  interactive = true,
  variant = 'stage',
  onSelectNavigate,
}: ChipStackProps) {
  const handleEnter = (idx: number) => {
    if (interactive && setActive) setActive(idx)
  }
  const handleLeave = () => {
    if (interactive && setActive) setActive(null)
  }
  const handleClick = (idx: number) => {
    if (onSelectNavigate) {
      onSelectNavigate(idx)
      return
    }
    if (interactive && setActive) {
      setActive(active === idx ? null : idx)
    }
  }

  return (
    <div className={`chip-viewport chip-viewport--${variant}`}>
      <div
        className={`chip-system chip-system--${variant} ${active !== null ? 'has-active-chip' : ''}`}
        onMouseLeave={handleLeave}
      >
        <span className="chip-ambient-glow" aria-hidden="true" />
        <span className="chip-orb chip-orb--1" aria-hidden="true" />
        <span className="chip-orb chip-orb--2" aria-hidden="true" />
        <span className="chip-orb chip-orb--3" aria-hidden="true" />
        <span className="chip-ring-node chip-ring-node--1" aria-hidden="true" />
        <span className="chip-ring-node chip-ring-node--2" aria-hidden="true" />
        <span className="chip-plus-node chip-plus-node--1" aria-hidden="true">+</span>
        <span className="chip-plus-node chip-plus-node--2" aria-hidden="true">+</span>

        <div className="iso-stack">
          {[0, 1, 2, 3, 4].map(idx => {
            const layerNumber = idx + 1
            const isSelected = active === idx
            const isMuted = active !== null && active !== idx
            const isMain = layerNumber === 3
            const isTop = layerNumber === 5
            const orangeGradId = `orangePetal-${variant}-${layerNumber}`

            return (
              <button
                key={layerNumber}
                type="button"
                className={[
                  'iso-slab',
                  `iso-slab--${layerNumber}`,
                  isMain ? 'iso-slab--main' : '',
                  isTop ? 'iso-slab--top' : '',
                  isSelected ? 'is-selected' : '',
                  isMuted ? 'is-receded' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => handleEnter(idx)}
                onFocus={() => handleEnter(idx)}
                onBlur={handleLeave}
                onClick={() => handleClick(idx)}
                aria-label={`Layer 0${layerNumber}: ${STACK_LAYERS[idx].name}`}
                aria-pressed={isSelected}
              >
                <svg viewBox="0 0 360 244" className="iso-slab__svg" aria-hidden="true">
                  <defs>
                    <linearGradient id={`topSurf-${variant}-${layerNumber}`} x1="15%" y1="5%" x2="85%" y2="95%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="52%" stopColor="#F6F4EE" />
                      <stop offset="100%" stopColor="#ECE8DE" />
                    </linearGradient>
                    <linearGradient id={`sideWall-${variant}-${layerNumber}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#E1DDD2" />
                      <stop offset="47%" stopColor="#EFECE3" />
                      <stop offset="53%" stopColor="#D6D1C4" />
                      <stop offset="100%" stopColor="#C4BEB0" />
                    </linearGradient>
                    <linearGradient id={orangeGradId} x1="10%" y1="0%" x2="90%" y2="100%">
                      <stop offset="0%" stopColor="#FF8B4D" />
                      <stop offset="55%" stopColor="#F46825" />
                      <stop offset="100%" stopColor="#E25312" />
                    </linearGradient>
                    <filter id={`slabShadow-${variant}-${layerNumber}`} x="-25%" y="-20%" width="150%" height="160%">
                      <feGaussianBlur stdDeviation="8" />
                    </filter>
                    <filter id={`orangeBloom-${variant}-${layerNumber}`} x="-30%" y="-30%" width="160%" height="175%">
                      <feGaussianBlur stdDeviation="12" />
                    </filter>
                  </defs>

                  <path
                    d="M 164 30 Q 180 21 196 30 L 322 103 Q 336 111 322 119 L 196 192 Q 180 201 164 192 L 38 119 Q 24 111 38 103 Z"
                    fill="rgba(38, 35, 28, 0.16)"
                    transform="translate(0, 20)"
                    filter={`url(#slabShadow-${variant}-${layerNumber})`}
                  />

                  {(isMain || isSelected) && (
                    <g>
                      <path
                        d="M 24 110 L 164 191 Q 180 200 196 191 L 336 110 L 336 134 L 196 215 Q 180 224 164 215 L 24 134 Z"
                        fill="#FF6418"
                        opacity={isSelected ? '0.95' : '0.88'}
                        filter={`url(#orangeBloom-${variant}-${layerNumber})`}
                      />
                      <path
                        d="M 27 118 L 164 197 Q 180 206 196 197 L 333 118 L 333 123.5 L 196 202.5 Q 180 211.5 164 202.5 L 27 123.5 Z"
                        fill="#FF6E27"
                        opacity="0.98"
                      />
                    </g>
                  )}

                  <path
                    d={
                      isMain
                        ? 'M 23 103 L 23 123 Q 23 130 34 136.5 L 164 211 Q 180 220 196 211 L 326 136.5 Q 337 130 337 123 L 337 103 L 196 184 Q 180 193 164 184 L 34 109 Z'
                        : 'M 25 104 L 25 119 Q 25 125.5 35 131.5 L 164 205.5 Q 180 214.5 196 205.5 L 325 131.5 Q 335 125.5 335 119 L 335 104 L 196 183 Q 180 192 164 183 L 35 110 Z'
                    }
                    fill={`url(#sideWall-${variant}-${layerNumber})`}
                    stroke="#C9C4B6"
                    strokeWidth="0.9"
                  />

                  <path
                    d="M 164 22 Q 180 13 196 22 L 326 96 Q 341 105 326 114 L 196 188 Q 180 197 164 188 L 34 114 Q 19 105 34 96 Z"
                    fill={`url(#topSurf-${variant}-${layerNumber})`}
                    stroke={isSelected ? '#F26627' : '#DFDBD0'}
                    strokeWidth={isSelected ? '1.8' : '1.15'}
                  />

                  <path
                    d="M 167 34 Q 180 26.8 193 34 L 306 99 Q 317 105 306 111 L 193 176 Q 180 183.2 167 176 L 54 111 Q 43 105 54 99 Z"
                    fill="none"
                    stroke="#DCD7CC"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M 168 35.5 Q 180 28.5 192 35.5 L 304 99.5 Q 314 105 304 110.5 L 192 174.5 Q 180 181.5 168 174.5 L 56 110.5 Q 46 105 56 99.5 Z"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.15"
                  />

                  <g className="iso-internal-traces">
                    <ellipse cx="180" cy="103" rx="54" ry="31" fill="none" stroke="#F26627" strokeWidth="1.25" strokeDasharray="4 4" />
                    <path d="M 116 103 L 244 103 M 180 66 L 180 140" stroke="#F26627" strokeWidth="1.1" opacity="0.65" />
                    <circle cx="180" cy="103" r="10" fill="#F26627" opacity="0.2" />
                    <circle cx="180" cy="103" r="4" fill="#F26627" />
                  </g>

                  {isMain && (
                    <g>
                      <ellipse cx="180" cy="96" rx="44" ry="25" fill="none" stroke="#F26627" strokeWidth="1.25" opacity="0.72" />
                      <ellipse cx="126" cy="127" rx="4.5" ry="2.6" fill="#E8E4D9" stroke="#C8C2B4" strokeWidth="0.8" />
                      <ellipse cx="234" cy="127" rx="4.5" ry="2.6" fill="#E8E4D9" stroke="#C8C2B4" strokeWidth="0.8" />
                      <ellipse cx="52" cy="133" rx="3.2" ry="1.9" fill="#FF6B26" />
                      <circle cx="72" cy="144.5" r="1.4" fill="#6D6A61" />
                      <circle cx="81" cy="149.5" r="1.4" fill="#6D6A61" />
                      <path d="M 103 160 L 119 169.2 L 119 174.2 L 103 165 Z" fill="#57544D" />
                      <circle cx="242" cy="172" r="1.5" fill="#6D6A61" />
                      <circle cx="252" cy="166.2" r="1.5" fill="#6D6A61" />
                      <path d="M 274 152.5 L 290 143.3 L 290 147.3 L 274 156.5 Z" fill="#6D6A61" />
                    </g>
                  )}

                  {layerNumber === 1 && (
                    <g>
                      <circle cx="72" cy="139.5" r="1.4" fill="#6D6A61" />
                      <circle cx="83" cy="145.8" r="1.4" fill="#6D6A61" />
                      <circle cx="255" cy="160.5" r="1.3" fill="#7D7970" />
                      <circle cx="265" cy="154.7" r="1.3" fill="#7D7970" />
                      <circle cx="275" cy="148.9" r="1.3" fill="#7D7970" />
                    </g>
                  )}

                  {!isTop && (
                    <g transform="translate(180, 155) scale(1.22, 0.72)">
                      <text
                        x="0"
                        y="0"
                        textAnchor="middle"
                        className={`iso-slab__num ${isMain || isSelected ? 'iso-slab__num--orange' : ''}`}
                      >
                        {`0 ${layerNumber}`}
                      </text>
                    </g>
                  )}

                  {(isTop || isSelected) && (
                    <g className={`iso-four-chips ${isSelected ? 'is-expanded-chips' : ''}`}>
                      <IsometricOrangePetal cx={180} cy={77} gradId={orangeGradId} className="petal-n" />
                      <IsometricOrangePetal cx={143} cy={99} gradId={orangeGradId} className="petal-w" />
                      <IsometricOrangePetal cx={217} cy={99} gradId={orangeGradId} className="petal-e" />
                      <IsometricOrangePetal cx={180} cy={121} gradId={orangeGradId} className="petal-s" />
                    </g>
                  )}
                </svg>
              </button>
            )
          })}
        </div>

        <div className="iso-callouts" aria-hidden="true">
          {STACK_LAYERS.map((item, idx) => {
            const isSelected = active === idx
            const isMuted = active !== null && active !== idx
            return (
              <div
                key={item.code}
                className={[
                  'iso-callout',
                  `iso-callout--${item.id}`,
                  `iso-callout--${item.side}`,
                  item.mainLayer ? 'iso-callout--main' : '',
                  isSelected ? 'is-selected' : '',
                  isMuted ? 'is-muted' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="iso-callout__connector">
                  <i className="iso-callout__pin" />
                  <i className="iso-callout__stem" />
                  <i className="iso-callout__orange-node" />
                </span>

                <div className="iso-callout__head">
                  <span className="iso-callout__num">{item.code}</span>
                  <strong className="iso-callout__title">{item.name}</strong>
                </div>

                {item.mainLayer && <div className="iso-callout__tag">MAIN LAYER</div>}

                <div className="iso-callout__body">
                  {!item.mainLayer && <LeftMiniGlyph layerId={item.id} />}
                  <p className="iso-callout__desc">{item.chipsText}</p>
                  {!item.mainLayer && <BrandMiniIcons layerId={item.id} />}
                </div>

                {item.mainLayer && (
                  <div className="iso-callout__footer">
                    <BrandMiniIcons layerId={3} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
