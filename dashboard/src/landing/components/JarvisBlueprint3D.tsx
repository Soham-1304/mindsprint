import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'

export type BadgeKind =
  | 'github'
  | 'prometheus'
  | 'docker'
  | 'logs'
  | 'cicd'
  | 'notion'
  | 'drive'
  | 'sheets'
  | 'openai'
  | 'gemini'
  | 'claude'
  | 'sietch'
  | 'slack'

export type DeckViewMode = 'auto' | 'physical' | 'xray' | 'blueprint'

type SideAnnotation = {
  id: string
  side: 'left' | 'right'
  code: string
  title: string
  description: string
  badges: BadgeKind[]
  moduleAnchor: [number, number, number]
  revealAt: number
}

type ExplodedLayerBlueprint = {
  index: number
  code: string
  kicker: string
  name: string
  explanation: string
  flowSummary: [string, string, string]
  isMain: boolean
  isTop: boolean
  annotations: SideAnnotation[]
}

const OVERVIEW_ANNOTATIONS: {
  left: { id: string; code: string; title: string; description: string; badges: BadgeKind[]; stackIdx: number }[]
  right: { id: string; code: string; title: string; description: string; badges: BadgeKind[]; stackIdx: number }[]
} = {
  left: [
    {
      id: 'ov-04',
      code: '04',
      title: 'Remediation & Security',
      description: 'Generates isolated Docker-tested fix pull requests behind human approval gates alongside Sietch npm sandboxing.',
      badges: ['claude', 'github', 'docker', 'sietch'],
      stackIdx: 3,
    },
    {
      id: 'ov-02',
      code: '02',
      title: 'Release & Incident Context',
      description: 'Correlates Git commits, deployment diffs, runtime traces & team knowledge bases to isolate suspect changes.',
      badges: ['github', 'notion', 'drive', 'sheets'],
      stackIdx: 1,
    },
  ],
  right: [
    {
      id: 'ov-05',
      code: '05',
      title: 'Verification & Outcomes',
      description: 'Validates live SLO recovery, guards against regressions, and compiles postmortems, audit trails & scorecards.',
      badges: ['prometheus', 'sheets', 'notion'],
      stackIdx: 4,
    },
    {
      id: 'ov-03',
      code: '03 · MAIN',
      title: 'AI Diagnosis Engine',
      description: 'Continuous Watcher sentinels wake a multi-model AI reasoning core for evidence-backed root-cause analysis.',
      badges: ['openai', 'gemini', 'claude'],
      stackIdx: 2,
    },
    {
      id: 'ov-01',
      code: '01',
      title: 'Connected Sources',
      description: 'Streams repositories, Prometheus metrics, Docker runtime events, logs & CI/CD signals into one view.',
      badges: ['github', 'prometheus', 'docker', 'cicd'],
      stackIdx: 0,
    },
  ],
}

export function TechBadgeIcon({ kind }: { kind: BadgeKind }) {
  switch (kind) {
    case 'github':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 1.2a6.8 6.8 0 0 0-2.15 13.25c.34.06.46-.15.46-.33v-1.2c-1.9.41-2.3-.81-2.3-.81-.31-.78-.76-.99-.76-.99-.62-.42.05-.41.05-.41.68.05 1.05.7 1.05.7.61 1.04 1.6.74 2 .57.06-.44.24-.74.43-.91-1.51-.17-3.1-.76-3.1-3.36 0-.74.26-1.35.7-1.82-.07-.17-.3-.86.07-1.8 0 0 .57-.18 1.87.7a6.4 6.4 0 0 1 3.4 0c1.3-.88 1.87-.7 1.87-.7.37.94.14 1.63.07 1.8.44.47.7 1.08.7 1.82 0 2.61-1.59 3.19-3.11 3.36.25.21.46.62.46 1.26v1.86c0 .18.12.39.47.33A6.8 6.8 0 0 0 8 1.2Z"
            />
          </svg>
          <span>GitHub</span>
        </span>
      )
    case 'prometheus':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6.2" fill="none" stroke="#E6522C" strokeWidth="1.3" />
            <path d="M5.2 10.8h5.6M8 4.2c1.4 1.5 1.6 3.1.5 4.8-.9-1-.8-2.2-.5-4.8Z" stroke="#E6522C" strokeWidth="1.2" fill="none" />
          </svg>
          <span>Prometheus</span>
        </span>
      )
    case 'docker':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2.5" y="6.5" width="2.2" height="2" fill="#2496ED" />
            <rect x="5.2" y="6.5" width="2.2" height="2" fill="#2496ED" />
            <rect x="7.9" y="6.5" width="2.2" height="2" fill="#2496ED" />
            <rect x="5.2" y="4" width="2.2" height="2" fill="#2496ED" />
            <path d="M2 9.2h10.8c.9 0 1.5-.5 1.8-1.2M2 9.2c.2 2.3 2 3.6 4.8 3.6 3 0 5.1-1.4 6-3.6" fill="none" stroke="#2496ED" strokeWidth="1.15" strokeLinecap="round" />
          </svg>
          <span>Docker</span>
        </span>
      )
    case 'logs':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 4h10M3 8h7M3 12h8.5" stroke="#F26627" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>App Logs</span>
        </span>
      )
    case 'cicd':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="4" cy="8" r="2" fill="none" stroke="#F26627" strokeWidth="1.3" />
            <circle cx="12" cy="8" r="2" fill="none" stroke="#536B82" strokeWidth="1.3" />
            <path d="M6 8h4" stroke="#F26627" strokeWidth="1.3" />
          </svg>
          <span>CI/CD</span>
        </span>
      )
    case 'notion':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5.5 11.2V4.8l5 6.4V4.8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Notion</span>
        </span>
      )
    case 'drive':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <polygon points="6,2.4 10,2.4 14,9.6 10,9.6" fill="#EAB308" />
            <polygon points="6,2.4 8,6 4,13 2,9.6" fill="#22C55E" />
            <polygon points="4,13 12,13 14,9.6 6,9.6" fill="#3B82F6" />
          </svg>
          <span>Drive</span>
        </span>
      )
    case 'sheets':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2.8" y="1.8" width="10.4" height="12.4" rx="2" fill="none" stroke="#16A34A" strokeWidth="1.3" />
            <path d="M5.2 6h5.6M5.2 8.8h5.6M8 4.8v6.4" stroke="#16A34A" strokeWidth="1.1" />
          </svg>
          <span>Sheets</span>
        </span>
      )
    case 'openai':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 1.8" />
          </svg>
          <span>GPT</span>
        </span>
      )
    case 'gemini':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2.2C8.4 5.8 10.2 7.6 13.8 8C10.2 8.4 8.4 10.2 8 13.8C7.6 10.2 5.8 8.4 2.2 8C5.8 7.6 7.6 5.8 8 2.2Z" fill="#3B82F6" />
          </svg>
          <span>Gemini</span>
        </span>
      )
    case 'claude':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2.5v11M2.5 8h11M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" stroke="#EA580C" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span>Claude</span>
        </span>
      )
    case 'sietch':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2.5l5 2.5v4.5c0 3.2-2.2 5.5-5 6.5-2.8-1-5-3.3-5-6.5V5l5-2.5Z" fill="none" stroke="#F26627" strokeWidth="1.3" />
            <path d="M6 8l1.6 1.6L10.5 7" fill="none" stroke="#F26627" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span>Sietch</span>
        </span>
      )
    case 'slack':
      return (
        <span className="jb-badge">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="5" cy="5" r="1.5" fill="#E01E5A" />
            <circle cx="11" cy="5" r="1.5" fill="#36C5F0" />
            <circle cx="5" cy="11" r="1.5" fill="#2EB67D" />
            <circle cx="11" cy="11" r="1.5" fill="#ECB22E" />
          </svg>
          <span>Slack</span>
        </span>
      )
    default:
      return null
  }
}

function createRoundedRectShape(w: number, h: number, r: number) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  const rad = Math.min(r, w * 0.45, h * 0.45)
  shape.moveTo(x + rad, y)
  shape.lineTo(x + w - rad, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + rad)
  shape.lineTo(x + w, y + h - rad)
  shape.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  shape.lineTo(x + rad, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - rad)
  shape.lineTo(x, y + rad)
  shape.quadraticCurveTo(x, y, x + rad, y)
  return shape
}

