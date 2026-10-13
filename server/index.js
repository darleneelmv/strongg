/* =====================================================================
   Strong Gym · servidor
   Uso:  node server/index.js      (o doble clic en INICIAR-STRONG-GYM.bat)
   ===================================================================== */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const cfg = require('./config');
const { sembrarBase } = require('./db');
const api = require('./api');
const sync = require('./sync');
const { iniciarRespaldos, copiaParaDescargar } = require('./respaldo');
const { ErrorApi } = require('./util');

sembrarBase();
if (cfg.SEMBRAR_DEMO) require('./demo').sembrarDemo();

// Rutas de sincronización y su estado
api.ruta('GET', '/sync/estado', (p, q, b, ctx) => {
  if (!ctx.usuario || ctx.usuario.rol === 'cliente') api.err(403, 'No tienes permiso para esta sección.');
  return sync.estadoPublico();
});
api.ruta('POST', '/sync/ahora', async (p, q, b, ctx) => {
  if (!ctx.usuario || ctx.usuario.rol !== 'admin') api.err(403, 'Solo el administrador puede sincronizar.');
  return sync.ciclo();
});
api.ruta('GET', '/salud', () => ({ ok: true, entorno: cfg.MODO, hora: new Date().toISOString() }));

// ---------- Utilidades HTTP ----------
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.mp3': 'audio/mpeg',
};
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function cabecerasBase(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', CSP);
}

function enviar(req, res, status, cuerpo, tipo, extra = {}) {
  let datos = Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(cuerpo);
  const headers = { 'Content-Type': tipo, ...extra };
  if (datos.length > 1024 && /gzip/.test(req.headers['accept-encoding'] || '') && /text|json|javascript|svg/.test(tipo)) {
    datos = zlib.gzipSync(datos);
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = datos.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : datos);
}
const json = (req, res, status, obj, extra) => enviar(req, res, status, JSON.stringify(obj), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store', ...extra });

function leerCuerpo(req, limite = 6 * 1024 * 1024) {
  return new Promise((ok, mal) => {
    let tam = 0;
    const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > limite) { mal(new ErrorApi(413, 'La información enviada es demasiado grande.')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      if (!tam) return ok({});
      try { ok(JSON.parse(Buffer.concat(partes).toString('utf8'))); }
      catch (e) { mal(new ErrorApi(400, 'Datos con formato incorrecto.')); }
    });
    req.on('error', mal);
  });
}

const ipDe = (req) => (cfg.MODO === 'nube' && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress || '').replace(/^::ffff:/, '');

// ---------- Archivos estáticos ----------
const ALIAS = { '/': 'index.html', '/app': 'app.html', '/app/': 'app.html', '/entrar': 'app.html' };
function estatico(req, res, camino) {
  let rel = ALIAS[camino] || decodeURIComponent(camino).replace(/^\/+/, '');
  const archivo = path.join(cfg.PUBLICO, rel);
  if (!archivo.startsWith(cfg.PUBLICO + path.sep) && archivo !== cfg.PUBLICO) return enviar(req, res, 404, 'No encontrado', 'text/plain; charset=utf-8');
  let st;
  try { st = fs.statSync(archivo); } catch (e) { st = null; }
  if (!st || !st.isFile()) {
    rel = '404.html';
    const f404 = path.join(cfg.PUBLICO, rel);
    return enviar(req, res, 404, fs.existsSync(f404) ? fs.readFileSync(f404) : 'No encontrado', 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
  }
  const ext = path.extname(archivo).toLowerCase();
  const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
  const cache = /\.(png|jpe?g|webp|svg|ico|woff2?|mp3)$/.test(ext) ? 'public, max-age=86400' : 'no-cache';
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': cache }); return res.end(); }
  enviar(req, res, 200, fs.readFileSync(archivo), TIPOS[ext] || 'application/octet-stream', { ETag: etag, 'Cache-Control': cache });
}

// ---------- Servidor ----------
const servidor = http.createServer(async (req, res) => {
  cabecerasBase(res);
  const url = new URL(req.url, 'http://x');
  const camino = url.pathname;
  try {
    if (camino.startsWith('/api/')) {
      const sub = camino.slice(4);
      const q = Object.fromEntries(url.searchParams);
      const metodo = req.method;
      if (metodo !== 'GET' && metodo !== 'HEAD') {
        // Solo JSON: protege contra envíos desde otros sitios
        if (!/application\/json/.test(req.headers['content-type'] || '') && req.headers['content-length'] !== '0' && req.headers['content-length']) {
          throw new ErrorApi(415, 'Formato no admitido.');
        }
      }
      const cuerpo = metodo === 'GET' || metodo === 'HEAD' ? {} : await leerCuerpo(req);
      if (sub === '/sync/recibir' || sub === '/sync/enviar') {
        return json(req, res, 200, sync.rutaServidor(metodo, sub, q, cuerpo, req));
      }
      const sesion = api.sesionDe(req);
      const ctx = { ip: ipDe(req), sesion, usuario: sesion ? sesion.usuario : null, cookie: null };
      if (sub === '/gestion/respaldo' && metodo === 'GET') {
        if (!ctx.usuario || ctx.usuario.rol !== 'admin') throw new ErrorApi(403, 'Solo el administrador puede descargar el respaldo.');
        const nombre = `strong-gym-respaldo-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.db`;
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${nombre}"`, 'Cache-Control': 'no-store' });
        return res.end(copiaParaDescargar());
      }
      const r = await api.despachar(metodo === 'HEAD' ? 'GET' : metodo, sub, q, cuerpo, ctx);
      const extra = ctx.cookie ? { 'Set-Cookie': ctx.cookie } : {};
      if (sub === '/publico/sitio') extra['Cache-Control'] = 'public, max-age=30';
      return json(req, res, 200, r, extra);
    }
    if (camino.startsWith('/media/')) {
      const [, , tipo, id] = camino.split('/');
      const sesion = api.sesionDe(req);
      const m = api.media(tipo, id, { usuario: sesion ? sesion.usuario : null });
      if (!m || m.status !== 200) return enviar(req, res, (m && m.status) || 404, 'No disponible', 'text/plain; charset=utf-8');
      return enviar(req, res, 200, m.cuerpo, m.tipo, { 'Cache-Control': m.publico ? 'public, max-age=31536000, immutable' : 'private, max-age=86400' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return enviar(req, res, 405, 'Método no permitido', 'text/plain; charset=utf-8');
    return estatico(req, res, camino);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    return json(req, res, status, { error: status >= 500 ? 'Ocurrió un error en el servidor. Intenta de nuevo.' : e.message });
  }
});

servidor.listen(cfg.PUERTO, cfg.HOST, () => {
  const lineas = [
    '',
    '  ███ STRONG GYM · sistema listo',
    `  Modo: ${cfg.MODO === 'local' ? 'LOCAL (recepción)' : 'NUBE'}`,
    `  Sitio web:  http://localhost:${cfg.PUERTO}/`,
    `  Sistema:    http://localhost:${cfg.PUERTO}/app`,
    `  Datos en:   ${cfg.DB_ARCHIVO}`,
    '',
  ];
  console.log(lineas.join('\n'));
  sync.iniciarCiclo();
  iniciarRespaldos();
});

module.exports = servidor;
