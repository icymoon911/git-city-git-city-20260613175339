"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ActiveProjectile } from "@/lib/useFlyPresence";

// ─── Boss Minions (perf-optimized) ─────────────────────────────
//
// 80 ducklings flying around the city, rendered via 6 InstancedMesh
// (body, head, beak, tail, eyeL, eyeR). Each frame computes a single
// matrix per instance, per part. ~6 draw calls total instead of
// 80 × 8 = 640. Cracks dropped for perf — can revisit later.
//
// Client-side hit detection vs the existing PvP projectile stream.
// Server-side will move this into PartyKit with shared kills.

const MINION_COUNT = 80;
const MINION_SCALE = 8;
const FLIGHT_AREA_XZ = 4500;
const RESPAWN_MS = 5000;
const EXPLOSION_DURATION_MS = 600;
const HIT_RADIUS = 30;

type Band = "low" | "mid" | "high";
const BAND_Y: Record<Band, [number, number]> = {
  low: [380, 520],
  mid: [520, 700],
  high: [700, 880],
};
const BAND_SPEED: Record<Band, [number, number]> = {
  low: [80, 140],
  mid: [50, 100],
  high: [30, 70],
};

const PROJECTILE_SPEED = 1200;
const PROJECTILE_LIFE_S = 0.8;

interface Minion {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  alive: boolean;
  diedAt: number;
  yaw: number;
  bobPhase: number;
  band: Band;
}

interface Part {
  name: string;
  size: [number, number, number];
  offset: [number, number, number];
  color: string;
  emissive?: string;
  emissiveI?: number;
  basic?: boolean;
}

// Natural-unit duck anatomy; scaled by MINION_SCALE at render time.
const PARTS: Part[] = [
  { name: "body", size: [1.2, 0.7, 1.0], offset: [0, 0, 0], color: "#ffd700", emissive: "#cc9900", emissiveI: 0.3 },
  { name: "head", size: [0.7, 0.6, 0.7], offset: [0, 0.55, 0.25], color: "#ffd700", emissive: "#cc9900", emissiveI: 0.3 },
  { name: "beak", size: [0.35, 0.2, 0.3], offset: [0, 0.55, 0.7], color: "#ff8800", emissive: "#ff8800", emissiveI: 0.5 },
  { name: "tail", size: [0.5, 0.35, 0.3], offset: [0, 0.3, -0.65], color: "#ffd700", emissive: "#cc9900", emissiveI: 0.3 },
  { name: "eyeL", size: [0.14, 0.14, 0.1], offset: [-0.18, 0.62, 0.55], color: "#ff0033", basic: true },
  { name: "eyeR", size: [0.14, 0.14, 0.1], offset: [0.18, 0.62, 0.55], color: "#ff0033", basic: true },
];

function pickTargetInBand(band: Band): THREE.Vector3 {
  const [yMin, yMax] = BAND_Y[band];
  return new THREE.Vector3(
    (Math.random() - 0.5) * FLIGHT_AREA_XZ * 2,
    yMin + Math.random() * (yMax - yMin),
    (Math.random() - 0.5) * FLIGHT_AREA_XZ * 2,
  );
}

function pickBand(i: number): Band {
  const r = (i * 7919) % 100;
  if (r < 50) return "mid";
  if (r < 80) return "low";
  return "high";
}

function makeMinion(seedOffset = 0, band: Band = "mid"): Minion {
  const [speedMin, speedMax] = BAND_SPEED[band];
  return {
    pos: pickTargetInBand(band),
    target: pickTargetInBand(band),
    speed: speedMin + Math.random() * (speedMax - speedMin),
    alive: true,
    diedAt: 0,
    yaw: 0,
    bobPhase: Math.random() * Math.PI * 2 + seedOffset,
    band,
  };
}

interface Props {
  projectilesRef?: React.MutableRefObject<Map<string, ActiveProjectile>> | null;
  onKill?: (totalKills: number) => void;
}

const EXPLOSION_POOL_SIZE = 12;

interface ExplosionSlot {
  active: boolean;
  pos: THREE.Vector3;
  startedAt: number;
}

