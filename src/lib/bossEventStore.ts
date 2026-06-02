"use client";

import { useEffect, useRef, useState } from "react";

// ─── Boss Event Store ──────────────────────────────────────────
//
// Tiny singleton store for client-side boss event state.
// BossEvent (inside Canvas) writes. BossEventHUD (outside Canvas) reads.
//
// This is a deliberately small zustand-equivalent — when server side
// lands, we swap the internals for a PartyKit-backed reducer.

export type BossEventStatus = "engage" | "dying" | "victory";

export interface BossAttack {
  id: number;
  type: "laser" | "shockwave";
  firesAt: number; // ms timestamp
  // For laser: marker position on ground (player snapshot at telegraph time)
  // For shockwave: also boss XZ at telegraph time; the wave expands from there
  targetX: number;
  targetZ: number;
}

export interface BossEventState {
  status: BossEventStatus;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3 | 4;
  playerDamage: number;
  minionKills: number;
  incomingAttack: BossAttack | null;
  lastHitFlashAt: number; // ms — boss-hit-by-player flash (subtle)
  lastAttackFlashAt: number; // ms — attack fired (whether or not it hit)
  lastPlayerHitAt: number; // ms — player actually took damage (strong feedback)
  playerHits: number; // total damage events received
  // Event-local lives (separate from PvP hp until server-side unifies)
  playerLives: number;
  maxLives: number;
  downedUntil: number; // ms — player destroyed, respawning. 0 = alive
  deaths: number; // times destroyed this event
  startedAt: number;
  endedAt: number | null;
}

const DEFAULT_MAX_HP = 5000;

function freshState(): BossEventState {
  return {
    status: "engage",
    hp: DEFAULT_MAX_HP,
    maxHp: DEFAULT_MAX_HP,
    phase: 1,
    playerDamage: 0,
    minionKills: 0,
    incomingAttack: null,
    lastHitFlashAt: 0,
    lastAttackFlashAt: 0,
    lastPlayerHitAt: 0,
    playerHits: 0,
    playerLives: 3,
    maxLives: 3,
    downedUntil: 0,
    deaths: 0,
    startedAt: Date.now(),
    endedAt: null,
  };
}

let _state: BossEventState = freshState();
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((l) => l());
}

export const bossEventStore = {
  get: (): BossEventState => _state,
  set: (patch: Partial<BossEventState>) => {
    _state = { ..._state, ...patch };
    notify();
  },
  reset: () => {
    _state = freshState();
    notify();
  },
  subscribe: (cb: () => void) => {
    _listeners.add(cb);
    return () => {
      _listeners.delete(cb);
    };
  },
};

export function computePhase(hp: number, maxHp: number): 1 | 2 | 3 | 4 {
  const r = maxHp > 0 ? hp / maxHp : 0;
  if (r > 0.75) return 1;
  if (r > 0.5) return 2;
  if (r > 0.25) return 3;
  return 4;
}

// React hook for selector-based subscription (mimics zustand API)
export function useBossEvent<T>(selector: (s: BossEventState) => T): T {
  const selRef = useRef(selector);
  selRef.current = selector;
  const [snap, setSnap] = useState(() => selector(_state));
  useEffect(() => {
    return bossEventStore.subscribe(() => {
      setSnap(selRef.current(_state));
    });
  }, []);
  return snap;
}
