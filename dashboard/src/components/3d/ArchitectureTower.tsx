import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { type LayerHealthState, type TowerNodeId, normalizeToTowerNode } from "./types";

interface ArchitectureTowerProps {
  hoveredServiceId: TowerNodeId | null;
  selectedServiceId: TowerNodeId | null;
  layerHealth?: Record<string, LayerHealthState>;
  onHoverService: (nodeId: TowerNodeId | null) => void;
  onSelectService: (nodeId: TowerNodeId) => void;
}

// ─────────────────────────────────────────────────────────────
// SEMANTIC 3D COMPONENT SYMBOLS (EMBOSSED ON WHITE CERAMIC PLATFORMS)
// Designed to match Image 5 with pixel-level fidelity
// ─────────────────────────────────────────────────────────────

interface SymbolProps {
  isHovered?: boolean;
  isSelected?: boolean;
}

// 1. FRONTEND: BROWSER WINDOW SYMBOL (Image 5 - Top-Left)
const FrontendBrowserSymbol: React.FC<SymbolProps> = ({ isHovered, isSelected }) => {
  const intensity = isSelected ? 0.65 : isHovered ? 0.48 : 0.30;
  return (
    <group position={[0, 0.094, 0]} rotation={[0, Math.PI / 4, 0]}>
      {/* Outer Browser Window Frame Border */}
      <mesh position={[0, 0, -0.30]} castShadow>
        <RoundedBox args={[0.96, 0.016, 0.040]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>
      <mesh position={[0, 0, 0.30]} castShadow>
        <RoundedBox args={[0.96, 0.016, 0.040]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>
      <mesh position={[-0.46, 0, 0]} castShadow>
        <RoundedBox args={[0.040, 0.016, 0.64]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>
      <mesh position={[0.46, 0, 0]} castShadow>
        <RoundedBox args={[0.040, 0.016, 0.64]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>

      {/* Horizontal Title Bar Divider Line */}
      <mesh position={[0, 0, -0.15]} castShadow>
        <RoundedBox args={[0.88, 0.016, 0.034]} radius={0.006} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>

      {/* 3 Title Bar Controls / Dots (o o o) */}
      <mesh position={[-0.34, 0.002, -0.225]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.018, 16]} />
        <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity * 1.2} roughness={0.15} />
      </mesh>
      <mesh position={[-0.27, 0.002, -0.225]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.018, 16]} />
        <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity * 1.2} roughness={0.15} />
      </mesh>
      <mesh position={[-0.20, 0.002, -0.225]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.018, 16]} />
        <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity * 1.2} roughness={0.15} />
      </mesh>

      {/* Window Body Layout: Left Card Panel */}
      <mesh position={[-0.20, 0, 0.07]} castShadow>
        <RoundedBox args={[0.32, 0.016, 0.26]} radius={0.035} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>
      <mesh position={[-0.20, 0.004, 0.07]}>
        <RoundedBox args={[0.22, 0.012, 0.16]} radius={0.02} smoothness={3}>
          <meshPhysicalMaterial color="#F7F5F0" roughness={0.25} />
        </RoundedBox>
      </mesh>

      {/* Window Body Layout: Right Content Wireframe Lines */}
      <mesh position={[0.20, 0, 0.01]} castShadow>
        <RoundedBox args={[0.32, 0.016, 0.038]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>
      <mesh position={[0.16, 0, 0.12]} castShadow>
        <RoundedBox args={[0.24, 0.016, 0.038]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>
    </group>
  );
};

