/* =====================================================================
   Strong Gym · utilidades de interfaz (sin dependencias)
   ===================================================================== */
window.SG = window.SG || {};
window.SG.LOGO = '/img/logo.jpg';
window.SG.vistas = window.SG.vistas || {};

(function (SG) {
  const TZ = 'America/Mexico_City';

  // ---------- Plantillas seguras (escapan todo lo que no sea html``) ----------
  const CRUDO = Symbol('crudo');
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const crudo = (s) => ({ [CRUDO]: true, s: String(s) });
  const pieza = (v) => {
    if (v === null || v === undefined || v === false) return '';
    if (Array.isArray(v)) return v.map(pieza).join('');
    if (v[CRUDO]) return v.s;
    return esc(v);
  };
  function html(strings, ...vals) {
    let out = '';
    strings.forEach((s, i) => { out += s + (i < vals.length ? pieza(vals[i]) : ''); });
    return crudo(out);
  }
  function pintar(el, tpl) { el.innerHTML = pieza(tpl); return el; }
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  // ---------- Formatos ----------
  const fmtDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const fmtDinero2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  const dinero = (n) => (Number(n) % 1 ? fmtDinero2 : fmtDinero).format(Number(n || 0));
  const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function sumarDias(iso, d) {
    const [y, m, dd] = iso.split('-').map(Number);
    const f = new Date(Date.UTC(y, m - 1, dd + d));
    return f.toISOString().slice(0, 10);
  }
  function fecha(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
    if (!iso) return '—';
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-MX', { ...opts, timeZone: 'UTC' });
  }
  const fechaHora = (ts) => (ts ? new Date(ts).toLocaleString('es-MX', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const hora = (ts) => (ts ? new Date(ts).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—');
  const diaDe = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts));
  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const hoyLargo = () => mayus(new Date().toLocaleDateString('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }));
  const nombreCompleto = (c) => `${c.nombre || ''} ${c.apellidos || ''}`.trim();
  const iniciales = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

  // ---------- Íconos (trazos estilo Lucide, licencia ISC) ----------
  const P = {
    panel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    acceso: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
    clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    membresias: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 16c.6-1.3 1.7-2 3-2s2.4.7 3 2M14 10h5M14 14h3"/>',
    visitas: '<path d="M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
    ventas: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    inventario: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    reportes: '<path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-3"/>',
    bitacora: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    usuarios: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 11l2 2 4-4"/>',
    sync: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16M16 16h5v5"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    menos: '<path d="M5 12h14"/>',
    buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alerta: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    luna: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    pagos: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    nube: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    servidor: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
    candado: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    editar: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    atras: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    mensaje: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    entrada: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    camara: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    imprimir: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    vaso: '<path d="M6 8h12l-1.5 13h-9z"/><path d="M5 8a7 3 0 0 1 14 0"/><path d="M13 5l2-3"/>',
    texto: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    imagen: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    externo: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  };
  const icono = (n, clase = '') => crudo(`<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`);

  // ---------- Estado de membresía ----------
  const ESTADOS = {
    vigente: ['Vigente', 'ok'],
    por_vencer: ['Por vencer', 'aviso'],
    vencida: ['Vencida', 'no'],
    sin_membresia: ['Sin membresía', 'neutro'],
  };
  const chipEstado = (e) => { const [t, c] = ESTADOS[e] || ['—', 'neutro']; return html`<span class="chip chip-${c}">${t}</span>`; };

  // ---------- Avisos (toast) ----------
  function aviso(texto, tipo = 'ok') {
    let caja = $('#avisos');
    if (!caja) { caja = document.createElement('div'); caja.id = 'avisos'; caja.setAttribute('aria-live', 'polite'); document.body.appendChild(caja); }
    const t = document.createElement('div');
    t.className = `aviso aviso-${tipo}`;
    pintar(t, html`${icono(tipo === 'error' ? 'alerta' : 'check')}<span>${texto}</span>`);
    caja.appendChild(t);
    setTimeout(() => { t.classList.add('saliendo'); setTimeout(() => t.remove(), 300); }, tipo === 'error' ? 5000 : 3000);
  }

  // ---------- Modal (en celular se vuelve hoja inferior) ----------
  const abiertos = new Set();
  /** Cierra todas las ventanas abiertas (al cambiar de sección). */
  const cerrarModales = () => [...abiertos].reverse().forEach((c) => c());
  function modal({ titulo, cuerpo, ancho = 'normal', alCerrar }) {
    const previo = document.activeElement;
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    pintar(fondo, html`
      <div class="modal modal-${ancho}" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <header class="modal-cab">
          <h2 id="modal-titulo">${titulo}</h2>
          <button class="btn-icono" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button>
        </header>
        <div class="modal-cuerpo">${cuerpo}</div>
      </div>`);
    document.body.appendChild(fondo);
    document.body.classList.add('sin-scroll');
    let cerrado = false;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      abiertos.delete(cerrar);
      fondo.remove();
      if (!$('.modal-fondo')) document.body.classList.remove('sin-scroll');
      document.removeEventListener('keydown', tecla);
      if (previo && previo.focus) previo.focus();
      if (alCerrar) alCerrar();
    };
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
    abiertos.add(cerrar);
    document.addEventListener('keydown', tecla);
    fondo.addEventListener('mousedown', (e) => { if (e.target === fondo) cerrar(); });
    $$('[data-cerrar]', fondo).forEach((b) => b.addEventListener('click', cerrar));
    const primero = $('input:not([type=hidden]), select, textarea', fondo) || $('button', fondo);
    setTimeout(() => primero && primero.focus(), 30);
    return { el: fondo, cerrar };
  }

  function confirmar(texto, { si = 'Confirmar', peligro = false } = {}) {
    return new Promise((ok) => {
      let resp = false;
      const m = modal({
        titulo: 'Confirma la acción',
        cuerpo: html`<p class="texto-modal">${texto}</p>
          <div class="acciones-form"><button class="btn btn-sec" data-cerrar>Cancelar</button>
          <button class="btn ${peligro ? 'btn-peligro' : 'btn-primario'}" data-si>${si}</button></div>`,
        alCerrar: () => ok(resp),
      });
      $('[data-si]', m.el).addEventListener('click', () => { resp = true; m.cerrar(); });
    });
  }

  /** Lee un <form> como objeto plano. */
  function datosForm(form) {
    const d = {};
    new FormData(form).forEach((v, k) => { d[k] = typeof v === 'string' ? v.trim() : v; });
    return d;
  }

  /** Deshabilita el botón mientras corre la promesa y muestra errores. */
  async function ocupado(boton, fn) {
    if (boton) { boton.disabled = true; boton.classList.add('cargando'); }
    try { return await fn(); }
    catch (e) { aviso(e.message || 'Algo salió mal.', 'error'); return undefined; }
    finally { if (boton) { boton.disabled = false; boton.classList.remove('cargando'); } }
  }

  /**
   * Reduce una foto del celular o cámara (varios MB) a JPEG de máx. 1280 px
   * y ~300 KB, para guardarla en la base de datos y sincronizarla sin problema.
   */
  function comprimirImagen(archivo, { lado = 1280, maxChars = 380 * 1024, alfa = false, cuadrada = false } = {}) {
    return new Promise((ok, mal) => {
      if (!/^image\//.test(archivo.type)) return mal(new Error('El archivo no es una imagen.'));
      const lector = new FileReader();
      lector.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => mal(new Error('No se pudo abrir la imagen. Prueba con JPG o PNG.'));
        img.onload = () => ok(reducirImagen(img, { lado, maxChars, alfa, cuadrada }));
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    }).then((r) => { if (!r) throw new Error('La imagen sigue siendo muy pesada. Recórtala e intenta de nuevo.'); return r; });
  }
  /** Reduce una imagen/video/canvas a data URI. alfa = conserva transparencia (WebP o PNG). */
  function reducirImagen(fuente, { lado = 1280, maxChars = 380 * 1024, alfa = false, cuadrada = false } = {}) {
    let sw = fuente.videoWidth || fuente.naturalWidth || fuente.width;
    let sh = fuente.videoHeight || fuente.naturalHeight || fuente.height;
    let sx = 0, sy = 0;
    if (cuadrada) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
    for (let escala = Math.min(1, lado / Math.max(sw, sh)); escala > 0.2; escala *= 0.8) {
      const w = Math.round(sw * escala), h = Math.round(sh * escala);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (!alfa) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(fuente, sx, sy, sw, sh, 0, 0, w, h);
      if (alfa) {
        for (let q = 0.85; q >= 0.5; q -= 0.15) {
          const url = c.toDataURL('image/webp', q);
          if (url.startsWith('data:image/webp') && url.length <= maxChars) return url;
        }
        const png = c.toDataURL('image/png');
        if (png.length <= maxChars) return png;
      } else {
        for (let q = 0.82; q >= 0.5; q -= 0.1) {
          const url = c.toDataURL('image/jpeg', q);
          if (url.length <= maxChars) return url;
        }
      }
    }
    return null;
  }

  // ---------- Sonidos cortos para recepción (sin archivos) ----------
  let audio = null;
  function sonido(tipo = 'ok') {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const notas = tipo === 'ok' ? [[880, 0, 0.09], [1320, 0.1, 0.12]] : tipo === 'aviso' ? [[660, 0, 0.12], [660, 0.16, 0.12]] : [[220, 0, 0.32]];
      notas.forEach(([f, t, d]) => {
        const o = audio.createOscillator(); const g = audio.createGain();
        o.type = tipo === 'no' ? 'square' : 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, audio.currentTime + t);
        g.gain.exponentialRampToValueAtTime(tipo === 'no' ? 0.08 : 0.2, audio.currentTime + t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + d);
        o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + d + 0.02);
      });
    } catch (e) { /* sin audio */ }
  }

  const vacio = (texto, accion) => html`<div class="vacio"><p>${texto}</p>${accion || ''}</div>`;
  const cargando = () => html`<div class="cargando-vista" aria-busy="true"><span></span><span></span><span></span></div>`;

  /** Descarga un CSV (abre en Excel con acentos correctos). */
  function descargarCSV(nombre, filas) {
    if (!filas.length) return aviso('No hay datos para descargar.', 'error');
    const cols = Object.keys(filas[0]);
    const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const txt = '\uFEFF' + [cols.map(celda).join(','), ...filas.map((f) => cols.map((c) => celda(f[c])).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  Object.assign(SG, {
    html, crudo, pintar, $, $$, esc, cerrarModales, dinero, fecha, fechaHora, hora, hoyISO, sumarDias, diaDe, hoyLargo,
    nombreCompleto, iniciales, mayus, icono, chipEstado, ESTADOS, METODOS, aviso, modal, confirmar, datosForm,
    ocupado, vacio, cargando, descargarCSV, comprimirImagen, reducirImagen, sonido, TZ,
  });
})(window.SG);
