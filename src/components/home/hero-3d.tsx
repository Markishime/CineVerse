"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import type { Group, Mesh } from "three";
import type { Content } from "@/types/content";
import { HeroStatic } from "./hero-static";
import { usePerformanceStore } from "@/stores/performance-store";

function OrbitalLogo() {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.15;
  });
  return (
    <group ref={group} position={[0, 0.2, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color="#7867FF"
          emissive="#7867FF"
          emissiveIntensity={0.4}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>
      <Ring radius={1.2} speed={0.2} color="#A79CFF" />
      <Ring radius={1.55} speed={-0.12} color="#31D7F5" tilt={0.6} />
      <Ring radius={1.9} speed={0.08} color="#FF5B98" tilt={-0.4} />
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
  useFrame((state) => {
    if (ref.current) ref.current.rotation.z = state.clock.elapsedTime * speed;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2 + tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.015, 8, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function FloatingPosters({ posters }: { posters: string[] }) {
  const positions = useMemo(
    () =>
      posters.slice(0, 6).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return [
          Math.cos(a) * 2.8,
          Math.sin(a * 1.3) * 0.8,
          Math.sin(a) * 2.2 - 0.5,
        ] as [number, number, number];
      }),
    [posters],
  );

  return (
    <>
      {positions.map((pos, i) => (
        <Float key={i} speed={1 + i * 0.1} floatIntensity={0.4} rotationIntensity={0.2}>
          <mesh position={pos}>
            <planeGeometry args={[0.7, 1.05]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#172033" : "#111827"}
              emissive={i % 3 === 0 ? "#7867FF" : "#31D7F5"}
              emissiveIntensity={0.15}
              metalness={0.3}
              roughness={0.5}
            />
          </mesh>
        </Float>
      ))}
    </>
  );
}

function Scene({ posters }: { posters: string[] }) {
  return (
    <>
      <color attach="background" args={["#05060A"]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 4, 4]} intensity={1.2} color="#A79CFF" />
      <pointLight position={[-3, -2, 2]} intensity={0.6} color="#31D7F5" />
      <Stars radius={40} depth={30} count={1200} factor={3} fade speed={0.5} />
      <OrbitalLogo />
      <FloatingPosters posters={posters} />
      <mesh position={[0, 0, -4]}>
        <sphereGeometry args={[6, 32, 32]} />
        <meshBasicMaterial color="#7867FF" transparent opacity={0.04} />
      </mesh>
    </>
  );
}

export function Hero3D({
  featured,
  posters = [],
}: {
  featured: Content | null;
  posters?: string[];
}) {
  const effective = usePerformanceStore((s) => s.effective);
  const webglSupported = usePerformanceStore((s) => s.webglSupported);

  if (effective === "performance" || !webglSupported) {
    return <HeroStatic featured={featured} />;
  }

  const dpr: [number, number] =
    effective === "cinematic" ? [1, 1.5] : [1, 1.25];

  return (
    <section className="relative min-h-[88dvh]">
      <div className="absolute inset-0">
        <Canvas
          dpr={dpr}
          camera={{ position: [0, 0, 5.5], fov: 45 }}
          gl={{ antialias: effective === "cinematic", powerPreference: "high-performance" }}
          style={{ width: "100%", height: "100%" }}
        >
          <Suspense fallback={null}>
            <Scene posters={posters} />
          </Suspense>
        </Canvas>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-[var(--background)]/40" />
      <div className="relative z-10">
        <HeroStatic featured={featured} />
      </div>
    </section>
  );
}
