/* Utilidades compartidas del servidor */
const crypto = require('node:crypto');
const { ZONA, DESFASE } = require('./config');

class ErrorApi extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}
const err = (status, mensaje) => { throw new ErrorApi(status, mensaje); };

const uuid = () => crypto.randomUUID();
const ahora = () => new Date().toISOString();

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA });
/** Día local (YYYY-MM-DD) de una fecha ISO o de ahora. */
const diaDe = (ts) => fmtDia.format(ts ? new Date(ts) : new Date());
const hoy = () => diaDe();
function sumarDias(iso, d) {
  const [y, m, dd] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10);
}
const difDias = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const esDia = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
/** Límites UTC [desde, hasta) de un rango de días locales. */
function limites(desde, hasta) {
  const d = esDia(desde) ? desde : hoy();
  const h = esDia(hasta) ? hasta : d;
  return [new Date(`${d}T00:00:00${DESFASE}`).toISOString(), new Date(`${sumarDias(h, 1)}T00:00:00${DESFASE}`).toISOString()];
}

// ---------- Contraseñas (scrypt, incluido en Node) ----------
function hashPassword(pw) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), sal, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sal.toString('base64')}$${h.toString('base64')}`;
}
function verificarPassword(pw, guardado) {
  if (!guardado || !guardado.startsWith('scrypt$')) return false;
  const [, sal, h] = guardado.split('$');
  const calc = crypto.scryptSync(String(pw), Buffer.from(sal, 'base64'), 32, { N: 16384, r: 8, p: 1 });
  const esperado = Buffer.from(h, 'base64');
  return esperado.length === calc.length && crypto.timingSafeEqual(esperado, calc);
}
const sha256 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const tokenAleatorio = (n = 32) => crypto.randomBytes(n).toString('base64url');
const digitos = (n) => Array.from({ length: n }, () => crypto.randomInt(0, 10)).join('');
const passwordLegible = () => {
  const L = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => L[crypto.randomInt(0, L.length)]).join('');
};

const nombreCompleto = (c) => `${(c && c.nombre) || ''} ${(c && c.apellidos) || ''}`.trim();
const texto = (v, max = 500) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const numero = (v, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };

module.exports = {
  ErrorApi, err, uuid, ahora, diaDe, hoy, sumarDias, difDias, esDia, limites,
  hashPassword, verificarPassword, sha256, tokenAleatorio, digitos, passwordLegible,
  nombreCompleto, texto, numero,
};
