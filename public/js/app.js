/* =====================================================================
   Strong Gym · estructura de la aplicación, menú por rol y navegación
   ===================================================================== */
(function (SG) {
  const { html, pintar, $, $$, icono, aviso, modal, datosForm, ocupado, iniciales } = SG;
  SG.vistas = SG.vistas || {};
  const estado = { usuario: null, entorno: 'nube' };
  SG.estado = estado;
  /** true si el usuario actual solo puede consultar (dueño). Las vistas ocultan botones de edición. */
  SG.soloLectura = () => !!estado.usuario && estado.usuario.rol === 'dueno';

  const ROLES = { dueno: 'Dueño · solo consulta', admin: 'Administrador', cliente: 'Cliente' };
  const INICIO = { admin: 'acceso', dueno: 'panel', cliente: 'mi-membresia' };

  // [ruta, etiqueta, ícono]
  const MENU = {
    // Administrador: hace todo
    admin: [
      { items: [['acceso', 'Acceso', 'acceso'], ['panel', 'Panel', 'panel']] },
      { grupo: 'Socios', items: [['clientes', 'Clientes', 'clientes'], ['membresias', 'Membresías', 'membresias'], ['visitas', 'Visitas', 'visitas']] },
      { grupo: 'Tienda', items: [['ventas', 'Ventas', 'ventas'], ['inventario', 'Inventario', 'inventario']] },
      { grupo: 'Administración', items: [['reportes', 'Movimientos', 'reportes'], ['bitacora', 'Bitácora', 'bitacora'], ['usuarios', 'Usuarios', 'usuarios'], ['sitio', 'Sitio web', 'nube'], ['sync', 'Sincronización', 'sync']] },
    ],
    // Dueño: ve todo, no modifica nada (no registra entradas, así que no tiene "Acceso")
    dueno: [
      { items: [['panel', 'Panel', 'panel']] },
      { grupo: 'Socios', items: [['clientes', 'Clientes', 'clientes'], ['membresias', 'Membresías', 'membresias'], ['visitas', 'Visitas', 'visitas']] },
      { grupo: 'Tienda', items: [['ventas', 'Ventas', 'ventas'], ['inventario', 'Inventario', 'inventario']] },
      { grupo: 'Supervisión', items: [['reportes', 'Movimientos', 'reportes'], ['bitacora', 'Bitácora', 'bitacora'], ['usuarios', 'Usuarios', 'usuarios'], ['sitio', 'Sitio web', 'nube'], ['sync', 'Sincronización', 'sync']] },
    ],
    cliente: [
      { items: [['mi-membresia', 'Mi membresía', 'membresias'], ['mis-asistencias', 'Asistencias', 'calendario'], ['mis-pagos', 'Pagos', 'pagos']] },
    ],
  };
  // Pestañas inferiores en celular (máximo 4 + "Más")
  const TABS = {
    admin: ['acceso', 'clientes', 'ventas', 'panel'],
    dueno: ['panel', 'clientes', 'reportes', 'bitacora'],
    cliente: ['mi-membresia', 'mis-asistencias', 'mis-pagos'],
  };

  const itemsDe = (rol) => MENU[rol].flatMap((g) => g.items);
  const permitida = (ruta) => estado.usuario && itemsDe(estado.usuario.rol).some((i) => i[0] === ruta);

  // ---------- Tema claro / oscuro ----------
  function leerTema() { try { return localStorage.getItem('sg-tema'); } catch (e) { return null; } }
  function aplicarTema(t) {
    if (t) document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema;
    try { if (t) localStorage.setItem('sg-tema', t); } catch (e) { /* sin almacenamiento */ }
  }
  const temaActual = () => document.documentElement.dataset.tema ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');
  aplicarTema(leerTema());

  // ---------- Inicio de sesión ----------
  function pantallaLogin() {
    document.title = 'Entrar · Strong Gym';
    const app = $('#app');
    pintar(app, html`
      <main class="login">
        <section class="login-marca">
          <img class="login-logo" src="${SG.LOGO}" alt="Strong Gym Puruándiro">
          <p class="login-lema">Strong Gym<br>Puruándiro</p>
          <p class="login-sub">Acceso, membresías, ventas e inventario en un solo lugar.</p>
        </section>
        <section class="login-panel">
          <form class="login-form" novalidate>
            <h1>Inicia sesión</h1>
            <p class="ayuda">Socios: entra con tu número de socio o tu teléfono.</p>
            <label class="campo"><span>Usuario, teléfono o número de socio</span>
              <input name="usuario" autocomplete="username" required autocapitalize="none"></label>
            <label class="campo"><span>Contraseña</span>
              <input name="password" type="password" autocomplete="current-password" required></label>
            <button class="btn btn-primario btn-bloque" type="submit">Entrar</button>
          </form>
          <p class="login-pie"><a class="enlace" href="/">${icono('atras')} Volver al sitio</a> · Desarrollado por CodeDMF</p>
        </section>
      </main>`);

    const form = $('.login-form', app);
    const entrar = (usuario, password, boton) => ocupado(boton, async () => {
      const r = await SG.api.post('/auth/login', { usuario, password });
      estado.usuario = r.usuario;
      estado.entorno = r.entorno || 'nube';
      // Si venía de una sección protegida (#/clientes), vuelve ahí; si no, a su inicio
      const pedida = rutaActual();
      history.replaceState(null, '', `#/${permitida(pedida) ? pedida : INICIO[estado.usuario.rol]}`);
      await enrutar();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = datosForm(form);
      if (!d.usuario || !d.password) return aviso('Escribe tu usuario y contraseña.', 'error');
      entrar(d.usuario, d.password, $('button[type=submit]', form));
    });
  }

  // ---------- Estructura principal ----------
  function menuLateral(rol, actual) {
    return MENU[rol].map((g) => html`
      <div class="menu-grupo">
        ${g.grupo ? html`<p class="menu-titulo">${g.grupo}</p>` : ''}
        ${g.items.map(([r, t, i]) => html`
          <a href="#/${r}" class="menu-item ${r === actual ? 'activo' : ''}" ${r === actual ? html`aria-current="page"` : ''}>
            ${icono(i)}<span>${t}</span></a>`)}
      </div>`);
  }

  function estructura() {
    const u = estado.usuario;
    const app = $('#app');
    pintar(app, html`
      <div class="shell rol-${u.rol}">
        <aside class="lateral" aria-label="Menú principal">
          <a class="lateral-marca" href="/" target="_blank" rel="noopener" title="Ver sitio web">
            <img src="${SG.LOGO}" alt="">
            <span>Strong Gym<small>Puruándiro</small></span>
          </a>
          <nav class="menu" id="menu"></nav>
          <div class="lateral-pie">
            <button class="usuario-chip" data-cuenta title="Mi cuenta">
              <span class="avatar">${iniciales(u.nombre)}</span>
              <span class="usuario-datos"><strong>${u.nombre}</strong><small>${ROLES[u.rol]}</small></span>
            </button>
            <button class="btn-icono claro" data-salir aria-label="Cerrar sesión" title="Cerrar sesión">${icono('salir')}</button>
          </div>
        </aside>
        <div class="principal">
          <header class="cabecera">
            <img class="cabecera-logo" src="${SG.LOGO}" alt="">
            <div class="cabecera-titulos"><h1 id="titulo">&nbsp;</h1><p>${SG.hoyLargo()}</p></div>
            <div class="cabecera-acciones">
              ${u.rol === 'dueno' ? html`<span class="solo-consulta" title="Puedes ver toda la información; los cambios los hace el administrador">${icono('candado')}<span>Solo consulta</span></span>` : ''}
              ${u.rol !== 'cliente' ? html`<span class="entorno entorno-${estado.entorno}" title="Dónde está corriendo esta copia del sistema">
                ${icono(estado.entorno === 'local' ? 'servidor' : 'nube')}<span>${estado.entorno === 'local' ? 'Servidor local' : 'Nube'}</span></span>` : ''}
              <button class="btn-icono" data-tema aria-label="Cambiar tema claro u oscuro"></button>
              <button class="btn-icono solo-movil" data-cuenta aria-label="Mi cuenta">${icono('usuario')}</button>
            </div>
          </header>
          <main id="vista" class="vista" tabindex="-1"></main>
        </div>
        <nav class="tabs-movil" id="tabs" aria-label="Navegación"></nav>
      </div>`);

    $$('[data-salir]', app).forEach((b) => b.addEventListener('click', salir));
    $$('[data-cuenta]', app).forEach((b) => b.addEventListener('click', miCuenta));
    const bTema = $('[data-tema]', app);
    const pintarTema = () => pintar(bTema, icono(temaActual() === 'oscuro' ? 'sol' : 'luna'));
    pintarTema();
    bTema.addEventListener('click', () => { aplicarTema(temaActual() === 'oscuro' ? 'claro' : 'oscuro'); pintarTema(); });
  }

  function pintarNav(actual) {
    const rol = estado.usuario.rol;
    pintar($('#menu'), menuLateral(rol, actual));
    const todos = itemsDe(rol);
    const tabs = TABS[rol].map((r) => todos.find((i) => i[0] === r));
    const hayMas = todos.length > tabs.length;
    pintar($('#tabs'), html`
      ${tabs.map(([r, t, i]) => html`<a href="#/${r}" class="tab ${r === actual ? 'activo' : ''}">${icono(i)}<span>${t}</span></a>`)}
      ${hayMas ? html`<button class="tab ${TABS[rol].includes(actual) ? '' : 'activo'}" data-mas>${icono('menu')}<span>Más</span></button>` : ''}`);
    const mas = $('[data-mas]');
    if (mas) mas.addEventListener('click', () => menuMas(actual));
  }

  function menuMas(actual) {
    const m = modal({
      titulo: 'Menú',
      cuerpo: html`<nav class="menu menu-hoja">${menuLateral(estado.usuario.rol, actual)}</nav>
        <div class="acciones-form"><button class="btn btn-sec" data-salir-hoja>${icono('salir')} Cerrar sesión</button></div>`,
    });
    $$('a', m.el).forEach((a) => a.addEventListener('click', () => m.cerrar()));
    $('[data-salir-hoja]', m.el).addEventListener('click', () => { m.cerrar(); salir(); });
  }

  function miCuenta() {
    const u = estado.usuario;
    const m = modal({
      titulo: 'Mi cuenta',
      cuerpo: html`
        <div class="cuenta-resumen"><span class="avatar grande">${iniciales(u.nombre)}</span>
          <div><strong>${u.nombre}</strong><p class="ayuda">${ROLES[u.rol]} · usuario ${u.usuario}</p></div></div>
        <form class="form" data-pass>
          <h3>Cambiar contraseña</h3>
          <label class="campo"><span>Contraseña actual</span><input name="actual" type="password" required autocomplete="current-password"></label>
          <label class="campo"><span>Nueva contraseña</span><input name="nueva" type="password" minlength="8" required autocomplete="new-password">
            <small>Mínimo 8 caracteres.</small></label>
          <div class="acciones-form">
            <button type="button" class="btn btn-sec" data-salir-cuenta>${icono('salir')} Cerrar sesión</button>
            <button class="btn btn-primario">Guardar contraseña</button>
          </div>
        </form>`,
    });
    const f = $('[data-pass]', m.el);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado($('.btn-primario', f), async () => {
        await SG.api.post('/auth/password', datosForm(f));
        aviso('Contraseña actualizada.');
        m.cerrar();
      });
    });
    $('[data-salir-cuenta]', m.el).addEventListener('click', () => { m.cerrar(); salir(); });
  }

  async function salir() {
    try { await SG.api.post('/auth/logout'); } catch (e) { /* igual salimos */ }
    estado.usuario = null;
    if (location.hash === '#/entrar') enrutar(); else location.hash = '#/entrar';
  }
  SG.alExpirar = () => {
    estado.usuario = null;
    history.replaceState(null, '', '#/entrar');
    enrutar();
    aviso('Tu sesión terminó. Vuelve a entrar.', 'error');
  };

  // ---------- Navegación por hash ----------
  //   (el sitio público vive en "/"; este archivo es el sistema en "/app")
  //   #/entrar      inicio de sesión
  //   #/clientes…   módulos (requieren sesión y rol)
  const rutaActual = () => location.hash.replace(/^#\/?/, '').split('?')[0];

  async function enrutar() {
    SG.cerrarModales();
    const ruta = rutaActual();
    if (!estado.usuario) { vistaSalir(); return pantallaLogin(); }
    if (ruta === 'entrar' || ruta === '') { history.replaceState(null, '', `#/${INICIO[estado.usuario.rol]}`); }
    if (!$('.shell')) estructura();
    return navegar();
  }

  let vistaActual = null;
  function vistaSalir() {
    if (vistaActual && vistaActual.salir) vistaActual.salir();
    vistaActual = null;
  }

  async function navegar() {
    let ruta = rutaActual();
    if (!permitida(ruta)) {
      ruta = INICIO[estado.usuario.rol];
      history.replaceState(null, '', `#/${ruta}`);
    }
    const def = SG.vistas[ruta];
    const titulo = itemsDe(estado.usuario.rol).find((i) => i[0] === ruta)[1];
    $('#titulo').textContent = titulo;
    document.title = `${titulo} · Strong Gym`;
    pintarNav(ruta);
    const cont = $('#vista');
    cont.className = `vista vista-${ruta}`;
    vistaSalir();
    pintar(cont, SG.cargando());
    window.scrollTo(0, 0);
    vistaActual = { salir: null };
    if (!def) return pintar(cont, SG.vacio('Esta sección aún no está disponible.'));
    try {
      const salirFn = await def(cont, estado);
      vistaActual.salir = typeof salirFn === 'function' ? salirFn : null;
    } catch (e) {
      pintar(cont, SG.vacio(e.message || 'No se pudo cargar la sección.'));
    }
  }
  SG.ir = (ruta) => { if (location.hash === `#/${ruta}`) enrutar(); else location.hash = `#/${ruta}`; };

  window.addEventListener('hashchange', enrutar);

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const r = await SG.api.get('/auth/me');
      estado.usuario = r.usuario;
      estado.entorno = r.entorno || 'nube';
    } catch (e) {
      estado.usuario = null;
    }
    enrutar();
  });
})(window.SG);
