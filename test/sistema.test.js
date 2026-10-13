/* Pruebas de punta a punta: levanta una copia "nube" y una "recepción",
   usa la API como lo haría el navegador y revisa que se sincronicen.
   Ejecutar:  npm test   */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-prueba-'));
const TOKEN = 'token-de-prueba-0123456789abcdef';
const procesos = [];

function levantar(nombre, puerto, extra) {
  const p = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    cwd: RAIZ,
    env: { ...process.env, PORT: String(puerto), DATA_DIR: path.join(TMP, nombre), ADMIN_PASSWORD_INICIAL: 'admin-prueba-1', DUENO_PASSWORD_INICIAL: 'dueno-prueba-1', SYNC_TOKEN: TOKEN, SYNC_INTERVALO_SEG: '3600', NUBE_URL: '', ...extra },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  p.stderr.on('data', (d) => process.stderr.write(`[${nombre}] ${d}`));
  procesos.push(p);
  return p;
}
async function esperar(url) {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${url}/api/salud`); if (r.ok) return; } catch (e) { /* aún no */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`No arrancó ${url}`);
}
function cliente(base) {
  let cookie = '';
  const llamar = async (metodo, ruta, cuerpo) => {
    const r = await fetch(`${base}/api${ruta}`, {
      method: metodo,
      headers: { ...(cuerpo ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || r.status); e.status = r.status; throw e; }
    return d;
  };
  return { get: (r) => llamar('GET', r), post: (r, b = {}) => llamar('POST', r, b), put: (r, b = {}) => llamar('PUT', r, b), del: (r) => llamar('DELETE', r) };
}

const NUBE = 'http://127.0.0.1:3591';
const LOCAL = 'http://127.0.0.1:3592';

before(async () => {
  levantar('nube', 3591, { MODO: 'nube', COOKIE_SEGURA: '0' });
  levantar('local', 3592, { MODO: 'local', NUBE_URL: NUBE });
  await Promise.all([esperar(NUBE), esperar(LOCAL)]);
});
after(() => { procesos.forEach((p) => p.kill()); fs.rmSync(TMP, { recursive: true, force: true }); });

test('flujo completo en recepción y sincronización con la nube', async () => {
  const rec = cliente(LOCAL);
  // Contraseña equivocada
  await assert.rejects(rec.post('/auth/login', { usuario: 'admin', password: 'mala' }), (e) => e.status === 401);
  const yo = await rec.post('/auth/login', { usuario: 'admin', password: 'admin-prueba-1' });
  assert.equal(yo.usuario.rol, 'admin');
  assert.equal(yo.entorno, 'local');

  // Alta de cliente con membresía, foto y portal
  const foto = `data:image/png;base64,${fs.readFileSync(path.join(RAIZ, 'public/img/icono-192.png')).toString('base64')}`;
  const planes = await rec.get('/membresias/planes');
  const alta = await rec.post('/clientes', { nombre: 'Lucía', apellidos: 'Prueba Sync', telefono: '438 555 1234', plan_id: planes[0].id, metodo_pago: 'efectivo', password: 'socia-12345', foto });
  const c = alta.cliente;
  assert.match(c.codigo, /^\d{6}$/);
  assert.match(c.qr, /^\d{10}$/);
  assert.ok(c.qr.startsWith(c.codigo));
  assert.equal(c.estado, 'vigente');
  assert.ok(c.foto_url);

  // Entrada con QR válido, repetida, QR viejo y por teléfono
  const e1 = await rec.post('/acceso/entrada', { codigo: c.qr, metodo: 'lector' });
  assert.equal(e1.permitido, true);
  assert.equal(e1.metodo, 'lector');
  const e2 = await rec.post('/acceso/entrada', { codigo: c.qr });
  assert.equal(e2.repetida, true);
  const nuevo = await rec.post(`/clientes/${c.id}/nuevo-qr`);
  assert.notEqual(nuevo.qr, c.qr);
  const e3 = await rec.post('/acceso/entrada', { codigo: c.qr });
  assert.equal(e3.permitido, false);
  assert.equal(e3.motivo, 'qr_invalido');
  const e4 = await rec.post('/acceso/entrada', { codigo: '4385551234' });
  assert.equal(e4.permitido, true);
  assert.equal(e4.repetida, true, 'por teléfono la encuentra, pero ya había entrado');
  const e5 = await rec.post('/acceso/entrada', { codigo: '000000' });
  assert.equal(e5.motivo, 'no_encontrado');

  // Venta con inventario
  const prod = await rec.post('/ventas/productos', { nombre: 'Agua 1 L', categoria: 'Bebidas', precio_venta: 20, costo: 9, stock_minimo: 2, stock_inicial: 5 });
  await assert.rejects(rec.post('/ventas', { items: [{ producto_id: prod.id, cantidad: 9 }], metodo_pago: 'efectivo' }), /No hay suficiente/);
  const v = await rec.post('/ventas', { items: [{ producto_id: prod.id, cantidad: 2 }], metodo_pago: 'tarjeta' });
  assert.equal(v.total, 40);
  const prods = await rec.get('/ventas/productos');
  assert.equal(prods.find((x) => x.id === prod.id).stock, 3);

  // Sitio: malteada y textos
  const sitio = await rec.get('/sitio');
  const mal = sitio.malteadas[0];
  await rec.put(`/sitio/malteadas/${mal.id}`, { ...mal, precio: 77 });
  await rec.put('/sitio', { whatsapp: '4381112233', textos: { hero_titulo: 'FUERZA' } });
  const pub = await fetch(`${LOCAL}/api/publico/sitio`).then((r) => r.json());
  assert.equal(pub.malteadas.find((m) => m.id === mal.id).precio, 77);
  assert.equal(pub.sitio.textos.hero_titulo, 'FUERZA');

  // Dueño: solo consulta
  const dueno = cliente(LOCAL);
  await dueno.post('/auth/login', { usuario: 'dueno', password: 'dueno-prueba-1' });
  await dueno.get('/dashboard');
  await assert.rejects(dueno.post('/acceso/visitas', { nombre: 'X', monto: 50 }), (e) => e.status === 403);

  // ---- Sincronizar ----
  const s1 = await rec.post('/sync/ahora');
  assert.equal(s1.ok, true, s1.error);
  assert.ok(s1.enviados > 10, `enviados ${s1.enviados}`);

  const nube = cliente(NUBE);
  await nube.post('/auth/login', { usuario: 'admin', password: 'admin-prueba-1' });
  const enNube = await nube.get('/clientes?q=Lucía');
  assert.equal(enNube.length, 1);
  assert.equal(enNube[0].qr, nuevo.qr);
  const fichaNube = await nube.get(`/clientes/${c.id}`);
  assert.equal(fichaNube.asistencias.length, 1);
  const pubNube = await fetch(`${NUBE}/api/publico/sitio`).then((r) => r.json());
  assert.equal(pubNube.malteadas.find((m) => m.id === mal.id).precio, 77);
  assert.equal(pubNube.sitio.whatsapp, '4381112233');
  const fotoNube = await fetch(`${NUBE}${c.foto_url}`);
  assert.equal(fotoNube.status, 401, 'la foto del socio no es pública');

  // El socio entra a su portal en la nube con la contraseña creada en recepción
  const socia = cliente(NUBE);
  await socia.post('/auth/login', { usuario: '438 555 1234', password: 'socia-12345' });
  const res = await socia.get('/portal/resumen');
  assert.equal(res.cliente.codigo, c.codigo);
  assert.equal(res.asistencias_mes, 1);
  await assert.rejects(socia.get('/clientes'), (e) => e.status === 403);

  // Cambio hecho en la nube regresa a recepción
  const p2 = await nube.post('/sitio/publicaciones', { tipo: 'novedad', titulo: 'Publicado desde la nube' });
  await nube.put(`/sitio/malteadas/${mal.id}`, { ...mal, precio: 80 });
  const s2 = await rec.post('/sync/ahora');
  assert.equal(s2.ok, true, s2.error);
  assert.ok(s2.recibidos >= 2);
  const enLocal = await rec.get('/sitio');
  assert.ok(enLocal.publicaciones.some((x) => x.id === p2.id));
  assert.equal(enLocal.malteadas.find((m) => m.id === mal.id).precio, 80);

  // Otra vuelta sin cambios: no hay eco infinito
  const s3 = await rec.post('/sync/ahora');
  assert.equal(s3.enviados, 0);
  assert.equal(s3.recibidos, 0);

  // Contraseña cambiada en recepción sirve en la nube
  await rec.post('/auth/password', { actual: 'admin-prueba-1', nueva: 'nueva-clave-99' });
  await rec.post('/sync/ahora');
  const nube2 = cliente(NUBE);
  await nube2.post('/auth/login', { usuario: 'admin', password: 'nueva-clave-99' });

  // Sin token no se puede sincronizar
  const sinToken = await fetch(`${NUBE}/api/sync/enviar?desde=0`);
  assert.equal(sinToken.status, 401);
});

test('importar socios desde CSV, respaldo y mudanza a otra nube', async () => {
  const rec = cliente(LOCAL);
  await rec.post('/auth/login', { usuario: 'admin', password: 'nueva-clave-99' });

  // El mismo lector de CSV que usa el navegador
  global.window = { SG: {} };
  require('../public/js/importar.js');
  const csv = fs.readFileSync(path.join(RAIZ, 'public/plantillas/clientes-plantilla.csv'), 'utf8');
  const tabla = window.SG.parsearCSV(csv);
  assert.equal(tabla.length, 4);
  assert.equal(tabla[1][2], 'Torres Gómez');

  const filas = [
    { codigo: '777001', nombre: 'Pedro', apellidos: 'Importado Uno', telefono: '(438) 100-2000', plan: 'mensual', fecha_fin: '31/12/2099' },
    { codigo: 'A-15', nombre: 'Rosa', apellidos: 'Importada Dos', plan: 'Plan Viejo VIP', fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31', precio: '500' },
    { nombre: 'Lucía', apellidos: 'Prueba Sync', telefono: '4385551234' }, // ya existe (teléfono)
    { nombre: 'Sin', apellidos: 'Fecha', fecha_fin: '31/02/2026' }, // fecha imposible
    { apellidos: 'Sin nombre' },
    { nombre: 'Pedro', apellidos: 'Importado Uno' }, // repetido dentro del archivo (mismo nombre, sin teléfono)
  ];
  const sim = await rec.post('/clientes/importar', { filas, confirmar: false });
  assert.equal(sim.simulacion, true);
  assert.equal(sim.nuevos, 2);
  assert.equal(sim.con_membresia, 2);
  assert.equal(sim.vigentes, 1);
  assert.equal(sim.codigos_conservados, 1);
  assert.deepEqual(sim.planes_sin_coincidencia, ['Plan Viejo VIP']);
  assert.equal(sim.omitidos.length, 2);
  assert.equal(sim.errores.length, 2);
  assert.equal((await rec.get('/clientes?q=Importad')).length, 0, 'la simulación no guarda nada');

  const fin = await rec.post('/clientes/importar', { filas, confirmar: true });
  assert.equal(fin.nuevos, 2);
  const pedro = (await rec.get('/clientes?q=Pedro'))[0];
  assert.equal(pedro.codigo, '777001');
  assert.equal(pedro.telefono, '4381002000');
  assert.equal(pedro.estado, 'vigente');
  assert.equal(pedro.plan, 'Mensual');
  const rosa = (await rec.get('/clientes?q=Rosa'))[0];
  assert.equal(rosa.estado, 'vencida');
  assert.equal(rosa.plan, 'Plan Viejo VIP');
  assert.match(rosa.notas, /A-15/);
  const entrada = await rec.post('/acceso/entrada', { codigo: pedro.qr });
  assert.equal(entrada.permitido, true);
  const renov = await rec.post('/membresias', { cliente_id: rosa.id, plan_id: 'plan-mensual', metodo_pago: 'efectivo' });
  assert.equal(renov.plan, 'Mensual');

  // Respaldo descargable (solo administrador)
  const r1 = await fetch(`${LOCAL}/api/gestion/respaldo`);
  assert.equal(r1.status, 403);
  const dueno = cliente(LOCAL);
  await dueno.post('/auth/login', { usuario: 'dueno', password: 'dueno-prueba-1' });
  await assert.rejects(dueno.get('/gestion/respaldo'), (e) => e.status === 403);
  const login = await fetch(`${LOCAL}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: 'admin', password: 'nueva-clave-99' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const r2 = await fetch(`${LOCAL}/api/gestion/respaldo`, { headers: { cookie } });
  assert.equal(r2.status, 200);
  const buf = Buffer.from(await r2.arrayBuffer());
  assert.equal(buf.subarray(0, 15).toString(), 'SQLite format 3');

  // Algo creado solo en la nube actual
  const nube = cliente(NUBE);
  await nube.post('/auth/login', { usuario: 'admin', password: 'nueva-clave-99' });
  await rec.post('/sync/ahora');
  const solo = await nube.post('/sitio/publicaciones', { tipo: 'novedad', titulo: 'Solo existía en la nube vieja' });
  await rec.post('/sync/ahora');

  // Mudanza: nueva nube vacía y recepción apunta a ella
  const NUBE2 = 'http://127.0.0.1:3593';
  levantar('nube2', 3593, { MODO: 'nube', COOKIE_SEGURA: '0' });
  await esperar(NUBE2);
  const local = procesos[1];
  local.kill();
  await new Promise((r) => local.once('exit', r));
  levantar('local', 3592, { MODO: 'local', NUBE_URL: NUBE2 });
  await esperar(LOCAL);
  const rec2 = cliente(LOCAL);
  await rec2.post('/auth/login', { usuario: 'admin', password: 'nueva-clave-99' });
  const s = await rec2.post('/sync/ahora');
  assert.equal(s.ok, true, s.error);
  const n2 = cliente(NUBE2);
  await n2.post('/auth/login', { usuario: 'admin', password: 'nueva-clave-99' });
  assert.equal((await n2.get('/clientes?q=Pedro')).length, 1);
  assert.equal((await n2.get('/clientes?q=Lucía')).length, 1);
  const pubs = await n2.get('/sitio');
  assert.ok(pubs.publicaciones.some((p) => p.id === solo.id), 'lo creado en la nube vieja también se mudó');
});
