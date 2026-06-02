"use client";

import { useEffect, useState } from "react";
import { useBossEvent } from "@/lib/bossEventStore";

// ─── Boss Fly Strip ────────────────────────────────────────────
//
// Bottom-center HUD shown ONLY in fly mode during a live boss event.
// Phase + HP bar + live leaderboard (real, from /api/events/active).

const PHASE_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "PHASE 1 · NOMINAL",
  2: "PHASE 2 · WARNING",
  3: "PHASE 3 · CRITICAL",
  4: "PHASE 4 · ENRAGE",
};

interface LeaderRow { rank: number; login: string; damage: number; minions: number }

interface Props {
  accentColor?: string;
  leaderboard?: LeaderRow[];
  selfLogin?: string;
}

export default function BossFlyStrip({ accentColor = "#f0c060", leaderboard = [], selfLogin = "" }: Props) {
  const hp = useBossEvent((s) => s.hp);
  const maxHp = useBossEvent((s) => s.maxHp);
  const phase = useBossEvent((s) => s.phase);
  const playerDamage = useBossEvent((s) => s.playerDamage);
  const minionKills = useBossEvent((s) => s.minionKills);
  const incomingAttack = useBossEvent((s) => s.incomingAttack);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color =
    phase === 1 ? accentColor :
    phase === 2 ? "#d4cfc4" :
    phase === 3 ? "#ff7733" :
    "#ff2244";

  const attackCountdown = incomingAttack
    ? Math.max(0, (incomingAttack.firesAt - now) / 1000)
    : null;

  // Real leaderboard from the server (credited damage), with the local "YOU"
  // damage merged in for immediacy (credit lags behind by a poll + receipts).
  const rows = leaderboard.map((r) => ({
    name: `@${r.login}`,
    damage: r.damage,
    isYou: !!selfLogin && r.login.toLowerCase() === selfLogin.toLowerCase(),
  }));
  const youIdx = rows.findIndex((r) => r.isYou);
  if (youIdx >= 0) {
    rows[youIdx] = { name: "YOU", damage: Math.max(rows[youIdx].damage, playerDamage), isYou: true };
  } else {
    rows.push({ name: "YOU", damage: playerDamage, isYou: true });
  }
  const board = rows.sort((a, b) => b.damage - a.damage).slice(0, 5);
  const maxBoardDmg = Math.max(...board.map((e) => e.damage), 1);

  return (
    <div className="pointer-events-none fixed left-1/2 bottom-12 z-40 w-full max-w-[560px] -translate-x-1/2 px-2">
      <div
        className="border-2 bg-bg/85 backdrop-blur-sm font-pixel uppercase"
        style={{
          borderColor: incomingAttack ? "#ff2244" : "var(--color-border)",
          transition: "border-color 0.15s",
        }}
      >
        {/* Row 1: Title OR attack warning */}
        <div className="flex items-baseline justify-between border-b-2 border-border/50 px-4 py-1.5 text-[9px] tracking-wider">
          {incomingAttack && attackCountdown !== null ? (
            <>
              <span className="animate-pulse" style={{ color: "#ff5566" }}>
                INCOMING LASER
              </span>
              <span style={{ color: "#ff5566" }}>
                {attackCountdown.toFixed(1)}S
              </span>
            </>
          ) : (
            <>
              <span style={{ color: accentColor }}>BUG INVASION</span>
              <span style={{ color }}>{PHASE_LABEL[phase]}</span>
            </>
          )}
        </div>

        {/* Row 2: HP bar */}
        <div className="px-4 py-2">
          <div className="relative h-2 w-full overflow-hidden border-2 border-border bg-bg">
            <div
              className="absolute inset-y-0 left-0 transition-all duration-150"
              style={{
                width: `${hpPct}%`,
                backgroundColor: color,
                boxShadow: `0 0 6px ${color}66`,
              }}
            />
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[9px]">
            <span className="text-cream">
              {Math.ceil(hp).toLocaleString()}
              <span className="text-cream/40"> / {maxHp.toLocaleString()}</span>
            </span>
            <span className="text-cream/60">{hpPct.toFixed(0)}%</span>
          </div>
        </div>

        {/* Row 3: Mini leaderboard */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-1 border-t-2 border-border/50 px-4 py-2 text-[9px]">
          {board.map((entry, i) => {
            const isYou = entry.isYou;
            const barW = (entry.damage / maxBoardDmg) * 100;
            const rank = i + 1;
            const nameColor = isYou ? accentColor : "#e8dcc8";
            const valColor = isYou ? accentColor : "rgba(232, 220, 200, 0.6)";
            return (
              <div key={`${entry.name}-${i}`} className="flex items-center gap-2">
                <span className="w-3 text-right text-cream/40">{rank}</span>
                <span
                  className="w-16 truncate"
                  style={{ color: nameColor, fontWeight: isYou ? "bold" : undefined }}
                >
                  {entry.name}
                </span>
                <div className="relative h-1.5 flex-1 border border-border bg-bg">
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${barW}%`,
                      backgroundColor: isYou ? accentColor : "#5a5040",
                    }}
                  />
                </div>
                <span className="w-12 text-right" style={{ color: valColor }}>
                  {entry.damage.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Row 4: Your stats summary */}
        <div className="flex items-baseline justify-between border-t-2 border-border/50 px-4 py-1 text-[8px] tracking-wider">
          <span className="text-cream/60">
            YOUR DAMAGE:{" "}
            <span style={{ color: accentColor }}>{playerDamage.toLocaleString()}</span>
          </span>
          <span className="text-cream/60">
            MINIONS:{" "}
            <span style={{ color: accentColor }}>{minionKills}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
