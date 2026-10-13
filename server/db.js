/* =====================================================================
   Base de datos SQLite (incluida en Node 22.13+; sin instalar nada).
   Todas las tablas sincronizables tienen:
     id          texto único (uuid)
     updated_at  fecha ISO del último cambio (gana el cambio más reciente)
     rev         contador local de cambios (para saber qué falta enviar)
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); }
catch (e) {
  console.error(`\n  Tu Node.js (${process.version}) es muy viejo para Strong Gym.\n  Instala la versión LTS más reciente (22.13 o mayor) desde https://nodejs.org/es/download y vuelve a intentar.\n`);
  process.exit(1);
}
const cfg = require('./config');
const { uuid, ahora, hashPassword, passwordLegible } = require('./util');

fs.mkdirSync(cfg.DATA_DIR, { recursive: true });
const db = new DatabaseSync(cfg.DB_ARCHIVO);
db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = OFF; PRAGMA busy_timeout = 5000;');

const SYNC = 'updated_at TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0';
db.exec(`
CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, usuario TEXT NOT NULL, rol TEXT NOT NULL,
  password_hash TEXT, activo INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_usuarios_usuario ON usuarios(usuario);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY, codigo TEXT NOT NULL, qr_token TEXT NOT NULL, nombre TEXT NOT NULL, apellidos TEXT,
  telefono TEXT, email TEXT, fecha_nacimiento TEXT, notas TEXT, foto TEXT, usuario_id TEXT,
  activo INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_clientes_codigo ON clientes(codigo);
CREATE INDEX IF NOT EXISTS ix_clientes_tel ON clientes(telefono);

CREATE TABLE IF NOT EXISTS planes (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, duracion_dias INTEGER NOT NULL, precio REAL NOT NULL,
  descripcion TEXT, activo INTEGER NOT NULL DEFAULT 1, orden INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, ${SYNC});

CREATE TABLE IF NOT EXISTS membresias (
  id TEXT PRIMARY KEY, cliente_id TEXT NOT NULL, plan_id TEXT NOT NULL, plan_nombre TEXT,
  fecha_inicio TEXT NOT NULL, fecha_fin TEXT NOT NULL, precio REAL NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_memb_cliente ON membresias(cliente_id, fecha_fin);

CREATE TABLE IF NOT EXISTS pagos (
  id TEXT PRIMARY KEY, cliente_id TEXT, membresia_id TEXT, concepto TEXT, monto REAL NOT NULL,
  metodo TEXT, usuario_id TEXT, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_pagos_fecha ON pagos(created_at);
CREATE INDEX IF NOT EXISTS ix_pagos_cliente ON pagos(cliente_id);

CREATE TABLE IF NOT EXISTS asistencias (
  id TEXT PRIMARY KEY, cliente_id TEXT NOT NULL, metodo TEXT, usuario_id TEXT, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_asis_fecha ON asistencias(created_at);
CREATE INDEX IF NOT EXISTS ix_asis_cliente ON asistencias(cliente_id, created_at);

CREATE TABLE IF NOT EXISTS visitas (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, telefono TEXT, monto REAL NOT NULL, metodo TEXT,
  usuario_id TEXT, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_visitas_fecha ON visitas(created_at);

CREATE TABLE IF NOT EXISTS productos (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, categoria TEXT, sku TEXT, precio_venta REAL NOT NULL,
  costo REAL NOT NULL DEFAULT 0, stock_minimo INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, ${SYNC});

CREATE TABLE IF NOT EXISTS ventas (
  id TEXT PRIMARY KEY, folio TEXT NOT NULL, total REAL NOT NULL, costo_total REAL NOT NULL DEFAULT 0,
  metodo_pago TEXT, usuario_id TEXT, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_ventas_fecha ON ventas(created_at);

CREATE TABLE IF NOT EXISTS venta_detalle (
  id TEXT PRIMARY KEY, venta_id TEXT NOT NULL, producto_id TEXT NOT NULL, nombre TEXT, cantidad INTEGER NOT NULL,
  precio REAL NOT NULL, subtotal REAL NOT NULL, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_detalle_venta ON venta_detalle(venta_id);

CREATE TABLE IF NOT EXISTS movimientos (
  id TEXT PRIMARY KEY, producto_id TEXT NOT NULL, tipo TEXT NOT NULL, cantidad INTEGER NOT NULL, motivo TEXT,
  venta_id TEXT, usuario_id TEXT, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_mov_producto ON movimientos(producto_id);
CREATE INDEX IF NOT EXISTS ix_mov_fecha ON movimientos(created_at);

CREATE TABLE IF NOT EXISTS bitacora (
  id TEXT PRIMARY KEY, usuario_id TEXT, accion TEXT NOT NULL, detalle TEXT, entorno TEXT, created_at TEXT NOT NULL, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_bitacora_fecha ON bitacora(created_at);

CREATE TABLE IF NOT EXISTS sesiones (
  id TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, token_hash TEXT, inicio TEXT NOT NULL, fin TEXT, expira TEXT,
  ultimo_uso TEXT, ip TEXT, entorno TEXT, ${SYNC});
CREATE INDEX IF NOT EXISTS ix_sesiones_token ON sesiones(token_hash);
CREATE INDEX IF NOT EXISTS ix_sesiones_inicio ON sesiones(inicio);

CREATE TABLE IF NOT EXISTS sitio (id TEXT PRIMARY KEY, datos TEXT NOT NULL, ${SYNC});

CREATE TABLE IF NOT EXISTS publicaciones (
  id TEXT PRIMARY KEY, tipo TEXT NOT NULL, titulo TEXT NOT NULL, texto TEXT, imagen TEXT, vigente_hasta TEXT,
  destacada INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, usuario_id TEXT, autor TEXT,
  created_at TEXT NOT NULL, ${SYNC});

CREATE TABLE IF NOT EXISTS malteadas (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, descripcion TEXT, ingredientes TEXT, proteina_g INTEGER,
  precio REAL NOT NULL, color TEXT, imagen TEXT, etiqueta TEXT, activo INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, ${SYNC});
`);

// Tablas que viajan entre recepción y la nube
const TABLAS_SYNC = ['usuarios', 'clientes', 'planes', 'membresias', 'pagos', 'asistencias', 'visitas', 'productos',
  'ventas', 'venta_detalle', 'movimientos', 'bitacora', 'sesiones', 'sitio', 'publicaciones', 'malteadas'];
// Columnas que nunca salen de la copia donde se crearon
const PRIVADAS = { sesiones: ['token_hash'] };

const COLUMNAS = {};
for (const t of TABLAS_SYNC) COLUMNAS[t] = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);

// ---------- Ayudantes de consulta ----------
const limpiar = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
const uno = (sql, ...p) => { const r = db.prepare(sql).get(...p.map(limpiar)); return r ? { ...r } : null; };
const todos = (sql, ...p) => db.prepare(sql).all(...p.map(limpiar)).map((r) => ({ ...r }));
const ejecutar = (sql, ...p) => db.prepare(sql).run(...p.map(limpiar));

let profundidad = 0;
function transaccion(fn) {
  if (profundidad > 0) return fn();
  profundidad++;
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch (_) { /* nada */ } throw e; }
  finally { profundidad--; }
}

