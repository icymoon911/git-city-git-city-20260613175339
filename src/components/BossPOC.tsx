"use client";

import "@/lib/silenceThreeClockWarning";
import { useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import BossPreview, { type BossVariant, type Phase } from "./BossPreview";

// ─── Bug Invasion Boss POC — v3.1 ──────────────────────────────
//
// Standalone POC scene. For in-city preview, use ?boss=duck on /
//
// Route: /poc/boss

const PHASE_LABELS: Record<Phase, string> = {
  1: "Phase 1 — innocent",
  2: "Phase 2 — something's off",
  3: "Phase 3 — damaged",
  4: "Phase 4 — FULL DEMON",
};

const THEME = {
  bg: "#0a1428",
  fog: "#0a1428",
  ambient: "#4060b0",
  sun: "#7090d0",
  panelBg: "rgba(10, 20, 40, 0.92)",
  panelBorder: "rgba(120, 160, 220, 0.3)",
  text: "#e0e8ff",
  textDim: "#90a0c0",
  accent: "#c8e64a",
};

const PHASE_UI_COLORS: Record<Phase, string> = {
  1: "#7eea9a",
  2: "#ffcc44",
  3: "#ff7733",
  4: "#ff2244",
};

function BossScene({ variant, phase }: { variant: BossVariant; phase: Phase }) {
  const shakeRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!shakeRef.current) return;
    if (phase === 4) {
      shakeRef.current.position.x = Math.sin(state.clock.elapsedTime * 30) * 0.15;
      shakeRef.current.position.y = Math.cos(state.clock.elapsedTime * 27) * 0.15;
    } else {
      shakeRef.current.position.x = 0;
      shakeRef.current.position.y = 0;
    }
  });

  return (
    <group ref={shakeRef}>
      <BossPreview variant={variant} phase={phase} />

      {/* Faint city silhouette below */}
      <mesh position={[0, -22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[60, 32]} />
        <meshBasicMaterial color="#1a2540" transparent opacity={0.5} />
      </mesh>
      {Array.from({ length: 32 }).map((_, i) => {
        const angle = (i / 32) * Math.PI * 2;
        const r = 30 + Math.sin(i * 7.3) * 12;
        const h = 1.5 + Math.abs(Math.sin(i * 4.1)) * 5;
        return (
          <mesh key={i} position={[Math.cos(angle) * r, -22 + h / 2, Math.sin(angle) * r]}>
            <boxGeometry args={[1.5, h, 1.5]} />
            <meshStandardMaterial color="#2a3858" emissive="#3050a0" emissiveIntensity={0.15} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

const VARIANT_INFO: Record<BossVariant, { emoji: string; name: string; tagline: string; lore: string; preview: string }> = {
  duck: {
    emoji: "🦆",
    name: "RUBBER DUCKPOCALYPSE",
    tagline: "O debugger possuído.",
    lore: "Anos de devs jogando bugs nele em silêncio. Ele absorveu cada um. Voltou.",
    preview: "/?boss=duck",
  },
  cafetopia: {
    emoji: "☕",
    name: "CAFETOPIA",
    tagline: "Todo café que devs deveriam ter bebido.",
    lore: "10 milhões de cafés ignorados em mesas de dev. O universo conserva calor.",
    preview: "/?boss=cafetopia",
  },
};

export default function BossPOC() {
  const [variant, setVariant] = useState<BossVariant>("duck");
  const [phase, setPhase] = useState<Phase>(1);
  const [autoRotate, setAutoRotate] = useState(false);

  const info = VARIANT_INFO[variant];
  const cityPreviewUrl = `${info.preview}&bossPhase=${phase}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: THEME.bg,
        color: THEME.text,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${THEME.panelBorder}`,
          background: THEME.panelBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: THEME.accent }}>
            BUG INVASION · BOSS POC
          </div>
          <div style={{ fontSize: 12, color: THEME.textDim, marginTop: 2 }}>
            Compare aqui. Pra ver na cidade real ↓
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {(Object.keys(VARIANT_INFO) as BossVariant[]).map((v) => {
            const active = v === variant;
            const vi = VARIANT_INFO[v];
            return (
              <button
                key={v}
                onClick={() => setVariant(v)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 6,
                  border: `1px solid ${active ? THEME.accent : THEME.panelBorder}`,
                  background: active ? "rgba(200, 230, 74, 0.15)" : "transparent",
                  color: active ? THEME.accent : THEME.text,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 16 }}>{vi.emoji}</span>
                {vi.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Canvas camera={{ position: [0, 4, 42], fov: 45 }} style={{ background: THEME.bg }}>
            <fog attach="fog" args={[THEME.fog, 40, 120]} />
            <ambientLight color={THEME.ambient} intensity={0.6} />
            <directionalLight color={THEME.sun} intensity={1.2} position={[10, 20, 10]} />
            <directionalLight color="#a060ff" intensity={0.3} position={[-10, 5, -10]} />

            <Stars radius={100} depth={60} count={4000} factor={3} fade speed={0.3} />

            <BossScene variant={variant} phase={phase} />

            <OrbitControls
              enablePan={false}
              minDistance={15}
              maxDistance={90}
              target={[0, 4, 0]}
              autoRotate={autoRotate}
              autoRotateSpeed={0.6}
            />
          </Canvas>

          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              background: THEME.panelBg,
              border: `1px solid ${THEME.panelBorder}`,
              borderRadius: 8,
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              backdropFilter: "blur(6px)",
            }}
          >
            <div style={{ fontSize: 11, color: THEME.textDim, marginRight: 4 }}>CORRUPTION</div>
            {([1, 2, 3, 4] as Phase[]).map((p) => {
              const active = p === phase;
              const c = PHASE_UI_COLORS[p];
              return (
                <button
                  key={p}
                  onClick={() => setPhase(p)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    border: `2px solid ${active ? c : "transparent"}`,
                    background: active ? c : `${c}33`,
                    color: active ? "#000" : "#fff",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  title={PHASE_LABELS[p]}
                >
                  {p}
                </button>
              );
            })}

            <div style={{ width: 1, height: 24, background: THEME.panelBorder, margin: "0 6px" }} />

            <button
              onClick={() => setAutoRotate((a) => !a)}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: `1px solid ${autoRotate ? THEME.accent : THEME.panelBorder}`,
                background: autoRotate ? "rgba(200, 230, 74, 0.15)" : "transparent",
                color: autoRotate ? THEME.accent : THEME.text,
                fontFamily: "inherit",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {autoRotate ? "⏸ STOP" : "↻ ROTATE"}
            </button>
          </div>

          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: THEME.panelBg,
              border: `1px solid ${PHASE_UI_COLORS[phase]}`,
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 11,
              color: PHASE_UI_COLORS[phase],
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            {PHASE_LABELS[phase]}
          </div>
        </div>

        <div
          style={{
            width: 360,
            borderLeft: `1px solid ${THEME.panelBorder}`,
            background: THEME.panelBg,
            padding: 20,
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 11, color: THEME.textDim, letterSpacing: 1 }}>VARIANT</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: PHASE_UI_COLORS[phase], display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 26 }}>{info.emoji}</span>
            {info.name}
          </div>
          <div style={{ fontSize: 13, color: THEME.text, marginTop: 6, lineHeight: 1.5 }}>
            {info.tagline}
          </div>
          <div
            style={{
              fontSize: 12,
              color: THEME.textDim,
              marginTop: 12,
              padding: "10px 12px",
              background: "rgba(120, 160, 220, 0.08)",
              borderRadius: 4,
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            "{info.lore}"
          </div>

          {/* In-city preview link */}
          <a
            href={cityPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              marginTop: 24,
              padding: "14px 16px",
              background: "rgba(200, 230, 74, 0.15)",
              border: `1px solid ${THEME.accent}`,
              borderRadius: 8,
              color: THEME.accent,
              textDecoration: "none",
              textAlign: "center",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            ↗ VER NA CIDADE REAL
          </a>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: THEME.textDim,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Abre <code style={{ color: THEME.accent }}>{cityPreviewUrl}</code> com lighting, sky, prédios reais
          </div>

          <div
            style={{
              marginTop: 24,
              padding: "10px 12px",
              fontSize: 11,
              color: THEME.textDim,
              borderTop: `1px dashed ${THEME.panelBorder}`,
              paddingTop: 14,
              lineHeight: 1.6,
            }}
          >
            💡 Aqui é só comparação rápida. Pra avaliar de verdade, abre o link acima e olha no contexto.
          </div>
        </div>
      </div>
    </div>
  );
}
