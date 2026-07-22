"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { usePerformanceStore } from "@/stores/performance-store";

function OrbitalLogo() {
  const group = useRef<Group>(null);
  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.12;
    }
  });
  return (
    <group ref={group} position={[1.8, 0.4, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial
          color="#7867FF"
          emissive="#7867FF"
          emissiveIntensity={0.45}
          metalness={0.55}
          roughness={0.3}
        />
      </mesh>
      <Ring radius={0.9} speed={0.18} color="#A79CFF" />
      <Ring radius={1.2} speed={-0.1} color="#31D7F5" tilt={0.5} />
    </group>
  );
}

function Ring({
  radius,
  speed,
  color,
  tilt = 0.3,
}: {
  radius: number;
  speed: number;
  color: string;
  tilt?: number;
}) {
  const ref = useRef<Mesh>(null);
  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2 + tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.012, 8, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.45}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

/** Background-only 3D orbits for cinematic mode (no UI chrome). */
export function HeroOrbits() {
  const effective = usePerformanceStore((s) => s.effective);
  const webgl = usePerformanceStore((s) => s.webglSupported);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestIdleCallback
      ? requestIdleCallback(() => setReady(true), { timeout: 2000 })
      : window.setTimeout(() => setReady(true), 600);
    return () => {
      if (typeof id === "number") cancelAnimationFrame(id);
      else clearTimeout(id);
    };
  }, []);

  if (effective === "performance" || !webgl || !ready) return null;

  return (
    <div className="absolute inset-0 -z-0">
      <Canvas
        dpr={[1, 1.25]}
        camera={{ position: [0, 0, 5], fov: 42 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.25} />
          <pointLight position={[3, 3, 3]} intensity={0.9} color="#A79CFF" />
          <Stars radius={30} depth={20} count={800} factor={2.5} fade speed={0.4} />
          <OrbitalLogo />
        </Suspense>
      </Canvas>
    </div>
  );
}
