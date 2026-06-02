"use client";

import { useEffect, useState } from "react";
import { useBossEvent, bossEventStore } from "@/lib/bossEventStore";

// ─── Boss Victory Screen ───────────────────────────────────────
//
// Dense post-event dashboard (Opção B with hero animation flourish).
// Sections:
//   1. Hero VICTORY animation (1.6s)
//   2. Reward unboxing (item reveals from "?" box, 1.4s)
//   3. Your stats: damage, minions, rank (real leaderboard)
//   4. Mini leaderboard top 5 (you highlighted)
//   5. Next invasion teaser
//   6. Actions: SHARE / RETURN
//
// Leaderboard + participant count come from /api/events/active. Rewards are
// granted server-side by damage tier at event wrap.

interface LeaderRow { rank: number; login: string; damage: number; minions: number }

interface Props {
  accentColor: string;
  shadowColor: string;
  leaderboard?: LeaderRow[];
  participants?: number;
  selfLogin?: string;
}

export default function BossVictoryScreen({ accentColor, shadowColor, leaderboard = [], participants = 0, selfLogin = "" }: Props) {
  const playerDamage = useBossEvent((s) => s.playerDamage);
  const minionKills = useBossEvent((s) => s.minionKills);
  const playerHits = useBossEvent((s) => s.playerHits);

  // Reveal stages — pacing the celebration
  const [stage, setStage] = useState<"victory" | "unbox" | "full">("victory");
  useEffect(() => {
    const t1 = setTimeout(() => setStage("unbox"), 1600);
    const t2 = setTimeout(() => setStage("full"), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Build the leaderboard from real credited damage, with local YOU merged in.
  const board = leaderboard.map((r) => {
    const isYou = !!selfLogin && r.login.toLowerCase() === selfLogin.toLowerCase();
    return { name: isYou ? "YOU" : `@${r.login}`, damage: r.damage, isYou };
  });
  const meIdx = board.findIndex((e) => e.isYou);
  if (meIdx >= 0) board[meIdx] = { name: "YOU", damage: Math.max(board[meIdx].damage, playerDamage), isYou: true };
  else board.push({ name: "YOU", damage: playerDamage, isYou: true });
  board.sort((a, b) => b.damage - a.damage);
  const yourRank = board.findIndex((e) => e.isYou) + 1;
  const totalParticipants = Math.max(participants, board.length);
  const top5 = board.slice(0, 5);
  const youInTop5 = top5.some((e) => e.isYou);
  const displayBoard = youInTop5
    ? top5
    : [...top5, { name: "···", damage: 0, isYou: false }, { name: "YOU", damage: playerDamage, isYou: true }];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/95 backdrop-blur-md font-pixel uppercase">
      <div
        className="border-2 border-border bg-bg-raised animate-[fade-in_0.4s_ease-out]"
        style={{
          width: "min(640px, 95vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: `4px 4px 0 0 ${shadowColor}`,
        }}
      >
        {/* ─── HERO ────────────────────────────────────────── */}
        <div
          className="border-b-2 border-border/60 px-6 py-6 text-center"
          style={{ background: `radial-gradient(ellipse at center, ${shadowColor}33, transparent 70%)` }}
        >
          <div className="text-[9px] tracking-[0.3em] text-cream/50">
            ──  BOSS DEFEATED  ──
          </div>
          <div
            className="mt-3 text-5xl tracking-[0.15em]"
            style={{
              color: accentColor,
              textShadow: `3px 3px 0 ${shadowColor}`,
              animation: stage === "victory" ? "boss_victory_in 1.6s ease-out" : undefined,
            }}
          >
            VICTORY
          </div>
          <div className="mt-2 text-[10px] tracking-wider text-cream-dark normal-case">
            you helped defeat the original bug
          </div>
        </div>

        {/* ─── REWARD UNBOXING ─────────────────────────────── */}
        <div className="border-b-2 border-border/60 px-6 py-5">
          <div className="mb-3 text-[9px] tracking-wider text-cream/50">REWARD UNLOCKED</div>
          {stage === "victory" ? (
            // Closed box
            <div className="flex items-center justify-center py-4">
              <div
                className="border-2 border-border bg-bg p-6 pixel-shadow"
                style={{ animation: "boss_box_shake 0.4s ease-in-out infinite" }}
              >
                <div className="text-3xl text-cream/40">?</div>
              </div>
            </div>
          ) : (
            // Revealed item
            <div
              className="flex items-center gap-4 border-2 border-border bg-bg px-4 py-3"
              style={{
                animation: stage === "unbox" ? "boss_item_reveal 0.8s ease-out" : undefined,
              }}
            >
              {/* Item visual: orbiting boxes */}
              <div
                className="relative h-16 w-16 shrink-0 border-2 border-border bg-bg-card"
                style={{ boxShadow: `inset 0 0 20px ${accentColor}66` }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ animation: "boss_orbit 4s linear infinite" }}
                >
                  <div
                    className="absolute h-2 w-2"
                    style={{ background: accentColor, top: 4, left: "50%", boxShadow: `0 0 6px ${accentColor}` }}
                  />
                  <div
                    className="absolute h-2 w-2"
                    style={{ background: accentColor, bottom: 4, left: "50%", boxShadow: `0 0 6px ${accentColor}` }}
                  />
                  <div
                    className="absolute h-2 w-2"
                    style={{ background: accentColor, top: "50%", left: 4, boxShadow: `0 0 6px ${accentColor}` }}
                  />
                  <div
                    className="absolute h-2 w-2"
                    style={{ background: accentColor, top: "50%", right: 4, boxShadow: `0 0 6px ${accentColor}` }}
                  />
                </div>
                <div
                  className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2"
                  style={{ background: accentColor, boxShadow: `0 0 12px ${accentColor}` }}
                />
              </div>
              <div className="flex-1">
                <div className="text-[11px]" style={{ color: accentColor }}>
                  EVENT REWARD
                </div>
                <div className="mt-0.5 text-[8px] tracking-wider text-cream/50">
                  DELIVERED TO YOUR CITY
                </div>
                <div className="mt-1 text-[9px] leading-relaxed text-cream-dark normal-case">
                  Your cosmetic is granted by damage tier and delivered to your inventory when the event ends.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── YOUR PERFORMANCE ────────────────────────────── */}
        <div className="border-b-2 border-border/60 px-6 py-4">
          <div className="mb-3 text-[9px] tracking-wider text-cream/50">YOUR PERFORMANCE</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="DAMAGE" value={playerDamage.toLocaleString()} accent={accentColor} highlight />
            <Stat
              label="RANK"
              value={`#${yourRank} / ${totalParticipants}`}
              accent={accentColor}
              highlight
            />
            <Stat label="MINIONS" value={minionKills.toString()} accent={accentColor} />
          </div>
          <div className="mt-3 text-center text-[8px] tracking-wider text-cream/30 normal-case">
            took {playerHits} hits from the boss
          </div>
        </div>

        {/* ─── LEADERBOARD ─────────────────────────────────── */}
        <div className="border-b-2 border-border/60 px-6 py-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[9px] tracking-wider text-cream/50">LEADERBOARD</span>
            <span className="text-[8px] tracking-wider text-cream/30">TOP 5</span>
          </div>
          <div className="border-2 border-border bg-bg px-3 py-2">
            {displayBoard.map((entry, i) => {
              const isYou = entry.isYou;
              const isSep = entry.name === "···";
              const realRank = isSep ? "" : board.findIndex((e) => e.name === entry.name) + 1;
              if (isSep) {
                return (
                  <div key="sep" className="py-0.5 text-center text-[10px] text-cream/30">
                    ···
                  </div>
                );
              }
              return (
                <div
                  key={`${entry.name}-${i}`}
                  className="flex items-baseline justify-between gap-2 py-0.5 text-[10px]"
                  style={isYou ? { color: accentColor, fontWeight: "bold" } : { color: "#e8dcc8" }}
                >
                  <span className="w-6 text-right text-cream/40">{realRank}</span>
                  <span className="flex-1 truncate">{entry.name}</span>
                  <span>{entry.damage.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── NEXT EVENT COUNTDOWN ────────────────────────── */}
        <div className="border-b-2 border-border/60 px-6 py-3 text-center">
          <div className="text-[9px] tracking-wider text-cream/50">NEXT BUG INVASION</div>
          <div className="mt-1 text-[11px] tracking-[0.1em] normal-case" style={{ color: accentColor }}>
            coming soon — watch the city
          </div>
        </div>

        {/* ─── ACTIONS ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 px-6 py-4">
          <button
            type="button"
            className="btn-press px-4 py-2 text-[10px] tracking-widest text-bg"
            style={{
              backgroundColor: accentColor,
              boxShadow: `4px 4px 0 0 ${shadowColor}`,
            }}
            onClick={() => window.dispatchEvent(new CustomEvent("boss-share-card-open"))}
          >
            SHARE ON X
          </button>
          <button
            type="button"
            className="btn-press border-2 border-border bg-bg px-4 py-2 text-[10px] tracking-widest text-cream"
            onClick={() => {
              // Just dismiss the modal; user goes back to city
              bossEventStore.reset();
            }}
          >
            RETURN TO CITY
          </button>
        </div>

        {/* ─── FOOTER ──────────────────────────────────────── */}
        <div className="border-t-2 border-border/50 px-4 py-2 text-center text-[8px] tracking-wider text-cream/30 normal-case">
          rewards are delivered to your city when the event ends
        </div>
      </div>

      <style>{`
        @keyframes boss_victory_in {
          0% { opacity: 0; transform: scale(0.6); }
          60% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes boss_box_shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-2px, 0) rotate(-2deg); }
          75% { transform: translate(2px, 0) rotate(2deg); }
        }
        @keyframes boss_item_reveal {
          0% { opacity: 0; transform: scale(0.8); }
          60% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes boss_orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  highlight = false,
}: {
  label: string;
  value: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div className="border-2 border-border bg-bg px-2 py-2">
      <div className="text-[8px] tracking-wider text-cream/50">{label}</div>
      <div
        className="mt-1 text-[14px]"
        style={{ color: highlight ? accent : "#e8dcc8" }}
      >
        {value}
      </div>
    </div>
  );
}