function meta(clave, valor) {
  if (valor === undefined) { const r = uno('SELECT valor FROM meta WHERE clave = ?', clave); return r ? r.valor : null; }
  ejecutar('INSERT INTO meta (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', clave, String(valor));
  return valor;
}
function siguienteRev() {
  const n = Number(meta('rev') || 0) + 1;
  meta('rev', n);
  return n;
}

function upsert(tabla, fila, columnas = COLUMNAS[tabla]) {
  const cols = columnas.filter((c) => c in fila);
  const sql = `INSERT INTO ${tabla} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})
    ON CONFLICT(id) DO UPDATE SET ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`;
  ejecutar(sql, ...cols.map((c) => fila[c]));
}

/** Guarda (inserta o reemplaza) una fila marcándola como cambio local. */
function guardar(tabla, fila) {
  const f = { ...fila };
  if (!f.id) f.id = uuid();
  if (COLUMNAS[tabla].includes('created_at') && !f.created_at) f.created_at = ahora();
  f.updated_at = ahora();
  f.rev = siguienteRev();
  upsert(tabla, f);
  return f;
}
/** Cambia solo algunos campos de una fila existente. */
function actualizar(tabla, id, cambios) {
  const actual = uno(`SELECT * FROM ${tabla} WHERE id = ?`, id);
  if (!actual) return null;
  return guardar(tabla, { ...actual, ...cambios, id });
}

