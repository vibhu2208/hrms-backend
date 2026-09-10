/**
 * Coerce query/body values to safe primitives — blocks NoSQL operator injection
 * (e.g. ?status[$ne]=x becoming { status: { $ne: 'x' } }).
 */
function asString(value, { maxLen = 200 } = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object') return undefined;
  const s = String(value).trim();
  if (!s || s.length > maxLen) return undefined;
  return s;
}

function asEnum(value, allowed) {
  const s = asString(value);
  if (!s) return undefined;
  return allowed.includes(s) ? s : undefined;
}

function asInt(value, { min, max } = {}) {
  if (value === undefined || value === null || typeof value === 'object') return undefined;
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return undefined;
  if (min !== undefined && n < min) return undefined;
  if (max !== undefined && n > max) return undefined;
  return n;
}

function pickAllowed(source, allowedKeys) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

module.exports = { asString, asEnum, asInt, pickAllowed };
