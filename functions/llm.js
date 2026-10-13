// Calls an OpenAI-compatible chat completions API (OpenRouter by default,
// also works with Together, Groq, Fireworks, DeepInfra, vLLM, Ollama…).
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

/**
 * @param {object} p
 * @param {string} p.baseUrl  e.g. https://openrouter.ai/api/v1
 * @param {string} p.apiKey
 * @param {string} p.model
 * @param {object[]} p.messages
 * @param {number} p.maxTokens
 * @param {number} p.temperature
 * @returns {Promise<object>} the JSON object the model replied with
 */
export async function chatJson({ baseUrl, apiKey, model, messages, maxTokens, temperature }) {
  let res;
  try {
    res = await fetch(baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    logger.error('LLM request failed', { model, error: String(e) });
    throw new HttpsError('unavailable', 'The AI service did not respond');
  }
  if (!res.ok) {
    logger.error('LLM error', { model, status: res.status, body: (await res.text()).slice(0, 500) });
    throw new HttpsError('unavailable', 'The AI service returned an error');
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  const parsed = parseJsonObject(typeof text === 'string' ? text : '');
  if (!parsed) {
    logger.warn('LLM reply was not JSON', { model, text: String(text).slice(0, 500) });
    throw new HttpsError('internal', 'Could not read the AI reply');
  }
  return parsed;
}

/** Pulls the first {...} object out of a reply that may have ``` fences or extra words. */
function parseJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(text.slice(start, end + 1));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
