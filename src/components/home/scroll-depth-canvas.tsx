"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import type { Group, Mesh } from "three";

function DepthScene({
  accent,
  progress,
}: {
  accent: string;
  progress: number;
}) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);

  const tRef = useRef(0);
  useFrame((_state, delta) => {
    tRef.current += delta;
    const t = tRef.current;
    if (group.current) {
      group.current.rotation.y = t * 0.12 + progress * Math.PI * 0.65;
      group.current.rotation.x = progress * 0.25;
      group.current.position.z = -1.4 + progress * 2.2;
      group.current.position.y = Math.sin(t * 0.45) * 0.1;
      group.current.scale.setScalar(0.85 + progress * 0.35);
    }
    if (ring.current) {
      ring.current.rotation.z = t * 0.22;
      ring.current.rotation.x = 0.55 + progress * 0.45;
    }
  });

  const cards = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const r = 1.4 + (i % 3) * 0.25;
        return {
          pos: [
            Math.cos(a) * r,
            Math.sin(a * 1.6) * 0.55,
            Math.sin(a) * r * 0.7 - 0.3,
          ] as [number, number, number],
        };
      }),
    [],
  );

  return (
    <>
      <color attach="background" args={["#00000000"]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[3, 2, 4]} intensity={1.1} color={accent} />
      <pointLight position={[-3, -1, 2]} intensity={0.4} color="#31D7F5" />
      <Stars radius={40} depth={24} count={900} factor={2.2} fade speed={0.35} />
      <group ref={group}>
        <mesh>
          <icosahedronGeometry args={[0.35, 1]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.5}
            metalness={0.55}
            roughness={0.28}
          />
        </mesh>
        <mesh ref={ring} rotation={[1.1, 0, 0]}>
          <torusGeometry args={[0.85, 0.012, 8, 64]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.45}
            transparent
            opacity={0.9}
          />
        </mesh>
        <mesh rotation={[0.4, 0.5, 0]}>
          <torusGeometry args={[1.15, 0.008, 8, 72]} />
          <meshStandardMaterial
            color="#31D7F5"
            emissive="#31D7F5"
            emissiveIntensity={0.35}
            transparent
            opacity={0.55}
          />
        </mesh>
        {cards.map((c, i) => (
          <Float key={i} speed={1 + i * 0.1} floatIntensity={0.35}>
            <mesh position={c.pos}>
              <planeGeometry args={[0.45, 0.65]} />
              <meshStandardMaterial
                color="#172033"
                emissive={accent}
                emissiveIntensity={0.12}
                metalness={0.35}
                roughness={0.45}
                transparent
                opacity={0.85}
              />
            </mesh>
          </Float>
        ))}
      </group>
    </>
  );
}

/** Lightweight R3F overlay for chapter depth — desktop cinematic only. */
export function ScrollDepthCanvas({
  accent,
  progress,
}: {
  accent: string;
  progress: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen">
      <Canvas
        dpr={[1, 1.25]}
        camera={{ position: [0, 0, 4.2], fov: 42 }}
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
        }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <DepthScene accent={accent} progress={progress} />
        </Suspense>
      </Canvas>
    </div>
  );
}