export default function BossMinions({ projectilesRef, onKill }: Props) {
  const minionsRef = useRef<Minion[] | null>(null);
  if (!minionsRef.current) {
    minionsRef.current = Array.from({ length: MINION_COUNT }, (_, i) =>
      makeMinion(i * 0.5, pickBand(i)),
    );
  }

  const killCountRef = useRef(0);
  const consumed = useRef<Set<string>>(new Set());
  const partRefs = useRef<(THREE.InstancedMesh | null)[]>(PARTS.map(() => null));

  // Explosion pool
  const explosionsRef = useRef<ExplosionSlot[] | null>(null);
  if (!explosionsRef.current) {
    explosionsRef.current = Array.from({ length: EXPLOSION_POOL_SIZE }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      startedAt: 0,
    }));
  }
  const explosionRefs = useRef<(THREE.Group | null)[]>(Array(EXPLOSION_POOL_SIZE).fill(null));

  function spawnExplosion(pos: THREE.Vector3) {
    const pool = explosionsRef.current!;
    const slot = pool.find((s) => !s.active);
    if (!slot) return;
    slot.active = true;
    slot.pos.copy(pos);
    slot.startedAt = Date.now();
  }

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const now = Date.now();
    const minions = minionsRef.current!;
    const projectiles = projectilesRef?.current;
    const dummy = new THREE.Object3D();

    if (consumed.current.size > 300) consumed.current.clear();

    for (let i = 0; i < minions.length; i++) {
      const m = minions[i];

      if (m.alive) {
        // Move toward target
        const dx = m.target.x - m.pos.x;
        const dy = m.target.y - m.pos.y;
        const dz = m.target.z - m.pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 40) {
          m.target = pickTargetInBand(m.band);
        } else {
          const inv = 1 / dist;
          m.pos.x += dx * inv * m.speed * delta;
          m.pos.y += dy * inv * m.speed * delta;
          m.pos.z += dz * inv * m.speed * delta;
          m.yaw = Math.atan2(dx, dz);
        }

        // Hit test
        if (projectiles) {
          projectiles.forEach((p, pid) => {
            if (consumed.current.has(pid)) return;
            const age = (now - p.bornAt) / 1000;
            if (age > PROJECTILE_LIFE_S) return;
            const ax = p.x + p.dirX * PROJECTILE_SPEED * age;
            const ay = p.y + p.dirY * PROJECTILE_SPEED * age;
            const az = p.z + p.dirZ * PROJECTILE_SPEED * age;
            const ex = ax - m.pos.x;
            const ey = ay - m.pos.y;
            const ez = az - m.pos.z;
            if (ex * ex + ey * ey + ez * ez < HIT_RADIUS * HIT_RADIUS) {
              m.alive = false;
              m.diedAt = now;
              consumed.current.add(pid);
              killCountRef.current += 1;
              onKill?.(killCountRef.current);
              spawnExplosion(m.pos);
            }
          });
        }
      } else if (now - m.diedAt > RESPAWN_MS) {
        // Respawn
        const fresh = makeMinion(i * 0.7, m.band);
        m.pos.copy(fresh.pos);
        m.target.copy(fresh.target);
        m.speed = fresh.speed;
        m.bobPhase = fresh.bobPhase;
        m.alive = true;
      }

      // Compute world transform for each part
      if (m.alive) {
        const worldX = m.pos.x;
        const worldY = m.pos.y + Math.sin(t * 2 + m.bobPhase) * 3;
        const worldZ = m.pos.z;
        const cosY = Math.cos(m.yaw);
        const sinY = Math.sin(m.yaw);
        const roll = Math.sin(t * 4 + m.bobPhase) * 0.12;

        for (let pi = 0; pi < PARTS.length; pi++) {
          const part = PARTS[pi];
          const ox = part.offset[0];
          const oy = part.offset[1];
          const oz = part.offset[2];
          // Local offset rotated by yaw
          const wx = worldX + (ox * cosY + oz * sinY) * MINION_SCALE;
          const wy = worldY + oy * MINION_SCALE;
          const wz = worldZ + (-ox * sinY + oz * cosY) * MINION_SCALE;

          dummy.position.set(wx, wy, wz);
          dummy.rotation.set(0, m.yaw, roll);
          dummy.scale.setScalar(MINION_SCALE);
          dummy.updateMatrix();
          partRefs.current[pi]?.setMatrixAt(i, dummy.matrix);
        }
      } else {
        // Hide: scale to 0
        dummy.position.set(0, -10000, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        for (let pi = 0; pi < PARTS.length; pi++) {
          partRefs.current[pi]?.setMatrixAt(i, dummy.matrix);
        }
      }
    }

    // Flag instance matrices for upload
    for (let pi = 0; pi < PARTS.length; pi++) {
      const ref = partRefs.current[pi];
      if (ref) ref.instanceMatrix.needsUpdate = true;
    }

    // Update explosion pool animations
    const pool = explosionsRef.current!;
    for (let i = 0; i < pool.length; i++) {
      const slot = pool[i];
      const group = explosionRefs.current[i];
      if (!group) continue;
      if (!slot.active) {
        group.visible = false;
        continue;
      }
      const age = now - slot.startedAt;
      if (age > EXPLOSION_DURATION_MS) {
        slot.active = false;
        group.visible = false;
        continue;
      }
      const k = age / EXPLOSION_DURATION_MS;
      group.visible = true;
      group.position.copy(slot.pos);
      group.scale.setScalar(1 + k * 4);
      // Fade children
      for (let ci = 0; ci < group.children.length; ci++) {
        const child = group.children[ci] as THREE.Mesh;
        const mat = child.material as THREE.MeshBasicMaterial;
        if (mat) mat.opacity = 1 - k;
      }
    }
  });

  return (
    <>
      {/* Duckling parts via InstancedMesh */}
      {PARTS.map((part, pi) => (
        <instancedMesh
          key={part.name}
          ref={(el) => {
            partRefs.current[pi] = el;
          }}
          args={[undefined, undefined, MINION_COUNT]}
          frustumCulled={false}
        >
          <boxGeometry args={part.size} />
          {part.basic ? (
            <meshBasicMaterial color={part.color} toneMapped={false} />
          ) : (
            <meshStandardMaterial
              color={part.color}
              emissive={part.emissive}
              emissiveIntensity={part.emissiveI}
              flatShading
            />
          )}
        </instancedMesh>
      ))}

      {/* Explosion pool (12 reusable bursts) */}
      {Array.from({ length: EXPLOSION_POOL_SIZE }).map((_, i) => (
        <group
          key={`explosion-${i}`}
          ref={(el) => {
            explosionRefs.current[i] = el;
          }}
          visible={false}
        >
          {Array.from({ length: 6 }).map((_, j) => {
            const angle = (j / 6) * Math.PI * 2;
            const r = 6 + (j % 3) * 2;
            const yOff = ((j * 7) % 6) - 2;
            const col =
              j % 3 === 0 ? "#ffd700" : j % 3 === 1 ? "#ff8800" : "#ff2244";
            return (
              <mesh key={j} position={[Math.cos(angle) * r, yOff, Math.sin(angle) * r]}>
                <boxGeometry args={[3, 3, 3]} />
                <meshBasicMaterial color={col} transparent opacity={1} toneMapped={false} />
              </mesh>
            );
          })}
        </group>
      ))}
    </>
  );
}
