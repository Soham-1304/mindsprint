import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { LayerHealthState } from "./types";

interface DataFlowCurvesProps {
  selectedServiceId: string | null;
  layerHealth?: Record<string, LayerHealthState>;
}

interface ArchitecturalPathway {
  id: string;
  sourceLayer: string;
  targetLayer: string;
  curve: THREE.CatmullRomCurve3;
}

export const DataFlowCurves: React.FC<DataFlowCurvesProps> = ({
  selectedServiceId,
  layerHealth = {},
}) => {
  const pulseGroupRef = useRef<THREE.Group>(null);
  const curvesGroupRef = useRef<THREE.Group>(null);
  const opacityRef = useRef<number>(1.0);

  const pathways: ArchitecturalPathway[] = useMemo(
    () => [
      {
        id: "flow-git-backend",
        sourceLayer: "layer-git-sep",
        targetLayer: "layer-backend",
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.02, -0.2, 0.92),
          new THREE.Vector3(-1.26, 0.22, 1.04),
          new THREE.Vector3(-1.24, 0.64, 0.98),
          new THREE.Vector3(-1.04, 1.06, 0.92),
        ]),
      },
      {
        id: "flow-frontend-gateway",
        sourceLayer: "layer-frontend",
        targetLayer: "layer-gateway",
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.08, 0.22, -0.92),
          new THREE.Vector3(-1.22, 0.43, -1.02),
          new THREE.Vector3(-1.18, 0.54, -0.98),
          new THREE.Vector3(-1.06, 0.64, -0.92),
        ]),
      },
      {
        id: "flow-gateway-backend",
        sourceLayer: "layer-gateway",
        targetLayer: "layer-backend",
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(1.02, 0.64, 0.92),
          new THREE.Vector3(1.18, 0.85, 1.04),
          new THREE.Vector3(1.16, 0.96, 0.98),
          new THREE.Vector3(1.02, 1.06, 0.92),
        ]),
      },
      {
        id: "flow-backend-ai",
        sourceLayer: "layer-backend",
        targetLayer: "layer-ai-engine",
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.96, 1.06, -0.96),
          new THREE.Vector3(1.12, 1.27, -1.06),
          new THREE.Vector3(1.08, 1.38, -1.02),
          new THREE.Vector3(0.94, 1.48, -0.94),
        ]),
      },
      {
        id: "flow-ai-loop",
        sourceLayer: "layer-ai-engine",
        targetLayer: "layer-frontend",
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.95, 1.48, 0.92),
          new THREE.Vector3(1.38, 0.95, 0.98),
          new THREE.Vector3(1.42, 0.52, 0.96),
          new THREE.Vector3(0.96, 0.22, 0.92),
        ]),
      },
    ],
    [],
  );

  const getPathColor = (path: ArchitecturalPathway) => {
    const srcHealth = layerHealth[path.sourceLayer] || "HEALTHY";
    const tgtHealth = layerHealth[path.targetLayer] || "HEALTHY";
    if (srcHealth === "CRITICAL" || tgtHealth === "CRITICAL") return "#EF4444";
    if (srcHealth === "DEGRADED" || tgtHealth === "DEGRADED") return "#F59E0B";
    if (srcHealth === "RECOVERING" || tgtHealth === "RECOVERING") return "#FF5500";
    return "#F28C55";
  };

  useFrame((state, delta) => {
    const isInspecting = Boolean(selectedServiceId);
    const targetOpacity = isInspecting ? 0.0 : 1.0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 5.0);

    if (curvesGroupRef.current) {
      curvesGroupRef.current.visible = opacityRef.current > 0.02;
    }

    if (pulseGroupRef.current && opacityRef.current > 0.02) {
      const time = state.clock.getElapsedTime();
      pulseGroupRef.current.children.forEach((child, index) => {
        const path = pathways[index % pathways.length];
        const loopDuration = 2.8;
        const progress = ((time * 0.42 + index * 0.35) % loopDuration) / loopDuration;
        const point = path.curve.getPointAt(progress);
        child.position.copy(point);
      });
    }
  });

  return (
    <group ref={curvesGroupRef}>
      {pathways.map((path) => {
        const pathColor = getPathColor(path);
        const isRecovering =
          layerHealth[path.sourceLayer] === "RECOVERING" ||
          layerHealth[path.targetLayer] === "RECOVERING";
        return (
          <mesh key={path.id}>
            <tubeGeometry args={[path.curve, 36, 0.013, 8, false]} />
            <meshBasicMaterial
              color={pathColor}
              transparent
              opacity={isRecovering ? 0.65 : 0.42}
            />
          </mesh>
        );
      })}

      <group ref={pulseGroupRef}>
        {pathways.map((path) => (
          <mesh key={`packet-${path.id}`}>
            <sphereGeometry args={[0.036, 12, 12]} />
            <meshBasicMaterial color={getPathColor(path)} />
          </mesh>
        ))}
      </group>
    </group>
  );
};