// 2. API GATEWAY: ROUTING NETWORK SYMBOL (Image 5 - Top-Right)
const ApiGatewaySymbol: React.FC<SymbolProps> = ({ isHovered, isSelected }) => {
  const intensity = isSelected ? 0.65 : isHovered ? 0.48 : 0.30;
  return (
    <group position={[0, 0.094, 0]} rotation={[0, Math.PI / 4, 0]}>
      {/* Central Hub with Soft Rounded Bevel */}
      <mesh position={[0, 0, 0]} castShadow>
        <RoundedBox args={[0.36, 0.018, 0.36]} radius={0.06} smoothness={4}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>

      {/* 4 Diagonal Connection Rays Extending Outward at 45 Degrees */}
      <mesh position={[0.23, 0, 0.23]} rotation={[0, -Math.PI / 4, 0]} castShadow>
        <RoundedBox args={[0.045, 0.015, 0.26]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} />
        </RoundedBox>
      </mesh>
      <mesh position={[-0.23, 0, 0.23]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <RoundedBox args={[0.045, 0.015, 0.26]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} />
        </RoundedBox>
      </mesh>
      <mesh position={[-0.23, 0, -0.23]} rotation={[0, -Math.PI / 4, 0]} castShadow>
        <RoundedBox args={[0.045, 0.015, 0.26]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} />
        </RoundedBox>
      </mesh>
      <mesh position={[0.23, 0, -0.23]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <RoundedBox args={[0.045, 0.015, 0.26]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} />
        </RoundedBox>
      </mesh>

      {/* 4 Circular Corner Connection Nodes */}
      {[
        [0.38, 0.38],
        [-0.38, 0.38],
        [-0.38, -0.38],
        [0.38, -0.38],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.018, 24]} />
            <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
          </mesh>
          <mesh position={[0, 0.004, 0]}>
            <cylinderGeometry args={[0.038, 0.038, 0.014, 16]} />
            <meshPhysicalMaterial color="#F7F5F0" roughness={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// 3. BACKEND: DUAL SERVER RACK UNITS SYMBOL (Image 5 - Bottom-Left)
const BackendServerStackSymbol: React.FC<SymbolProps> = ({ isHovered, isSelected }) => {
  const intensity = isSelected ? 0.65 : isHovered ? 0.48 : 0.30;
  return (
    <group position={[0, 0.094, 0]} rotation={[0, Math.PI / 4, 0]}>
      {[-0.16, 0.16].map((zPos, idx) => (
        <group key={idx} position={[0, 0, zPos]}>
          {/* Main Rounded Server Chassis Unit */}
          <mesh castShadow>
            <RoundedBox args={[0.92, 0.018, 0.22]} radius={0.04} smoothness={4}>
              <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
            </RoundedBox>
          </mesh>

          {/* Left Status LED Indicator Dot */}
          <mesh position={[-0.35, 0.003, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.020, 16]} />
            <meshStandardMaterial
              color="#FFFFFF"
              emissive="#FFD8BF"
              emissiveIntensity={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* Drive Slit 1 (Upper Horizontal Bay Line) */}
          <mesh position={[0.08, 0.005, -0.045]}>
            <RoundedBox args={[0.54, 0.012, 0.034]} radius={0.008} smoothness={3}>
              <meshPhysicalMaterial color="#F7F5F0" roughness={0.25} />
            </RoundedBox>
          </mesh>

          {/* Drive Slit 2 (Lower Horizontal Bay Line) */}
          <mesh position={[0.08, 0.005, 0.045]}>
            <RoundedBox args={[0.54, 0.012, 0.034]} radius={0.008} smoothness={3}>
              <meshPhysicalMaterial color="#F7F5F0" roughness={0.25} />
            </RoundedBox>
          </mesh>
        </group>
      ))}
    </group>
  );
};

// 4. PATCHUP AI ENGINE: PROCESSOR DIE CHIP SYMBOL (Image 5 - Bottom-Right)
const AiEngineChipSymbol: React.FC<SymbolProps> = ({ isHovered, isSelected }) => {
  const intensity = isSelected ? 0.75 : isHovered ? 0.55 : 0.35;
  return (
    <group position={[0, 0.094, 0]} rotation={[0, Math.PI / 4, 0]}>
      {/* Central Chip Body */}
      <mesh castShadow>
        <RoundedBox args={[0.50, 0.018, 0.50]} radius={0.04} smoothness={4}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>

      {/* Central Recessed Inner Die */}
      <mesh position={[0, 0.004, 0]}>
        <RoundedBox args={[0.30, 0.016, 0.30]} radius={0.02} smoothness={3}>
          <meshPhysicalMaterial color="#FF7A24" emissive="#FF5500" emissiveIntensity={intensity * 1.25} roughness={0.12} clearcoat={1.0} />
        </RoundedBox>
      </mesh>

      {/* 8 Radiating Pins (2 on each edge) */}
      {/* Left Pins (-X) */}
      <mesh position={[-0.29, 0, -0.10]} castShadow>
        <RoundedBox args={[0.09, 0.014, 0.036]} radius={0.004} smoothness={2}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.18} />
        </RoundedBox>
      </mesh>
      <mesh position={[-0.29, 0, 0.10]} castShadow>
        <RoundedBox args={[0.09, 0.014, 0.036]} radius={0.004} smoothness={2}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.18} />
        </RoundedBox>
      </mesh>

      {/* Right Pins (+X) */}
      <mesh position={[0.29, 0, -0.10]} castShadow>
        <RoundedBox args={[0.09, 0.014, 0.036]} radius={0.004} smoothness={2}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.18} />
        </RoundedBox>
      </mesh>
      <mesh position={[0.29, 0, 0.10]} castShadow>
        <RoundedBox args={[0.09, 0.014, 0.036]} radius={0.004} smoothness={2}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.18} />
        </RoundedBox>
      </mesh>

      {/* Top Pins (-Z) */}
      <mesh position={[-0.10, 0, -0.29]} castShadow>
        <RoundedBox args={[0.036, 0.014, 0.09]} radius={0.004} smoothness={2}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.18} />
        </RoundedBox>
      </mesh>
      <mesh position={[0.10, 0, -0.29]} castShadow>
        <RoundedBox args={[0.036, 0.014, 0.09]} radius={0.004} smoothness={2}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.18} />
        </RoundedBox>
      </mesh>

      {/* Bottom Pins (+Z) */}
      <mesh position={[-0.10, 0, 0.29]} castShadow>
        <RoundedBox args={[0.036, 0.014, 0.09]} radius={0.004} smoothness={2}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.18} />
        </RoundedBox>
      </mesh>
      <mesh position={[0.10, 0, 0.29]} castShadow>
        <RoundedBox args={[0.036, 0.014, 0.09]} radius={0.004} smoothness={2}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.18} />
        </RoundedBox>
      </mesh>
    </group>
  );
};

// 5. GITHUB VCS & CI/CD SYMBOL (Git Commit Branching Graph)
const GitHubVcsSymbol: React.FC<SymbolProps> = ({ isHovered, isSelected }) => {
  const intensity = isSelected ? 0.65 : isHovered ? 0.48 : 0.30;
  return (
    <group position={[0, 0.094, 0]} rotation={[0, Math.PI / 4, 0]}>
      {/* Main Branch Trunk Line */}
      <mesh position={[-0.10, 0, 0]} castShadow>
        <RoundedBox args={[0.036, 0.016, 0.54]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} clearcoat={0.9} />
        </RoundedBox>
      </mesh>

      {/* Branching Diagonal Connection Line */}
      <mesh position={[0.02, 0, 0.01]} rotation={[0, -Math.PI / 4, 0]} castShadow>
        <RoundedBox args={[0.036, 0.016, 0.24]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} />
        </RoundedBox>
      </mesh>

      {/* Secondary Branch Line */}
      <mesh position={[0.14, 0, 0.08]} castShadow>
        <RoundedBox args={[0.036, 0.016, 0.20]} radius={0.008} smoothness={3}>
          <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity} roughness={0.16} />
        </RoundedBox>
      </mesh>

      {/* 3 Commit Node Discs */}
      <mesh position={[-0.10, 0.002, -0.20]} castShadow>
        <cylinderGeometry args={[0.052, 0.052, 0.020, 20]} />
        <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity * 1.2} roughness={0.15} />
      </mesh>
      <mesh position={[0.14, 0.002, 0.08]} castShadow>
        <cylinderGeometry args={[0.052, 0.052, 0.020, 20]} />
        <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity * 1.2} roughness={0.15} />
      </mesh>
      <mesh position={[-0.10, 0.002, 0.20]} castShadow>
        <cylinderGeometry args={[0.052, 0.052, 0.020, 20]} />
        <meshPhysicalMaterial color="#FF5500" emissive="#FF4400" emissiveIntensity={intensity * 1.2} roughness={0.15} />
      </mesh>

      {/* Inner Node Center Insets */}
      <mesh position={[-0.10, 0.008, -0.20]}>
        <cylinderGeometry args={[0.022, 0.022, 0.014, 16]} />
        <meshPhysicalMaterial color="#F7F5F0" roughness={0.25} />
      </mesh>
      <mesh position={[0.14, 0.008, 0.08]}>
        <cylinderGeometry args={[0.022, 0.022, 0.014, 16]} />
        <meshPhysicalMaterial color="#F7F5F0" roughness={0.25} />
      </mesh>
      <mesh position={[-0.10, 0.008, 0.20]}>
        <cylinderGeometry args={[0.022, 0.022, 0.014, 16]} />
        <meshPhysicalMaterial color="#F7F5F0" roughness={0.25} />
      </mesh>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────