function createRoundedRectContour(w: number, h: number, r: number, pointsPerCorner = 8): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const halfW = w / 2
  const halfH = h / 2
  const rad = Math.min(r, halfW * 0.45, halfH * 0.45)

  const corners = [
    { cx: halfW - rad, cy: halfH - rad, a0: 0, a1: Math.PI * 0.5 },
    { cx: -halfW + rad, cy: halfH - rad, a0: Math.PI * 0.5, a1: Math.PI },
    { cx: -halfW + rad, cy: -halfH + rad, a0: Math.PI, a1: Math.PI * 1.5 },
    { cx: halfW - rad, cy: -halfH + rad, a0: Math.PI * 1.5, a1: Math.PI * 2 },
  ]

  for (const c of corners) {
    for (let s = 0; s <= pointsPerCorner; s++) {
      const a = c.a0 + (s / pointsPerCorner) * (c.a1 - c.a0)
      pts.push(new THREE.Vector3(c.cx + Math.cos(a) * rad, 0, c.cy + Math.sin(a) * rad))
    }
  }
  pts.push(pts[0].clone())
  return pts
}

function createPlateLabelCanvas(label: string, isOrange: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#EAE7E0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.font = '700 70px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = isOrange ? '#F46925' : '#8A867D'
  ctx.fillText(label, canvas.width / 2, canvas.height / 2)

  return canvas
}

function createUnderglowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 128)
    grad.addColorStop(0, 'rgba(244, 105, 37, 0.95)')
    grad.addColorStop(0.35, 'rgba(244, 105, 37, 0.65)')
    grad.addColorStop(0.7, 'rgba(244, 105, 37, 0.22)')
    grad.addColorStop(1, 'rgba(244, 105, 37, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function createTopFaceTexture(isMain: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 512, 512)

    // Tactile embossed squircle inner groove matching media_1795307624568_1476844b.jpg
    const pad = 36
    const r = 50
    const w = 512 - pad * 2
    const h = 512 - pad * 2

    ctx.strokeStyle = 'rgba(120, 115, 105, 0.26)'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pad, pad, w, h, r)
    } else {
      ctx.rect(pad, pad, w, h)
    }
    ctx.stroke()

    // Inner subtle highlight groove
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pad + 2, pad + 2, w - 4, h - 4, r - 2)
    } else {
      ctx.rect(pad + 2, pad + 2, w - 4, h - 4)
    }
    ctx.stroke()

    if (isMain) {
      // Circular central sensor ring for Layer 03 (The Brain)
      ctx.strokeStyle = '#F46925'
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.arc(256, 256, 110, 0, Math.PI * 2)
      ctx.stroke()

      // Sensor pinholes
      ctx.fillStyle = '#6E6B62'
      ctx.beginPath()
      ctx.arc(170, 256, 6, 0, Math.PI * 2)
      ctx.arc(342, 256, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function buildFiveExplodedLayers(): ExplodedLayerBlueprint[] {
  return [
    {
      index: 0,
      code: '01',
      kicker: 'TELEMETRY INGESTION & NORMALIZATION',
      name: 'Connected Sources',
      explanation:
        'Read-scoped connectors stream commits, metrics, container runtime state, logs and CI/CD events into canonical AIA-02 envelopes.',
      flowSummary: ['GitHub · Prometheus · Docker · Logs · CI/CD', 'Connector Mesh + Signal Normalizer', 'Unified Operational Stream → Layer 02'],
      isMain: false,
      isTop: false,
      annotations: [
        {
          id: 'l1-a',
          side: 'left',
          code: '01.A',
          title: 'GitHub & CI/CD Connectors',
          description: 'Ingests commit webhooks, pull request diffs and deployment pipeline rollouts using read-scoped tokens.',
          badges: ['github', 'cicd'],
          moduleAnchor: [-2.6, 0.4, -1.2],
          revealAt: 0.04,
        },
        {
          id: 'l1-b',
          side: 'left',
          code: '01.B',
          title: 'Prometheus Metrics TSDB',
          description: 'Streams p99 latency histograms, 5xx error bursts and host CPU/memory saturation time-series.',
          badges: ['prometheus'],
          moduleAnchor: [-2.6, 0.4, 1.2],
          revealAt: 0.16,
        },
        {
          id: 'l1-c',
          side: 'right',
          code: '01.C',
          title: 'Docker & Container Runtime',
          description: 'Captures container lifecycle events, restart loops, OOMKills and cgroup health transitions.',
          badges: ['docker'],
          moduleAnchor: [2.6, 0.4, -1.2],
          revealAt: 0.26,
        },
        {
          id: 'l1-d',
          side: 'right',
          code: '01.D',
          title: 'App Logs & Signal Normalizer',
          description: 'Aligns structured runtime logs and trace IDs into canonical envelopes for downstream correlation.',
          badges: ['logs', 'slack'],
          moduleAnchor: [2.6, 0.4, 1.2],
          revealAt: 0.36,
        },
      ],
    },
    {
      index: 1,
      code: '02',
      kicker: 'TEMPORAL CHANGE & INCIDENT CORRELATION',
      name: 'Release & Incident Context',
      explanation:
        'Correlates deployment timelines, AST Git diffs, blame history, runtime traces and team runbooks to pinpoint what changed.',
      flowSummary: ['Normalized Signals + Deploy Ledger', 'Temporal Helix & Blame Triangulator', 'Suspected Culprit c9f31a8 (94%) → Layer 03'],
      isMain: false,
      isTop: false,
      annotations: [
        {
          id: 'l2-a',
          side: 'left',
          code: '02.A',
          title: 'Git Diff & Line-Level Blame',
          description: 'Isolates suspected culprit commits through AST syntax diffs and commit author timeline graphs.',
          badges: ['github'],
          moduleAnchor: [-2.6, 0.4, -1.2],
          revealAt: 0.04,
        },
        {
          id: 'l2-b',
          side: 'left',
          code: '02.B',
          title: 'Historical Anomaly Baselines',
          description: 'Compares anomalous spikes against 30-day baseline patterns to reject intermittent traffic outliers.',
          badges: ['sheets'],
          moduleAnchor: [-2.6, 0.4, 1.2],
          revealAt: 0.16,
        },
        {
          id: 'l2-c',
          side: 'right',
          code: '02.C',
          title: 'Runtime Stack Trace Mapping',
          description: 'Connects runtime exception call-stacks and microservice spans directly to source line modifications.',
          badges: ['logs'],
          moduleAnchor: [2.6, 0.4, -1.2],
          revealAt: 0.26,
        },
        {
          id: 'l2-d',
          side: 'right',
          code: '02.D',
          title: 'Team Knowledge Bases',
          description: 'Cross-checks recent config updates, architecture docs and past postmortems for known issues.',
          badges: ['notion', 'drive'],
          moduleAnchor: [2.6, 0.4, 1.2],
          revealAt: 0.36,
        },
      ],
    },
    {
      index: 2,
      code: '03',
      kicker: 'AI REASONING & MULTI-MODEL RCA',
      name: 'AI Diagnosis Engine',
      explanation:
        'Always-on Watcher anomaly detection meets multi-model Brain reasoning across Gemini and Claude to deliver evidence-backed root cause.',
      flowSummary: ['Watcher Sentinels & Telemetry', 'Dual-Core AI Cross-Examination', 'Root-Cause Verdict + 98.4% Confidence'],
      isMain: true,
      isTop: false,
      annotations: [
        {
          id: 'l3-a',
          side: 'left',
          code: '03.A',
          title: 'The Watcher Sentinels',
          description: 'Evaluates 40+ composite health rules every 5 seconds to open incidents and trigger diagnostic workflows.',
          badges: ['prometheus', 'docker'],
          moduleAnchor: [-2.0, 0.6, -2.0],
          revealAt: 0.04,
        },
        {
          id: 'l3-b',
          side: 'left',
          code: '03.B',
          title: 'Code vs Infra Fault Splitter',
          description: 'Cleanly decouples application software regressions from kernel, network and cloud-provider faults.',
          badges: ['logs'],
          moduleAnchor: [-2.0, 0.6, 2.0],
          revealAt: 0.16,
        },
        {
          id: 'l3-c',
          side: 'right',
          code: '03.C',
          title: 'The Brain Reasoning Core',
          description: 'Cross-examines stack traces, commit diffs and telemetry spikes to synthesize verifiable root-cause proof.',
          badges: ['openai', 'gemini', 'claude'],
          moduleAnchor: [2.0, 0.6, -2.0],
          revealAt: 0.26,
        },
        {
          id: 'l3-d',
          side: 'right',
          code: '03.D',
          title: 'Evidence-Backed Confidence Score',
          description: 'Assigns an explicit confidence percentage with attached commit diffs, traces and log excerpts.',
          badges: ['slack'],
          moduleAnchor: [2.0, 0.6, 2.0],
          revealAt: 0.36,
        },
      ],
    },
    {
      index: 3,
      code: '04',
      kicker: 'AUTOMATED REMEDIATION & SECURITY',
      name: 'Remediation & Security',
      explanation:
        'Generates minimal, reviewable fix branches, creates focused regression tests in isolated Docker runners, and enforces Sietch npm security.',
      flowSummary: ['Root-Cause Proof + Fault Type', 'Docker Patch Runner + Sietch Guard', 'Verified GitHub PR #1042 / Operator Runbook'],
      isMain: false,
      isTop: false,
      annotations: [
        {
          id: 'l4-a',
          side: 'left',
          code: '04.A',
          title: 'Minimal Patch Synthesis',
          description: 'Generates clean, targeted bug-fix branches directly from diagnosed root-cause proofs with zero hallucinated code.',
          badges: ['claude', 'github'],
          moduleAnchor: [-2.6, 0.4, -1.2],
          revealAt: 0.04,
        },
        {
          id: 'l4-b',
          side: 'left',
          code: '04.B',
          title: 'Isolated Docker Test Runner',
          description: 'Compiles and runs newly synthesized regression suites inside disposable, hermetically sealed Docker containers.',
          badges: ['docker'],
          moduleAnchor: [-2.6, 0.4, 1.2],
          revealAt: 0.16,
        },
        {
          id: 'l4-c',
          side: 'right',
          code: '04.C',
          title: 'Human Approval Safety Gates',
          description: 'High-risk infrastructure operations require explicit human confirmation with full audit logs before release.',
          badges: ['github', 'slack'],
          moduleAnchor: [2.6, 0.4, -1.2],
          revealAt: 0.26,
        },
        {
          id: 'l4-d',
          side: 'right',
          code: '04.D',
          title: 'Sietch Supply-Chain Shield',
          description: 'Executes updated npm dependencies inside instrumented sandboxes with canary traps to catch exfiltration.',
          badges: ['sietch'],
          moduleAnchor: [2.6, 0.4, 1.2],
          revealAt: 0.36,
        },
      ],
    },
    {
      index: 4,
      code: '05',
      kicker: 'VERIFICATION & OPERATIONAL OUTCOMES',
      name: 'Verification & Outcomes',
      explanation:
        'Continuous post-deployment telemetry confirms SLO recovery, auto-closes incidents, guards against regressions, and exports team scorecards.',
      flowSummary: ['Applied Patch / Rollback', 'Continuous SLO Recovery Sentinel', 'Automated Postmortem + MTTD Scorecard'],
      isMain: false,
      isTop: true,
      annotations: [
        {
          id: 'l5-a',
          side: 'left',
          code: '05.A',
          title: 'Live SLO Recovery Surface',
          description: 'Confirms error rates and p99 latency stabilize safely beneath SLO thresholds across the observation window.',
          badges: ['prometheus'],
          moduleAnchor: [-2.6, 0.4, -1.2],
          revealAt: 0.04,
        },
        {
          id: 'l5-b',
          side: 'left',
          code: '05.B',
          title: 'Service Reopening Guard',
          description: 'Automatically reopens the incident and wakes Layer 03 Brain if post-deployment metrics regress.',
          badges: ['logs'],
          moduleAnchor: [-2.6, 0.4, 1.2],
          revealAt: 0.16,
        },
        {
          id: 'l5-c',
          side: 'right',
          code: '05.C',
          title: 'Postmortems & Audit Trails',
          description: 'Publishes structured timelines, root-cause diffs and cryptographically signed approval logs.',
          badges: ['notion', 'slack'],
          moduleAnchor: [2.6, 0.4, -1.2],
          revealAt: 0.26,
        },
        {
          id: 'l5-d',
          side: 'right',
          code: '05.D',
          title: 'Scorecards & Business Reporting',
          description: 'Measures Time-to-Diagnosis (MTTD), MTTR improvements and engineering hours recovered.',
          badges: ['sheets'],
          moduleAnchor: [2.6, 0.4, 1.2],
          revealAt: 0.36,
        },
      ],
    },
  ]
}

const ALL_EXPLODED_LAYERS = buildFiveExplodedLayers()
const SHORT_STEP_NAMES = ['Sources', 'Context', 'AI Engine', 'Remediation', 'Outcomes']

type PopupLayerData = {
  stackIdx: number
  code: string
  kicker: string
  title: string
  headline: string
  purpose: string
  detail: string
  badges: BadgeKind[]
  metrics: { label: string; value: string }[]
  revolvingTexts: string[]
}

const POPUP_LAYERS_DATA: PopupLayerData[] = [
  {
    stackIdx: 0,
    code: '01',
    kicker: 'CONNECTED SOURCES',
    title: 'Connected Sources',
    headline: 'Unify every live production signal.',
    purpose:
      'AIA-02 ingests commits, Prometheus metrics, Docker container state, application logs and CI/CD events into a single normalized stream.',
    detail:
      'Signals are correlated in real time with strict read-scoped permissions and zero custom instrumentation.',
    badges: ['github', 'prometheus', 'docker', 'cicd'],
    metrics: [
      { label: 'INGESTION FIDELITY', value: '99.98%' },
      { label: 'SCRAPERS ACTIVE', value: '42 Prometheus' },
      { label: 'THROUGHPUT', value: '4,850 Ev/s' },
    ],
    revolvingTexts: [
      'GitHub Commits & Webhooks',
      'Prometheus Metric Scrapers',
      'Docker Container Telemetry',
      '4,850 Events/Sec Pipeline',
      'Strict Read-Scoped Sandbox',
    ],
  },
  {
    stackIdx: 1,
    code: '02',
    kicker: 'RELEASE & INCIDENT CONTEXT',
    title: 'Release & Incident Context',
    headline: 'Pinpoint the exact change behind an outage.',
    purpose:
      'When health degrades, the agent correlates deployment timelines, Git diffs, Git blame and stack traces against historical metric baselines.',
    detail:
      'Every anomalous spike is mapped directly against recent code and config changes to isolate the suspected culprit commit.',
    badges: ['github', 'notion', 'drive', 'sheets'],
    metrics: [
      { label: 'CORRELATION SPEED', value: '< 15 Seconds' },
      { label: 'ISOLATION METHOD', value: 'Line Git Blame' },
      { label: 'ALERT NOISE REDUCTION', value: '99.4% Filtered' },
    ],
    revolvingTexts: [
      'Suspect Commit #8f2a1c',
      'Line-Level Blame Tracking',
      'Stack Trace Correlation',
      'Deployment Drift Isolation',
      '< 15s Context Synthesis',
    ],
  },
  {
    stackIdx: 2,
    code: '03 · MAIN',
    kicker: 'AI DIAGNOSIS ENGINE',
    title: 'AI Diagnosis Engine',
    headline: 'Watcher detection meets Brain root-cause reasoning.',
    purpose:
      'The Watcher continuously evaluates health rules and anomalies to open incidents; The Brain activates to cross-examine logs, metrics and commits.',
    detail:
      'Delivers an evidence-backed root cause diagnosis with explicit confidence scoring and clean separation of code vs infrastructure faults.',
    badges: ['openai', 'gemini', 'claude'],
    metrics: [
      { label: 'DIAGNOSTIC CONFIDENCE', value: '98.4%' },
      { label: 'MEAN TIME TO DIAGNOSE', value: '38 Seconds' },
      { label: 'REASONING CORE', value: 'Gemini + Claude' },
    ],
    revolvingTexts: [
      'Watcher Incident Sentinel',
      'Multi-Model Reasoning Core',
      '98.4% Confidence Score',
      'Code vs Infra Fault Split',
      'Evidence-Backed Root Cause',
    ],
  },
  {
    stackIdx: 3,
    code: '04',
    kicker: 'REMEDIATION & SECURITY',
    title: 'Remediation & Security',
    headline: 'Turn diagnosis into controlled action.',
    purpose:
      'For code failures, the agent generates a fix, creates regression tests and opens a GitHub PR. Changes run in isolated Docker environments.',
    detail:
      'Human approval and permission tiers remain in control, while Sietch adds package-level sandbox security.',
    badges: ['claude', 'github', 'docker', 'sietch'],
    metrics: [
      { label: 'DOCKER ISOLATION', value: '100% Hermetic' },
      { label: 'REGRESSION SUITE', value: '42/42 Passing' },
      { label: 'SUPPLY CHAIN SHIELD', value: 'Sietch Scanned' },
    ],
    revolvingTexts: [
      'Automated Fix PR #1042',
      'Disposable Docker Sandbox',
      'Sietch Supply Chain Gate',
      '42/42 Regression Tests Pass',
      'Human Approval Enforced',
    ],
  },
  {
    stackIdx: 4,
    code: '05',
    kicker: 'VERIFICATION & OUTCOMES',
    title: 'Verification & Outcomes',
    headline: 'Close incidents only when recovery holds.',
    purpose:
      'After a fix or rollback lands, AIA-02 monitors live service telemetry to confirm error rates and latency return to healthy baselines.',
    detail:
      'Automatically closes verified incidents or reopens regressions, then compiles a complete postmortem and audit trail.',
    badges: ['prometheus', 'sheets', 'notion'],
    metrics: [
      { label: 'LIVE SLO RECOVERY', value: '99.98% Confirmed' },
      { label: 'LATENCY NOMINAL', value: '42ms Global' },
      { label: 'DECISION LOG', value: 'Immutable Trail' },
    ],
    revolvingTexts: [
      'Post-Fix Telemetry Monitor',
      '99.98% SLO Confirmed',
      'Immutable Audit Trail',
      'Postmortem Scorecard Export',
      'Time-to-Diagnosis: 38s',
    ],
  },
]

function RevolvingOrbitalPopup({
  item,
  onClose,
  onSelectLayer,
}: {
  item: PopupLayerData
  onClose: () => void
  onSelectLayer: (idx: number) => void
}) {
  const capsuleRefs = useRef<(HTMLDivElement | null)[]>([])
  const stringLineRefs = useRef<(SVGLineElement | null)[]>([])
  const stageRef = useRef<HTMLDivElement | null>(null)
  const isPausedRef = useRef(false)
  const [revolveSpeed, setRevolveSpeed] = useState(1.0)
  const [, setCardShockwave] = useState(false)
  const [pointerTilt, setPointerTilt] = useState({ rotX: 20, rotY: -16 })

  const handlePointerMove = (e: React.PointerEvent) => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width - 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    setPointerTilt({
      rotX: 20 - ny * 12,
      rotY: -16 + nx * 16,
    })
  }

  const handlePointerLeave = () => {
    setPointerTilt({ rotX: 20, rotY: -16 })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onSelectLayer((item.stackIdx + 1) % 5)
      if (e.key === 'ArrowLeft') onSelectLayer((item.stackIdx + 4) % 5)
      if (e.key === ' ' || e.key === 'Enter') {
        triggerCardClick()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [item.stackIdx, onClose, onSelectLayer])

  useEffect(() => {
    let angle = 0
    let lastTime = performance.now()
    let rafId = 0

    const loop = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      if (!isPausedRef.current) {
        angle += 0.16 * delta * revolveSpeed
      }

      const n = item.revolvingTexts.length
      const stageEl = stageRef.current
      const stageW = stageEl ? stageEl.clientWidth : 1100
      const rx = Math.min(Math.max(stageW * 0.44, 440), 510)
      const ry = 225
      const rz = 240

      capsuleRefs.current.forEach((el, i) => {
        if (!el) return
        const theta = angle + (i * 2 * Math.PI) / n
        const rawX = Math.cos(theta) * rx
        const rawY = Math.sin(theta) * ry
        const rawZ = Math.sin(theta) * rz

        const x = rawX
        const y = rawY * 0.90 + rawZ * 0.18
        const z = rawZ * 0.92 - rawY * 0.20

        const sinVal = Math.sin(theta)
        const depthNorm = (sinVal + 1) / 2
        const scale = 0.88 + 0.20 * depthNorm
        const opacity = 0.55 + 0.45 * depthNorm
        const zIndex = z > 0 ? 40 : 10

        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) scale(${scale.toFixed(3)})`
        el.style.opacity = opacity.toFixed(2)
        el.style.zIndex = zIndex.toString()

        const lineEl = stringLineRefs.current[i]
        if (lineEl) {
          const cardEdgeFactor = 0.44
          const sx = 500 + x * cardEdgeFactor
          const sy = 310 + y * cardEdgeFactor
          const ex = 500 + x
          const ey = 310 + y
          lineEl.setAttribute('x1', sx.toFixed(1))
          lineEl.setAttribute('y1', sy.toFixed(1))
          lineEl.setAttribute('x2', ex.toFixed(1))
          lineEl.setAttribute('y2', ey.toFixed(1))
          lineEl.setAttribute('stroke-opacity', (opacity * 0.75).toFixed(2))
        }
      })

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [item, revolveSpeed])

  const triggerCardClick = () => {
    setRevolveSpeed(prev => (prev >= 2.0 ? 1.0 : prev + 0.5))
    setCardShockwave(true)
    setTimeout(() => setCardShockwave(false), 600)
  }

  const popupContent = (
    <div className="jarvis-popup-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="jarvis-popup-bg-grid" aria-hidden="true" />
      <div className="jarvis-popup-hud-top" aria-hidden="true">
        <span className="hud-code-pill">◬ AIA-02 ARCHITECTURAL 3D INSPECTOR // LAYER {item.code}</span>
        <span className="hud-esc-cue">ESC TO CLOSE ✕</span>
      </div>

      <div
        ref={stageRef}
        className="jarvis-popup-orbit-stage"
        onClick={e => e.stopPropagation()}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div className="jarvis-popup-orbitals is-active-orbit" aria-hidden="true">
          <svg className="jarvis-orbit-svg is-3d-tilted-orbit" viewBox="0 0 1000 620">
            <defs>
              <radialGradient id="orbitGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F26627" stopOpacity="0.18" />
                <stop offset="65%" stopColor="#F26627" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#F26627" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="500" cy="310" rx="480" ry="220" className="jarvis-orbit-wire-string" />
            <ellipse cx="500" cy="310" rx="505" ry="238" className="jarvis-orbit-wire-outer" />
            <circle cx="500" cy="310" r="320" fill="url(#orbitGlow)" />
            {item.revolvingTexts.map((_, idx) => (
              <line
                key={idx}
                ref={el => {
                  stringLineRefs.current[idx] = el
                }}
                className="jarvis-capsule-tether-wire"
                x1="500"
                y1="310"
                x2="500"
                y2="310"
              />
            ))}
          </svg>
        </div>

        <div className="jarvis-revolving-track">
          {item.revolvingTexts.map((text, idx) => (
            <div
              key={idx}
              ref={el => {
                capsuleRefs.current[idx] = el
              }}
              className="jarvis-revolving-capsule is-revolving"
              onClick={e => {
                e.stopPropagation()
                triggerCardClick()
              }}
              onMouseEnter={() => {
                isPausedRef.current = true
              }}
              onMouseLeave={() => {
                isPausedRef.current = false
              }}
              title="Hover to pause · Click for speed surge"
            >
              <span className="revolving-capsule-wire-clip" />
              <span className="revolving-capsule-dot" />
              <span className="revolving-capsule-text">{text}</span>
            </div>
          ))}
        </div>

        <div
          className="jarvis-popup-card-anchor is-3d-card-anchor"
          style={{
            transform: `rotateX(${pointerTilt.rotX.toFixed(1)}deg) rotateY(${pointerTilt.rotY.toFixed(1)}deg) rotateZ(2deg)`,
          }}
        >
          <div className="popup-disk-body">
            <header className="popup-disk-header">
              <span className="popup-disk-layer-tag">LAYER 0{item.stackIdx + 1} // {item.kicker}</span>
              <h2 className="popup-disk-title">{item.title}</h2>
              <p className="popup-disk-headline">{item.headline}</p>
            </header>

            <div className="popup-disk-metrics">
              {item.metrics.map(m => (
                <div key={m.label} className="popup-metric-box">
                  <span className="popup-metric-label">{m.label}</span>
                  <strong className="popup-metric-val">{m.value}</strong>
                </div>
              ))}
            </div>

            <p className="popup-disk-purpose">{item.purpose}</p>

            <div className="popup-disk-badges">
              {item.badges.map(b => (
                <TechBadgeIcon key={b} kind={b} />
              ))}
            </div>

            <div className="popup-disk-stepper">
              {POPUP_LAYERS_DATA.map((layer, idx) => (
                <button
                  key={layer.code}
                  type="button"
                  className={`popup-step-dot ${item.stackIdx === idx ? 'is-active' : ''}`}
                  onClick={() => onSelectLayer(idx)}
                >
                  <span>0{idx + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(popupContent, document.body)
}

/* ============================================================================
   HIGH-FIDELITY 3D WEBGL DECK ARCHITECTURE EXPERIENCE
   - Physical Mode (Image 1): Solid matte ceramic slabs, 4 orange button keys,
     Layer 03 glowing underlight, ports, LEDs & callout pins.
   - Holographic Glass Mode (Image 2): Exploded translucent glass slabs with glowing
     orange rim on Layer 03, floating 3D wireframe polyhedrons, laser conduits & rays.
   - CAD Blueprint Mode (Image 3): High-angle inspection of Layer 03 with central
     wireframe torus + white icosahedron core & 4 satellite corner nodes.
   ============================================================================ */
export function JarvisArchitectureExperience({
  externalTargetLayer,
  onClearExternalTarget,
}: {
  externalTargetLayer?: number | null
  onClearExternalTarget?: () => void
}) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const cardItemRefs = useRef<Record<string, HTMLElement | null>>({})
  const svgLineRefs = useRef<Record<string, SVGPathElement | null>>({})
  const svgDotRefs = useRef<Record<string, SVGCircleElement | null>>({})

  // Interactive Selected Layer (null = compact physical stack matching media_1795307624568_1476844b.jpg)
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null)
  const [isExploded, setIsExploded] = useState<boolean>(false)
  const [clickedCardId, setClickedCardId] = useState<string | null>(null)
  const [poppedLayerIdx, setPoppedLayerIdx] = useState<number | null>(null)

  const openLayerPopup = (layerIdx: number, cardId?: string) => {
    setSelectedLayer(layerIdx)
    setPoppedLayerIdx(layerIdx)
    if (cardId) setClickedCardId(cardId)
  }

  const slabMeshesRef = useRef<THREE.Mesh[]>([])
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const pointerDownPos = useRef({ x: 0, y: 0, time: 0 })

  const stateRef = useRef({
    orbitTargetX: 0,
    orbitTargetY: 0,
    orbitCurrentX: 0,
    orbitCurrentY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    hoveredLayer: -1,
    selectedLayer: null as number | null,
    isExploded: false,
  })

  stateRef.current.selectedLayer = selectedLayer
  stateRef.current.isExploded = isExploded

  const resetViewAngle = () => {
    stateRef.current.orbitTargetX = 0
    stateRef.current.orbitTargetY = 0
  }

  // Handle external navigation target from hero section
  useEffect(() => {
    if (externalTargetLayer !== undefined && externalTargetLayer !== null) {
      setSelectedLayer(externalTargetLayer)
      onClearExternalTarget?.()
      const sec = sectionRef.current
      if (sec) {
        window.scrollTo({ top: sec.offsetTop - 30, behavior: 'smooth' })
      }
    }
  }, [externalTargetLayer, onClearExternalTarget])

  // Direct 3D Raycasting & Drag-to-orbit pointer handlers on center stage
  const onStagePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY, time: Date.now() }
    stateRef.current.isDragging = true
    stateRef.current.dragStartX = e.clientX
    stateRef.current.dragStartY = e.clientY
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onStagePointerMove = (e: React.PointerEvent) => {
    const dx = e.clientX - stateRef.current.dragStartX
    const dy = e.clientY - stateRef.current.dragStartY

    if (stateRef.current.isDragging) {
      const distFromDown = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y)
      if (distFromDown > 3) {
        stateRef.current.dragStartX = e.clientX
        stateRef.current.dragStartY = e.clientY
        stateRef.current.orbitTargetY += dx * 0.007
        stateRef.current.orbitTargetX = Math.max(-0.65, Math.min(0.65, stateRef.current.orbitTargetX + dy * 0.006))
      }
    } else {
      // Raycast hover check against 5 physical slabs
      const host = canvasHostRef.current
      const cam = cameraRef.current
      if (host && cam && slabMeshesRef.current.length === 5) {
        const rect = host.getBoundingClientRect()
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cam)
        const hits = raycaster.intersectObjects(slabMeshesRef.current, false)
        if (hits.length > 0) {
          const idx = hits[0].object.userData.layerIdx as number
          stateRef.current.hoveredLayer = idx
          host.style.cursor = 'pointer'
        } else {
          stateRef.current.hoveredLayer = -1
          host.style.cursor = stateRef.current.isDragging ? 'grabbing' : 'grab'
        }
      }
    }
  }

  const onStagePointerUp = (e: React.PointerEvent) => {
    stateRef.current.isDragging = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      // safe fallback
    }

    const dist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y)
    const elapsed = Date.now() - pointerDownPos.current.time
    if (dist < 8 && elapsed < 400) {
      // Direct Click on 3D Slab detected!
      const host = canvasHostRef.current
      const cam = cameraRef.current
      if (host && cam && slabMeshesRef.current.length === 5) {
        const rect = host.getBoundingClientRect()
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cam)
        const hits = raycaster.intersectObjects(slabMeshesRef.current, false)
        if (hits.length > 0) {
          const clickedIdx = hits[0].object.userData.layerIdx as number
          setSelectedLayer(prev => (prev === clickedIdx ? null : clickedIdx))
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // WEBGL THREE.JS ENGINE SETUP
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch (e) {
      console.error('Failed to create WebGLRenderer:', e)
      return
    }

    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 16 / 10, 0.1, 100)
    camera.position.set(10.2, 11.0, 14.8)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Studio Lighting - warm, tactile lighting matching media_1795307624568_1476844b.jpg
    const keyLight = new THREE.DirectionalLight(0xfffbf0, 2.6)
    keyLight.position.set(12, 18, 14)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xdbe8f5, 1.4)
    fillLight.position.set(-14, 10, -10)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffecd6, 1.2)
    rimLight.position.set(0, -10, 15)
    scene.add(rimLight)

    const ambLight = new THREE.AmbientLight(0xf5f3ee, 1.8)
    scene.add(ambLight)

    // Master Deck Group
    const masterDeckGroup = new THREE.Group()
    scene.add(masterDeckGroup)

    // Ground Shadow Plane (soft isometric contact shadow beneath the whole deck)
    const groundShadowGeo = new THREE.PlaneGeometry(14, 14)
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = 256
    shadowCanvas.height = 256
    const shadowCtx = shadowCanvas.getContext('2d')
    if (shadowCtx) {
      const grad = shadowCtx.createRadialGradient(128, 128, 20, 128, 128, 120)
      grad.addColorStop(0, 'rgba(40, 36, 30, 0.28)')
      grad.addColorStop(0.5, 'rgba(40, 36, 30, 0.12)')
      grad.addColorStop(1, 'rgba(40, 36, 30, 0)')
      shadowCtx.fillStyle = grad
      shadowCtx.fillRect(0, 0, 256, 256)
    }
    const groundShadowTex = new THREE.CanvasTexture(shadowCanvas)
    const groundShadowMat = new THREE.MeshBasicMaterial({
      map: groundShadowTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    })
    const groundShadowMesh = new THREE.Mesh(groundShadowGeo, groundShadowMat)
    groundShadowMesh.rotation.x = -Math.PI / 2
    groundShadowMesh.position.y = -1.65
    scene.add(groundShadowMesh)

    // Shared Geometries & Textures
    const plateWidth = 5.4
    const plateDepth = 5.4
    const plateCornerR = 0.82
    const plateThickness = 0.36

    const plateShape = createRoundedRectShape(plateWidth, plateDepth, plateCornerR)
    const plateExtrudeSettings = {
      depth: plateThickness,
      bevelEnabled: true,
      bevelSegments: 5,
      bevelSteps: 1,
      bevelSize: 0.12,
      bevelThickness: 0.08,
    }
    const plateGeo = new THREE.ExtrudeGeometry(plateShape, plateExtrudeSettings)
    plateGeo.center()

    const underglowTex = createUnderglowTexture()
    const topFaceTexNormal = createTopFaceTexture(false)
    const topFaceTexMain = createTopFaceTexture(true)

    // Outline contour for squircle edges
    const rimPoints = createRoundedRectContour(plateWidth + 0.14, plateDepth + 0.14, plateCornerR + 0.07, 12)
    const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPoints)

    // Top buttons geometry (4 orange keys on Layer 05 / top lid)
    const btnShape = createRoundedRectShape(0.88, 0.88, 0.24)
    const btnGeo = new THREE.ExtrudeGeometry(btnShape, {
      depth: 0.24,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    })
    btnGeo.center()

    // ------------------------------------------------------------------------
    // BUILD THE 5 TACTILE SOLID SLABS (Matching media_1795307624568_1476844b.jpg)
    // ------------------------------------------------------------------------
    type TactileLayerState = {
      group: THREE.Group
      physicalMesh: THREE.Mesh
      rimLine: THREE.Line
      underglowMesh?: THREE.Mesh
      underglowLight?: THREE.PointLight
      topButtonsGroup?: THREE.Group
      isMain: boolean
      isTop: boolean
      layerIdx: number
    }

    const layerObjects: TactileLayerState[] = []
    slabMeshesRef.current = []

    for (let i = 0; i < 5; i++) {
      const isMain = i === 2
      const isTop = i === 4
      const layerGroup = new THREE.Group()
      masterDeckGroup.add(layerGroup)

      // Solid Opaque Tactile Mesh (Matte warm ivory ceramic)
      const physMat = new THREE.MeshStandardMaterial({
        color: isMain ? 0xfbf9f5 : 0xf4f1ea,
        roughness: 0.32,
        metalness: 0.04,
      })
      const physMesh = new THREE.Mesh(plateGeo, physMat)
      physMesh.rotation.x = -Math.PI / 2
      physMesh.userData = { layerIdx: i }
      slabMeshesRef.current.push(physMesh)
      layerGroup.add(physMesh)

      // Front label texture applied to a decal quad on the front bevel face
      const labelCanvas = createPlateLabelCanvas(`0 ${i + 1}`, isMain)
      const labelTex = new THREE.CanvasTexture(labelCanvas)
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        opacity: 0.96,
      })
      const labelQuad = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.38), labelMat)
      labelQuad.position.set(0, 0, plateDepth / 2 + 0.13)
      physMesh.add(labelQuad)

      // Top surface engraved details
      const topDecalMat = new THREE.MeshBasicMaterial({
        map: isMain ? topFaceTexMain : topFaceTexNormal,
        transparent: true,
        opacity: 0.82,
      })
      const topDecal = new THREE.Mesh(new THREE.PlaneGeometry(plateWidth - 0.4, plateDepth - 0.4), topDecalMat)
      topDecal.position.set(0, 0, plateThickness / 2 + 0.01)
      physMesh.add(topDecal)

      // Hardware side details matching target screenshot
      if (isMain) {
        // Orange status LED on left edge
        const ledMat = new THREE.MeshBasicMaterial({ color: 0xff5e1e })
        const ledMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), ledMat)
        ledMesh.rotation.z = Math.PI / 2
        ledMesh.position.set(-plateWidth / 2 - 0.07, 0, 0.4)
        physMesh.add(ledMesh)

        // Sensor pinhole next to LED
        const pinMat = new THREE.MeshBasicMaterial({ color: 0x38352f })
        const pinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), pinMat)
        pinMesh.rotation.z = Math.PI / 2
        pinMesh.position.set(-plateWidth / 2 - 0.07, 0, 0.8)
        physMesh.add(pinMesh)

        // USB-C port cutout on right edge
        const portMat = new THREE.MeshBasicMaterial({ color: 0x22211e })
        const portMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), portMat)
        portMesh.position.set(plateWidth / 2 + 0.07, 0, 0.2)
        physMesh.add(portMesh)

        // Aux port slot
        const slotMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.28), portMat)
        slotMesh.position.set(plateWidth / 2 + 0.07, 0, -0.6)
        physMesh.add(slotMesh)
      }

      if (i === 0) {
        // Layer 01 indicator dots on sides
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x7a7770 })
        for (const zOff of [-0.2, 0.2]) {
          const d = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), dotMat)
          d.rotation.z = Math.PI / 2
          d.position.set(-plateWidth / 2 - 0.07, 0, zOff)
          physMesh.add(d)
        }
        for (const zOff of [-0.3, 0, 0.3]) {
          const d = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), dotMat)
          d.rotation.z = Math.PI / 2
          d.position.set(plateWidth / 2 + 0.07, 0, zOff)
          physMesh.add(d)
        }
      }

      // Outer squircle rim highlight contour
      const rimMat = new THREE.LineBasicMaterial({
        color: isMain ? 0xf26627 : 0x8a9ba8,
        transparent: true,
        opacity: isMain ? 0.95 : 0.4,
      })
      const rimLine = new THREE.Line(rimGeo, rimMat)
      rimLine.position.y = plateThickness / 2 + 0.02
      layerGroup.add(rimLine)

      // Intense warm orange ambient underglow spilling onto Layer 02 below (matching target UI)
      let underglowMesh: THREE.Mesh | undefined
      let underglowLight: THREE.PointLight | undefined
      if (isMain) {
        const glowMat = new THREE.MeshBasicMaterial({
          map: underglowTex,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        underglowMesh = new THREE.Mesh(new THREE.PlaneGeometry(plateWidth * 1.5, plateDepth * 1.5), glowMat)
        underglowMesh.rotation.x = -Math.PI / 2
        underglowMesh.position.y = -plateThickness / 2 - 0.05
        layerGroup.add(underglowMesh)

        underglowLight = new THREE.PointLight(0xf46925, 3.2, 6.5)
        underglowLight.position.set(0, -0.3, 0)
        layerGroup.add(underglowLight)
      }

      // Top 4 Rounded Orange Buttons on Layer 05 (matching target UI)
      let topButtonsGroup: THREE.Group | undefined
      if (isTop) {
        topButtonsGroup = new THREE.Group()
        topButtonsGroup.position.y = plateThickness / 2 + 0.12

        const btnMat = new THREE.MeshStandardMaterial({
          color: 0xf26627,
          roughness: 0.28,
          metalness: 0.08,
          emissive: 0x9e350b,
          emissiveIntensity: 0.16,
        })

        const offsets: [number, number][] = [
          [-0.64, -0.64],
          [0.64, -0.64],
          [-0.64, 0.64],
          [0.64, 0.64],
        ]

        for (const [bx, bz] of offsets) {
          const btn = new THREE.Mesh(btnGeo, btnMat)
          btn.position.set(bx, 0, bz)
          btn.rotation.x = -Math.PI / 2
          topButtonsGroup.add(btn)
        }
        layerGroup.add(topButtonsGroup)
      }

      layerObjects.push({
        group: layerGroup,
        physicalMesh: physMesh,
        rimLine,
        underglowMesh,
        underglowLight,
        topButtonsGroup,
        isMain,
        isTop,
        layerIdx: i,
      })
    }

    // ------------------------------------------------------------------------
    // VIEW RESIZING & ANIMATION LOOP
    // ------------------------------------------------------------------------
    let viewW = 640
    let viewH = 520
    const resize = () => {
      const host = canvasHostRef.current
      if (!host) return
      viewW = Math.max(260, host.clientWidth)
      viewH = Math.max(240, host.clientHeight)
      renderer.setSize(viewW, viewH, false)
      camera.aspect = viewW / viewH
      camera.fov = viewW < 540 ? 44 : 36
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    let rafId = 0
    const startTime = performance.now()

    const vWorldTmp = new THREE.Vector3()
    const vScreenTmp = new THREE.Vector3()

    const animate = (now: number) => {
      const t = (now - startTime) / 1000
      const {
        orbitTargetX,
        orbitTargetY,
        selectedLayer: curSelected,
        isExploded: curExploded,
        hoveredLayer: curHovered,
      } = stateRef.current

      // Smooth Orbit Drag Rotation
      stateRef.current.orbitCurrentX = THREE.MathUtils.lerp(stateRef.current.orbitCurrentX, orbitTargetX, 0.12)
      stateRef.current.orbitCurrentY = THREE.MathUtils.lerp(stateRef.current.orbitCurrentY, orbitTargetY, 0.12)

      // Master Deck Rotation (Isometric tilt matching target UI + user drag orbit)
      const idleHover = Math.sin(t * 1.2) * 0.012
      masterDeckGroup.rotation.y = -Math.PI / 4 + stateRef.current.orbitCurrentY
      masterDeckGroup.rotation.x = 0.58 + stateRef.current.orbitCurrentX + idleHover

      // Subtle breathing wave
      const breathWave = Math.sin(t * 1.5) * 0.02

      // Position each slab in 3D:
      // 1. Compact Stack (target UI): tightly stacked at 0.54 spacing
      // 2. Cut-Open Layer: isolates selected slab vertically with ample room
      // 3. Exploded All: all 5 slabs evenly spread
      for (let i = 0; i < 5; i++) {
        const obj = layerObjects[i]
        let targetY = 0

        if (curExploded) {
          targetY = (i - 2) * 1.55
          if (curSelected === i) targetY += 0.35
        } else if (curSelected !== null) {
          // CUT OPEN at selected layer!
          if (i < curSelected) {
            targetY = (i - 2) * 0.54
          } else if (i === curSelected) {
            targetY = (i - 2) * 0.54 + 1.85
          } else {
            targetY = (i - 2) * 0.54 + 2.55
          }
        } else {
          // Compact solid tactile stack
          targetY = (i - 2) * 0.54 + breathWave
          if (curHovered === i) {
            targetY += 0.14
          }
        }

        obj.group.position.y = THREE.MathUtils.lerp(obj.group.position.y, targetY, 0.14)

        // Highlight rim line on active, hovered, or Layer 03
        const isHighlighted =
          curSelected === i ||
          curHovered === i ||
          (curSelected === null && obj.isMain)
        const rimMat = obj.rimLine.material as THREE.LineBasicMaterial
        rimMat.color.setHex(isHighlighted ? 0xf26627 : 0x8a9ba8)
        rimMat.opacity = isHighlighted ? 1.0 : (curSelected !== null ? 0.25 : 0.45)

        // Underglow Light animation (Layer 03)
        if (obj.underglowMesh && obj.underglowLight) {
          const glowPulse = Math.sin(t * 2.4) * 0.15 + 1.0
          ;(obj.underglowMesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * glowPulse
          obj.underglowLight.intensity = 3.2 * glowPulse
        }
      }

      // Render Three.js Scene
      renderer.render(scene, camera)

      // Screen-Space Projection for SVG Connector Lines
      const ws = workspaceRef.current
      const ch = canvasHostRef.current
      if (ws && ch && window.innerWidth >= 1080) {
        const wsRect = ws.getBoundingClientRect()
        const chRect = ch.getBoundingClientRect()
        const canvasOffsetLeft = chRect.left - wsRect.left
        const canvasOffsetTop = chRect.top - wsRect.top

        if (curSelected === null) {
          // Overview connections from the 5 stacked overview cards
          const allOv = [...OVERVIEW_ANNOTATIONS.left, ...OVERVIEW_ANNOTATIONS.right]
          allOv.forEach(item => {
            const domEl = cardItemRefs.current[item.id]
            const pathEl = svgLineRefs.current[item.id]
            const dotEl = svgDotRefs.current[item.id]
            if (!domEl || !pathEl || !dotEl) return

            const cRect = domEl.getBoundingClientRect()
            const isLeft = item.id === 'ov-04' || item.id === 'ov-02'
            const startX = isLeft ? cRect.right - wsRect.left : cRect.left - wsRect.left
            const startY = cRect.top - wsRect.top + cRect.height * 0.5

            // Anchor point on the slab corner
            const cornerX = isLeft ? -plateWidth * 0.48 : plateWidth * 0.48
            const cornerZ = isLeft ? -plateDepth * 0.48 : plateDepth * 0.48
            vWorldTmp.set(cornerX, 0, cornerZ)
            vWorldTmp.applyMatrix4(layerObjects[item.stackIdx].group.matrixWorld)
            vScreenTmp.copy(vWorldTmp).project(camera)

            const endX = canvasOffsetLeft + (vScreenTmp.x * 0.5 + 0.5) * viewW
            const endY = canvasOffsetTop + (-vScreenTmp.y * 0.5 + 0.5) * viewH
            const midX = startX + (endX - startX) * 0.45

            pathEl.setAttribute('d', `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${midX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`)
            dotEl.setAttribute('cx', endX.toFixed(1))
            dotEl.setAttribute('cy', endY.toFixed(1))
          })
        } else {
          // Active layer application capability cards
          const activeLayerSpec = ALL_EXPLODED_LAYERS[curSelected]
          const curObj = layerObjects[curSelected]
          activeLayerSpec.annotations.forEach(anno => {
            const domEl = cardItemRefs.current[anno.id]
            const pathEl = svgLineRefs.current[anno.id]
            const dotEl = svgDotRefs.current[anno.id]
            if (!domEl || !pathEl || !dotEl) return

            const cRect = domEl.getBoundingClientRect()
            const isLeft = anno.side === 'left'
            const startX = isLeft ? cRect.right - wsRect.left : cRect.left - wsRect.left
            const startY = cRect.top - wsRect.top + cRect.height * 0.5

            vWorldTmp.set(anno.moduleAnchor[0], anno.moduleAnchor[1], anno.moduleAnchor[2])
            vWorldTmp.applyMatrix4(curObj.group.matrixWorld)
            vScreenTmp.copy(vWorldTmp).project(camera)

            const endX = canvasOffsetLeft + (vScreenTmp.x * 0.5 + 0.5) * viewW
            const endY = canvasOffsetTop + (-vScreenTmp.y * 0.5 + 0.5) * viewH
            const midX = startX + (endX - startX) * 0.42

            pathEl.setAttribute('d', `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${midX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`)
            dotEl.setAttribute('cx', endX.toFixed(1))
            dotEl.setAttribute('cy', endY.toFixed(1))
          })
        }
      }

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      plateGeo.dispose()
      rimGeo.dispose()
      btnGeo.dispose()
      groundShadowGeo.dispose()
      slabMeshesRef.current = []
    }
  }, [])

  const activeSpec = selectedLayer !== null ? ALL_EXPLODED_LAYERS[selectedLayer] : null
  const leftAnnos = activeSpec ? activeSpec.annotations.filter(a => a.side === 'left') : []
  const rightAnnos = activeSpec ? activeSpec.annotations.filter(a => a.side === 'right') : []

  return (
    <section
      ref={sectionRef}
      className="jarvis-scroll-section"
      id="architecture"
      aria-label="Interactive 5-layer 3D industrial architecture deck"
    >
      <div className="jarvis-sticky-viewport">
        <div className="jarvis-bg-grid" aria-hidden="true" />
        <div className="jarvis-scanline" aria-hidden="true" />

        <div className="jarvis-layout-shell">
          {/* ROW 1: DEDICATED TOP BAND */}
          <header className="jarvis-top-band">
            <div className="jarvis-top-band__copy">
              <div className="jarvis-kicker-row">
                <span className="jarvis-live-dot" />
                <span>
                  {activeSpec
                    ? `LAYER ${activeSpec.code} OF 05 // ${activeSpec.kicker}`
                    : 'MODULAR 5-LAYER INDUSTRIAL ARCHITECTURE DECK'}
                </span>
              </div>
              <h2>
                {activeSpec ? activeSpec.name : '3D Tactile Reliability Architecture'}
              </h2>
              <p>
                {activeSpec
                  ? activeSpec.explanation
                  : 'An integrated 5-layer physical hardware architecture. Click any 3D slab or layer button to cut open its internal diagnostic capabilities.'}
              </p>

              <div
                className="jarvis-interactive-action-banner"
                onClick={() => {
                  if (selectedLayer === null) {
                    setSelectedLayer(2)
                  } else {
                    openLayerPopup(selectedLayer)
                  }
                }}
                role="button"
                tabIndex={0}
                title="Click to interact with 3D layer applications"
              >
                <span className="jarvis-action-spark">✦</span>
                <span className="jarvis-action-text">
                  {selectedLayer === null
                    ? 'CLICK ANY 3D SLAB TO CUT OPEN APPLICATIONS'
                    : `INSPECT LAYER ${selectedLayer + 1} DEEP TELEMETRY ➜`}
                </span>
              </div>
            </div>

            <nav className="jarvis-stepper" aria-label="Architecture layer navigation">
              <button
                type="button"
                className={`jarvis-step-btn ${selectedLayer === null ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedLayer(null)
                  setIsExploded(false)
                }}
                title="Reassemble all 5 layers into compact tactile stack"
              >
                <span>STACK</span>
              </button>
              {ALL_EXPLODED_LAYERS.map((layer, idx) => (
                <button
                  key={layer.code}
                  type="button"
                  className={`jarvis-step-btn ${selectedLayer === idx ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedLayer(idx)
                    setIsExploded(false)
                  }}
                  title={`Focus Layer ${layer.code} applications`}
                >
                  <span className="jarvis-step-btn__num">{layer.code}</span>
                  <span className="jarvis-step-btn__name">{SHORT_STEP_NAMES[idx]}</span>
                </button>
              ))}
            </nav>
          </header>

          {/* ROW 2: BALANCED LEFT WING — CENTRAL 3D STAGE — RIGHT WING */}
          <div ref={workspaceRef} className="jarvis-workspace">
            {/* Desktop SVG Connector Overlay */}
            <svg className="jarvis-connector-svg" aria-hidden="true">
              {activeSpec === null
                ? [...OVERVIEW_ANNOTATIONS.left, ...OVERVIEW_ANNOTATIONS.right].map(item => (
                    <g key={item.id} className="jarvis-conn-group is-visible">
                      <path
                        ref={el => {
                          svgLineRefs.current[item.id] = el
                        }}
                        className="jarvis-conn-path"
                      />
                      <circle
                        ref={el => {
                          svgDotRefs.current[item.id] = el
                        }}
                        r="3.4"
                        className="jarvis-conn-dot"
                      />
                    </g>
                  ))
                : activeSpec.annotations.map(anno => (
                    <g key={anno.id} className="jarvis-conn-group is-visible">
                      <path
                        ref={el => {
                          svgLineRefs.current[anno.id] = el
                        }}
                        className="jarvis-conn-path"
                      />
                      <circle
                        ref={el => {
                          svgDotRefs.current[anno.id] = el
                        }}
                        r="3.4"
                        className="jarvis-conn-dot"
                      />
                    </g>
                  ))}
            </svg>

            {/* LEFT ANNOTATION WING */}
            <div className="jarvis-wing jarvis-wing--left">
              {activeSpec === null
                ? OVERVIEW_ANNOTATIONS.left.map(item => (
                    <article
                      key={item.id}
                      ref={el => {
                        cardItemRefs.current[item.id] = el
                      }}
                      className={`jarvis-note is-visible is-interactive-card ${clickedCardId === item.id ? 'is-card-clicked' : ''}`}
                      onClick={() => {
                        setClickedCardId(item.id)
                        setSelectedLayer(item.stackIdx)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedLayer(item.stackIdx)
                        }
                      }}
                    >
                      <div className="jarvis-note__head">
                        <span className="jarvis-note__code">{item.code}</span>
                        <h3>{item.title}</h3>
                        <span className="jarvis-note__pop-cue">CUT OPEN ➜</span>
                      </div>
                      <p>{item.description}</p>
                      <div className="jarvis-note__badges">
                        {item.badges.map(b => (
                          <TechBadgeIcon key={b} kind={b} />
                        ))}
                      </div>
                    </article>
                  ))
                : leftAnnos.map(anno => (
                    <article
                      key={anno.id}
                      ref={el => {
                        cardItemRefs.current[anno.id] = el
                      }}
                      className={`jarvis-note is-interactive-card is-visible ${clickedCardId === anno.id ? 'is-card-clicked' : ''}`}
                      onClick={() => {
                        setClickedCardId(anno.id)
                        openLayerPopup(selectedLayer !== null ? selectedLayer : 1, anno.id)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          openLayerPopup(selectedLayer !== null ? selectedLayer : 1, anno.id)
                        }
                      }}
                    >
                      <div className="jarvis-note__head">
                        <span className="jarvis-note__code">{anno.code}</span>
                        <h3>{anno.title}</h3>
                        <span className="jarvis-note__pop-cue">INSPECT ➜</span>
                      </div>
                      <p>{anno.description}</p>
                      <div className="jarvis-note__badges">
                        {anno.badges.map(b => (
                          <TechBadgeIcon key={b} kind={b} />
                        ))}
                      </div>
                    </article>
                  ))}
            </div>

            {/* CENTRAL 3D WEBGL DECK STAGE */}
            <div
              ref={canvasHostRef}
              className="jarvis-center-stage"
              onPointerDown={onStagePointerDown}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              onPointerCancel={onStagePointerUp}
              title="Click on any 3D slab to cut open applications · Drag to orbit"
            >
              <canvas ref={canvasRef} className="jarvis-projection-canvas" />

              {/* FLOATING 3D DECK CONTROL TOOLBAR */}
              <div className="jarvis-deck-toolbar" onClick={e => e.stopPropagation()}>
                <div className="jarvis-deck-modes">
                  <button
                    type="button"
                    className={`jarvis-deck-btn ${selectedLayer === null && !isExploded ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedLayer(null)
                      setIsExploded(false)
                    }}
                    title="Solid physical ceramic hardware stack (Matching target UI)"
                  >
                    <span>⬡ Compact Stack</span>
                  </button>
                  <button
                    type="button"
                    className={`jarvis-deck-btn ${selectedLayer !== null && !isExploded ? 'is-active' : ''}`}
                    onClick={() => {
                      if (selectedLayer === null) setSelectedLayer(2)
                      setIsExploded(false)
                    }}
                    title="Cuts open the selected layer to expose its applications"
                  >
                    <span>◬ Cut Open View</span>
                  </button>
                  <button
                    type="button"
                    className={`jarvis-deck-btn ${isExploded ? 'is-active' : ''}`}
                    onClick={() => setIsExploded(prev => !prev)}
                    title="Explode all 5 layers vertically"
                  >
                    <span>✥ Explode All</span>
                  </button>
                </div>

                <div className="jarvis-deck-tools">
                  <span className="jarvis-deck-hint">✥ Drag to 3D Orbit</span>
                  <button
                    type="button"
                    className="jarvis-deck-reset-btn"
                    onClick={resetViewAngle}
                    title="Reset 3D camera to default isometric angle"
                  >
                    <span>⟲ Reset</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT ANNOTATION WING */}
            <div className="jarvis-wing jarvis-wing--right">
              {activeSpec === null
                ? OVERVIEW_ANNOTATIONS.right.map(item => (
                    <article
                      key={item.id}
                      ref={el => {
                        cardItemRefs.current[item.id] = el
                      }}
                      className={`jarvis-note is-visible is-interactive-card ${item.code.includes('03') ? 'jarvis-note--main' : ''} ${clickedCardId === item.id ? 'is-card-clicked' : ''}`}
                      onClick={() => {
                        setClickedCardId(item.id)
                        setSelectedLayer(item.stackIdx)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedLayer(item.stackIdx)
                        }
                      }}
                    >
                      <div className="jarvis-note__head">
                        <span className="jarvis-note__code">{item.code}</span>
                        <h3>{item.title}</h3>
                        <span className="jarvis-note__pop-cue">CUT OPEN ➜</span>
                      </div>
                      <p>{item.description}</p>
                      <div className="jarvis-note__badges">
                        {item.badges.map(b => (
                          <TechBadgeIcon key={b} kind={b} />
                        ))}
                      </div>
                    </article>
                  ))
                : rightAnnos.map(anno => (
                    <article
                      key={anno.id}
                      ref={el => {
                        cardItemRefs.current[anno.id] = el
                      }}
                      className={`jarvis-note is-interactive-card is-visible ${clickedCardId === anno.id ? 'is-card-clicked' : ''}`}
                      onClick={() => {
                        setClickedCardId(anno.id)
                        openLayerPopup(selectedLayer !== null ? selectedLayer : 2, anno.id)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          openLayerPopup(selectedLayer !== null ? selectedLayer : 2, anno.id)
                        }
                      }}
                    >
                      <div className="jarvis-note__head">
                        <span className="jarvis-note__code">{anno.code}</span>
                        <h3>{anno.title}</h3>
                        <span className="jarvis-note__pop-cue">INSPECT ➜</span>
                      </div>
                      <p>{anno.description}</p>
                      <div className="jarvis-note__badges">
                        {anno.badges.map(b => (
                          <TechBadgeIcon key={b} kind={b} />
                        ))}
                      </div>
                    </article>
                  ))}
            </div>
          </div>
        </div>
      </div>

      {poppedLayerIdx !== null && (
        <RevolvingOrbitalPopup
          item={POPUP_LAYERS_DATA[poppedLayerIdx]}
          onClose={() => setPoppedLayerIdx(null)}
          onSelectLayer={idx => setPoppedLayerIdx(idx)}
        />
      )}
    </section>
  )
}
