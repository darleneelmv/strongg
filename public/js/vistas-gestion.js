/* Vistas de gestión: Movimientos, Bitácora, Usuarios y Sincronización
   (el administrador las usa completas; el dueño solo las consulta) */
(function (SG) {
  const { html, pintar, $, $$, icono, dinero, fecha, fechaHora, METODOS, modal, datosForm, ocupado, vacio, aviso } = SG;

  function selectorRango(rango) {
    const hoy = SG.hoyISO();
    const rapidos = [['Hoy', hoy, hoy], ['7 días', SG.sumarDias(hoy, -6), hoy], ['Este mes', `${hoy.slice(0, 8)}01`, hoy]];
    return html`<div class="rango-bloque">
      <div class="filtros">${rapidos.map(([t, d, h]) => html`<button class="filtro ${rango.desde === d && rango.hasta === h ? 'activo' : ''}" data-d="${d}" data-h="${h}">${t}</button>`)}</div>
      <div class="rango"><input type="date" name="desde" value="${rango.desde}" aria-label="Desde"><span>a</span><input type="date" name="hasta" value="${rango.hasta}" aria-label="Hasta"></div>
    </div>`;
  }
  function enlazarRango(cont, rango, alCambiar) {
    $$('.rango-bloque [data-d]', cont).forEach((b) => b.addEventListener('click', () => { rango.desde = b.dataset.d; rango.hasta = b.dataset.h; alCambiar(); }));
    $$('.rango-bloque input', cont).forEach((i) => i.addEventListener('change', () => { rango[i.name] = i.value; alCambiar(); }));
  }

  // =====================================================================
  //  INFORME DE MOVIMIENTOS
  // =====================================================================
  SG.vistas.reportes = async (cont) => {
    const rango = { desde: SG.sumarDias(SG.hoyISO(), -6), hasta: SG.hoyISO() };
    let tab = 'ventas';
    let datos;
    const TABS = [['ventas', 'Ventas'], ['pagos', 'Membresías'], ['visitas', 'Visitas'], ['inventario', 'Inventario']];

    async function cargar() {
      datos = await SG.api.get(`/gestion/movimientos?desde=${rango.desde}&hasta=${rango.hasta}`);
      const t = datos.totales;
      pintar(cont, html`
        <div class="barra-herramientas">${selectorRango(rango)}
          <button class="btn btn-sec" data-csv>${icono('descargar')} Descargar CSV</button></div>
        <section class="kpis kpis-chicos">
          <article class="kpi"><p class="kpi-etq">Ingresos del periodo</p><p class="kpi-num">${dinero(t.ventas + t.pagos + t.visitas)}</p></article>
          <article class="kpi"><p class="kpi-etq">Membresías</p><p class="kpi-num">${dinero(t.pagos)}</p><p class="kpi-nota">${datos.pagos.length} pagos</p></article>
          <article class="kpi"><p class="kpi-etq">Ventas de tienda</p><p class="kpi-num">${dinero(t.ventas)}</p><p class="kpi-nota">Ganancia ${dinero(t.ganancia_ventas)}</p></article>
          <article class="kpi"><p class="kpi-etq">Visitas</p><p class="kpi-num">${dinero(t.visitas)}</p><p class="kpi-nota">${datos.visitas.length} visitas</p></article>
        </section>
        <div class="pestanas" role="tablist">${TABS.map(([k, n]) => html`<button class="pestana ${k === tab ? 'activo' : ''}" data-tab="${k}" role="tab">${n} <small>${datos[k].length}</small></button>`)}</div>
        <div id="tabla-mov"></div>`);
      pintarTabla();
      enlazarRango(cont, rango, cargar);
      $$('[data-tab]', cont).forEach((b) => b.addEventListener('click', () => {
        tab = b.dataset.tab; $$('[data-tab]', cont).forEach((x) => x.classList.toggle('activo', x === b)); pintarTabla();
      }));
      $('[data-csv]', cont).addEventListener('click', () => SG.descargarCSV(`strong-gym-${tab}-${rango.desde}_${rango.hasta}.csv`,
        datos[tab].map((r) => { const o = { ...r }; delete o.id; o.created_at = fechaHora(o.created_at); return o; })));
    }

    function pintarTabla() {
      const filas = datos[tab];
      const t = $('#tabla-mov', cont);
      if (!filas.length) return pintar(t, vacio('No hay movimientos en este periodo.'));
      const cols = {
        ventas: [['Fecha', (r) => fechaHora(r.created_at)], ['Folio', (r) => r.folio], ['Pago', (r) => METODOS[r.metodo_pago]],
          ['Registró', (r) => r.usuario], ['Total', (r) => dinero(r.total)], ['Ganancia', (r) => dinero(r.total - r.costo_total)]],
        pagos: [['Fecha', (r) => fechaHora(r.created_at)], ['Cliente', (r) => r.cliente], ['Concepto', (r) => r.concepto],
          ['Pago', (r) => METODOS[r.metodo]], ['Registró', (r) => r.usuario], ['Monto', (r) => dinero(r.monto)]],
        visitas: [['Fecha', (r) => fechaHora(r.created_at)], ['Nombre', (r) => r.nombre], ['Pago', (r) => METODOS[r.metodo]],
          ['Registró', (r) => r.usuario], ['Monto', (r) => dinero(r.monto)]],
        inventario: [['Fecha', (r) => fechaHora(r.created_at)], ['Producto', (r) => r.producto], ['Tipo', (r) => r.tipo],
          ['Motivo', (r) => r.motivo || '—'], ['Registró', (r) => r.usuario || 'sistema'], ['Cantidad', (r) => (r.cantidad > 0 ? `+${r.cantidad}` : r.cantidad)]],
      }[tab];
      pintar(t, html`<table class="tabla"><thead><tr>${cols.map(([n]) => html`<th>${n}</th>`)}</tr></thead>
        <tbody>${filas.map((r) => html`<tr>${cols.map(([n, f], i) => html`<td ${i === 0 ? html`class="td-principal"` : html`data-label="${n}"`}>${f(r) ?? '—'}</td>`)}</tr>`)}</tbody></table>`);
    }
    await cargar();
  };

  // =====================================================================
  //  BITÁCORA
  // =====================================================================
  const ACCIONES = {
    'sesion.iniciar': 'Inició sesión', 'sesion.cerrar': 'Cerró sesión', 'cliente.crear': 'Registró cliente',
    'cliente.editar': 'Editó cliente', 'cliente.baja': 'Dio de baja a cliente', 'cliente.acceso_portal': 'Dio acceso al portal',
    'membresia.crear': 'Cobró membresía', 'membresia.cancelar': 'Canceló membresía', 'plan.crear': 'Creó plan', 'plan.editar': 'Editó plan',
    'visita.registrar': 'Registró visita', 'venta.registrar': 'Registró venta', 'producto.crear': 'Creó producto',
    'producto.editar': 'Editó producto', 'inventario.entrada': 'Entrada de inventario', 'inventario.merma': 'Registró merma',
    'inventario.ajuste': 'Ajustó inventario', 'usuario.crear': 'Creó usuario', 'usuario.editar': 'Editó usuario',
    'usuario.cambiar_password': 'Cambió su contraseña', 'acceso.denegado': 'Acceso denegado',
    'sitio.editar': 'Editó la información del sitio', 'sitio.publicar': 'Publicó en el sitio',
    'sitio.editar_publicacion': 'Editó una publicación', 'sitio.ocultar': 'Ocultó una publicación',
    'cliente.nuevo_qr': 'Generó QR nuevo', 'cliente.importar': 'Importó socios', 'malteada.crear': 'Agregó malteada', 'malteada.editar': 'Editó malteada',
  };
  function resumenDetalle(d) {
    if (!d) return '';
    return Object.entries(d).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'number' && /monto|total|precio/.test(k) ? dinero(v) : v}`).join(' · ');
  }

  SG.vistas.bitacora = async (cont) => {
    const rango = { desde: SG.hoyISO(), hasta: SG.hoyISO() };
    let usuarioId = '';
    let tab = 'acciones';
    const usuarios = await SG.api.get('/gestion/usuarios');

    async function cargar() {
      const qs = new URLSearchParams({ ...rango, ...(usuarioId ? { usuario_id: usuarioId } : {}) });
      const d = await SG.api.get(`/gestion/bitacora?${qs}`);
      pintar(cont, html`
        <div class="barra-herramientas">${selectorRango(rango)}
          <label class="campo campo-linea"><span>Usuario</span><select data-usuario>
            <option value="">Todos</option>${usuarios.map((u) => html`<option value="${u.id}" ${u.id === usuarioId ? 'selected' : ''}>${u.nombre}</option>`)}</select></label>
        </div>
        <div class="pestanas" role="tablist">
          <button class="pestana ${tab === 'acciones' ? 'activo' : ''}" data-tab="acciones">Actividad <small>${d.acciones.length}</small></button>
          <button class="pestana ${tab === 'sesiones' ? 'activo' : ''}" data-tab="sesiones">Turnos y sesiones <small>${d.sesiones.length}</small></button>
        </div>
        <div data-panel="acciones" ${tab === 'acciones' ? '' : 'hidden'}>
          ${d.acciones.length ? html`<ol class="linea-tiempo">${d.acciones.map((a) => html`
            <li><time>${fechaHora(a.created_at)}</time>
              <div><p><strong>${a.usuario || 'Sistema'}</strong> ${(ACCIONES[a.accion] || a.accion).toLowerCase()}</p>
                ${a.detalle ? html`<small>${resumenDetalle(a.detalle)}</small>` : ''}</div>
              <span class="chip chip-neutro" title="Dónde se hizo">${a.entorno === 'local' ? 'Recepción' : 'Nube'}</span></li>`)}</ol>`
            : vacio('Sin actividad en este periodo.')}
        </div>
        <div data-panel="sesiones" ${tab === 'sesiones' ? '' : 'hidden'}>
          ${d.sesiones.length ? html`<table class="tabla"><thead><tr><th>Usuario</th><th>Inicio</th><th>Cierre</th><th>Duración</th><th>Desde</th></tr></thead>
            <tbody>${d.sesiones.map((s) => {
              const min = s.fin ? Math.round((new Date(s.fin) - new Date(s.inicio)) / 60000) : null;
              return html`<tr><td class="td-principal"><strong>${s.usuario}</strong></td>
                <td data-label="Inicio">${fechaHora(s.inicio)}</td>
                <td data-label="Cierre">${s.fin ? fechaHora(s.fin) : html`<span class="chip chip-ok">Activa</span>`}</td>
                <td data-label="Duración">${min === null ? '—' : min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`}</td>
                <td data-label="Desde">${s.entorno === 'local' ? 'Recepción' : 'Nube'}</td></tr>`;
            })}</tbody></table>` : vacio('Sin sesiones en este periodo.')}
        </div>`);
      enlazarRango(cont, rango, cargar);
      $('[data-usuario]', cont).addEventListener('change', (e) => { usuarioId = e.target.value; cargar(); });
      $$('[data-tab]', cont).forEach((b) => b.addEventListener('click', () => {
        tab = b.dataset.tab;
        $$('[data-tab]', cont).forEach((x) => x.classList.toggle('activo', x === b));
        $$('[data-panel]', cont).forEach((p) => { p.hidden = p.dataset.panel !== tab; });
      }));
    }
    await cargar();
  };

  // =====================================================================
  //  USUARIOS DEL PERSONAL
  // =====================================================================
  function formUsuario(u, alGuardar) {
    const nuevo = !u;
    const m = modal({
      titulo: nuevo ? 'Nuevo usuario' : `Editar · ${u.nombre}`,
      cuerpo: html`<form class="form">
        <label class="campo"><span>Nombre completo</span><input name="nombre" required value="${u ? u.nombre : ''}"></label>
        ${nuevo ? html`
          <label class="campo"><span>Usuario para entrar</span><input name="usuario" required pattern="[a-zA-Z0-9._\\-]{3,60}" autocapitalize="none" placeholder="ej. recepcion.tarde"></label>
          <fieldset class="segmentos"><legend>Rol</legend>
            <label class="segmento"><input type="radio" name="rol" value="admin" checked><span>Administrador</span></label>
            <label class="segmento"><input type="radio" name="rol" value="dueno"><span>Dueño (solo consulta)</span></label></fieldset>` :
          html`<label class="interruptor"><input type="checkbox" name="activo" ${u.activo ? 'checked' : ''}><span>Puede iniciar sesión</span></label>`}
        <label class="campo"><span>${nuevo ? 'Contraseña' : 'Nueva contraseña'}</span>
          <input name="password" type="text" minlength="8" ${nuevo ? 'required' : ''} autocomplete="off" placeholder="${nuevo ? '' : 'Déjala vacía para no cambiarla'}">
          <small>Mínimo 8 caracteres. Compártela en persona, no por chat.</small></label>
        <div class="acciones-form"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button>
          <button class="btn btn-primario">${nuevo ? 'Crear usuario' : 'Guardar cambios'}</button></div>
      </form>`,
    });
    $('form', m.el).addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado($('.btn-primario', m.el), async () => {
        const d = datosForm(e.target);
        if (nuevo) await SG.api.post('/gestion/usuarios', d);
        else { d.activo = !!e.target.activo.checked; if (!d.password) delete d.password; await SG.api.put(`/gestion/usuarios/${u.id}`, d); }
        aviso(nuevo ? 'Usuario creado.' : 'Cambios guardados.'); m.cerrar(); alGuardar();
      });
    });
  }

  SG.vistas.usuarios = async (cont) => {
    const lista = await SG.api.get('/gestion/usuarios');
    const lectura = SG.soloLectura();
    pintar(cont, html`
      <div class="barra-herramientas"><p class="ayuda crece">${lectura
        ? 'Personal con acceso al sistema. Las altas y cambios los hace el administrador.'
        : 'Crea una cuenta por persona: así la bitácora sabe quién hizo cada cosa. El dueño tiene acceso de solo consulta.'}</p>
        ${lectura ? '' : html`<button class="btn btn-primario" data-nuevo>${icono('mas')} Nuevo usuario</button>`}</div>
      <table class="tabla"><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Última sesión</th><th>Estado</th>${lectura ? '' : html`<th><span class="sr">Editar</span></th>`}</tr></thead>
      <tbody>${lista.map((u) => html`<tr class="${u.activo ? '' : 'inactivo'}">
        <td class="td-principal"><span class="avatar chico">${SG.iniciales(u.nombre)}</span><strong>${u.nombre}</strong></td>
        <td data-label="Usuario">${u.usuario}</td>
        <td data-label="Rol">${u.rol === 'dueno' ? 'Dueño · solo consulta' : 'Administrador'}</td>
        <td data-label="Última sesión">${u.ultima_sesion ? fechaHora(u.ultima_sesion) : 'Nunca'}</td>
        <td data-label="Estado"><span class="chip ${u.activo ? 'chip-ok' : 'chip-neutro'}">${u.activo ? 'Activo' : 'Desactivado'}</span></td>
        ${lectura ? '' : html`<td class="td-acciones"><button class="btn-icono" data-edit="${u.id}" aria-label="Editar ${u.nombre}">${icono('editar')}</button></td>`}
      </tr>`)}</tbody></table>`);
    if (lectura) return;
    $('[data-nuevo]', cont).addEventListener('click', () => formUsuario(null, () => SG.ir('usuarios')));
    $$('[data-edit]', cont).forEach((b) => b.addEventListener('click', () => formUsuario(lista.find((u) => u.id === b.dataset.edit), () => SG.ir('usuarios'))));
  };

  // =====================================================================
  //  SINCRONIZACIÓN
  // =====================================================================
  SG.vistas.sync = async (cont) => {
    const e = await SG.api.get('/sync/estado');
    const hace = (iso) => {
      if (!iso) return 'Nunca';
      const min = Math.round((Date.now() - new Date(iso)) / 60000);
      return min < 1 ? 'Hace unos segundos' : min < 60 ? `Hace ${min} min` : fechaHora(iso);
    };
    pintar(cont, html`
      <section class="sync">
        <article class="tarjeta sync-diagrama">
          <div class="sync-nodo ${e.entorno === 'local' ? 'actual' : ''}">${icono('servidor')}<strong>Recepción</strong><small>Servidor local · funciona sin internet</small></div>
          <div class="sync-flecha ${e.ultimo_error ? 'error' : ''}"><span>${icono('sync')}</span><small>${e.activo ? `cada ${e.intervalo_seg} s` : 'solo desde recepción'}</small></div>
          <div class="sync-nodo ${e.entorno === 'nube' ? 'actual' : ''}">${icono('nube')}<strong>Nube</strong><small>Dueño y clientes desde cualquier lugar</small></div>
        </article>
        <article class="tarjeta">
          <h2>Estado</h2>
          <dl class="ficha-datos">
            <div><dt>Esta copia corre en</dt><dd>${e.entorno === 'local' ? 'Servidor local de recepción' : 'La nube'}</dd></div>
            <div><dt>${e.entorno === 'local' ? 'Última sincronización correcta' : 'Último contacto de recepción'}</dt><dd>${e.entorno === 'local' && !e.activo ? 'Sin configurar' : hace(e.ultima_ok)}</dd></div>
            ${e.ultimo_resumen ? html`<div><dt>Último ciclo</dt><dd>${e.ultimo_resumen.enviados} enviados · ${e.ultimo_resumen.recibidos} recibidos</dd></div>` : ''}
            <div><dt>Problemas</dt><dd>${e.ultimo_error ? html`<span class="texto-error">${e.ultimo_error}</span>` : 'Ninguno'}</dd></div>
          </dl>
          ${e.activo && !SG.soloLectura() ? html`<button class="btn btn-primario" data-ahora>${icono('sync')} Sincronizar ahora</button>`
            : html`<p class="ayuda">${e.activo ? 'La sincronización corre sola cada minuto.'
              : e.entorno === 'local' ? 'La sincronización está apagada: falta configurar NUBE_URL y SYNC_TOKEN en el archivo .env de esta computadora (ver la guía de instalación).'
              : 'Desde la nube solo se consulta este estado; quien envía y recibe los cambios es el servidor de recepción.'}</p>`}
        </article>
        ${SG.soloLectura() ? '' : html`<article class="tarjeta">
          <h2>Respaldo</h2>
          <p class="ayuda" style="margin:6px 0 14px">Cada día se guarda una copia automática en la carpeta <code>datos/respaldos</code>. Además puedes descargar una copia completa ahora (por ejemplo antes de importar socios o de cambiar de computadora). Guárdala en una USB o en Drive: incluye toda la información del gimnasio.</p>
          <a class="btn btn-sec" href="/api/gestion/respaldo" download>${icono('descargar')} Descargar respaldo ahora</a>
        </article>`}
      </section>`);
    const b = $('[data-ahora]', cont);
    if (b) b.addEventListener('click', () => ocupado(b, async () => {
      const r = await SG.api.post('/sync/ahora');
      if (r.ok) aviso(`Sincronizado: ${r.enviados} enviados, ${r.recibidos} recibidos.`);
      else aviso(r.error || r.omitido || 'No se pudo sincronizar.', 'error');
      SG.ir('sync');
    }));
  };
})(window.SG);
