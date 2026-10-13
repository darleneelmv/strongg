/* =====================================================================
   Sincronización recepción ⇄ nube
   - La copia LOCAL (recepción) es la que inicia: cada minuto envía sus
     cambios y recibe los que se hicieron en la nube.
   - Si no hay internet, recepción sigue funcionando y se pone al día
     cuando vuelve la conexión.
   - Conflictos: gana el cambio más reciente (updated_at).
   ===================================================================== */
const cfg = require('./config');
const { todos, ejecutar, meta, transaccion, aplicarRemota, siguienteRev, TABLAS_SYNC, PRIVADAS } = require('./db');
const { err, ahora } = require('./util');

const LIMITE_FILAS = 400;
const LIMITE_BYTES = 3 * 1024 * 1024;

/** Junta los cambios con rev > desde, en orden, hasta llenar un paquete. */
function paqueteDesde(desde) {
  let candidatas = [];
  let tope = Infinity; // si una tabla llegó al límite, no podemos pasar de su última rev
  for (const t of TABLAS_SYNC) {
    const filas = todos(`SELECT * FROM ${t} WHERE rev > ? ORDER BY rev LIMIT ?`, desde, LIMITE_FILAS);
    if (filas.length === LIMITE_FILAS) tope = Math.min(tope, filas[filas.length - 1].rev);
    for (const f of filas) {
      for (const c of PRIVADAS[t] || []) delete f[c];
      candidatas.push([t, f]);
    }
  }
  candidatas = candidatas.filter(([, f]) => f.rev <= tope).sort((a, b) => a[1].rev - b[1].rev);
  const tablas = {};
  let bytes = 0, hasta = desde, n = 0;
  for (const [t, f] of candidatas) {
    const tam = JSON.stringify(f).length;
    if (n > 0 && (bytes + tam > LIMITE_BYTES || n >= LIMITE_FILAS)) break;
    (tablas[t] = tablas[t] || []).push(f);
    bytes += tam; n++; hasta = f.rev;
  }
  const mas = n < candidatas.length || tope !== Infinity;
  return { tablas, hasta, n, mas };
}

function aplicarPaquete(tablas) {
  let aplicados = 0;
  transaccion(() => {
    for (const [t, filas] of Object.entries(tablas || {})) {
      if (!TABLAS_SYNC.includes(t) || !Array.isArray(filas)) continue;
      for (const f of filas) if (aplicarRemota(t, f)) aplicados++;
    }
  });
  return aplicados;
}

// ---------- Lado NUBE: recibe y entrega ----------
function autorizado(req) {
  const h = req.headers.authorization || '';
  return cfg.SYNC_TOKEN && cfg.SYNC_TOKEN.length >= 16 && h === `Bearer ${cfg.SYNC_TOKEN}`;
}
function rutaServidor(metodo, camino, q, cuerpo, req) {
  if (!autorizado(req)) err(401, 'Token de sincronización inválido.');
  if (metodo === 'POST' && camino === '/sync/recibir') {
    const aplicados = aplicarPaquete(cuerpo.tablas);
    meta('sync_ultimo_contacto', ahora());
    return { ok: true, aplicados };
  }
  if (metodo === 'GET' && camino === '/sync/enviar') {
    const p = paqueteDesde(Number(q.desde || 0));
    return { ok: true, tablas: p.tablas, hasta: p.hasta, mas: p.mas };
  }
  err(404, 'Ruta de sincronización no encontrada.');
}

// ---------- Lado LOCAL: ciclo automático ----------
const estado = { corriendo: false, ultima_ok: null, ultimo_error: '', ultimo_resumen: null };
const activo = () => cfg.MODO === 'local' && !!cfg.NUBE_URL && !!cfg.SYNC_TOKEN;