/** Aplica una fila que llegó de la otra copia: gana la más reciente. */
function aplicarRemota(tabla, fila) {
  if (!TABLAS_SYNC.includes(tabla) || !fila || !fila.id || !fila.updated_at) return false;
  const actual = uno(`SELECT updated_at FROM ${tabla} WHERE id = ?`, fila.id);
  if (actual && actual.updated_at >= fila.updated_at) return false;
  const f = {};
  for (const c of COLUMNAS[tabla]) if (c in fila && !(PRIVADAS[tabla] || []).includes(c)) f[c] = fila[c];
  f.rev = 0; // no se reenvía: ya existe del otro lado
  upsert(tabla, f);
  return true;
}

// ---------- Datos iniciales ----------
const ANTIGUO = '2000-01-01T00:00:00.000Z'; // así cualquier edición real gana al sincronizar

const SITIO_INICIAL = {
  nombre: 'Strong Gym', ciudad: 'Puruándiro',
  eslogan: 'Entrena fuerte. Entrena en Puruándiro.',
  descripcion: 'Pesas, cardio y un ambiente de comunidad para que alcances tus metas, empieces de cero o vengas de años entrenando.',
  horario: 'Lunes a viernes: 6:00 a 22:00\nSábado: 7:00 a 15:00\nDomingo: Cerrado',
  telefono: null, whatsapp: null, email: null, direccion: 'Puruándiro, Michoacán',
  maps_url: 'https://www.google.com/maps/search/?api=1&query=Strong+Gym+Puru%C3%A1ndiro',
  facebook: null, instagram: null, tiktok: null,
  precio_visita: 50,
  sitio_web: null,
  credencial_texto: 'Credencial personal e intransferible. Preséntala en recepción al llegar.',
  textos: {
    intro: true,
    hero_titulo: 'STRONG',
    hero_linea: 'Gym · Puruándiro',
    marquesina: 'Fuerza, Proteína, Disciplina, Cardio, Comunidad, Sin excusas',
    manifiesto: 'No solo levantamos pesas. Levantamos a *Puruándiro*: *fuerte*, constante y *sin excusas.*',
    bloque_titulo: 'Entrena con todo.',
    bloque_script: 'sin excusas, solo resultados',
    etiquetas: 'Abrimos 6 AM, Pesas y cardio, Asesoría en piso, Barra de proteína',
    malteadas_titulo: 'Barra de proteína',
    malteadas_texto: 'Malteadas preparadas al momento, para antes o después de entrenar. Pídelas en recepción.',
    cierre_titulo: 'La fuerza no es un hábito.',
    cierre_script: 'es un estilo de vida',
  },
};

const PLANES_INICIALES = [
  ['plan-mensual', 'Mensual', 30, 350, 'Acceso libre durante 30 días'],
  ['plan-quincenal', 'Quincenal', 15, 200, 'Acceso libre durante 15 días'],
  ['plan-semanal', 'Semanal', 7, 120, 'Acceso libre durante 7 días'],
  ['plan-estudiante', 'Mensual estudiante', 30, 280, 'Con credencial escolar vigente'],
  ['plan-trimestral', 'Trimestral', 90, 950, 'Tres meses con descuento'],
];

