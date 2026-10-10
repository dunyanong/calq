// Calls the AI Cloud Functions (functions/index.js). Signed-in users only.
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

const MESSAGES = {
  'functions/unauthenticated': 'Sign in to use this feature',
  'functions/resource-exhausted': 'Daily limit reached, try again tomorrow',
  'functions/deadline-exceeded': 'That took too long, try again',
  'functions/unavailable': 'AI service unavailable, try again',
};

/** Error with a message that can be shown to the user. */
function friendly(e) {
  return new Error(MESSAGES[e?.code] || 'Something went wrong, try again');
}

async function call(name, data) {
  try {
    const res = await httpsCallable(functions, name, { timeout: 70_000 })(data);
    return res.data;
  } catch (e) {
    throw friendly(e);
  }
}

/**
 * @param {string} imageBase64  JPEG, no data: prefix
 * @returns {Promise<{expr: string, note: string}>}
 */
export function scanEquation(imageBase64) {
  return call('scanEquation', { image: imageBase64 });
}

// Plans are cached for the session: holding the same calculation again is free.
const planCache = new Map();

/**
 * @param {string} expr
 * @param {'deg'|'rad'} angle
 * @returns {Promise<{parts: string[], note: string}[]>}
 */
export async function explainSteps(expr, angle) {
  const key = angle + '|' + expr;
  if (!planCache.has(key)) {
    const { steps } = await call('explainSteps', { expr, angle });
    planCache.set(key, steps);
  }
  return planCache.get(key);
}
