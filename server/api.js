/* =====================================================================
   API de Strong Gym (/api/...)
   Misma forma que el simulador de la maqueta, ahora con base de datos real.
   ===================================================================== */
const cfg = require('./config');
const { uno, todos, ejecutar, transaccion, guardar, actualizar } = require('./db');
const {
  err, uuid, ahora, hoy, diaDe, sumarDias, difDias, limites, hashPassword, verificarPassword, sha256,
  tokenAleatorio, digitos, nombreCompleto, texto, numero,
} = require('./util');

const R = [];
const ruta = (metodo, patron, fn) => R.push({ metodo, re: new RegExp(`^${patron.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

// ---------- Sesión y permisos ----------
const COOKIE = 'sg_sesion';
const DURACION = { cliente: 60 * 24 * 3600e3, admin: 14 * 3600e3, dueno: 14 * 3600e3 };

function leerCookie(req, nombre) {
  const c = req.headers.cookie || '';
  const m = c.split(/;\s*/).find((p) => p.startsWith(`${nombre}=`));
  return m ? decodeURIComponent(m.slice(nombre.length + 1)) : null;
}
function cookieSesion(token, maxMs) {
  const partes = [`${COOKIE}=${token ? encodeURIComponent(token) : ''}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${token ? Math.floor(maxMs / 1000) : 0}`];
  if (cfg.COOKIE_SEGURA) partes.push('Secure');
  return partes.join('; ');
}

function sesionDe(req) {
  const token = leerCookie(req, COOKIE);
  if (!token) return null;
  const s = uno(`SELECT s.id AS sesion_id, s.expira, u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.fin IS NULL`, sha256(token));
  if (!s || !s.activo || s.expira < ahora()) return null;
  if (s.rol === 'cliente') {
    const c = uno('SELECT activo FROM clientes WHERE usuario_id = ?', s.id);
    if (!c || !c.activo) return null;
  }
  // Sesión deslizante: se renueva con el uso (sin generar cambios a sincronizar)
  const nueva = new Date(Date.now() + DURACION[s.rol]).toISOString();
  ejecutar('UPDATE sesiones SET expira = ?, ultimo_uso = ? WHERE id = ?', nueva, ahora(), s.sesion_id);
  return { sesionId: s.sesion_id, token, usuario: publicoUsuario(s) };
}
const publicoUsuario = (u) => ({ id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, activo: !!u.activo, created_at: u.created_at });

function requiere(ctx, ...roles) {
  if (!ctx.usuario) err(401, 'Inicia sesión para continuar.');
  if (roles.length && !roles.includes(ctx.usuario.rol)) err(403, 'No tienes permiso para esta sección.');
}
const STAFF = ['admin', 'dueno'];

function log(ctx, accion, detalle = null) {
  guardar('bitacora', { usuario_id: ctx.usuario ? ctx.usuario.id : null, accion, detalle: detalle ? JSON.stringify(detalle) : null, entorno: cfg.MODO });
}

// Intentos de inicio de sesión (freno contra adivinar contraseñas)
const intentos = new Map();
function frenoLogin(clave) {
  const r = intentos.get(clave);
  if (r && r.hasta > Date.now()) err(429, 'Demasiados intentos. Espera unos minutos e intenta de nuevo.');
}
function falloLogin(clave) {
  const r = intentos.get(clave) || { n: 0, hasta: 0 };
  r.n++;
  if (r.n >= 6) { r.hasta = Date.now() + 5 * 60e3; r.n = 0; }
  intentos.set(clave, r);
}

// ---------- Imágenes guardadas como data URI ----------
const TIPOS_IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
/** Decide la imagen a guardar: nueva (data URI), conservar (URL /media/...) o quitar (vacío). */
function imagenNueva(valor, actual) {
  if (valor === undefined) return actual || null;
  if (!valor) return null;
  const v = String(valor);
  if (v.startsWith('/media/')) return actual || null;
  if (!TIPOS_IMG.test(v)) err(400, 'La imagen no es válida. Usa JPG, PNG o WebP.');
  if (v.length > 900 * 1024) err(400, 'La imagen es muy pesada. Recórtala e intenta de nuevo.');
  return v;
}
const version = (f) => sha256(f.updated_at || '').slice(0, 8);
const urlMedia = (tipo, f, campo = 'imagen') => (f[campo] ? `/media/${tipo}/${f.id}?v=${version(f)}` : null);

// ---------- Clientes y membresías ----------
const CAMPOS_LISTA = 'c.id, c.codigo, c.qr_token, c.nombre, c.apellidos, c.telefono, c.email, c.fecha_nacimiento, c.notas, c.usuario_id, c.activo, c.created_at, c.updated_at, (c.foto IS NOT NULL) AS tiene_foto';
const JOIN_ULTIMA = `LEFT JOIN membresias m ON m.id = (SELECT id FROM membresias WHERE cliente_id = c.id AND activo = 1 ORDER BY fecha_fin DESC LIMIT 1)
  LEFT JOIN planes p ON p.id = m.plan_id`;
const SELECT_CLIENTE = `SELECT ${CAMPOS_LISTA}, m.plan_id, COALESCE(m.plan_nombre, p.nombre) AS plan, m.fecha_inicio, m.fecha_fin FROM clientes c ${JOIN_ULTIMA}`;

function conEstado(c) {
  const r = {
    ...c, activo: !!c.activo, tiene_foto: !!c.tiene_foto, qr: `${c.codigo}${c.qr_token}`,
    plan: c.plan || null, fecha_inicio: c.fecha_inicio || null, fecha_fin: c.fecha_fin || null,
    dias_restantes: null, estado: 'sin_membresia', tiene_acceso: !!c.usuario_id,
    foto_url: c.tiene_foto ? `/media/cliente/${c.id}?v=${version(c)}` : null,
  };
  delete r.qr_token;
  if (c.fecha_fin) {
    const dias = difDias(c.fecha_fin, hoy());
    r.dias_restantes = dias;
    r.estado = dias < 0 ? 'vencida' : dias <= 5 ? 'por_vencer' : 'vigente';
  }
  return r;
}
const clientePorId = (id) => { const c = uno(`${SELECT_CLIENTE} WHERE c.id = ?`, id); return c ? conEstado(c) : null; };

function codigoNuevo() {
  for (let i = 0; i < 50; i++) {
    const c = String(1 + Math.floor(Math.random() * 9)) + digitos(5);
    if (!uno('SELECT 1 AS x FROM clientes WHERE codigo = ?', c)) return c;
  }
  err(500, 'No se pudo generar un código de socio. Intenta de nuevo.');
}

function crearMembresia(ctx, cliente_id, plan_id, metodo) {
  const p = uno('SELECT * FROM planes WHERE id = ?', plan_id);
  if (!p) err(400, 'El plan seleccionado no existe.');
  const c = uno('SELECT * FROM clientes WHERE id = ? AND activo = 1', cliente_id);
  if (!c) err(404, 'Cliente no encontrado.');
  const u = uno('SELECT * FROM membresias WHERE cliente_id = ? AND activo = 1 ORDER BY fecha_fin DESC LIMIT 1', cliente_id);
  let inicio = hoy();
  if (u && u.fecha_fin >= hoy()) inicio = sumarDias(u.fecha_fin, 1);
  const m = guardar('membresias', { cliente_id, plan_id, plan_nombre: p.nombre, fecha_inicio: inicio,
    fecha_fin: sumarDias(inicio, p.duracion_dias - 1), precio: p.precio, activo: 1 });
  guardar('pagos', { cliente_id, membresia_id: m.id, concepto: `Membresía ${p.nombre}`, monto: p.precio,
    metodo: METODOS.includes(metodo) ? metodo : 'efectivo', usuario_id: ctx.usuario.id });
  log(ctx, 'membresia.crear', { cliente: nombreCompleto(c), plan: p.nombre, monto: p.precio, hasta: m.fecha_fin });
  return { ...m, activo: true, plan: p.nombre };
}
const METODOS = ['efectivo', 'tarjeta', 'transferencia'];

function cuentaCliente(c, password) {
  if (String(password || '').length < 8) err(400, 'La contraseña del portal debe tener al menos 8 caracteres.');
  const existente = c.usuario_id ? uno('SELECT * FROM usuarios WHERE id = ?', c.usuario_id) : null;
  const u = guardar('usuarios', { ...(existente || {}), id: c.usuario_id || uuid(), nombre: nombreCompleto(c), usuario: c.codigo,
    rol: 'cliente', password_hash: hashPassword(password), activo: 1, created_at: existente ? existente.created_at : ahora() });
  return u.id;
}

// ---------- Inventario ----------
const stockDe = (pid) => Number((uno('SELECT COALESCE(SUM(cantidad), 0) AS s FROM movimientos WHERE producto_id = ?', pid) || {}).s || 0);
function productoVista(p) {
  const stock = stockDe(p.id);
  return { ...p, activo: !!p.activo, stock, stock_bajo: stock <= p.stock_minimo };
}

// ---------- Utilidades de consulta por fecha ----------
const enRango = (tabla, q, campo = 'created_at') => {
  const [a, b] = limites(q.desde, q.hasta);
  return todos(`SELECT * FROM ${tabla} WHERE ${campo} >= ? AND ${campo} < ? ORDER BY ${campo} DESC`, a, b);
};
const nombresUsuarios = () => Object.fromEntries(todos('SELECT id, nombre, rol FROM usuarios').map((u) => [u.id, u]));
const sumaDia = (tabla, campo, dia) => {
  const [a, b] = limites(dia, dia);
  return Number(uno(`SELECT COALESCE(SUM(${campo}), 0) AS s, COUNT(*) AS n FROM ${tabla} WHERE created_at >= ? AND created_at < ?`, a, b).s);
};
const cuentaDia = (tabla, dia) => {
  const [a, b] = limites(dia, dia);
  return Number(uno(`SELECT COUNT(*) AS n FROM ${tabla} WHERE created_at >= ? AND created_at < ?`, a, b).n);
};
const serieDia = (dia) => ({ dia, ventas: sumaDia('ventas', 'total', dia), membresias: sumaDia('pagos', 'monto', dia),
  visitas: sumaDia('visitas', 'monto', dia), asistencias: cuentaDia('asistencias', dia) });

const sitioDatos = () => {
  const r = uno("SELECT * FROM sitio WHERE id = 'sitio'");
  const d = r ? JSON.parse(r.datos) : {};
  d.textos = d.textos || {};
  return d;
};
const pubVista = (p) => ({ ...p, destacada: !!p.destacada, activo: !!p.activo, imagen: urlMedia('pub', p) });
const malteadaVista = (m) => ({ ...m, activo: !!m.activo, imagen: urlMedia('malteada', m) });

// =====================================================================
//  AUTENTICACIÓN
// =====================================================================
ruta('POST', '/auth/login', (p, q, b, ctx) => {
  const ident = String(b.usuario || '').trim();
  const clave = `${ctx.ip}|${ident.toLowerCase()}`;
  frenoLogin(clave);
  if (!ident || !b.password) err(400, 'Escribe tu usuario y contraseña.');
  let u = uno("SELECT * FROM usuarios WHERE lower(usuario) = lower(?) AND rol != 'cliente'", ident);
  if (!u) {
    const dig = ident.replace(/\D/g, '');
    const c = dig ? uno('SELECT * FROM clientes WHERE activo = 1 AND usuario_id IS NOT NULL AND (codigo = ? OR telefono = ?) ORDER BY created_at DESC LIMIT 1', dig, dig) : null;
    if (c) u = uno('SELECT * FROM usuarios WHERE id = ?', c.usuario_id);
  }
  if (!u || !u.activo || !verificarPassword(b.password, u.password_hash)) {
    falloLogin(clave);
    err(401, 'Usuario o contraseña incorrectos.');
  }
  intentos.delete(clave);
  const token = tokenAleatorio();
  guardar('sesiones', { usuario_id: u.id, token_hash: sha256(token), inicio: ahora(), fin: null,
    expira: new Date(Date.now() + DURACION[u.rol]).toISOString(), ultimo_uso: ahora(), ip: ctx.ip, entorno: cfg.MODO });
  ctx.cookie = cookieSesion(token, DURACION[u.rol]);
  ctx.usuario = publicoUsuario(u);
  if (u.rol !== 'cliente') log(ctx, 'sesion.iniciar');
  return { usuario: ctx.usuario, entorno: cfg.MODO };
});

ruta('POST', '/auth/logout', (p, q, b, ctx) => {
  if (ctx.sesion) {
    actualizar('sesiones', ctx.sesion.sesionId, { fin: ahora() });
    if (ctx.usuario.rol !== 'cliente') log(ctx, 'sesion.cerrar');
  }
  ctx.cookie = cookieSesion(null);
  return { ok: true };
});

ruta('GET', '/auth/me', (p, q, b, ctx) => {
  if (!ctx.usuario) err(401, 'Sin sesión');
  return { usuario: ctx.usuario, entorno: cfg.MODO };
});

ruta('POST', '/auth/password', (p, q, b, ctx) => {
  requiere(ctx);
  const u = uno('SELECT * FROM usuarios WHERE id = ?', ctx.usuario.id);
  if (!verificarPassword(b.actual, u.password_hash)) err(400, 'La contraseña actual no es correcta.');
  if (String(b.nueva || '').length < 8) err(400, 'La contraseña nueva debe tener al menos 8 caracteres.');
  actualizar('usuarios', u.id, { password_hash: hashPassword(b.nueva) });
  if (u.rol !== 'cliente') log(ctx, 'usuario.cambiar_password');
  return { ok: true };
});

// =====================================================================
//  PANEL
// =====================================================================
ruta('GET', '/dashboard', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const h = hoy();
  const s = serieDia(h);
  const [a, z] = limites(h, h);
  const ventasHoy = todos('SELECT total, costo_total FROM ventas WHERE created_at >= ? AND created_at < ?', a, z);
  const est = todos(`${SELECT_CLIENTE} WHERE c.activo = 1`).map(conEstado);
  const [a30] = limites(sumarDias(h, -29), h);
  const top = todos(`SELECT d.nombre AS nombre, SUM(d.cantidad) AS unidades, SUM(d.subtotal) AS importe FROM venta_detalle d
    JOIN ventas v ON v.id = d.venta_id WHERE v.created_at >= ? GROUP BY d.producto_id ORDER BY unidades DESC LIMIT 5`, a30);
  const pagosHoy = cuentaDia('pagos', h);
  return {
    hoy: { ventas: s.ventas, ventas_num: ventasHoy.length, membresias: s.membresias, membresias_num: pagosHoy,
      visitas: s.visitas, visitas_num: cuentaDia('visitas', h), asistencias: s.asistencias,
      ingresos: s.ventas + s.membresias + s.visitas,
      ganancia: ventasHoy.reduce((t, v) => t + v.total - v.costo_total, 0) + s.membresias + s.visitas },
    socios: { vigentes: est.filter((c) => c.estado === 'vigente' || c.estado === 'por_vencer').length,
      por_vencer: est.filter((c) => c.estado === 'por_vencer').length, vencidos: est.filter((c) => c.estado === 'vencida').length,
      sin_membresia: est.filter((c) => c.estado === 'sin_membresia').length },
    serie: Array.from({ length: 7 }, (_, i) => serieDia(sumarDias(h, i - 6))),
    top_productos: top,
    por_vencer: est.filter((c) => c.estado === 'por_vencer').sort((x, y) => x.dias_restantes - y.dias_restantes),
    stock_bajo: todos('SELECT * FROM productos WHERE activo = 1').map(productoVista).filter((x) => x.stock_bajo).sort((x, y) => x.stock - y.stock),
  };
});

// =====================================================================
//  CLIENTES
// =====================================================================
ruta('GET', '/clientes', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const t = String(q.q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sinAcentos = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return todos(`${SELECT_CLIENTE} WHERE c.activo = 1 ORDER BY c.nombre COLLATE NOCASE, c.apellidos COLLATE NOCASE`).map(conEstado)
    .filter((c) => !t || sinAcentos(nombreCompleto(c)).includes(t) || c.codigo.includes(t) || (c.telefono || '').includes(t))
    .filter((c) => !q.estado || c.estado === q.estado);
});

ruta('GET', '/clientes/:id', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const c = clientePorId(p.id) || err(404, 'Cliente no encontrado.');
  return {
    cliente: { ...c, usuario_portal: c.usuario_id ? c.codigo : null },
    membresias: todos('SELECT * FROM membresias WHERE cliente_id = ? ORDER BY fecha_fin DESC', c.id).map((m) => ({ ...m, plan: m.plan_nombre, activo: !!m.activo })),
    asistencias: todos('SELECT * FROM asistencias WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 60', c.id),
    pagos: todos('SELECT * FROM pagos WHERE cliente_id = ? ORDER BY created_at DESC', c.id),
  };
});

const datosCliente = (b) => ({
  nombre: texto(b.nombre, 80), apellidos: texto(b.apellidos, 120) || '', telefono: (String(b.telefono || '').replace(/\D/g, '') || null),
  email: texto(b.email, 160), fecha_nacimiento: /^\d{4}-\d{2}-\d{2}$/.test(b.fecha_nacimiento || '') ? b.fecha_nacimiento : null,
  notas: texto(b.notas, 1000),
});

ruta('POST', '/clientes', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const d = datosCliente(b);
  if (!d.nombre) err(400, 'El campo "nombre" es obligatorio.');
  if (b.password && String(b.password).length < 8) err(400, 'La contraseña del portal debe tener al menos 8 caracteres.');
  return transaccion(() => {
    let c = guardar('clientes', { ...d, codigo: codigoNuevo(), qr_token: digitos(4), foto: imagenNueva(b.foto, null), usuario_id: null, activo: 1 });
    if (b.password) c = actualizar('clientes', c.id, { usuario_id: cuentaCliente(c, b.password) });
    log(ctx, 'cliente.crear', { codigo: c.codigo, nombre: nombreCompleto(c) });
    const membresia = b.plan_id ? crearMembresia(ctx, c.id, b.plan_id, b.metodo_pago) : null;
    return { cliente: clientePorId(c.id), membresia };
  });
});

ruta('PUT', '/clientes/:id', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const actual = uno('SELECT * FROM clientes WHERE id = ?', p.id) || err(404, 'Cliente no encontrado.');
  const d = datosCliente(b);
  if (!d.nombre) err(400, 'El campo "nombre" es obligatorio.');
  transaccion(() => {
    const c = actualizar('clientes', p.id, { ...d, foto: imagenNueva(b.foto, actual.foto) });
    if (c.usuario_id) {
      const u = uno('SELECT * FROM usuarios WHERE id = ?', c.usuario_id);
      if (u && u.nombre !== nombreCompleto(c)) actualizar('usuarios', u.id, { nombre: nombreCompleto(c) });
    }
    log(ctx, 'cliente.editar', { codigo: c.codigo, nombre: nombreCompleto(c) });
  });
  return clientePorId(p.id);
});

ruta('POST', '/clientes/:id/acceso', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const c = uno('SELECT * FROM clientes WHERE id = ?', p.id) || err(404, 'Cliente no encontrado.');
  transaccion(() => {
    const uid = cuentaCliente(c, b.password);
    if (c.usuario_id !== uid) actualizar('clientes', c.id, { usuario_id: uid });
    log(ctx, 'cliente.acceso_portal', { codigo: c.codigo });
  });
  return { ok: true };
});

ruta('POST', '/clientes/:id/nuevo-qr', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const c = uno('SELECT * FROM clientes WHERE id = ?', p.id) || err(404, 'Cliente no encontrado.');
  let t = digitos(4);
  while (t === c.qr_token) t = digitos(4);
  actualizar('clientes', c.id, { qr_token: t });
  log(ctx, 'cliente.nuevo_qr', { codigo: c.codigo });
  return clientePorId(c.id);
});

ruta('DELETE', '/clientes/:id', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const c = uno('SELECT * FROM clientes WHERE id = ?', p.id) || err(404, 'Cliente no encontrado.');
  actualizar('clientes', c.id, { activo: 0 });
  log(ctx, 'cliente.baja', { codigo: c.codigo, nombre: nombreCompleto(c) });
  return { ok: true };
});

// ---------------------------------------------------------------------
//  Importar clientes (migración desde el sistema anterior o desde Excel)
//  Primero se manda con confirmar=false para ver qué pasaría, y luego
//  con confirmar=true para guardar.
// ---------------------------------------------------------------------
const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
/** Acepta 2026-10-31, 31/10/2026, 31-10-2026, 31/10/26. Devuelve ISO, null (vacío) o false (no válida). */
function fechaFlexible(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  let y, m, d;
  let r = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (r) [, y, m, d] = r.map(Number);
  else if ((r = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) { [, d, m, y] = r.map(Number); if (y < 100) y += 2000; }
  else return false;
  const f = new Date(Date.UTC(y, m - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d || y < 1900 || y > 2100) return false;
  return f.toISOString().slice(0, 10);
}

ruta('POST', '/clientes/importar', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const filas = Array.isArray(b.filas) ? b.filas : err(400, 'No llegaron filas para importar.');
  if (!filas.length) err(400, 'El archivo no tiene filas.');
  if (filas.length > 5000) err(400, 'Máximo 5,000 socios por archivo. Divide el archivo en partes.');
  const planes = todos('SELECT * FROM planes');
  const planPorNombre = Object.fromEntries(planes.map((x) => [normal(x.nombre), x]));
  const telefonos = new Set(todos('SELECT telefono FROM clientes WHERE activo = 1 AND telefono IS NOT NULL').map((r) => r.telefono));
  const codigos = new Set(todos('SELECT codigo FROM clientes').map((r) => r.codigo));
  const nombres = new Set(todos('SELECT nombre, apellidos FROM clientes WHERE activo = 1').map((r) => normal(nombreCompleto(r))));
  const codigoLibre = () => { let c; do { c = String(1 + Math.floor(Math.random() * 9)) + digitos(5); } while (codigos.has(c)); return c; };
  const omitidos = [], errores = [], listos = [];

  filas.forEach((f0, i) => {
    const f = f0 || {};
    const fila = i + 2; // la fila 1 del archivo son los títulos
    const nombre = texto(f.nombre, 80);
    const apellidos = texto(f.apellidos, 120) || '';
    if (!nombre) return errores.push({ fila, motivo: 'Falta el nombre.' });
    const tel = String(f.telefono || '').replace(/\D/g, '').slice(-10) || null;
    const completo = normal(`${nombre} ${apellidos}`);
    if (tel && telefonos.has(tel)) return omitidos.push({ fila, nombre: `${nombre} ${apellidos}`.trim(), motivo: 'Ya existe un socio con ese teléfono.' });
    if (!tel && nombres.has(completo)) return omitidos.push({ fila, nombre: `${nombre} ${apellidos}`.trim(), motivo: 'Ya existe un socio con ese nombre.' });
    const fin = fechaFlexible(f.fecha_fin);
    let ini = fechaFlexible(f.fecha_inicio);
    const nac = fechaFlexible(f.fecha_nacimiento);
    const alta = fechaFlexible(f.alta);
    if (fin === false) return errores.push({ fila, motivo: `La fecha de vencimiento "${f.fecha_fin}" no se entiende. Usa 31/12/2026.` });
    if (ini === false) return errores.push({ fila, motivo: `La fecha de inicio "${f.fecha_inicio}" no se entiende. Usa 01/12/2026.` });
    const plan = f.plan ? planPorNombre[normal(f.plan)] : null;
    if (fin && !ini) ini = sumarDias(fin, -((plan ? plan.duracion_dias : 30) - 1));
    if (fin && ini > fin) return errores.push({ fila, motivo: 'La fecha de inicio es después del vencimiento.' });
    const anterior = String(f.codigo || '').trim();
    const conservar = /^[1-9]\d{5}$/.test(anterior) && !codigos.has(anterior);
    const codigo = conservar ? anterior : codigoLibre();
    const notas = [texto(f.notas, 800), anterior && !conservar ? `Número en el sistema anterior: ${anterior}` : null].filter(Boolean).join(' · ') || null;
    codigos.add(codigo);
    if (tel) telefonos.add(tel);
    nombres.add(completo);
    listos.push({
      cliente: { codigo, qr_token: digitos(4), nombre, apellidos, telefono: tel, email: texto(f.email, 160), fecha_nacimiento: nac || null, notas,
        foto: null, usuario_id: null, activo: 1, created_at: alta ? new Date(`${alta}T12:00:00${cfg.DESFASE}`).toISOString() : undefined },
      membresia: fin ? { plan_id: plan ? plan.id : 'importado', plan_nombre: plan ? plan.nombre : (texto(f.plan, 80) || 'Importado'),
        fecha_inicio: ini, fecha_fin: fin, precio: f.precio !== undefined && f.precio !== '' ? Math.max(0, numero(f.precio)) : plan ? plan.precio : 0, activo: 1 } : null,
      conservo_codigo: conservar,
    });
  });

  const resumen = {
    total: filas.length, nuevos: listos.length, con_membresia: listos.filter((x) => x.membresia).length,
    vigentes: listos.filter((x) => x.membresia && x.membresia.fecha_fin >= hoy()).length,
    codigos_conservados: listos.filter((x) => x.conservo_codigo).length,
    planes_sin_coincidencia: [...new Set(listos.filter((x) => x.membresia && x.membresia.plan_id === 'importado').map((x) => x.membresia.plan_nombre))],
    omitidos, errores,
    muestra: listos.slice(0, 5).map((x) => ({ codigo: x.cliente.codigo, nombre: nombreCompleto(x.cliente), telefono: x.cliente.telefono, plan: x.membresia ? x.membresia.plan_nombre : null, vence: x.membresia ? x.membresia.fecha_fin : null })),
  };
  if (!b.confirmar) return { ...resumen, simulacion: true };
  transaccion(() => {
    for (const x of listos) {
      const c = guardar('clientes', x.cliente);
      if (x.membresia) guardar('membresias', { ...x.membresia, cliente_id: c.id, created_at: c.created_at });
    }
    log(ctx, 'cliente.importar', { nuevos: resumen.nuevos, con_membresia: resumen.con_membresia, omitidos: omitidos.length });
  });
  return { ...resumen, simulacion: false };
});

// =====================================================================
//  MEMBRESÍAS
// =====================================================================
ruta('GET', '/membresias/planes', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const est = todos(`${SELECT_CLIENTE} WHERE c.activo = 1`).map(conEstado);
  return todos(`SELECT * FROM planes ${q.todos === '1' ? '' : 'WHERE activo = 1'} ORDER BY activo DESC, orden, precio`).map((x) => ({
    ...x, activo: !!x.activo, socios_vigentes: est.filter((c) => c.plan_id === x.id && c.dias_restantes >= 0).length,
  }));
});
const datosPlan = (b) => {
  const d = { nombre: texto(b.nombre, 80), duracion_dias: Math.round(numero(b.duracion_dias)), precio: numero(b.precio, -1), descripcion: texto(b.descripcion, 200) };
  if (!d.nombre) err(400, 'El plan necesita un nombre.');
  if (d.duracion_dias < 1) err(400, 'La duración debe ser de al menos 1 día.');
  if (d.precio < 0) err(400, 'Escribe un precio válido.');
  return d;
};
ruta('POST', '/membresias/planes', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const n = guardar('planes', { ...datosPlan(b), activo: 1, orden: 99 });
  log(ctx, 'plan.crear', { nombre: n.nombre, precio: n.precio });
  return { ...n, activo: true };
});
ruta('PUT', '/membresias/planes/:id', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  if (!uno('SELECT id FROM planes WHERE id = ?', p.id)) err(404, 'Plan no encontrado.');
  const x = actualizar('planes', p.id, { ...datosPlan(b), activo: b.activo !== false ? 1 : 0 });
  log(ctx, 'plan.editar', { nombre: x.nombre, precio: x.precio, activo: !!x.activo });
  return { ...x, activo: !!x.activo };
});
ruta('POST', '/membresias', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  return transaccion(() => crearMembresia(ctx, b.cliente_id, b.plan_id, b.metodo_pago));
});

// =====================================================================
//  ACCESO Y VISITAS
// =====================================================================
ruta('POST', '/acceso/entrada', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const cod = String(b.codigo || '').replace(/\s/g, '');
  let c0 = null;
  let metodo = 'manual';
  if (/^\d{10}$/.test(cod)) {
    // QR de credencial: código de socio (6) + verificador (4)
    c0 = uno('SELECT * FROM clientes WHERE activo = 1 AND codigo = ?', cod.slice(0, 6));
    if (c0 && c0.qr_token !== cod.slice(6)) {
      log(ctx, 'acceso.denegado', { codigo: c0.codigo, motivo: 'qr_invalido' });
      return { permitido: false, motivo: 'qr_invalido', cliente: clientePorId(c0.id),
        mensaje: 'Esta credencial ya no es válida (se generó un QR nuevo). Revisa que sea la persona y reimprime su credencial.' };
    }
    if (!c0) c0 = uno('SELECT * FROM clientes WHERE activo = 1 AND telefono = ?', cod);
    else metodo = b.metodo === 'camara' ? 'camara' : 'lector';
  } else if (cod) {
    c0 = uno('SELECT * FROM clientes WHERE activo = 1 AND (codigo = ? OR telefono = ?) ORDER BY created_at DESC LIMIT 1', cod, cod);
  }
  if (!c0) return { permitido: false, motivo: 'no_encontrado', mensaje: 'No hay ningún socio con ese código.' };
  const c = { ...clientePorId(c0.id), foto_url: c0.foto ? `/media/cliente/${c0.id}?v=${version(c0)}` : null };
  if (c.estado === 'vencida' || c.estado === 'sin_membresia') {
    log(ctx, 'acceso.denegado', { cliente: nombreCompleto(c), estado: c.estado });
    return { permitido: false, motivo: c.estado, cliente: c,
      mensaje: c.estado === 'vencida' ? 'Su membresía ya venció. Ofrece renovar.' : 'No tiene membresía. Ofrece un plan o registra visita.' };
  }
  const hace2h = new Date(Date.now() - 2 * 3600e3).toISOString();
  const rec = uno('SELECT * FROM asistencias WHERE cliente_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1', c.id, hace2h);
  if (rec) return { permitido: true, repetida: true, cliente: c, hora: rec.created_at, mensaje: 'Ya había registrado su entrada hace poco.' };
  const a = guardar('asistencias', { cliente_id: c.id, metodo, usuario_id: ctx.usuario.id });
  return { permitido: true, cliente: c, hora: a.created_at, metodo,
    mensaje: c.estado === 'por_vencer' ? `Le quedan ${c.dias_restantes} ${c.dias_restantes === 1 ? 'día' : 'días'}. Recuérdale renovar.` : 'Bienvenido.' };
});

ruta('GET', '/acceso/hoy', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const [a, z] = limites(hoy(), hoy());
  return todos(`SELECT a.*, c.codigo, c.nombre, c.apellidos FROM asistencias a LEFT JOIN clientes c ON c.id = a.cliente_id
    WHERE a.created_at >= ? AND a.created_at < ? ORDER BY a.created_at DESC`, a, z);
});

ruta('GET', '/acceso/visitas', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const us = nombresUsuarios();
  return { precio_sugerido: numero(sitioDatos().precio_visita, 50),
    visitas: enRango('visitas', q).map((v) => ({ ...v, registro: (us[v.usuario_id] || {}).nombre })) };
});

ruta('POST', '/acceso/visitas', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const nombre = texto(b.nombre, 120);
  if (!nombre) err(400, 'El campo "nombre" es obligatorio.');
  const monto = numero(b.monto, -1);
  if (monto < 0) err(400, 'Escribe un monto válido.');
  const v = guardar('visitas', { nombre, telefono: texto(b.telefono, 20), monto, metodo: METODOS.includes(b.metodo_pago) ? b.metodo_pago : 'efectivo', usuario_id: ctx.usuario.id });
  log(ctx, 'visita.registrar', { nombre: v.nombre, monto: v.monto });
  return v;
});

// =====================================================================
//  PRODUCTOS, INVENTARIO Y VENTAS
// =====================================================================
ruta('GET', '/ventas/productos', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  return todos(`SELECT * FROM productos ${q.todos === '1' ? '' : 'WHERE activo = 1'} ORDER BY categoria, nombre`).map(productoVista);
});
const datosProducto = (b) => {
  const d = { nombre: texto(b.nombre, 120), categoria: texto(b.categoria, 60) || 'General', sku: texto(b.sku, 60),
    precio_venta: numero(b.precio_venta, -1), costo: Math.max(0, numero(b.costo)), stock_minimo: Math.max(0, Math.round(numero(b.stock_minimo, 3))) };
  if (!d.nombre) err(400, 'El campo "nombre" es obligatorio.');
  if (d.precio_venta < 0) err(400, 'Escribe un precio de venta válido.');
  return d;
};
ruta('POST', '/ventas/productos', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  return transaccion(() => {
    const n = guardar('productos', { ...datosProducto(b), activo: 1 });
    const ini = Math.round(numero(b.stock_inicial));
    if (ini > 0) guardar('movimientos', { producto_id: n.id, tipo: 'entrada', cantidad: ini, motivo: 'Inventario inicial', usuario_id: ctx.usuario.id });
    log(ctx, 'producto.crear', { nombre: n.nombre });
    return productoVista(n);
  });
});
ruta('PUT', '/ventas/productos/:id', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  if (!uno('SELECT id FROM productos WHERE id = ?', p.id)) err(404, 'Producto no encontrado.');
  const x = actualizar('productos', p.id, { ...datosProducto(b), activo: b.activo !== false ? 1 : 0 });
  log(ctx, 'producto.editar', { nombre: x.nombre, precio: x.precio_venta });
  return productoVista(x);
});
ruta('POST', '/ventas/productos/:id/movimientos', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const prod = uno('SELECT * FROM productos WHERE id = ?', p.id) || err(404, 'Producto no encontrado.');
  let cant = Number(b.cantidad);
  if (!Number.isInteger(cant) || cant === 0) err(400, 'La cantidad debe ser un número entero distinto de cero.');
  const tipo = ['entrada', 'merma', 'ajuste'].includes(b.tipo) ? b.tipo : 'ajuste';
  if (tipo === 'entrada') cant = Math.abs(cant);
  if (tipo === 'merma') cant = -Math.abs(cant);
  const m = guardar('movimientos', { producto_id: prod.id, tipo, cantidad: cant, motivo: texto(b.motivo, 200), usuario_id: ctx.usuario.id });
  log(ctx, `inventario.${tipo}`, { producto: prod.nombre, cantidad: cant });
  return m;
});
ruta('GET', '/ventas/productos/:id/movimientos', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const us = nombresUsuarios();
  return todos('SELECT * FROM movimientos WHERE producto_id = ? ORDER BY created_at DESC LIMIT 100', p.id)
    .map((m) => ({ ...m, usuario: (us[m.usuario_id] || {}).nombre }));
});
ruta('POST', '/ventas', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  if (!Array.isArray(b.items) || !b.items.length) err(400, 'Agrega al menos un producto a la venta.');
  return transaccion(() => {
    const lineas = b.items.map((it) => {
      const pr = uno('SELECT * FROM productos WHERE id = ?', it.producto_id) || err(400, 'Uno de los productos ya no existe.');
      const cant = Math.round(Number(it.cantidad));
      if (!(cant > 0)) err(400, 'Cantidad no válida.');
      const st = stockDe(pr.id);
      if (st < cant) err(400, `No hay suficiente "${pr.nombre}". Quedan ${st}.`);
      return { pr, cant };
    });
    const id = uuid();
    const folio = `V${Date.now().toString(36).toUpperCase()}`;
    let total = 0, costo = 0;
    lineas.forEach(({ pr, cant }) => {
      total += pr.precio_venta * cant; costo += pr.costo * cant;
      guardar('venta_detalle', { venta_id: id, producto_id: pr.id, nombre: pr.nombre, cantidad: cant, precio: pr.precio_venta, subtotal: pr.precio_venta * cant });
      guardar('movimientos', { producto_id: pr.id, tipo: 'venta', cantidad: -cant, motivo: `Venta ${folio}`, venta_id: id, usuario_id: ctx.usuario.id });
    });
    const v = guardar('ventas', { id, folio, total, costo_total: costo, metodo_pago: METODOS.includes(b.metodo_pago) ? b.metodo_pago : 'efectivo', usuario_id: ctx.usuario.id });
    log(ctx, 'venta.registrar', { folio, total });
    return { ...v, lineas: lineas.map(({ pr, cant }) => ({ nombre: pr.nombre, cantidad: cant, precio: pr.precio_venta })) };
  });
});
ruta('GET', '/ventas', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const us = nombresUsuarios();
  return enRango('ventas', q).map((v) => ({ ...v, vendedor: (us[v.usuario_id] || {}).nombre,
    productos: todos('SELECT nombre, cantidad, subtotal FROM venta_detalle WHERE venta_id = ?', v.id) }));
});

// =====================================================================
//  GESTIÓN: movimientos, bitácora y usuarios
// =====================================================================
ruta('GET', '/gestion/movimientos', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const us = nombresUsuarios();
  const nom = (id) => (us[id] || {}).nombre;
  const cli = Object.fromEntries(todos('SELECT id, nombre, apellidos FROM clientes').map((c) => [c.id, nombreCompleto(c)]));
  const prods = Object.fromEntries(todos('SELECT id, nombre FROM productos').map((x) => [x.id, x.nombre]));
  const ventas = enRango('ventas', q).map((v) => ({ ...v, usuario: nom(v.usuario_id) }));
  const pagos = enRango('pagos', q).map((v) => ({ ...v, usuario: nom(v.usuario_id), cliente: cli[v.cliente_id] || '—' }));
  const visitas = enRango('visitas', q).map((v) => ({ ...v, usuario: nom(v.usuario_id) }));
  const inventario = enRango('movimientos', q).map((v) => ({ ...v, producto: prods[v.producto_id] || '—', usuario: nom(v.usuario_id) }));
  const suma = (a, k) => a.reduce((s, r) => s + Number(r[k]), 0);
  for (const arr of [ventas, pagos, visitas, inventario]) arr.forEach((r) => { delete r.rev; delete r.updated_at; });
  return { ventas, pagos, visitas, inventario, totales: { ventas: suma(ventas, 'total'),
    ganancia_ventas: suma(ventas, 'total') - suma(ventas, 'costo_total'), pagos: suma(pagos, 'monto'), visitas: suma(visitas, 'monto') } };
});

ruta('GET', '/gestion/bitacora', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const us = nombresUsuarios();
  const [a, z] = limites(q.desde, q.hasta);
  const filtroU = q.usuario_id ? ' AND usuario_id = ?' : '';
  const args = q.usuario_id ? [a, z, q.usuario_id] : [a, z];
  return {
    acciones: todos(`SELECT * FROM bitacora WHERE created_at >= ? AND created_at < ?${filtroU} ORDER BY created_at DESC LIMIT 1000`, ...args)
      .map((x) => ({ ...x, detalle: x.detalle ? JSON.parse(x.detalle) : null, usuario: (us[x.usuario_id] || {}).nombre, rol: (us[x.usuario_id] || {}).rol })),
    sesiones: todos(`SELECT id, usuario_id, inicio, fin, ip, entorno FROM sesiones WHERE inicio >= ? AND inicio < ?${filtroU} ORDER BY inicio DESC LIMIT 500`, ...args)
      .filter((s) => us[s.usuario_id] && us[s.usuario_id].rol !== 'cliente').map((s) => ({ ...s, usuario: us[s.usuario_id].nombre })),
  };
});

ruta('GET', '/gestion/usuarios', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  return todos("SELECT u.*, (SELECT MAX(inicio) FROM sesiones s WHERE s.usuario_id = u.id) AS ultima_sesion FROM usuarios u WHERE rol != 'cliente' ORDER BY activo DESC, nombre")
    .map((u) => ({ ...publicoUsuario(u), ultima_sesion: u.ultima_sesion }));
});
ruta('POST', '/gestion/usuarios', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const usuario = String(b.usuario || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,60}$/.test(usuario)) err(400, 'El usuario debe tener de 3 a 60 letras, números, puntos o guiones.');
  if (/^\d+$/.test(usuario)) err(400, 'El usuario del personal no puede ser solo números (se confunde con un número de socio).');
  if (!texto(b.nombre)) err(400, 'Escribe el nombre completo.');
  if (String(b.password || '').length < 8) err(400, 'La contraseña debe tener al menos 8 caracteres.');
  if (uno('SELECT id FROM usuarios WHERE lower(usuario) = ?', usuario)) err(400, 'Ese nombre de usuario ya está ocupado.');
  const u = guardar('usuarios', { nombre: texto(b.nombre, 80), usuario, rol: b.rol === 'dueno' ? 'dueno' : 'admin',
    password_hash: hashPassword(b.password), activo: 1 });
  log(ctx, 'usuario.crear', { usuario: u.usuario, rol: u.rol });
  return publicoUsuario(u);
});
ruta('PUT', '/gestion/usuarios/:id', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const u0 = uno("SELECT * FROM usuarios WHERE id = ? AND rol != 'cliente'", p.id) || err(404, 'Usuario no encontrado.');
  if (p.id === ctx.usuario.id && b.activo === false) err(400, 'No puedes desactivar tu propio usuario.');
  const cambios = { nombre: texto(b.nombre, 80) || u0.nombre, activo: b.activo !== false ? 1 : 0 };
  if (b.password) {
    if (String(b.password).length < 8) err(400, 'La contraseña debe tener al menos 8 caracteres.');
    cambios.password_hash = hashPassword(b.password);
  }
  const u = actualizar('usuarios', p.id, cambios);
  if (!u.activo) ejecutar('UPDATE sesiones SET fin = ? WHERE usuario_id = ? AND fin IS NULL', ahora(), u.id);
  log(ctx, 'usuario.editar', { usuario: u.usuario, activo: !!u.activo, cambio_password: !!b.password });
  return publicoUsuario(u);
});

// =====================================================================
//  PORTAL DEL CLIENTE
// =====================================================================
ruta('GET', '/portal/resumen', (p, q, b, ctx) => {
  if (!ctx.usuario || ctx.usuario.rol !== 'cliente') err(403, 'Esta sección es para clientes.');
  const c0 = uno('SELECT id FROM clientes WHERE usuario_id = ?', ctx.usuario.id) || err(404, 'No encontramos tu ficha de socio.');
  const c = clientePorId(c0.id);
  const asis = todos('SELECT id, created_at FROM asistencias WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 400', c.id);
  const mes = hoy().slice(0, 7);
  return { cliente: c, asistencias: asis.slice(0, 200), pagos: todos('SELECT concepto, monto, metodo, created_at FROM pagos WHERE cliente_id = ? ORDER BY created_at DESC', c.id),
    asistencias_mes: asis.filter((a) => diaDe(a.created_at).slice(0, 7) === mes).length };
});

// =====================================================================
//  SITIO WEB
// =====================================================================
ruta('GET', '/publico/sitio', () => {
  const h = hoy();
  const s = sitioDatos();
  const pubs = todos("SELECT * FROM publicaciones WHERE activo = 1 AND (tipo != 'promocion' OR vigente_hasta IS NULL OR vigente_hasta >= ?) ORDER BY destacada DESC, created_at DESC", h).map(pubVista);
  const de = (t, n) => pubs.filter((x) => x.tipo === t).slice(0, n)
    .map(({ id, tipo, titulo, texto: t2, imagen, vigente_hasta, destacada, created_at }) => ({ id, tipo, titulo, texto: t2, imagen, vigente_hasta, destacada, created_at }));
  return {
    sitio: s, promociones: de('promocion', 6), novedades: de('novedad', 6), galeria: de('galeria', 16),
    planes: todos('SELECT nombre, duracion_dias, precio, descripcion FROM planes WHERE activo = 1 ORDER BY orden, precio'),
    precio_visita: numero(s.precio_visita, 0),
    malteadas: todos('SELECT * FROM malteadas WHERE activo = 1 ORDER BY orden, nombre').map(malteadaVista)
      .map(({ id, nombre, descripcion, ingredientes, proteina_g, precio, color, imagen, etiqueta }) => ({ id, nombre, descripcion, ingredientes, proteina_g, precio, color, imagen, etiqueta })),
  };
});

ruta('GET', '/sitio', (p, q, b, ctx) => {
  requiere(ctx, ...STAFF);
  const us = nombresUsuarios();
  return {
    sitio: sitioDatos(),
    publicaciones: todos('SELECT * FROM publicaciones ORDER BY activo DESC, created_at DESC').map((x) => ({ ...pubVista(x), autor: x.autor || (us[x.usuario_id] || {}).nombre })),
    malteadas: todos('SELECT * FROM malteadas ORDER BY activo DESC, orden, nombre').map(malteadaVista),
  };
});

const CAMPOS_SITIO = ['eslogan', 'descripcion', 'horario', 'telefono', 'whatsapp', 'email', 'direccion', 'maps_url', 'facebook', 'instagram', 'tiktok', 'sitio_web', 'credencial_texto'];
const CAMPOS_TEXTOS = ['hero_titulo', 'hero_linea', 'marquesina', 'manifiesto', 'bloque_titulo', 'bloque_script', 'etiquetas',
  'malteadas_titulo', 'malteadas_texto', 'cierre_titulo', 'cierre_script'];
const urlSegura = (u) => (u && /^https?:\/\//i.test(u) ? u : null);

ruta('PUT', '/sitio', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const s = sitioDatos();
  for (const k of CAMPOS_SITIO) if (k in b) s[k] = texto(b[k], 1000);
  for (const k of ['maps_url', 'facebook', 'instagram', 'tiktok']) if (k in b) s[k] = urlSegura(s[k]);
  if ('precio_visita' in b) s.precio_visita = Math.max(0, numero(b.precio_visita, s.precio_visita || 0));
  if (b.textos && typeof b.textos === 'object') {
    for (const k of CAMPOS_TEXTOS) if (k in b.textos) s.textos[k] = texto(b.textos[k], 400);
    if ('intro' in b.textos) s.textos.intro = !!b.textos.intro;
  }
  guardar('sitio', { id: 'sitio', datos: JSON.stringify(s) });
  log(ctx, 'sitio.editar');
  return s;
});

const TIPOS_PUB = ['promocion', 'novedad', 'galeria'];
function datosPub(b, actual) {
  const tipo = TIPOS_PUB.includes(b.tipo) ? b.tipo : 'promocion';
  const d = { tipo, titulo: texto(b.titulo, 120), texto: texto(b.texto, 2000), imagen: imagenNueva(b.imagen, actual && actual.imagen),
    vigente_hasta: tipo === 'promocion' && /^\d{4}-\d{2}-\d{2}$/.test(b.vigente_hasta || '') ? b.vigente_hasta : null,
    destacada: b.destacada ? 1 : 0 };
  if (!d.titulo) err(400, 'El campo "título" es obligatorio.');
  if (tipo === 'galeria' && !d.imagen) err(400, 'Agrega la foto para la galería.');
  return d;
}
ruta('POST', '/sitio/publicaciones', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const n = guardar('publicaciones', { ...datosPub(b), activo: 1, usuario_id: ctx.usuario.id, autor: ctx.usuario.nombre });
  log(ctx, 'sitio.publicar', { tipo: n.tipo, titulo: n.titulo });
  return pubVista(n);
});
ruta('PUT', '/sitio/publicaciones/:id', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const actual = uno('SELECT * FROM publicaciones WHERE id = ?', p.id) || err(404, 'Publicación no encontrada.');
  const x = actualizar('publicaciones', p.id, { ...datosPub(b, actual), activo: b.activo !== false ? 1 : 0 });
  log(ctx, x.activo ? 'sitio.editar_publicacion' : 'sitio.ocultar', { titulo: x.titulo });
  return pubVista(x);
});

const COLOR = /^#[0-9a-fA-F]{6}$/;
function datosMalteada(b, actual) {
  const d = { nombre: texto(b.nombre, 60), descripcion: texto(b.descripcion, 300), ingredientes: texto(b.ingredientes, 200),
    proteina_g: b.proteina_g === '' || b.proteina_g === null || b.proteina_g === undefined ? null : Math.max(0, Math.round(numero(b.proteina_g))),
    precio: numero(b.precio, -1), color: COLOR.test(b.color || '') ? b.color : '#D3121F', etiqueta: texto(b.etiqueta, 30),
    imagen: imagenNueva(b.imagen, actual && actual.imagen), orden: Math.round(numero(b.orden, actual ? actual.orden : 99)) };
  if (!d.nombre) err(400, 'La malteada necesita un nombre.');
  if (d.precio < 0) err(400, 'Escribe un precio válido.');
  return d;
}
ruta('POST', '/sitio/malteadas', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const n = guardar('malteadas', { ...datosMalteada(b), activo: 1 });
  log(ctx, 'malteada.crear', { nombre: n.nombre, precio: n.precio });
  return malteadaVista(n);
});
ruta('PUT', '/sitio/malteadas/:id', (p, q, b, ctx) => {
  requiere(ctx, 'admin');
  const actual = uno('SELECT * FROM malteadas WHERE id = ?', p.id) || err(404, 'Malteada no encontrada.');
  const x = actualizar('malteadas', p.id, { ...datosMalteada(b, actual), activo: b.activo !== false ? 1 : 0 });
  log(ctx, 'malteada.editar', { nombre: x.nombre, precio: x.precio, activo: !!x.activo });
  return malteadaVista(x);
});

// ---------- Imágenes: /media/<tipo>/<id> ----------
const MEDIA = {
  pub: { tabla: 'publicaciones', campo: 'imagen', publico: true },
  malteada: { tabla: 'malteadas', campo: 'imagen', publico: true },
  cliente: { tabla: 'clientes', campo: 'foto', publico: false },
};
function media(tipo, id, ctx) {
  const m = MEDIA[tipo];
  if (!m) return null;
  if (!m.publico) {
    if (!ctx.usuario) return { status: 401 };
    if (ctx.usuario.rol === 'cliente') {
      const c = uno('SELECT id FROM clientes WHERE usuario_id = ?', ctx.usuario.id);
      if (!c || c.id !== id) return { status: 403 };
    }
  }
  const f = uno(`SELECT ${m.campo} AS dato FROM ${m.tabla} WHERE id = ?`, id);
  if (!f || !f.dato) return { status: 404 };
  const mm = String(f.dato).match(/^data:(image\/[a-z]+);base64,(.*)$/);
  if (!mm) return { status: 404 };
  return { status: 200, tipo: mm[1], cuerpo: Buffer.from(mm[2], 'base64'), publico: m.publico };
}

// ---------- Despachador ----------
async function despachar(metodo, camino, q, cuerpo, ctx) {
  if (ctx.usuario && ctx.usuario.rol === 'dueno' && metodo !== 'GET' && !camino.startsWith('/auth')) {
    err(403, 'El dueño tiene acceso de solo consulta. Pide el cambio al administrador.');
  }
  for (const r of R) {
    const m = r.metodo === metodo && camino.match(r.re);
    if (m) return r.fn(m.groups || {}, q, cuerpo || {}, ctx);
  }
  err(404, 'Ruta no encontrada.');
}

module.exports = { despachar, sesionDe, media, ruta, err };
