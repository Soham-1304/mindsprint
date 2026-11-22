import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ArchitectureTower } from "./ArchitectureTower";
import { DataFlowCurves } from "./DataFlowCurves";
import type { LayerHealthState, TowerNodeId } from "./types";

interface ArchitectureSceneProps {
  hoveredServiceId: TowerNodeId | null;
  selectedServiceId: TowerNodeId | null;
  layerHealth: Record<string, LayerHealthState>;
  onHoverService: (nodeId: TowerNodeId | null) => void;
  onSelectService: (nodeId: TowerNodeId) => void;
}

const OVERVIEW_CAMERA_POS = new THREE.Vector3(9.2, 5.5, 9.2);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0.6, 0);

const LAYER_BASE_Y: Record<TowerNodeId, number> = {
  "git-sep": 0.28,
  "frontend-service": 0.7,
  "gateway-service": 1.12,
  "backend-service": 1.54,
  "ai-engine": 1.96,
};

// Extracted chip sits at (-1.35, y, +1.35); targeting (-0.45, y, +0.45) frames it cleanly in the left half opposite the right popup
const DEDICATED_TARGET_OFFSET = new THREE.Vector3(-0.45, 0, 0.45);
const DEDICATED_CAMERA_OFFSET = new THREE.Vector3(6.2, 3.8, 6.2);

const CameraController: React.FC<{
  selectedServiceId: TowerNodeId | null;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}> = ({ selectedServiceId, controlsRef }) => {
  const { camera } = useThree();
  const transitionRef = useRef({
    isAnimating: false,
    startTime: 0,
    duration: 900,
    startPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
  });

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!controlsRef.current) return;
    const targetPos = new THREE.Vector3();
    const targetTarget = new THREE.Vector3();

    if (selectedServiceId && LAYER_BASE_Y[selectedServiceId] !== undefined) {
      const worldY = -0.48 + LAYER_BASE_Y[selectedServiceId];
      targetTarget.set(
        DEDICATED_TARGET_OFFSET.x,
        worldY + DEDICATED_TARGET_OFFSET.y,
        DEDICATED_TARGET_OFFSET.z,
      );
      targetPos.copy(targetTarget).add(DEDICATED_CAMERA_OFFSET);
    } else {
      targetTarget.copy(OVERVIEW_TARGET);
      targetPos.copy(OVERVIEW_CAMERA_POS);
    }

    if (prefersReducedMotion) {
      camera.position.copy(targetPos);
      controlsRef.current.target.copy(targetTarget);
      controlsRef.current.update();
      return;
    }

    transitionRef.current = {
      isAnimating: true,
      startTime: performance.now(),
      duration: 900,
      startPos: camera.position.clone(),
      startTarget: controlsRef.current.target.clone(),
      endPos: targetPos,
      endTarget: targetTarget,
    };
  }, [selectedServiceId, camera, controlsRef, prefersReducedMotion]);

  useFrame(() => {
    const tr = transitionRef.current;
    if (!tr.isAnimating || !controlsRef.current) return;
    const progress = Math.min(1, (performance.now() - tr.startTime) / tr.duration);
    const ease = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(tr.startPos, tr.endPos, ease);
    controlsRef.current.target.lerpVectors(tr.startTarget, tr.endTarget, ease);
    controlsRef.current.update();
    if (progress >= 1) tr.isAnimating = false;
  });

  return null;
};

const ShadowMapConfig: React.FC = () => {
  const { gl } = useThree();
  useEffect(() => {
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl]);
  return null;
};

export const ArchitectureScene: React.FC<ArchitectureSceneProps> = ({
  hoveredServiceId,
  selectedServiceId,
  layerHealth,
  onHoverService,
  onSelectService,
}) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#FAF8F5" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.14,
          antialias: true,
        }}
        camera={{
          position: [OVERVIEW_CAMERA_POS.x, OVERVIEW_CAMERA_POS.y, OVERVIEW_CAMERA_POS.z],
          fov: 22,
          near: 0.1,
          far: 50,
        }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <ShadowMapConfig />
        <ambientLight color="#FFF8F2" intensity={1.5} />
        <directionalLight
          position={[8, 14, 6]}
          intensity={2.3}
          color="#FFFFFF"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={25}
          shadow-camera-left={-3.5}
          shadow-camera-right={3.5}
          shadow-camera-top={3.5}
          shadow-camera-bottom={-3.5}
          shadow-bias={-0.00015}
        />
        <directionalLight position={[-6, 7, 4]} intensity={0.9} color="#FFF5EE" />
        <directionalLight position={[2, 7, -7]} intensity={0.8} color="#FFEFE4" />
        <directionalLight position={[0, -3, 2]} intensity={0.25} color="#FFF8F2" />

        <DataFlowCurves selectedServiceId={selectedServiceId} layerHealth={layerHealth} />

        <ArchitectureTower
          hoveredServiceId={hoveredServiceId}
          selectedServiceId={selectedServiceId}
          layerHealth={layerHealth}
          onHoverService={onHoverService}
          onSelectService={onSelectService}
        />

        <CameraController selectedServiceId={selectedServiceId} controlsRef={controlsRef} />

        <ContactShadows
          position={[0, -0.672, 0]}
          opacity={0.3}
          scale={7.5}
          blur={2.4}
          far={2.0}
          color="#3A2C21"
        />

        <gridHelper args={[44, 22, "#E9B590", "#F3D4BF"]} position={[0, -0.675, 0]} />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          enableZoom={false}
          minDistance={3.2}
          maxDistance={15}
          maxPolarAngle={Math.PI / 2 - 0.08}
          minPolarAngle={Math.PI / 6}
          target={[OVERVIEW_TARGET.x, OVERVIEW_TARGET.y, OVERVIEW_TARGET.z]}
        />
      </Canvas>
    </div>
  );
};
