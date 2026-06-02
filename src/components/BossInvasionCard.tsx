"use client";

import { useBossEvent } from "@/lib/bossEventStore";

// ─── Boss Invasion Card ────────────────────────────────────────
//
// Replaces the ROAD TO 100K banner during a live event.
// Visual hierarchy goals:
//   • Container blends with neighbours (border-border, not accent-bordered)
//   • Brand "BUG INVASION" + HP fill carry the theme accent
//   • Phase indicator stays DIM at phase 1, escalates as corruption rises
//   • Primary CTA mirrors the FLY button: solid accent bg, dark text,
//     chunky theme.shadow offset (btn-press)

const PHASE_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "PHASE 1 · NOMINAL",
  2: "PHASE 2 · WARNING",
  3: "PHASE 3 · CRITICAL",
  4: "PHASE 4 · ENRAGE",
};

interface Props {
  onJoin: () => void;
  accentColor?: string;
  shadowColor?: string;
  participants?: number;
}

export default function BossInvasionCard({
  onJoin,
  accentColor = "#f0c060",
  shadowColor = "#806020",
  participants = 0,
}: Props) {
  const hp = useBossEvent((s) => s.hp);
  const maxHp = useBossEvent((s) => s.maxHp);
  const phase = useBossEvent((s) => s.phase);

  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));

  // HP fill color: theme accent when safe, semantic when danger
  const fillColor =
    phase === 1 ? accentColor :
    phase === 2 ? "#d4cfc4" :
    phase === 3 ? "#ff7733" :
    "#ff2244";

  // Phase indicator: dim at nominal, escalates with corruption
  const phaseIndicatorColor =
    phase === 1 ? "rgba(232, 220, 200, 0.35)" :
    phase === 2 ? "#d4cfc4" :
    phase === 3 ? "#ff7733" :
    "#ff2244";

  return (
    <div className="pointer-events-auto w-full max-w-sm">
      <div className="border-2 border-border bg-bg/80 px-4 py-3 backdrop-blur-sm font-pixel uppercase">
        {/* Header row */}
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[9px] tracking-wider" style={{ color: accentColor }}>
            BUG INVASION · LIVE
          </span>
          <span className="text-[9px] tracking-wider" style={{ color: phaseIndicatorColor }}>
            {PHASE_LABEL[phase]}
          </span>
        </div>

        {/* HP bar */}
        <div className="relative h-2.5 w-full overflow-hidden border-2 border-border bg-bg">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-150"
            style={{
              width: `${hpPct}%`,
              backgroundColor: fillColor,
              boxShadow: `0 0 8px ${fillColor}66`,
            }}
          />
        </div>

        {/* HP numeric + social proof */}
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[10px] text-cream">
            {Math.ceil(hp).toLocaleString()}
            <span className="text-cream/40"> / {maxHp.toLocaleString()}</span>
          </span>
          <span className="text-[8px] text-cream/40 normal-case">
            {participants > 0 ? `${participants} dev${participants === 1 ? "" : "s"} fighting` : "be the first in"}
          </span>
        </div>

        {/* Primary CTA — mirrors the FLY button (solid accent, dark text) */}
        <button
          type="button"
          onClick={onJoin}
          className="btn-press mt-3 w-full px-4 py-2 text-[11px] tracking-widest text-bg"
          style={{
            backgroundColor: accentColor,
            boxShadow: `4px 4px 0 0 ${shadowColor}`,
          }}
        >
          JOIN FIGHT
        </button>
      </div>
    </div>
  );
}
