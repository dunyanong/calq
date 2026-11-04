// How long an AI call should take, for the "~6 s left" line under every AI wait
// (scan, workings, ∫ formulas, study notes).
//
// Starts from typical times and learns from this phone's own calls: each finished
// call is blended into a moving average kept in AsyncStorage. Storage can fail
// (private mode, cleared data): the defaults are used then.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'calq.aiTimes';
// Typical times in ms with the default models (functions/index.js).
export const DEFAULT_TIMES = { scan: 8000, steps: 5000, formula: 6000, notes: 15000 };
const ALPHA = 0.3; // weight of the newest call
const MIN_MS = 500;
const MAX_MS = 130_000; // the longest client timeout (services/ai.js)

let times = { ...DEFAULT_TIMES };
let loaded = null;

/** Reads the learned times once; later calls share the same promise. */
export function loadAiTimes() {
  if (!loaded) {
    loaded = AsyncStorage.getItem(KEY)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : {};
        for (const k of Object.keys(DEFAULT_TIMES)) {
          if (Number.isFinite(saved[k]) && saved[k] >= MIN_MS && saved[k] <= MAX_MS) times[k] = saved[k];
        }
      })
      .catch(() => {});
  }
  return loaded;
}

/** Blends one finished call into the average for its kind. */
export function recordAiTime(kind, ms) {
  if (!(kind in DEFAULT_TIMES) || !Number.isFinite(ms)) return;
  const clamped = Math.min(MAX_MS, Math.max(MIN_MS, ms));
  times = { ...times, [kind]: Math.round(times[kind] * (1 - ALPHA) + clamped * ALPHA) };
  AsyncStorage.setItem(KEY, JSON.stringify(times)).catch(() => {});
}

/**
 * Expected time in ms.
 * @param {'scan'|'steps'|'formula'|'notes'} kind
 */
export const estimateAi = (kind) => times[kind] ?? DEFAULT_TIMES.steps;

/** "~6 s left", "~2 min left", or "Taking longer than usual…" once the estimate has passed. */
export function etaText(totalMs, elapsedMs) {
  const left = totalMs - elapsedMs;
  if (left <= 0) return 'Taking longer than usual…';
  const s = Math.max(1, Math.ceil(left / 1000));
  return s < 60 ? `~${s} s left` : `~${Math.ceil(s / 60)} min left`;
}

/** The same estimate for screen readers, said once: "About 8 seconds." */
export function etaSpoken(totalMs) {
  const s = Math.max(1, Math.round(totalMs / 1000));
  return s < 60 ? `About ${s} second${s === 1 ? '' : 's'}.` : `About ${Math.ceil(s / 60)} minutes.`;
}

/**
 * Countdown text while `kind` runs; null when not running. Ticks once a second.
 * @param {string|null} kind  null while nothing is running
 * @returns {{text: string, spoken: string} | null}
 */
export function useAiEta(kind) {
  const [start, setStart] = useState(null);
  const [now, setNow] = useState(0);
  const [, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAiTimes().then(() => alive && setReady(true)); // re-render with the learned times
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!kind) {
      setStart(null);
      return undefined;
    }
    const t0 = Date.now();
    setStart(t0);
    setNow(t0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [kind]);

  if (!kind || start === null) return null;
  const total = estimateAi(kind);
  return { text: etaText(total, now - start), spoken: etaSpoken(total) };
}
