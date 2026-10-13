// Calls the AI Cloud Functions (functions/index.js). Signed-in users only.
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

const MESSAGES = {
  'functions/unauthenticated': 'Sign in to use this feature',
  'functions/resource-exhausted': 'Daily limit reached, try again tomorrow',
  'functions/deadline-exceeded': 'That took too long, try again',
  'functions/unavailable': 'AI service unavailable, try again',
  'functions/not-found': 'This feature is not set up on the server yet',
};

/** Error with a message that can be shown to the user. */
function friendly(e) {
  // a dropped connection also arrives as functions/internal
  return new Error(MESSAGES[e?.code] || 'Something went wrong. Check your connection');
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
 * @param {'deg'|'rad'|'grad'} angle
 * @param {{retry?: boolean}} [opts]  retry: skip the cache and ask for a different plan
 * @returns {Promise<{parts?: string[], rewrite?: string, note: string}[]>}
 */
export async function explainSteps(expr, angle, { retry = false } = {}) {
  const key = angle + '|' + expr;
  if (retry || !planCache.has(key)) {
    const { steps } = await call('explainSteps', { expr, angle, retry });
    planCache.set(key, steps);
  }
  return planCache.get(key);
}

const integralCache = new Map();

/**
 * Antiderivative for ∫ without limits. The answer is unchecked here:
 * math/symbolic.js accepts it only if F′ = f.
 * @param {string} f  integrand in calculator notation
 * @param {'deg'|'rad'|'grad'} angle
 * @param {{retry?: boolean}} [opts]  retry: the last answer was wrong, ask for another one
 * @returns {Promise<string>} F, or '' when the model says there is no formula
 */
export async function integrateFormula(f, angle, { retry = false } = {}) {
  const key = angle + '|' + f;
  if (retry || !integralCache.has(key)) {
    const { F } = await call('integrateFormula', { f, angle, retry });
    integralCache.set(key, typeof F === 'string' ? F : '');
  }
  return integralCache.get(key);
}