async function pedir(metodo, camino, cuerpo) {
  const r = await fetch(`${cfg.NUBE_URL}/api${camino}`, {
    method: metodo,
    headers: { authorization: `Bearer ${cfg.SYNC_TOKEN}`, ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(45000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `La nube respondió ${r.status}`);
  return d;
}

async function ciclo() {
  if (!activo()) return { ok: false, omitido: 'La sincronización no está configurada (NUBE_URL y SYNC_TOKEN).' };
  if (estado.corriendo) return { ok: false, omitido: 'Ya hay una sincronización en curso.' };
  estado.corriendo = true;
  const res = { enviados: 0, recibidos: 0, errores: 0 };
  try {
    // 1) Enviar cambios locales
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const desde = Number(meta('sync_push_rev') || 0);
      const p = paqueteDesde(desde);
      if (!p.n) break;
      await pedir('POST', '/sync/recibir', { tablas: p.tablas });
      meta('sync_push_rev', p.hasta);
      res.enviados += p.n;
      if (!p.mas) break;
    }
    // 2) Recibir cambios hechos en la nube
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const desde = Number(meta('sync_pull_rev') || 0);
      const d = await pedir('GET', `/sync/enviar?desde=${desde}`);
      res.recibidos += aplicarPaquete(d.tablas);
      if (d.hasta > desde) meta('sync_pull_rev', d.hasta);
      if (!d.mas || d.hasta <= desde) break;
    }
    estado.ultima_ok = ahora();
    estado.ultimo_error = '';
    meta('sync_ultima_ok', estado.ultima_ok);
    estado.ultimo_resumen = res;
    return { ok: true, ...res };
  } catch (e) {
    const causa = e.name === 'TimeoutError' ? 'La nube tardó demasiado en responder.'
      : /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(`${e.message} ${e.cause && e.cause.code}`) ? 'Sin conexión a internet o la nube no responde.' : e.message;
    estado.ultimo_error = causa;
    estado.ultimo_resumen = { ...res, errores: 1 };
    return { ok: false, error: causa, ...res };
  } finally {
    estado.corriendo = false;
  }
}

function iniciarCiclo() {
  if (!activo()) {
    if (cfg.MODO === 'local') console.log('Sincronización con la nube: desactivada (falta NUBE_URL o SYNC_TOKEN en .env).');
    return;
  }
  console.log(`Sincronización con ${cfg.NUBE_URL} cada ${cfg.SYNC_INTERVALO_SEG} s.`);
  // Si cambió la dirección de la nube (ej. de Render a Hostinger), se vuelve a enviar todo
  if (meta('sync_nube_url') !== cfg.NUBE_URL) {
    if (meta('sync_nube_url')) console.log('La dirección de la nube cambió: se enviará toda la información a la nueva.');
    transaccion(() => {
      // Lo que llegó de la nube anterior también se manda a la nueva
      for (const t of TABLAS_SYNC) {
        for (const { id } of todos(`SELECT id FROM ${t} WHERE rev = 0`)) ejecutar(`UPDATE ${t} SET rev = ? WHERE id = ?`, siguienteRev(), id);
      }
      meta('sync_push_rev', 0);
      meta('sync_pull_rev', 0);
      meta('sync_nube_url', cfg.NUBE_URL);
    });
  }
  estado.ultima_ok = meta('sync_ultima_ok');
  setTimeout(ciclo, 3000);
  setInterval(ciclo, cfg.SYNC_INTERVALO_SEG * 1000).unref();
}

function estadoPublico() {
  return {
    entorno: cfg.MODO, activo: activo(), nube: cfg.NUBE_URL || null, intervalo_seg: cfg.SYNC_INTERVALO_SEG,
    ultima_ok: cfg.MODO === 'local' ? estado.ultima_ok : meta('sync_ultimo_contacto'),
    ultimo_error: estado.ultimo_error, ultimo_resumen: estado.ultimo_resumen,
    configurado_en_nube: cfg.MODO === 'nube' ? !!cfg.SYNC_TOKEN : undefined,
  };
}

module.exports = { rutaServidor, ciclo, iniciarCiclo, estadoPublico, paqueteDesde, aplicarPaquete };
