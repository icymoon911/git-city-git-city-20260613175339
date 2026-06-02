"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Bug Invasion Boss Preview ────────────────────────────────
//
// Reusable boss components for both the POC page and live preview
// in the actual city via ?boss=duck|asteroid404|cafetopia
//
// All bosses are designed to be rendered at world scale.
// Default scale of 1 is "POC-sized" (~20 units tall).
// For in-city preview, scale to ~10-15 (boss ~200-300 units tall).

export type BossVariant = "duck" | "cafetopia";
export type Phase = 1 | 2 | 3 | 4;

// ═══════════════════════════════════════════════════════════════
// MINI DUCKLING (orbiting companion, replaces bath bubbles)
// ═══════════════════════════════════════════════════════════════

function MiniDuckling() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.2, 0.7, 1]} />
        <meshStandardMaterial color="#ffd700" emissive="#cc9900" emissiveIntensity={0.2} flatShading />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.55, 0.2]}>
        <boxGeometry args={[0.7, 0.6, 0.7]} />
        <meshStandardMaterial color="#ffd700" emissive="#cc9900" emissiveIntensity={0.2} flatShading />
      </mesh>
      {/* Tiny beak */}
      <mesh position={[0, 0.55, 0.7]}>
        <boxGeometry args={[0.35, 0.2, 0.3]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff8800" emissiveIntensity={0.3} flatShading />
      </mesh>
      {/* Tail */}
      <mesh position={[0, 0.3, -0.65]}>
        <boxGeometry args={[0.5, 0.35, 0.3]} />
        <meshStandardMaterial color="#ffd700" emissive="#cc9900" emissiveIntensity={0.2} flatShading />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// VARIANT A — RUBBER DUCKPOCALYPSE
// ═══════════════════════════════════════════════════════════════

export function RubberDuckBoss({ phase }: { phase: Phase }) {
  const groupRef = useRef<THREE.Group>(null);
  const eyeMatLRef = useRef<THREE.MeshStandardMaterial>(null);
  const eyeMatRRef = useRef<THREE.MeshStandardMaterial>(null);
  const haloRef = useRef<THREE.Group>(null);
  const ducklingRefs = useRef<(THREE.Group | null)[]>([]);

  // Body stays bright yellow — corruption shows via emissive (red glow), accents, horns, cracks.
  const bodyYellow = "#ffd700";
  const bodyEmissive = phase === 1 ? "#cc9900" : phase === 2 ? "#aa5533" : phase === 3 ? "#aa2222" : "#cc0033";
  const bodyEmissiveI = phase === 1 ? 0.15 : phase === 2 ? 0.25 : phase === 3 ? 0.4 : 0.7;
  const bellyColor = phase === 4 ? "#882200" : "#cc9900";
  const beakOrange = phase === 4 ? "#ff2200" : "#ff8800";
  const eyeWhite = phase >= 3 ? "#ffaaaa" : "#ffffff";
  const eyePupil = phase === 1 ? "#000000" : "#ff0000";
  const showCracks = phase >= 2;
  const showVoid = phase >= 3;
  const showBrows = phase >= 3;
  const showDemon = phase === 4; // horns + fire crown

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.4;
      groupRef.current.rotation.y = Math.sin(t * 0.25) * 0.15;
      groupRef.current.rotation.z = Math.sin(t * 0.4) * 0.04;
    }
    const intensity = phase === 1 ? 0 : phase === 2 ? 1 : phase === 3 ? 1.6 : 2.5;
    if (eyeMatLRef.current) eyeMatLRef.current.emissiveIntensity = intensity + Math.sin(t * 6) * 0.4;
    if (eyeMatRRef.current) eyeMatRRef.current.emissiveIntensity = intensity + Math.sin(t * 6 + 0.5) * 0.4;
    if (haloRef.current) haloRef.current.rotation.y = t * 0.8;
    // Mini ducklings orbiting (replaces bubbles)
    ducklingRefs.current.forEach((g, i) => {
      if (!g) return;
      const angle = (i / 6) * Math.PI * 2 + t * 0.35;
      const radius = 12;
      g.position.x = Math.cos(angle) * radius;
      g.position.z = Math.sin(angle) * radius;
      g.position.y = Math.sin(t * 1.2 + i * 0.8) * 1.5 + 0.5;
      // Face the direction they're moving
      g.rotation.y = -angle + Math.PI / 2;
      // Subtle bob
      g.rotation.z = Math.sin(t * 2 + i) * 0.1;
    });
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[10, 6, 8]} />
        <meshStandardMaterial color={bodyYellow} emissive={bodyEmissive} emissiveIntensity={bodyEmissiveI} flatShading />
      </mesh>
      <mesh position={[0, 0, 4.5]}>
        <boxGeometry args={[8, 5, 3]} />
        <meshStandardMaterial color={bodyYellow} emissive={bodyEmissive} emissiveIntensity={bodyEmissiveI} flatShading />
      </mesh>
      <mesh position={[0, 1.5, -5]}>
        <boxGeometry args={[7, 5, 4]} />
        <meshStandardMaterial color={bodyYellow} emissive={bodyEmissive} emissiveIntensity={bodyEmissiveI} flatShading />
      </mesh>
      <mesh position={[0, 3, -7]}>
        <boxGeometry args={[4, 3, 2]} />
        <meshStandardMaterial color={bodyYellow} emissive={bodyEmissive} emissiveIntensity={bodyEmissiveI} flatShading />
      </mesh>
      <mesh position={[0, -2.8, 1]}>
        <boxGeometry args={[9, 1, 7]} />
        <meshStandardMaterial color={bellyColor} flatShading />
      </mesh>

      {/* Head */}
      <mesh position={[0, 4.5, 3]}>
        <boxGeometry args={[5, 4, 5]} />
        <meshStandardMaterial color={bodyYellow} emissive={bodyEmissive} emissiveIntensity={bodyEmissiveI} flatShading />
      </mesh>
      <mesh position={[0, 6.5, 3]}>
        <boxGeometry args={[4, 1.5, 4]} />
        <meshStandardMaterial color={bodyYellow} emissive={bodyEmissive} emissiveIntensity={bodyEmissiveI} flatShading />
      </mesh>

      {/* Beak */}
      <mesh position={[0, 4.5, 6.5]}>
        <boxGeometry args={[3, 1.6, 3]} />
        <meshStandardMaterial color={beakOrange} emissive={beakOrange} emissiveIntensity={0.3} flatShading />
      </mesh>
      <mesh position={[0, 3.8, 7.8]}>
        <boxGeometry args={[2.5, 0.4, 1]} />
        <meshStandardMaterial color={beakOrange} emissive={beakOrange} emissiveIntensity={0.3} flatShading />
      </mesh>
      {phase === 4 && (
        <>
          <mesh position={[0, 4.2, 7]}>
            <boxGeometry args={[2.4, 0.6, 0.6]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
          {[-1, -0.4, 0.4, 1].map((x, i) => (
            <mesh key={i} position={[x, 4.5, 7.4]}>
              <boxGeometry args={[0.3, 0.4, 0.3]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
          ))}
        </>
      )}

      {/* Eyes */}
      <mesh position={[-1.3, 5.8, 5.3]}>
        <boxGeometry args={[1.2, 1.4, 0.4]} />
        <meshStandardMaterial color={eyeWhite} emissive={eyeWhite} emissiveIntensity={0.2} flatShading />
      </mesh>
      <mesh position={[-1.3, 5.8, 5.55]}>
        <boxGeometry args={[0.6, 0.8, 0.2]} />
        <meshStandardMaterial
          ref={eyeMatLRef}
          color={eyePupil}
          emissive={eyePupil}
          emissiveIntensity={phase === 1 ? 0 : 1.5}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[1.3, 5.8, 5.3]}>
        <boxGeometry args={[1.2, 1.4, 0.4]} />
        <meshStandardMaterial color={eyeWhite} emissive={eyeWhite} emissiveIntensity={0.2} flatShading />
      </mesh>
      <mesh position={[1.3, 5.8, 5.55]}>
        <boxGeometry args={[0.6, 0.8, 0.2]} />
        <meshStandardMaterial
          ref={eyeMatRRef}
          color={eyePupil}
          emissive={eyePupil}
          emissiveIntensity={phase === 1 ? 0 : 1.5}
          toneMapped={false}
        />
      </mesh>

      {/* Wings */}
      <mesh position={[-5, 0, 0]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[1.5, 4, 5]} />
        <meshStandardMaterial color={bodyYellow} emissive={bodyEmissive} emissiveIntensity={bodyEmissiveI} flatShading />
      </mesh>
      <mesh position={[5, 0, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[1.5, 4, 5]} />
        <meshStandardMaterial color={bodyYellow} emissive={bodyEmissive} emissiveIntensity={bodyEmissiveI} flatShading />
      </mesh>

      {/* Angry eyebrows (phase 3+) - V-shape over eyes */}
      {showBrows && (
        <>
          {/* Left brow: tilted down-and-in */}
          <mesh position={[-1.3, 6.9, 5.5]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[1.6, 0.45, 0.5]} />
            <meshStandardMaterial color="#1a0a02" emissive="#330000" emissiveIntensity={0.4} flatShading />
          </mesh>
          {/* Right brow: mirror */}
          <mesh position={[1.3, 6.9, 5.5]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[1.6, 0.45, 0.5]} />
            <meshStandardMaterial color="#1a0a02" emissive="#330000" emissiveIntensity={0.4} flatShading />
          </mesh>
        </>
      )}

      {/* Cracks (wider, with bright red core inside the gap) */}
      {showCracks && (
        <>
          {[
            { pos: [-2.5, 1, 3.5] as [number, number, number], rot: 0.3, len: 3 },
            { pos: [2.8, -0.5, 3] as [number, number, number], rot: -0.5, len: 2.5 },
            { pos: [0, 2, -3] as [number, number, number], rot: 0.1, len: 3.5 },
            // extra cracks for phase 3+
            ...(phase >= 3
              ? [
                  { pos: [-4, -1, 1] as [number, number, number], rot: 0.6, len: 2.2 },
                  { pos: [3.5, 2.5, -1] as [number, number, number], rot: -0.2, len: 2.8 },
                ]
              : []),
          ].map((c, i) => (
            <group key={i} position={c.pos} rotation={[0, 0, c.rot]}>
              {/* Outer dark crack */}
              <mesh>
                <boxGeometry args={[0.4, c.len, 0.5]} />
                <meshStandardMaterial color="#0a0000" flatShading />
              </mesh>
              {/* Inner glowing red gap */}
              <mesh position={[0, 0, 0.05]}>
                <boxGeometry args={[0.2, c.len * 0.9, 0.3]} />
                <meshBasicMaterial color={phase >= 3 ? "#ff2244" : "#5a0011"} toneMapped={false} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* Void leak (purple glowing wounds, phase 3+) */}
      {showVoid && (
        <>
          {[[-3, 2, 3.5], [3, 1, 3.2], [0, -1, 4.5], [-2, 3, -2], [4, 0, -1]].map((p, i) => (
            <group key={i} position={p as [number, number, number]}>
              {/* Dark outer */}
              <mesh>
                <boxGeometry args={[1.5, 1.5, 1.5]} />
                <meshStandardMaterial color="#0a0014" flatShading />
              </mesh>
              {/* Bright inner glow */}
              <mesh>
                <boxGeometry args={[1.1, 1.1, 1.6]} />
                <meshBasicMaterial color="#ff00aa" toneMapped={false} transparent opacity={0.85} />
              </mesh>
            </group>
          ))}
          <pointLight position={[0, 1, 3]} color="#ff00aa" intensity={4} distance={22} />
        </>
      )}

      {/* DEMON FORM (phase 4): horns + fire crown */}
      {showDemon && (
        <>
          {/* Left horn (curving up and back) */}
          <group position={[-1.4, 7.5, 2.8]} rotation={[0.4, 0, -0.35]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.6, 1.2, 0.6]} />
              <meshStandardMaterial color="#0a0000" emissive="#330000" emissiveIntensity={0.3} flatShading />
            </mesh>
            <mesh position={[0, 1, -0.2]}>
              <boxGeometry args={[0.45, 1, 0.45]} />
              <meshStandardMaterial color="#0a0000" emissive="#440000" emissiveIntensity={0.4} flatShading />
            </mesh>
            <mesh position={[0, 1.8, -0.4]}>
              <boxGeometry args={[0.3, 0.7, 0.3]} />
              <meshStandardMaterial color="#0a0000" emissive="#660000" emissiveIntensity={0.5} flatShading />
            </mesh>
          </group>
          {/* Right horn (mirror) */}
          <group position={[1.4, 7.5, 2.8]} rotation={[0.4, 0, 0.35]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.6, 1.2, 0.6]} />
              <meshStandardMaterial color="#0a0000" emissive="#330000" emissiveIntensity={0.3} flatShading />
            </mesh>
            <mesh position={[0, 1, -0.2]}>
              <boxGeometry args={[0.45, 1, 0.45]} />
              <meshStandardMaterial color="#0a0000" emissive="#440000" emissiveIntensity={0.4} flatShading />
            </mesh>
            <mesh position={[0, 1.8, -0.4]}>
              <boxGeometry args={[0.3, 0.7, 0.3]} />
              <meshStandardMaterial color="#0a0000" emissive="#660000" emissiveIntensity={0.5} flatShading />
            </mesh>
          </group>

          {/* Fire crown — 10 flame slivers around the head, rotating slowly */}
          <group ref={haloRef} position={[0, 7.5, 3]}>
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = (i / 10) * Math.PI * 2;
              const r = 2.8;
              return (
                <group
                  key={i}
                  position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
                  rotation={[0, -angle, 0]}
                >
                  {/* Flame base (red) */}
                  <mesh position={[0, 0.4, 0]}>
                    <boxGeometry args={[0.35, 0.9, 0.35]} />
                    <meshBasicMaterial color="#cc0022" toneMapped={false} />
                  </mesh>
                  {/* Flame mid (orange) */}
                  <mesh position={[0, 1.1, 0]}>
                    <boxGeometry args={[0.25, 0.7, 0.25]} />
                    <meshBasicMaterial color="#ff5500" toneMapped={false} />
                  </mesh>
                  {/* Flame tip (yellow) */}
                  <mesh position={[0, 1.6, 0]}>
                    <boxGeometry args={[0.15, 0.5, 0.15]} />
                    <meshBasicMaterial color="#ffcc00" toneMapped={false} />
                  </mesh>
                </group>
              );
            })}
          </group>

          {/* Hellish point light from above */}
          <pointLight position={[0, 9, 3]} color="#ff0033" intensity={3} distance={18} />
        </>
      )}

      {/* Mini ducklings orbiting (replaces bubbles) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i} ref={(el) => { ducklingRefs.current[i] = el; }}>
          <MiniDuckling />
        </group>
      ))}

      {/* Glow */}
      <pointLight position={[0, 2, 5]} color={phase === 4 ? "#ff0088" : "#ffdd44"} intensity={2} distance={20} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// VARIANT B — CAFETOPIA (proper mug + coffee pours from tilted lip)
// ═══════════════════════════════════════════════════════════════

export function CafetopiaBoss({ phase }: { phase: Phase }) {
  const hoverRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const coffeeStreamRefs = useRef<(THREE.Mesh | null)[]>([]);
  const steamRefs = useRef<(THREE.Mesh | null)[]>([]);
  const dripRef = useRef<(THREE.Mesh | null)[]>([]);

  const mugWhite = phase === 4 ? "#e0c0c0" : "#f5f5f0";
  const mugShadow = phase === 4 ? "#a08080" : "#d0d0c8";
  const coffeeColor = phase === 1 ? "#3a1f0a" : phase === 2 ? "#2a1505" : phase === 3 ? "#1a0a02" : "#0a0301";
  const coffeeHL = phase === 4 ? "#3a0a0a" : "#6a4020";
  const tilt = phase === 1 ? 0.15 : phase === 2 ? 0.32 : phase === 3 ? 0.5 : 0.75;
  const showCracks = phase >= 3;

  const MUG_RADIUS = 6;
  const MUG_HEIGHT_TOP = 3.5;
  const MUG_HEIGHT_BOT = -3.5;

  // Mug tilts with HANDLE side UP (handle at +X), so -X side goes DOWN.
  // Rotation by +tilt around Z: handle (+X) rotates up, pour lip (-X) rotates down.
  // Local lip: (-MUG_RADIUS, MUG_HEIGHT_TOP, 0)
  // After rotation by +tilt:
  //   x' = -MUG_RADIUS*cos(tilt) - MUG_HEIGHT_TOP*sin(tilt)
  //   y' = -MUG_RADIUS*sin(tilt) + MUG_HEIGHT_TOP*cos(tilt)
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const lipX = -MUG_RADIUS * cosT - MUG_HEIGHT_TOP * sinT;
  const lipY = -MUG_RADIUS * sinT + MUG_HEIGHT_TOP * cosT;
  const mouthX = -MUG_HEIGHT_TOP * sinT;
  const mouthY = MUG_HEIGHT_TOP * cosT;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (hoverRef.current) {
      hoverRef.current.position.y = Math.sin(t * 0.35) * 0.5;
      hoverRef.current.rotation.y = Math.sin(t * 0.15) * 0.1;
    }
    if (tiltRef.current) {
      tiltRef.current.rotation.z = tilt + Math.sin(t * 0.4) * 0.03;
    }
    // Coffee waterfall: pours from tilted lip, falls straight down in world
    coffeeStreamRefs.current.forEach((m, i) => {
      if (!m) return;
      const speed = 7 + (i % 3);
      const totalDist = 50;
      const offset = ((t * speed) + i * 1.5) % totalDist;
      m.position.x = lipX + Math.sin(i * 1.7 + t * 0.5) * 0.3;
      m.position.y = lipY - 0.6 - offset;
      m.position.z = Math.cos(i * 0.7) * 0.3;
    });
    // Steam: rises straight from the mouth
    steamRefs.current.forEach((m, i) => {
      if (!m) return;
      const speed = 1.8;
      const totalDist = 10;
      const offset = ((t * speed) + i * 1.4) % totalDist;
      m.position.x = mouthX + Math.sin(t * 0.7 + i) * (0.4 + offset * 0.15);
      m.position.y = mouthY + 1 + offset;
      m.position.z = Math.cos(t * 0.6 + i * 0.8) * 0.4;
      const mat = m.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 0.65 - offset / totalDist);
      const s = 1 + offset * 0.15;
      m.scale.set(s, 1, s);
    });
    // Drips: close to lip, slow fall
    dripRef.current.forEach((m, i) => {
      if (!m) return;
      const speed = 2;
      const totalDist = 8;
      const offset = ((t * speed) + i * 2.5) % totalDist;
      m.position.x = lipX - 0.3 + Math.sin(i * 1.5) * 0.4;
      m.position.y = lipY - 0.6 - offset;
      m.position.z = Math.sin(i * 0.8) * 1.5;
    });
  });

  const renderRing = (y: number, radius: number, boxCount: number, boxH: number, boxW: number) => {
    return Array.from({ length: boxCount }).map((_, i) => {
      const angle = (i / boxCount) * Math.PI * 2;
      return (
        <mesh
          key={`${y}-${i}`}
          position={[Math.cos(angle) * radius, y, Math.sin(angle) * radius]}
          rotation={[0, -angle + Math.PI / 2, 0]}
        >
          <boxGeometry args={[boxW, boxH, 1.4]} />
          <meshStandardMaterial color={mugWhite} emissive={mugShadow} emissiveIntensity={0.15} flatShading />
        </mesh>
      );
    });
  };

  return (
    <group ref={hoverRef}>
      {/* Tilted mug (everything that tips together) */}
      <group ref={tiltRef}>
        {renderRing(MUG_HEIGHT_BOT + 0.7, MUG_RADIUS, 16, 1.4, 2.5)}
        {renderRing(MUG_HEIGHT_BOT + 2.1, MUG_RADIUS, 16, 1.4, 2.5)}
        {renderRing(0, MUG_RADIUS, 16, 1.4, 2.5)}
        {renderRing(MUG_HEIGHT_TOP - 2.1, MUG_RADIUS, 16, 1.4, 2.5)}
        {renderRing(MUG_HEIGHT_TOP - 0.7, MUG_RADIUS, 16, 1.4, 2.5)}

        {/* Top lip */}
        {Array.from({ length: 20 }).map((_, i) => {
          const angle = (i / 20) * Math.PI * 2;
          return (
            <mesh
              key={`lip-${i}`}
              position={[Math.cos(angle) * (MUG_RADIUS + 0.2), MUG_HEIGHT_TOP, Math.sin(angle) * (MUG_RADIUS + 0.2)]}
              rotation={[0, -angle + Math.PI / 2, 0]}
            >
              <boxGeometry args={[2.2, 0.6, 0.8]} />
              <meshStandardMaterial color={mugShadow} flatShading />
            </mesh>
          );
        })}

        {/* Bottom plate */}
        <mesh position={[0, MUG_HEIGHT_BOT - 0.4, 0]}>
          <boxGeometry args={[12, 0.8, 12]} />
          <meshStandardMaterial color={mugShadow} flatShading />
        </mesh>

        {/* Coffee surface */}
        <mesh position={[0, MUG_HEIGHT_TOP - 0.4, 0]}>
          <cylinderGeometry args={[MUG_RADIUS - 0.5, MUG_RADIUS - 0.5, 0.6, 16, 1]} />
          <meshStandardMaterial color={coffeeColor} emissive={coffeeHL} emissiveIntensity={0.4} flatShading />
        </mesh>
        <mesh position={[-2, MUG_HEIGHT_TOP - 0.05, 1]}>
          <boxGeometry args={[1.8, 0.1, 1]} />
          <meshStandardMaterial color={coffeeHL} emissive={coffeeHL} emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[1.5, MUG_HEIGHT_TOP - 0.05, -2]}>
          <boxGeometry args={[1.2, 0.1, 0.7]} />
          <meshStandardMaterial color={coffeeHL} emissive={coffeeHL} emissiveIntensity={0.7} />
        </mesh>

        {/* Handle (D-shape arc) */}
        {(() => {
          const segments = 7;
          const segs = [];
          for (let i = 0; i < segments; i++) {
            const t = (i / (segments - 1));
            const angle = -Math.PI / 2 + t * Math.PI;
            const localY = Math.sin(angle) * 3;
            const localX = MUG_RADIUS + 0.5 + Math.cos(angle) * 2.5;
            segs.push(
              <mesh
                key={`handle-${i}`}
                position={[localX, localY, 0]}
                rotation={[0, 0, angle + Math.PI / 2]}
              >
                <boxGeometry args={[1.5, 1.5, 2]} />
                <meshStandardMaterial color={mugWhite} emissive={mugShadow} emissiveIntensity={0.15} flatShading />
              </mesh>
            );
          }
          return segs;
        })()}

        {/* Cracks */}
        {showCracks && (
          <>
            <mesh position={[-3, 0.5, 5.8]} rotation={[0, 0, 0.4]}>
              <boxGeometry args={[0.25, 4, 0.4]} />
              <meshStandardMaterial color="#0a0202" emissive="#0a0202" />
            </mesh>
            <mesh position={[3, -1, 5.8]} rotation={[0, 0, -0.6]}>
              <boxGeometry args={[0.25, 3, 0.4]} />
              <meshStandardMaterial color="#0a0202" emissive="#0a0202" />
            </mesh>
            <mesh position={[-5, 1.5, 4]} rotation={[0, -0.5, 0.3]}>
              <boxGeometry args={[0.25, 3.5, 0.4]} />
              <meshStandardMaterial color="#0a0202" emissive="#0a0202" />
            </mesh>
          </>
        )}
      </group>

      {/* OUTSIDE tilt — pours/steam/drips fixed in world space */}

      {/* Coffee waterfall (lip → straight down) */}
      {Array.from({ length: 18 }).map((_, i) => (
        <mesh
          key={`stream-${i}`}
          ref={(el) => { coffeeStreamRefs.current[i] = el; }}
          position={[lipX, lipY, 0]}
        >
          <boxGeometry args={[1.6 + (i % 3) * 0.3, 1.6, 1.6]} />
          <meshStandardMaterial color={coffeeColor} emissive={coffeeColor} emissiveIntensity={0.3} flatShading />
        </mesh>
      ))}

      {/* Steam (mouth → straight up) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`steam-${i}`} ref={(el) => { steamRefs.current[i] = el; }} position={[mouthX, mouthY, 0]}>
          <boxGeometry args={[1.8 + (i % 3) * 0.5, 1.2, 1.8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} toneMapped={false} />
        </mesh>
      ))}

      {/* Drips (lip → slow fall close to mug) */}
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh
          key={`drip-${i}`}
          ref={(el) => { dripRef.current[i] = el; }}
          position={[lipX, lipY, 0]}
        >
          <boxGeometry args={[0.7, 0.9, 0.7]} />
          <meshStandardMaterial color={coffeeColor} emissive={coffeeColor} emissiveIntensity={0.3} flatShading />
        </mesh>
      ))}

      <pointLight position={[mouthX, mouthY, 0]} color={phase === 4 ? "#ff4400" : "#ffaa66"} intensity={2.5} distance={25} />
    </group>
  );
}


// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════

interface BossPreviewProps {
  variant: BossVariant;
  phase: Phase;
  position?: [number, number, number];
  scale?: number;
  rotationY?: number;
}

export default function BossPreview({
  variant,
  phase,
  position = [0, 0, 0],
  scale = 1,
  rotationY = 0,
}: BossPreviewProps) {
  return (
    <group position={position} scale={scale} rotation={[0, rotationY, 0]}>
      {variant === "duck" && <RubberDuckBoss phase={phase} />}
      {variant === "cafetopia" && <CafetopiaBoss phase={phase} />}
    </group>
  );
}
