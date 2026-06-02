"use client";

import { useEffect, useState } from "react";
import { useBossEvent } from "@/lib/bossEventStore";
import BossFlyStrip from "./BossFlyStrip";
import BossVictoryScreen from "./BossVictoryScreen";
import BossShareCard from "./BossShareCard";

// ─── Boss Event HUD ────────────────────────────────────────────
//
// Coordinator. Most UI lives elsewhere:
//   • Explore mode: <BossInvasionCard> in home-client
//   • Fly mode: <BossFlyStrip> mounted here (bottom-center)
//   • Victory: <BossVictoryScreen> fullscreen
//
// This component handles screen flashes (subtle boss-hit flash,
// strong player-hit flood, attack-fired flash).

export interface BossLeaderRow { rank: number; login: string; damage: number; minions: number }

interface Props {
  flyMode: boolean;
  accentColor?: string;
  shadowColor?: string;
  leaderboard?: BossLeaderRow[];
  participants?: number;
  selfLogin?: string;
}

export default function BossEventHUD({
  flyMode,
  accentColor = "#f0c060",
  shadowColor = "#806020",
  leaderboard = [],
  participants = 0,
  selfLogin = "",
}: Props) {
  const status = useBossEvent((s) => s.status);
  const lastHitFlashAt = useBossEvent((s) => s.lastHitFlashAt);
  const lastAttackFlashAt = useBossEvent((s) => s.lastAttackFlashAt);
  const lastPlayerHitAt = useBossEvent((s) => s.lastPlayerHitAt);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const showHitFlash = now - lastHitFlashAt < 220;
  const showAttackFlash = now - lastAttackFlashAt < 400;
  const sincePlayerHit = now - lastPlayerHitAt;
  const showPlayerHit = sincePlayerHit < 1200;
  const playerHitIntensity = showPlayerHit ? Math.max(0, 1 - sincePlayerHit / 1200) : 0;

  return (
    <>
      {/* Subtle: boss took damage from player */}
      {showHitFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-30"
          style={{ background: `${accentColor}10` }}
        />
      )}

      {/* Subtle: an attack fired (whether or not it hit) */}
      {showAttackFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-30"
          style={{ background: "rgba(255, 34, 68, 0.10)" }}
        />
      )}

      {/* STRONG: player got hit by boss attack */}
      {showPlayerHit && (
        <>
          {/* Red blood flood, fades over 1.2s */}
          <div
            className="pointer-events-none fixed inset-0 z-40"
            style={{
              background: `rgba(255, 0, 30, ${0.35 * playerHitIntensity})`,
              boxShadow: `inset 0 0 200px rgba(255, 0, 30, ${playerHitIntensity})`,
            }}
          />
          {/* Center warning text */}
          <div className="pointer-events-none fixed left-1/2 top-1/3 z-50 -translate-x-1/2">
            <div
              className="border-2 bg-bg/85 px-5 py-2 font-pixel uppercase backdrop-blur-sm"
              style={{
                borderColor: "#ff2244",
                opacity: playerHitIntensity,
                boxShadow: `4px 4px 0 0 rgba(255, 34, 68, 0.5)`,
              }}
            >
              <div className="text-[14px] tracking-[0.2em]" style={{ color: "#ff5566" }}>
                YOU WERE HIT
              </div>
              <div className="text-center text-[10px] tracking-wider text-cream/70">
                TAKE COVER
              </div>
            </div>
          </div>
        </>
      )}

      {/* Fly mode strip with leaderboard */}
      {flyMode && status !== "victory" && <BossFlyStrip accentColor={accentColor} leaderboard={leaderboard} selfLogin={selfLogin} />}

      {/* Victory overlay */}
      {status === "victory" && (
        <BossVictoryScreen accentColor={accentColor} shadowColor={shadowColor} leaderboard={leaderboard} participants={participants} selfLogin={selfLogin} />
      )}

      {/* Share card modal (listens to "boss-share-card-open" custom event) */}
      <BossShareCard accentColor={accentColor} shadowColor={shadowColor} leaderboard={leaderboard} participants={participants} selfLogin={selfLogin} />
    </>
  );
}