// PRECISION ROUNDED PLATE GEOMETRY GENERATOR
// Generates perfectly beveled, horizontally rounded architectural platforms
// with rock-solid vertex normals and exact physical dimensions (no Drei bloat).
// ─────────────────────────────────────────────────────────────
function createRoundedPlateGeometry(
  width: number,
  depth: number,
  height: number,
  cornerRadius: number,
  bevel = 0.005
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const w = width / 2;
  const d = depth / 2;
  const r = Math.min(cornerRadius, w, d);

  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);

  const safeDepth = Math.max(0.001, height - (bevel * 2 > 0 ? bevel * 2 : 0));
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: safeDepth,
    bevelEnabled: bevel > 0,
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 20,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();
  geom.rotateX(Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

// ─────────────────────────────────────────────────────────────
// RELIABLE 2D CANVAS NUMERAL TEXTURE GENERATOR ("01", "02", "03", "04")
// 100% synchronous, zero network suspension, razor-sharp anti-aliased numerals
// ─────────────────────────────────────────────────────────────
function createLayerLabelTexture(numberStr: string, isOrange = false): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 256, 128);

  ctx.fillStyle = isOrange ? '#FF5500' : '#8C857E';
  ctx.font = '600 68px -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '8px';
  ctx.fillText(numberStr, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export const ArchitectureTower: React.FC<ArchitectureTowerProps> = ({
  hoveredServiceId,
  selectedServiceId,
  layerHealth = {},
  onHoverService,
  onSelectService,
}) => {
  const rootGroupRef = useRef<THREE.Group>(null);

  // Dynamic hardware beacon color derived from operational health
  const getHealthColor = (health: LayerHealthState = 'HEALTHY') => {
    switch (health) {
      case 'CRITICAL':
        return '#EF4444'; // Red
      case 'DEGRADED':
        return '#F59E0B'; // Amber
      case 'RECOVERING':
        return '#FF5500'; // Restrained pulsing orange
      case 'UNKNOWN':
        return '#999286'; // Neutral gray
      case 'HEALTHY':
      default:
        return '#10B981'; // Subtle emerald green
    }
  };

  // References for interactive hover/lift animation and architecture receding
  const crownRef = useRef<THREE.Group>(null);
  const ordersRef = useRef<THREE.Group>(null);
  const gatewayRef = useRef<THREE.Group>(null);
  const paymentsRef = useRef<THREE.Group>(null);
  const gitSepRef = useRef<THREE.Group>(null);
  const pedestalRef = useRef<THREE.Group>(null);
  const glassRef = useRef<THREE.Group>(null);
  const fadeRef = useRef<number>(0);

  // Pointer down position tracker to distinguish drags (orbiting) from clicks
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Generate crisp identification labels matching reference
  const layerLabels = useMemo(() => ({
    '00': createLayerLabelTexture('0 0', false),
    '01': createLayerLabelTexture('0 1', false),
    '02': createLayerLabelTexture('0 2', false),
    '03': createLayerLabelTexture('0 3', true), // Signature orange branding
    '04': createLayerLabelTexture('0 4', false),
  }), []);

  // Shared geometry singletons with SUBSTANTIAL PREMIUM THICKNESS (0.16)
  const chassisGeometry = useMemo(() => createRoundedPlateGeometry(2.04, 2.04, 0.16, 0.14, 0.012), []);
  const insetGeometry = useMemo(() => createRoundedPlateGeometry(1.76, 1.76, 0.012, 0.09, 0.003), []);
  // Luminous orange underglow collar (slightly broader than chassis to reveal radiant beveled lip)
  const glowRingGeometry = useMemo(() => createRoundedPlateGeometry(2.06, 2.06, 0.032, 0.14, 0.006), []);
  const glowCoreGeometry = useMemo(() => createRoundedPlateGeometry(1.92, 1.92, 0.038, 0.11, 0.006), []);
  const shadowGeometry = useMemo(() => createRoundedPlateGeometry(1.92, 1.92, 0.002, 0.12, 0), []);

  // Base Y positions for 5 floating platforms (uniform 0.42 vertical spacing)
  const LAYER_BASE_Y: Record<string, number> = {
    'ai-engine': 1.96,
    'gemini-brain': 1.96,
    'layer-ai-engine': 1.96,
    'backend-service': 1.54,
    'orders-service': 1.54,
    'payments-service': 1.54,
    'inventory-service': 1.54,
    'layer-backend': 1.54,
    'gateway-service': 1.12,
    'layer-gateway': 1.12,
    'frontend-service': 0.70,
    'layer-frontend': 0.70,
    'git-sep': 0.28,
    'github-service': 0.28,
    'layer-git-sep': 0.28,
  };

  // Horizontal extraction displacement (slides outward toward SCREEN-LEFT in isometric projection)
  // Screen-Left vector is (-1/√2, 0, 1/√2). Offset (-1.35, 1.35) slides directly across to viewer's left.
  const EXTRACTION_OFFSET = {
    x: -1.35,
    z: 1.35,
  };

  const isTierSelected = (layer: 'git' | 'frontend' | 'gateway' | 'backend' | 'ai') => {
    if (!selectedServiceId) return false;
    if (layer === 'git') return selectedServiceId === 'git-sep';
    if (layer === 'frontend') return selectedServiceId === 'frontend-service';
    if (layer === 'gateway') return selectedServiceId === 'gateway-service';
    if (layer === 'backend') return selectedServiceId === 'backend-service';
    if (layer === 'ai') return selectedServiceId === 'ai-engine';
    return false;
  };

  const isTierHovered = (layer: 'git' | 'frontend' | 'gateway' | 'backend' | 'ai') => {
    if (!hoveredServiceId || selectedServiceId) return false;
    if (layer === 'git') return hoveredServiceId === 'git-sep';
    if (layer === 'frontend') return hoveredServiceId === 'frontend-service';
    if (layer === 'gateway') return hoveredServiceId === 'gateway-service';
    if (layer === 'backend') return hoveredServiceId === 'backend-service';
    if (layer === 'ai') return hoveredServiceId === 'ai-engine';
    return false;
  };

  // Subtle floating breathing animation + PHYSICAL 3D LAYER EXTRACTION & ARCHITECTURE RECEDE
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    if (rootGroupRef.current) {
      rootGroupRef.current.position.y = -0.48 + Math.sin(t * 0.7) * 0.007;
    }

    // Helper to smoothly update group opacity without losing original material configurations
    const updateGroupOpacity = (
      group: THREE.Group | null,
      alpha: number,
      isVisible: boolean
    ) => {
      if (!group) return;
      group.visible = isVisible;
      if (!isVisible) return;

      group.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mat = child.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              if (m.userData.baseOpacity === undefined) {
                m.userData.baseOpacity = m.opacity !== undefined ? m.opacity : 1.0;
                m.userData.baseTransparent = m.transparent;
              }
              if (alpha < 0.999) {
                m.transparent = true;
                m.opacity = m.userData.baseOpacity * alpha;
              } else {
                m.transparent = m.userData.baseTransparent;
                m.opacity = m.userData.baseOpacity;
              }
            });
          } else {
            if (mat.userData.baseOpacity === undefined) {
              mat.userData.baseOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
              mat.userData.baseTransparent = mat.transparent;
            }
            if (alpha < 0.999) {
              mat.transparent = true;
              mat.opacity = mat.userData.baseOpacity * alpha;
            } else {
              mat.transparent = mat.userData.baseTransparent;
              mat.opacity = mat.userData.baseOpacity;
            }
          }
        }
      });
    };

    // Synchronous, responsive architecture fade factor
    const targetFade = selectedServiceId ? 1.0 : 0.0;
    fadeRef.current = THREE.MathUtils.damp(fadeRef.current, targetFade, 5.2, delta);
    if (Math.abs(fadeRef.current - targetFade) < 0.0005) fadeRef.current = targetFade;
    const fade = fadeRef.current;

    // stackAlpha drops smoothly and reaches 0 naturally around fade = 0.72
    // Zero abrupt pop: by the time isStackVisible becomes false, opacity is already 0.000
    const stackAlpha = Math.max(0, 1 - Math.min(1, Math.pow(fade, 0.9) * 1.38));
    const isStackVisible = stackAlpha > 0.002;

    // Glass dissolves even faster to immediately clear the way for extracting layer
    const glassAlpha = Math.max(0, 1 - Math.min(1, fade * 2.2));
    const isGlassVisible = glassAlpha > 0.002;

    // Pedestal recedes smoothly into the distance and dissolves
    if (pedestalRef.current) {
      pedestalRef.current.position.y = -fade * 0.55;
      pedestalRef.current.position.x = fade * 1.2;
      pedestalRef.current.position.z = -fade * 1.2;
      pedestalRef.current.scale.setScalar(Math.max(0.001, 1 - fade * 0.45));
      updateGroupOpacity(pedestalRef.current, stackAlpha, isStackVisible);
    }

    // Glass enclosure fades out rapidly and smoothly
    if (glassRef.current) {
      glassRef.current.position.y = 1.14 - fade * 0.4;
      glassRef.current.scale.setScalar(Math.max(0.001, 1 - fade * 0.3));
      updateGroupOpacity(glassRef.current, glassAlpha, isGlassVisible);
    }

    const animateLayer = (
      ref: React.RefObject<THREE.Group>,
      layerKey: 'git' | 'frontend' | 'gateway' | 'backend' | 'ai',
      baseY: number
    ) => {
      if (!ref.current) return;
      const isSelected = isTierSelected(layerKey);
      const isHovered = isTierHovered(layerKey);

      if (isSelected) {
        // Selected layer physically extracts toward SCREEN-LEFT
        const targetX = EXTRACTION_OFFSET.x;
        const targetZ = EXTRACTION_OFFSET.z;
        const targetY = baseY;

        const lambda = 5.2;
        const pos = ref.current.position;
        pos.x = THREE.MathUtils.damp(pos.x, targetX, lambda, delta);
        pos.y = THREE.MathUtils.damp(pos.y, targetY, lambda, delta);
        pos.z = THREE.MathUtils.damp(pos.z, targetZ, lambda, delta);

        ref.current.scale.setScalar(1.0);
        updateGroupOpacity(ref.current, 1.0, true);

        if (Math.abs(pos.x - targetX) < 0.0004) pos.x = targetX;
        if (Math.abs(pos.y - targetY) < 0.0004) pos.y = targetY;
        if (Math.abs(pos.z - targetZ) < 0.0004) pos.z = targetZ;
      } else {
        // Non-selected layers recede smoothly into depth (+X, -Z) and dissolve away early
        const recedeDist = fade * 1.6;
        const targetX = recedeDist * 0.8;
        const targetZ = -recedeDist * 0.8;
        const targetY = baseY + (isHovered ? 0.04 : 0) - fade * 0.35;

        const lambda = 5.2;
        const pos = ref.current.position;
        pos.x = THREE.MathUtils.damp(pos.x, targetX, lambda, delta);
        pos.y = THREE.MathUtils.damp(pos.y, targetY, lambda, delta);
        pos.z = THREE.MathUtils.damp(pos.z, targetZ, lambda, delta);

        ref.current.scale.setScalar(Math.max(0.001, 1 - fade * 0.45));
        updateGroupOpacity(ref.current, stackAlpha, isStackVisible);

        if (Math.abs(pos.x - targetX) < 0.0004) pos.x = targetX;
        if (Math.abs(pos.y - targetY) < 0.0004) pos.y = targetY;
        if (Math.abs(pos.z - targetZ) < 0.0004) pos.z = targetZ;
      }
    };

    animateLayer(crownRef, 'ai', LAYER_BASE_Y['ai-engine']);
    animateLayer(ordersRef, 'backend', LAYER_BASE_Y['backend-service']);
    animateLayer(gatewayRef, 'gateway', LAYER_BASE_Y['gateway-service']);
    animateLayer(paymentsRef, 'frontend', LAYER_BASE_Y['frontend-service']);
    animateLayer(gitSepRef, 'git', LAYER_BASE_Y['git-sep']);
  });

  const handlePointerDown = (e: any) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerOver = (e: any, id: string) => {
    e.stopPropagation();
    onHoverService(normalizeToTowerNode(id));
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    onHoverService(null);
    document.body.style.cursor = 'default';
  };

  const handleClick = (e: any, id: string) => {
    e.stopPropagation();
    if (pointerDownPos.current) {
      const dist = Math.hypot(
        e.clientX - pointerDownPos.current.x,
        e.clientY - pointerDownPos.current.y
      );
      if (dist > 6) return;
    }
    const nodeId = normalizeToTowerNode(id);
    if (nodeId) onSelectService(nodeId);
  };

  // Shared ceramic material specs
  const getCeramicMaterial = (isSelected: boolean, isHovered: boolean) => (
    <meshPhysicalMaterial
      color={isSelected || isHovered ? '#FFFFFF' : '#FAFAF8'}
      roughness={0.14}
      metalness={0.015}
      clearcoat={0.92}
      clearcoatRoughness={0.05}
      reflectivity={0.55}
    />
  );

  return (
    <group ref={rootGroupRef} position={[0, -0.48, 0]}>
      {/* ─────────────────────────────────────────────────────────
          1. CLEAN SQUARISH STEPPED ARCHITECTURAL PEDESTAL
             (Preserved solid ceramic white base & radiant orange spacer)
         ───────────────────────────────────────────────────────── */}
      <group ref={pedestalRef}>
        {/* Bottom Wide Ceramic White Foundation Slab */}
        <mesh position={[0, -0.14, 0]} receiveShadow>
          <RoundedBox args={[3.5, 0.10, 3.5]} radius={0.04} smoothness={6}>
            <meshPhysicalMaterial
              color="#FFFFFF"
              roughness={0.14}
              metalness={0.01}
              clearcoat={0.6}
              clearcoatRoughness={0.08}
            />
          </RoundedBox>
        </mesh>

        {/* Radiant Safety-Orange Glowing Stepped Spacer */}
        <mesh position={[0, -0.05, 0]}>
          <RoundedBox args={[3.05, 0.08, 3.05]} radius={0.035} smoothness={6}>
            <meshStandardMaterial
              color="#FF6810"
              emissive="#FF6810"
              emissiveIntensity={0.8}
              roughness={0.2}
            />
          </RoundedBox>
        </mesh>

        {/* Upper Ceramic White Display Platform */}
        <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
          <RoundedBox args={[2.65, 0.10, 2.65]} radius={0.035} smoothness={6}>
            <meshPhysicalMaterial
              color="#FFFFFF"
              roughness={0.10}
              metalness={0.01}
              clearcoat={0.95}
              clearcoatRoughness={0.04}
            />
          </RoundedBox>
        </mesh>

        {/* White Glass Collar Bezel Trim */}
        <mesh position={[0, 0.11, 0]}>
          <RoundedBox args={[2.30, 0.04, 2.30]} radius={0.015} smoothness={4}>
            <meshStandardMaterial color="#FFFFFF" roughness={0.2} />
          </RoundedBox>
        </mesh>
      </group>

      {/* ─────────────────────────────────────────────────────────
          2. PRECISION 3D ARCHITECTURAL PLATFORMS (5 FLOATING TIERS)
         ───────────────────────────────────────────────────────── */}

      {/* ── TIER 0: BASE — GIT SEP (Platform 00 — Microsoft & GitHub VCS) ── */}
      <group
        ref={gitSepRef}
        position={[0, 0.28, 0]}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => handlePointerOver(e, 'git-sep')}
        onPointerOut={handlePointerOut}
        onClick={(e) => handleClick(e, 'git-sep')}
      >
        {/* Soft Ambient Contact Shadow Underneath Platform */}
        <mesh geometry={shadowGeometry} position={[0, -0.082, 0]}>
          <meshBasicMaterial color="#302014" transparent opacity={0.16} depthWrite={false} />
        </mesh>

        {/* Main Precision Ceramic White Platform Chassis */}
        <mesh geometry={chassisGeometry} castShadow receiveShadow>
          {getCeramicMaterial(
            isTierSelected('git'),
            isTierHovered('git')
          )}
        </mesh>

        {/* Inset Top Porcelain Surface Panel */}
        <mesh geometry={insetGeometry} position={[0, 0.086, 0]}>
          <meshPhysicalMaterial color="#F6F4F0" roughness={0.22} metalness={0.01} />
        </mesh>

        {/* ── SEMANTIC SYMBOL: GIT COMMIT BRANCH GRAPH (IMAGE 5) ── */}
        <GitHubVcsSymbol
          isHovered={isTierHovered('git')}
          isSelected={isTierSelected('git')}
        />

        {/* Precision '00' Marking on Front Corner facing Camera */}
        {layerLabels['00'] && (
          <mesh
            position={[0.54, 0.094, 0.54]}
            rotation={[-Math.PI / 2, 0, Math.PI / 4]}
            renderOrder={25}
          >
            <planeGeometry args={[0.34, 0.17]} />
            <meshBasicMaterial
              map={layerLabels['00']}
              transparent
              opacity={0.88}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Front Center Dark Oval Optical Port */}
        <mesh position={[0, 0, 1.026]}>
          <RoundedBox args={[0.095, 0.026, 0.012]} radius={0.008} smoothness={4}>
            <meshStandardMaterial color="#22201D" roughness={0.35} />
          </RoundedBox>
        </mesh>

        {/* Front Micro-Pinhole Sensor Ports (··) */}
        <mesh position={[-0.32, 0, 1.026]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
          <meshStandardMaterial color="#322E28" roughness={0.3} />
        </mesh>
        <mesh position={[-0.25, 0, 1.026]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
          <meshStandardMaterial color="#322E28" roughness={0.3} />
        </mesh>

        {/* Dynamic Hardware Operational Health Beacon Port (Layer 00 Base Git Sep) */}
        <mesh position={[0.30, 0, 1.026]}>
          <RoundedBox args={[0.040, 0.020, 0.012]} radius={0.005} smoothness={3}>
            <meshStandardMaterial
              color={getHealthColor(layerHealth['git-sep'] || layerHealth['layer-git-sep'])}
              emissive={getHealthColor(layerHealth['git-sep'] || layerHealth['layer-git-sep'])}
              emissiveIntensity={0.8}
              roughness={0.2}
            />
          </RoundedBox>
        </mesh>

        {/* Right Edge Optical Sensor Port */}
        <mesh position={[1.026, 0, -0.12]}>
          <RoundedBox args={[0.012, 0.026, 0.08]} radius={0.006} smoothness={3}>
            <meshStandardMaterial color="#282522" roughness={0.35} />
          </RoundedBox>
        </mesh>
      </group>

      {/* ── TIER 1: FRONTEND (Platform 01 — Ceramic Slab) ─ */}
      <group
        ref={paymentsRef}
        position={[0, 0.70, 0]}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => handlePointerOver(e, 'frontend-service')}
        onPointerOut={handlePointerOut}
        onClick={(e) => handleClick(e, 'frontend-service')}
      >
        {/* Soft Ambient Contact Shadow Underneath Platform */}
        <mesh geometry={shadowGeometry} position={[0, -0.082, 0]}>
          <meshBasicMaterial color="#302014" transparent opacity={0.14} depthWrite={false} />
        </mesh>

        {/* Main Precision Ceramic White Platform Chassis (Thick Solid Module) */}
        <mesh geometry={chassisGeometry} castShadow receiveShadow>
          {getCeramicMaterial(
            isTierSelected('frontend'),
            isTierHovered('frontend')
          )}
        </mesh>

        {/* Inset Top Porcelain Surface Panel */}
        <mesh geometry={insetGeometry} position={[0, 0.086, 0]}>
          <meshPhysicalMaterial color="#F6F4F0" roughness={0.22} metalness={0.01} />
        </mesh>

        {/* ── SEMANTIC SYMBOL: FRONTEND BROWSER WINDOW (IMAGE 5) ── */}
        <FrontendBrowserSymbol
          isHovered={isTierHovered('frontend')}
          isSelected={isTierSelected('frontend')}
        />

        {/* Precision '01' Marking on Front Corner facing Camera */}
        {layerLabels['01'] && (
          <mesh
            position={[0.54, 0.094, 0.54]}
            rotation={[-Math.PI / 2, 0, Math.PI / 4]}
            renderOrder={25}
          >
            <planeGeometry args={[0.34, 0.17]} />
            <meshBasicMaterial
              map={layerLabels['01']}
              transparent
              opacity={0.88}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Front Center Dark Oval Optical Port */}
        <mesh position={[0, 0, 1.026]}>
          <RoundedBox args={[0.095, 0.026, 0.012]} radius={0.008} smoothness={4}>
            <meshStandardMaterial color="#22201D" roughness={0.35} />
          </RoundedBox>
        </mesh>

        {/* Front Micro-Pinhole Sensor Ports (··) */}
        <mesh position={[-0.32, 0, 1.026]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
          <meshStandardMaterial color="#322E28" roughness={0.3} />
        </mesh>
        <mesh position={[-0.25, 0, 1.026]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
          <meshStandardMaterial color="#322E28" roughness={0.3} />
        </mesh>

        {/* Dynamic Hardware Operational Health Beacon Port (Layer 01 Frontend) */}
        <mesh position={[0.30, 0, 1.026]}>
          <RoundedBox args={[0.040, 0.020, 0.012]} radius={0.005} smoothness={3}>
            <meshStandardMaterial
              color={getHealthColor(layerHealth['frontend-service'] || layerHealth['layer-frontend'])}
              emissive={getHealthColor(layerHealth['frontend-service'] || layerHealth['layer-frontend'])}
              emissiveIntensity={0.8}
              roughness={0.2}
            />
          </RoundedBox>
        </mesh>

        {/* Right Edge Optical Sensor Port */}
        <mesh position={[1.026, 0, -0.12]}>
          <RoundedBox args={[0.012, 0.026, 0.08]} radius={0.006} smoothness={3}>
            <meshStandardMaterial color="#282522" roughness={0.35} />
          </RoundedBox>
        </mesh>
      </group>

      {/* ── TIER 2: API GATEWAY (Platform 02 — Ceramic Slab) ── */}
      <group
        ref={gatewayRef}
        position={[0, 1.12, 0]}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => handlePointerOver(e, 'gateway-service')}
        onPointerOut={handlePointerOut}
        onClick={(e) => handleClick(e, 'gateway-service')}
      >
        {/* Soft Ambient Contact Shadow Underneath Platform */}
        <mesh geometry={shadowGeometry} position={[0, -0.082, 0]}>
          <meshBasicMaterial color="#302014" transparent opacity={0.14} depthWrite={false} />
        </mesh>

        {/* Main Precision Ceramic White Platform Chassis */}
        <mesh geometry={chassisGeometry} castShadow receiveShadow>
          {getCeramicMaterial(
            isTierSelected('gateway'),
            isTierHovered('gateway')
          )}
        </mesh>

        {/* Inset Top Porcelain Surface Panel */}
        <mesh geometry={insetGeometry} position={[0, 0.086, 0]}>
          <meshPhysicalMaterial color="#F6F4F0" roughness={0.22} metalness={0.01} />
        </mesh>

        {/* ── SEMANTIC SYMBOL: API GATEWAY ROUTING NETWORK (IMAGE 5) ── */}
        <ApiGatewaySymbol
          isHovered={isTierHovered('gateway')}
          isSelected={isTierSelected('gateway')}
        />

        {/* Crisp '02' Numeral on Front Corner */}
        {layerLabels['02'] && (
          <mesh
            position={[0.54, 0.094, 0.54]}
            rotation={[-Math.PI / 2, 0, Math.PI / 4]}
            renderOrder={25}
          >
            <planeGeometry args={[0.34, 0.17]} />
            <meshBasicMaterial
              map={layerLabels['02']}
              transparent
              opacity={0.88}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Front Center Dark Oval Optical Port */}
        <mesh position={[0, 0, 1.026]}>
          <RoundedBox args={[0.095, 0.026, 0.012]} radius={0.008} smoothness={4}>
            <meshStandardMaterial color="#201E1A" roughness={0.35} />
          </RoundedBox>
        </mesh>

        {/* Front Micro-Pinhole Sensor Ports (··) */}
        <mesh position={[-0.32, 0, 1.026]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
          <meshStandardMaterial color="#322E28" roughness={0.3} />
        </mesh>
        <mesh position={[-0.25, 0, 1.026]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
          <meshStandardMaterial color="#322E28" roughness={0.3} />
        </mesh>

        {/* Dynamic Hardware Operational Health Beacon Port */}
        <mesh position={[0.30, 0, 1.026]}>
          <RoundedBox args={[0.040, 0.020, 0.012]} radius={0.005} smoothness={3}>
            <meshStandardMaterial
              color={getHealthColor(layerHealth['gateway-service'] || layerHealth['layer-gateway'])}
              emissive={getHealthColor(layerHealth['gateway-service'] || layerHealth['layer-gateway'])}
              emissiveIntensity={0.8}
              roughness={0.2}
            />
          </RoundedBox>
        </mesh>

        {/* Right Edge Optical Sensor Plate */}
        <mesh position={[1.026, 0, 0.0]}>
          <RoundedBox args={[0.012, 0.026, 0.16]} radius={0.006} smoothness={3}>
            <meshStandardMaterial color="#3E3A34" roughness={0.35} />
          </RoundedBox>
        </mesh>
      </group>

      {/* ── TIER 3: BACKEND (Platform 03 — HERO SAFETY-ORANGE ACCENT & RADIANT UNDERGLOW) ── */}
      <group
        ref={ordersRef}
        position={[0, 1.54, 0]}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => handlePointerOver(e, 'backend-service')}
        onPointerOut={handlePointerOut}
        onClick={(e) => handleClick(e, 'backend-service')}
      >
        {/* Soft Ambient Contact Shadow Underneath Platform */}
        <mesh geometry={shadowGeometry} position={[0, -0.090, 0]}>
          <meshBasicMaterial color="#302014" transparent opacity={0.16} depthWrite={false} />
        </mesh>

        {/* Outer Radiant Safety-Orange Illuminated Underside Bezel Rim */}
        <mesh geometry={glowRingGeometry} position={[0, -0.078, 0]}>
          <meshStandardMaterial
            color="#FF5500"
            emissive="#FF5500"
            emissiveIntensity={
              isTierHovered('backend') || isTierSelected('backend') ? 1.45 : 1.15
            }
            roughness={0.15}
          />
        </mesh>

        {/* Deep Recessed Radiant Orange Core */}
        <mesh geometry={glowCoreGeometry} position={[0, -0.086, 0]}>
          <meshStandardMaterial
            color="#FF3A00"
            emissive="#FF3A00"
            emissiveIntensity={1.50}
            roughness={0.12}
          />
        </mesh>

        {/* Real Orange Light Spill onto Layer 2 Below */}
        <pointLight position={[0, -0.12, 0]} color="#FF6810" intensity={2.2} distance={0.80} decay={2} />

        {/* Main Precision Ceramic White Platform Chassis */}
        <mesh geometry={chassisGeometry} castShadow receiveShadow>
          {getCeramicMaterial(
            isTierSelected('backend'),
            isTierHovered('backend')
          )}
        </mesh>

        {/* Inset Top Porcelain Surface Panel */}
        <mesh geometry={insetGeometry} position={[0, 0.086, 0]}>
          <meshPhysicalMaterial color="#F8F6F2" roughness={0.22} metalness={0.01} />
        </mesh>

        {/* ── SEMANTIC SYMBOL: BACKEND DUAL SERVER RACKS (IMAGE 5) ── */}
        <BackendServerStackSymbol
          isHovered={isTierHovered('backend')}
          isSelected={isTierSelected('backend')}
        />

        {/* Prominent Front '03' Signature Branding in Vivid Orange */}
        {layerLabels['03'] && (
          <mesh
            position={[0.54, 0.094, 0.54]}
            rotation={[-Math.PI / 2, 0, Math.PI / 4]}
            renderOrder={25}
          >
            <planeGeometry args={[0.34, 0.17]} />
            <meshBasicMaterial
              map={layerLabels['03']}
              transparent
              opacity={0.96}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Front Center Dark Oval Optical Port */}
        <mesh position={[0, 0, 1.026]}>
          <RoundedBox args={[0.095, 0.026, 0.012]} radius={0.008} smoothness={4}>
            <meshStandardMaterial color="#201E1A" roughness={0.35} />
          </RoundedBox>
        </mesh>

        {/* Front Micro-Pinhole Sensor Ports (··) */}
        <mesh position={[-0.32, 0, 1.026]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
          <meshStandardMaterial color="#322E28" roughness={0.3} />
        </mesh>
        <mesh position={[-0.25, 0, 1.026]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
          <meshStandardMaterial color="#322E28" roughness={0.3} />
        </mesh>

        {/* Dynamic Hardware Operational Health Beacon Port (Layer 03 Backend) */}
        <mesh position={[0.32, 0, 1.026]}>
          <RoundedBox args={[0.040, 0.020, 0.012]} radius={0.005} smoothness={3}>
            <meshStandardMaterial
              color={getHealthColor(layerHealth['backend-service'] || layerHealth['layer-backend'])}
              emissive={getHealthColor(layerHealth['backend-service'] || layerHealth['layer-backend'])}
              emissiveIntensity={0.8}
              roughness={0.2}
            />
          </RoundedBox>
        </mesh>

        {/* Right Edge Inset Optical Vent */}
        <mesh position={[1.026, 0, 0.08]}>
          <RoundedBox args={[0.012, 0.024, 0.09]} radius={0.006} smoothness={3}>
            <meshStandardMaterial color="#22201C" roughness={0.35} />
          </RoundedBox>
        </mesh>
      </group>

      {/* ── TIER 4: PATCHUP AI ENGINE (Platform 04 — Processor Die Chip) ── */}
      <group
        ref={crownRef}
        position={[0, 1.96, 0]}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => handlePointerOver(e, 'ai-engine')}
        onPointerOut={handlePointerOut}
        onClick={(e) => handleClick(e, 'ai-engine')}
      >
        {/* Soft Ambient Contact Shadow Underneath Platform */}
        <mesh geometry={shadowGeometry} position={[0, -0.082, 0]}>
          <meshBasicMaterial color="#302014" transparent opacity={0.14} depthWrite={false} />
        </mesh>

        {/* Main Precision Ceramic White Platform Chassis */}
        <mesh geometry={chassisGeometry} castShadow receiveShadow>
          {getCeramicMaterial(
            isTierSelected('ai'),
            isTierHovered('ai')
          )}
        </mesh>

        {/* Inset Top Porcelain Surface Panel */}
        <mesh geometry={insetGeometry} position={[0, 0.086, 0]}>
          <meshPhysicalMaterial color="#F7F5F0" roughness={0.22} metalness={0.01} />
        </mesh>

        {/* Crisp '04' Numeral Marking on Front Corner facing Camera */}
        {layerLabels['04'] && (
          <mesh
            position={[0.58, 0.094, 0.58]}
            rotation={[-Math.PI / 2, 0, Math.PI / 4]}
            renderOrder={25}
          >
            <planeGeometry args={[0.34, 0.17]} />
            <meshBasicMaterial
              map={layerLabels['04']}
              transparent
              opacity={0.88}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* ── SEMANTIC SYMBOL: PATCHUP AI ENGINE PROCESSOR DIE CHIP (IMAGE 5) ── */}
        <AiEngineChipSymbol
          isHovered={isTierHovered('ai')}
          isSelected={isTierSelected('ai')}
        />

        {/* Front Center Dark Oval Optical Port */}
        <mesh position={[0, 0, 1.026]}>
          <RoundedBox args={[0.095, 0.026, 0.012]} radius={0.008} smoothness={4}>
            <meshStandardMaterial color="#201E1A" roughness={0.35} />
          </RoundedBox>
        </mesh>

        {/* Dynamic Hardware Operational Health Beacon Port (Layer 04 AI Engine) */}
        <mesh position={[0.30, 0, 1.026]}>
          <RoundedBox args={[0.040, 0.020, 0.012]} radius={0.005} smoothness={3}>
            <meshStandardMaterial
              color={getHealthColor(layerHealth['ai-engine'] || layerHealth['layer-ai-engine'])}
              emissive={getHealthColor(layerHealth['ai-engine'] || layerHealth['layer-ai-engine'])}
              emissiveIntensity={0.8}
              roughness={0.2}
            />
          </RoundedBox>
        </mesh>
      </group>

      {/* ─────────────────────────────────────────────────────────
          3. CRYSTAL-CLEAR ROUNDED GLASS ENCLOSURE
             (Clean, realistic PBR glass with subtle specular edge highlights)
         ───────────────────────────────────────────────────────── */}
      <group ref={glassRef} position={[0, 1.16, 0]}>
        <mesh renderOrder={100}>
          <RoundedBox args={[2.26, 2.28, 2.26]} radius={0.18} smoothness={8}>
            <meshPhysicalMaterial
              color="#FFFFFF"
              transparent
              opacity={0.24}
              roughness={0.04}
              metalness={0.02}
              clearcoat={1.0}
              clearcoatRoughness={0.06}
              reflectivity={0.82}
              depthWrite={false}
            />
          </RoundedBox>
        </mesh>
      </group>
    </group>
  );
};