const MALTEADAS_INICIALES = [
  ['mal-chocolate', 'Chocolate Power', 'Chocolate intenso con plátano y crema de cacahuate.', 'Chocolate, plátano, crema de cacahuate', 30, 65, '#5A3220', 'Más pedida'],
  ['mal-fresa', 'Fresa Strong', 'Fresa natural con avena: dulce, fresca y llenadora.', 'Fresa, avena, leche light', 25, 60, '#D6334F', null],
  ['mal-mango', 'Mango Tropical', 'Mango con un toque de coco. Sabe a palmeras.', 'Mango, coco, yogur griego', 25, 60, '#F29A1F', 'Nueva'],
  ['mal-moras', 'Moras Recovery', 'Mezcla de moras para la recuperación después de pierna.', 'Mora azul, frambuesa, avena', 27, 65, '#3A3FA8', null],
  ['mal-cookies', 'Cookies & Cream', 'Vainilla con galleta triturada. Tu antojo, con proteína.', 'Vainilla, galleta, leche light', 28, 70, '#2A2F3A', null],
  ['mal-cafe', 'Café Pre-entreno', 'Café espresso con proteína de vainilla para arrancar con energía.', 'Café, vainilla, canela', 24, 60, '#8A5A3C', 'Antes de entrenar'],
];

function sembrarBase() {
  const avisos = [];
  transaccion(() => {
    if (!uno("SELECT id FROM sitio WHERE id = 'sitio'")) {
      upsert('sitio', { id: 'sitio', datos: JSON.stringify(SITIO_INICIAL), updated_at: ANTIGUO, rev: siguienteRev() });
    }
    if (!uno('SELECT id FROM planes LIMIT 1')) {
      PLANES_INICIALES.forEach(([id, nombre, duracion_dias, precio, descripcion], orden) => upsert('planes', {
        id, nombre, duracion_dias, precio, descripcion, activo: 1, orden, created_at: ANTIGUO, updated_at: ANTIGUO, rev: siguienteRev(),
      }));
    }
    if (!uno('SELECT id FROM malteadas LIMIT 1')) {
      MALTEADAS_INICIALES.forEach(([id, nombre, descripcion, ingredientes, proteina_g, precio, color, etiqueta], orden) => upsert('malteadas', {
        id, nombre, descripcion, ingredientes, proteina_g, precio, color, etiqueta, imagen: null, activo: 1, orden,
        created_at: ANTIGUO, updated_at: ANTIGUO, rev: siguienteRev(),
      }));
    }
    // Usuarios del personal (ids fijos para que recepción y nube no dupliquen)
    const iniciales = [
      ['u-admin', 'Administrador', 'admin', 'admin', cfg.ADMIN_PASSWORD_INICIAL],
      ['u-dueno', 'Dueño', 'dueno', 'dueno', cfg.DUENO_PASSWORD_INICIAL],
    ];
    if (!uno("SELECT id FROM usuarios WHERE rol IN ('admin','dueno') LIMIT 1")) {
      for (const [id, nombre, usuario, rol, pw0] of iniciales) {
        const pw = pw0 || passwordLegible();
        upsert('usuarios', { id, nombre, usuario, rol, password_hash: hashPassword(pw), activo: 1,
          created_at: ANTIGUO, updated_at: ANTIGUO, rev: siguienteRev() });
        avisos.push(`  ${rol === 'admin' ? 'Administrador' : 'Dueño        '}  usuario: ${usuario.padEnd(8)} contraseña: ${pw}`);
      }
    }
  });
  if (avisos.length) {
    const txt = ['Strong Gym · usuarios iniciales', '', ...avisos, '',
      'Entra con estos datos y cambia la contraseña en "Mi cuenta".',
      'Si vas a sincronizar con la nube, usa las MISMAS contraseñas iniciales en ambas copias',
      '(variables ADMIN_PASSWORD_INICIAL y DUENO_PASSWORD_INICIAL) o cámbialas después en recepción.', ''].join('\n');
    try { fs.writeFileSync(path.join(cfg.DATA_DIR, 'CREDENCIALES-INICIALES.txt'), txt); } catch (_) { /* nada */ }
    console.log(`\n${txt}`);
  }
}

module.exports = {
  db, uno, todos, ejecutar, transaccion, meta, guardar, actualizar, aplicarRemota, upsert, siguienteRev,
  TABLAS_SYNC, PRIVADAS, COLUMNAS, sembrarBase, SITIO_INICIAL,
};
