/* =====================================================================
   Datos de demostración (solo con SEMBRAR_DEMO=1 · npm run demo)
   Crea socios, asistencias, ventas y publicaciones de ejemplo para
   recorrer el sistema. NO usar en la base de datos real.
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const { uno, transaccion, guardar, actualizar } = require('./db');
const { hoy, sumarDias, hashPassword, digitos } = require('./util');
const { DESFASE } = require('./config');

let semilla = 7;
const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
const elegir = (a) => a[Math.floor(azar() * a.length)];
const enHora = (dia, h, m = 0) => {
  const t = new Date(`${dia}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${DESFASE}`).getTime();
  return new Date(t > Date.now() ? Date.now() - (5 + ((h * 37 + m) % 170)) * 60000 : t).toISOString();
};
const img = (n) => `data:image/jpeg;base64,${fs.readFileSync(path.join(__dirname, 'demo-img', `${n}.jpg`)).toString('base64')}`;

const NOMBRES = ['Mariana', 'José', 'Fernanda', 'Carlos', 'Daniela', 'Miguel', 'Valeria', 'Juan Pablo', 'Ximena', 'Luis Ángel',
  'Paola', 'Diego', 'Andrea', 'Jorge', 'Karla', 'Ricardo', 'Itzel', 'Eduardo', 'Alejandra', 'Óscar', 'Lupita', 'Héctor',
  'Sofía', 'Emilio', 'Brenda', 'Raúl', 'Yesenia', 'Alonso', 'Citlali', 'Francisco', 'Dulce', 'Iván', 'Regina', 'Arturo'];
const APELLIDOS = ['Torres', 'García', 'Hernández', 'López', 'Martínez', 'Ramírez', 'Cervantes', 'Zavala', 'Villaseñor', 'Pantoja',
  'Ayala', 'Rangel', 'Ortiz', 'Mendoza', 'Guzmán', 'Ochoa', 'Magaña', 'Arévalo', 'Gómez', 'Solís'];

function sembrarDemo() {
  if (uno('SELECT id FROM clientes LIMIT 1')) return;
  console.log('Sembrando datos de demostración…');
  const h = hoy();
  transaccion(() => {
    actualizar('usuarios', 'u-admin', { nombre: 'Ana Ruiz' });
    actualizar('usuarios', 'u-dueno', { nombre: 'Roberto Méndez' });
    guardar('usuarios', { id: 'u-rec2', nombre: 'Luis Pérez', usuario: 'recepcion.tarde', rol: 'admin', password_hash: hashPassword('recepcion1234'), activo: 1 });
    const ctx = ['u-admin', 'u-rec2'];
    const planes = [['plan-mensual', 'Mensual', 30, 350], ['plan-quincenal', 'Quincenal', 15, 200], ['plan-semanal', 'Semanal', 7, 120],
      ['plan-estudiante', 'Mensual estudiante', 30, 280], ['plan-trimestral', 'Trimestral', 90, 950]];

    const clientes = [];
    NOMBRES.forEach((n, i) => {
      const c = guardar('clientes', {
        codigo: i === 0 ? '482913' : String(100000 + Math.floor(azar() * 899999)), qr_token: i === 0 ? '7351' : digitos(4),
        nombre: n, apellidos: i === 0 ? 'Torres Gómez' : `${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`,
        telefono: `438${String(1000000 + Math.floor(azar() * 8999999))}`, email: azar() > 0.6 ? `${n.toLowerCase().replace(/[^a-z]/g, '')}${i}@correo.com` : null,
        notas: i === 3 ? 'Lesión de rodilla: evitar sentadilla profunda.' : null, foto: null, usuario_id: null, activo: 1,
        created_at: enHora(sumarDias(h, -Math.floor(40 + azar() * 200)), 10),
      });
      clientes.push(c);
      if (i % 13 === 12) return;
      const p = i === 0 ? planes[0] : elegir([planes[0], planes[0], planes[0], planes[1], planes[2], planes[3], planes[4]]);
      let fin = Math.floor(-20 + azar() * 48);
      if (i === 0) fin = 17;
      if (i % 7 === 2) fin = Math.floor(azar() * 5);
      const fecha_fin = sumarDias(h, fin);
      const fecha_inicio = sumarDias(fecha_fin, -(p[2] - 1));
      const creado = enHora(fecha_inicio > h ? h : fecha_inicio, 9 + (i % 10), (i * 7) % 60);
      const m = guardar('membresias', { cliente_id: c.id, plan_id: p[0], plan_nombre: p[1], fecha_inicio, fecha_fin, precio: p[3], activo: 1, created_at: creado });
      guardar('pagos', { cliente_id: c.id, membresia_id: m.id, concepto: `Membresía ${p[1]}`, monto: p[3],
        metodo: elegir(['efectivo', 'efectivo', 'tarjeta', 'transferencia']), usuario_id: elegir(ctx), created_at: fin > 20 && i % 3 === 0 ? enHora(h, 7 + (i % 5), 15) : creado });
      c.m = m;
    });
    // Portal del socio de ejemplo
    const uCli = guardar('usuarios', { nombre: 'Mariana Torres Gómez', usuario: '482913', rol: 'cliente', password_hash: hashPassword('socio1234'), activo: 1 });
    actualizar('clientes', clientes[0].id, { usuario_id: uCli.id });

    for (let d = 30; d >= 0; d--) {
      const dia = sumarDias(h, -d);
      const domingo = new Date(`${dia}T12:00:00Z`).getUTCDay() === 0;
      clientes.forEach((c, i) => {
        if (!c.m || dia < c.m.fecha_inicio || dia > c.m.fecha_fin) return;
        if (azar() < (domingo ? 0.1 : i === 0 ? 0.7 : 0.45)) {
          const hh = d === 0 ? 6 + Math.floor(azar() * 5) : elegir([6, 7, 8, 9, 17, 18, 19, 20]);
          guardar('asistencias', { cliente_id: c.id, metodo: azar() > 0.15 ? 'lector' : 'manual', usuario_id: 'u-admin', created_at: enHora(dia, hh, Math.floor(azar() * 59)) });
        }
      });
    }

    const PRODUCTOS = [
      ['Proteína whey 2 lb', 'Suplementos', 750, 520, 3, 6, 'SUP-WHEY-2LB'], ['Creatina monohidratada 300 g', 'Suplementos', 480, 310, 3, 2, 'SUP-CREA-300'],
      ['Pre-entreno 30 servicios', 'Suplementos', 560, 380, 2, 4, 'SUP-PRE-30'], ['Agua natural 1 L', 'Bebidas', 20, 9, 12, 40, 'BEB-AGUA-1L'],
      ['Bebida isotónica 600 ml', 'Bebidas', 30, 16, 12, 9, 'BEB-ISO-600'], ['Barra de proteína', 'Snacks', 45, 26, 10, 22, 'SNK-BARRA'],
      ['Malteada de proteína', 'Bebidas', 65, 28, 0, 60, 'BEB-MALTEADA'], ['Shaker 600 ml', 'Accesorios', 120, 60, 3, 7, 'ACC-SHAKER'],
      ['Guantes de entrenamiento', 'Accesorios', 250, 140, 2, 0, 'ACC-GUANTES'],
    ].map(([nombre, categoria, precio_venta, costo, stock_minimo, stock, sku]) => {
      const p = guardar('productos', { nombre, categoria, precio_venta, costo, stock_minimo, sku, activo: 1, created_at: enHora(sumarDias(h, -30), 9) });
      guardar('movimientos', { producto_id: p.id, tipo: 'entrada', cantidad: stock + 25, motivo: 'Inventario inicial', usuario_id: 'u-admin', created_at: enHora(sumarDias(h, -30), 9) });
      return { ...p, objetivo: stock, vendidos: 0 };
    });
    for (let d = 6; d >= 0; d--) {
      const dia = sumarDias(h, -d);
      const n = d === 0 ? 5 : 3 + Math.floor(azar() * 6);
      for (let k = 0; k < n; k++) {
        const prods = [elegir(PRODUCTOS.slice(3, 7)), ...(azar() > 0.75 ? [elegir(PRODUCTOS.slice(0, 3))] : [])];
        const ts = enHora(dia, 7 + Math.floor(azar() * 13), Math.floor(azar() * 59));
        const venta = guardar('ventas', { folio: `V${(Date.parse(ts) / 1000 + k).toString(36).toUpperCase()}`, total: 0, costo_total: 0,
          metodo_pago: elegir(['efectivo', 'efectivo', 'tarjeta']), usuario_id: elegir(ctx), created_at: ts });
        let total = 0, costo = 0;
        prods.forEach((p) => {
          const cant = p.categoria === 'Bebidas' ? 1 + Math.floor(azar() * 2) : 1;
          total += p.precio_venta * cant; costo += p.costo * cant; p.vendidos += cant;
          guardar('venta_detalle', { venta_id: venta.id, producto_id: p.id, nombre: p.nombre, cantidad: cant, precio: p.precio_venta, subtotal: p.precio_venta * cant, created_at: ts });
          guardar('movimientos', { producto_id: p.id, tipo: 'venta', cantidad: -cant, motivo: `Venta ${venta.folio}`, venta_id: venta.id, usuario_id: venta.usuario_id, created_at: ts });
        });
        actualizar('ventas', venta.id, { total, costo_total: costo });
      }
      for (let k = 0; k < (d === 0 ? 3 : Math.floor(azar() * 4)); k++) {
        guardar('visitas', { nombre: `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`, telefono: null, monto: 50, metodo: 'efectivo', usuario_id: 'u-admin', created_at: enHora(dia, 8 + k * 3, 20) });
      }
    }
    PRODUCTOS.forEach((p) => {
      const actual = p.objetivo + 25 - p.vendidos;
      if (actual !== p.objetivo) guardar('movimientos', { producto_id: p.id, tipo: 'ajuste', cantidad: p.objetivo - actual, motivo: 'Conteo semanal', usuario_id: 'u-dueno', created_at: enHora(sumarDias(h, -1), 21) });
    });

    const finMes = `${h.slice(0, 8)}${new Date(Date.UTC(+h.slice(0, 4), +h.slice(5, 7), 0)).getUTCDate()}`;
    const pub = (tipo, titulo, texto, imagen, extra = {}, dias = 0) => guardar('publicaciones', { tipo, titulo, texto, imagen, vigente_hasta: null,
      destacada: 0, activo: 1, usuario_id: 'u-admin', autor: 'Ana Ruiz', created_at: enHora(sumarDias(h, -dias), 10), ...extra });
    pub('promocion', 'Inscripción gratis este mes', 'Paga tu primera mensualidad y no pagas inscripción. Válido para socios nuevos.', img('promo1'), { vigente_hasta: finMes, destacada: 1 }, 3);
    pub('promocion', 'Trae a un amigo', 'Si tu amigo se inscribe, tu siguiente mes tiene 20% de descuento.', img('promo2'), { vigente_hasta: sumarDias(h, 30) }, 6);
    pub('promocion', 'Plan estudiante', 'Mensualidad especial presentando credencial escolar vigente.', img('promo3'), {}, 20);
    pub('novedad', 'Nuevo horario de sábado', 'A partir de este mes abrimos los sábados de 7:00 a 15:00.', null, {}, 2);
    pub('novedad', 'Llegaron mancuernas nuevas', 'Ampliamos el rack de mancuernas hasta 40 kg por pieza.', img('nov1'), {}, 9);
    pub('novedad', 'Consulta tu membresía en línea', 'Pide en recepción tu acceso al portal y revisa desde tu celular tus días restantes, asistencias y pagos.', null, {}, 15);
    pub('galeria', 'Área de pesas', null, img('gal1'), {}, 30);
    pub('galeria', 'Zona de cardio', null, img('gal2'), {}, 30);
    pub('galeria', 'Peso libre', null, img('gal3'), {}, 30);
    pub('galeria', 'Funcional', null, img('gal4'), {}, 30);
    const s = JSON.parse(uno("SELECT datos FROM sitio WHERE id = 'sitio'").datos);
    s.whatsapp = '4381234567';
    s.direccion = 'Av. Juárez 120, Centro, Puruándiro, Mich. (dirección de ejemplo)';
    s.facebook = 'https://facebook.com/';
    guardar('sitio', { id: 'sitio', datos: JSON.stringify(s) });
  });
  console.log('Demo lista. Accesos: admin / admin1234 · dueno / dueno1234 · socio 482913 / socio1234');
}

module.exports = { sembrarDemo };
