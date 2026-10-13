/* Vistas: Clientes, Membresías y Visitas (+ modales compartidos) */
(function (SG) {
  const { html, pintar, $, $$, icono, dinero, fecha, fechaHora, hora, nombreCompleto, chipEstado, METODOS,
    modal, confirmar, datosForm, ocupado, vacio, aviso } = SG;

  const opcionesMetodo = (sel = 'efectivo') => Object.entries(METODOS).map(([v, t]) => html`
    <label class="segmento"><input type="radio" name="metodo_pago" value="${v}" ${v === sel ? 'checked' : ''}><span>${t}</span></label>`);

  let cachePlanes = null;
  async function planes() { if (!cachePlanes) cachePlanes = await SG.api.get('/membresias/planes'); return cachePlanes; }
  SG.limpiarPlanes = () => { cachePlanes = null; };

  // ---------------------------------------------------------------------
  //  Credencial con QR (para imprimir, recortar y enmicar · o en PVC)
  //  El QR lleva el código de socio + 4 dígitos de verificación: no cambia
  //  al renovar, así que se imprime una sola vez.
  // ---------------------------------------------------------------------
  const credencial = (c) => html`
    <div class="credencial-tarjeta">
      <div class="ct-datos">
        <div class="ct-cab">
          <img class="ct-logo" src="${SG.LOGO}" alt="">
          ${c.foto_url ? html`<img class="ct-foto" src="${c.foto_url}" alt="">` : ''}
        </div>
        <p class="ct-nombre">${nombreCompleto(c)}</p>
        <p class="ct-codigo">Socio ${c.codigo}</p>
        <p class="ct-pie">Strong Gym Puruándiro</p>
      </div>
      <div class="ct-qr">${SG.crudo(SG.qrSVG(c.qr || c.codigo, { color: '#0B2A5C', margen: 2 }))}</div>
    </div>`;

  // Datos del gimnasio para el reverso (se piden una vez)
  let datosGym = null;
  async function gym() {
    if (!datosGym) { try { datosGym = (await SG.api.get('/sitio')).sitio || {}; } catch (e) { datosGym = {}; } }
    return datosGym;
  }
  SG.limpiarDatosGym = () => { datosGym = null; };
  const telBonito = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : t; };

  const reverso = (s) => {
    const horario = String(s.horario || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
    const contacto = [s.whatsapp && ['WhatsApp', telBonito(s.whatsapp)], s.telefono && ['Teléfono', telBonito(s.telefono)]].filter(Boolean)[0];
    return html`
    <div class="credencial-tarjeta credencial-reverso">
      <div class="cr-cab"><img src="${SG.LOGO}" alt=""><p><strong>Strong Gym</strong><span>Puruándiro</span></p></div>
      <dl class="cr-datos">
        ${horario.length ? html`<div><dt>Horario</dt><dd>${horario.map((l) => html`<span>${l}</span>`)}</dd></div>` : ''}
        ${contacto ? html`<div><dt>${contacto[0]}</dt><dd>${contacto[1]}</dd></div>` : ''}
        ${s.direccion ? html`<div><dt>Dirección</dt><dd>${s.direccion}</dd></div>` : ''}
        ${s.sitio_web ? html`<div><dt>Web</dt><dd>${s.sitio_web}</dd></div>` : ''}
      </dl>
      <p class="cr-texto">${s.credencial_texto || 'Credencial personal e intransferible. Preséntala en recepción al llegar.'}</p>
    </div>`;
  };

  // Preferencias de impresión (se recuerdan en esta computadora)
  const PREF = 'sg-impresion';
  const leerPref = () => { try { return { formato: 'carta', reverso: true, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch (e) { return { formato: 'carta', reverso: true }; } };
  const guardarPref = (p) => { try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) { /* nada */ } };
  const opcionesImpresion = (p) => html`
    <div class="opciones-impresion">
      <fieldset class="segmentos"><legend>Imprimir en</legend>
        <label class="segmento"><input type="radio" name="formato" value="carta" ${p.formato === 'carta' ? 'checked' : ''}><span>Hoja carta (recortar y enmicar)</span></label>
        <label class="segmento"><input type="radio" name="formato" value="pvc" ${p.formato === 'pvc' ? 'checked' : ''}><span>Impresora de credenciales PVC</span></label>
      </fieldset>
      <label class="interruptor"><input type="checkbox" name="reverso" ${p.reverso ? 'checked' : ''}><span>Incluir reverso</span></label>
    </div>
    <p class="ayuda" data-ayuda-impresion></p>`;
  function enlazarOpciones(raiz, p, alCambiar) {
    const ayuda = $('[data-ayuda-impresion]', raiz);
    const texto = () => {
      ayuda.textContent = p.formato === 'pvc'
        ? `En la impresora elige el tamaño de tarjeta CR80 (8.6 × 5.4 cm), márgenes "Ninguno"${p.reverso ? ' y "Imprimir por ambos lados" (cada socio sale como frente y reverso)' : ''}.`
        : p.reverso
          ? 'Sale una hoja de frentes y otra de reversos acomodados en espejo. Si tu impresora imprime por ambos lados, elige "voltear por el borde largo". Si no, imprime las dos hojas, recórtalas y pega frente con reverso antes de enmicar.'
          : 'Hasta 8 credenciales por hoja, con línea punteada para recortar.';
    };
    $$('input[name=formato]', raiz).forEach((i) => i.addEventListener('change', () => { p.formato = i.value; guardarPref(p); texto(); if (alCambiar) alCambiar(); }));
    $('input[name=reverso]', raiz).addEventListener('change', (e) => { p.reverso = e.target.checked; guardarPref(p); texto(); if (alCambiar) alCambiar(); });
    texto();
  }

  /** Imprime una o varias credenciales. */
  SG.imprimirCredenciales = async (lista, pref = leerPref()) => {
    const s = pref.reverso ? await gym() : {};
    const previo = document.getElementById('impresion');
    if (previo) previo.remove();
    const div = document.createElement('div');
    div.id = 'impresion';
    let contenido;
    if (pref.formato === 'pvc') {
      // Una tarjeta por página: frente y (si aplica) reverso
      contenido = html`<div class="impresion-pvc">${lista.map((c) => html`${credencial(c)}${pref.reverso ? reverso(s) : ''}`)}</div>`;
    } else {
      const hojas = [];
      for (let i = 0; i < lista.length; i += 8) {
        const grupo = lista.slice(i, i + 8);
        hojas.push(html`<div class="hoja-credenciales">${grupo.map((c) => credencial(c))}</div>`);
        if (pref.reverso) {
          // Reversos en espejo (columna izquierda ↔ derecha) para que coincidan al voltear la hoja
          const celdas = [];
          for (let r = 0; r < grupo.length; r += 2) {
            celdas.push(grupo[r + 1] ? reverso(s) : html`<div class="credencial-vacia"></div>`);
            celdas.push(reverso(s));
          }
          hojas.push(html`<div class="hoja-credenciales hoja-reversos">${celdas}</div>`);
        }
      }
      contenido = html`${hojas}<p class="ct-instruccion">Recorta por la línea punteada y enmica (de preferencia mica mate: refleja menos y el lector lee más rápido). Tamaño: 8.6 × 5.4 cm.</p>`;
    }
    pintar(div, contenido);
    div.className = pref.formato === 'pvc' ? 'formato-pvc' : 'formato-carta';
    // Tamaño de página según el formato
    let estilo = document.getElementById('estilo-pagina');
    if (!estilo) { estilo = document.createElement('style'); estilo.id = 'estilo-pagina'; document.head.appendChild(estilo); }
    estilo.textContent = pref.formato === 'pvc' ? '@page { size: 85.6mm 54mm; margin: 0; }' : '@page { size: letter; margin: 10mm; }';
    document.body.appendChild(div);
    document.body.classList.add('imprimiendo');
    const limpiar = () => {
      window.removeEventListener('afterprint', limpiar);
      if (!div.isConnected) return; // ya se reemplazó por otra impresión
      document.body.classList.remove('imprimiendo'); div.remove();
    };
    window.addEventListener('afterprint', limpiar);
    // Espera a que carguen las fotos antes de imprimir
    const imgs = [...div.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))).filter(Boolean);
    await Promise.all(imgs);
    setTimeout(() => {
      try { window.print(); } catch (e) { aviso('Este navegador no permite imprimir desde aquí.', 'error'); }
      setTimeout(limpiar, 1500);
    }, 60);
  };
  SG.imprimirCredencial = (c) => SG.imprimirCredenciales([c]);

  SG.abrirCredencial = async (c, { nuevo = false, alVerFicha, alCambiar } = {}) => {
    const lectura = SG.soloLectura();
    const pref = leerPref();
    const s = await gym();
    const m = modal({
      titulo: nuevo ? 'Cliente registrado' : 'Credencial',
      ancho: 'ancho',
      cuerpo: html`
        ${nuevo ? html`<p class="ayuda">Imprime su credencial ahora: con ella entra pasando el QR por el lector, sin celular ni internet.</p>` : ''}
        <div class="credencial-vista" data-vista>
          <figure><figcaption>Frente</figcaption>${credencial(c)}</figure>
          <figure data-fig-reverso ${pref.reverso ? '' : 'hidden'}><figcaption>Reverso</figcaption>${reverso(s)}</figure>
        </div>
        ${opcionesImpresion(pref)}
        <p class="ayuda">El QR no cambia al renovar, así que se imprime una sola vez. Si la pierde, se reimprime igual.
          ${lectura ? '' : html`Si crees que alguien más la usa, <button class="enlace" data-nuevo-qr>genera un QR nuevo</button> (la credencial anterior deja de servir).`}</p>
        <div class="acciones-form">
          ${alVerFicha ? html`<button class="btn btn-sec" data-ficha>Ver ficha</button>` : html`<button class="btn btn-sec" data-cerrar>Cerrar</button>`}
          <button class="btn btn-primario" data-imprimir>${icono('imprimir')} Imprimir credencial</button>
        </div>`,
    });
    enlazarOpciones(m.el, pref, () => { $('[data-fig-reverso]', m.el).hidden = !pref.reverso; });
    $('[data-imprimir]', m.el).addEventListener('click', () => SG.imprimirCredenciales([c], pref));
    const bF = $('[data-ficha]', m.el);
    if (bF) bF.addEventListener('click', () => { m.cerrar(); alVerFicha(); });
    const bQ = $('[data-nuevo-qr]', m.el);
    if (bQ) bQ.addEventListener('click', async () => {
      if (!(await confirmar(`¿Generar un QR nuevo para ${nombreCompleto(c)}? Su credencial actual dejará de funcionar y habrá que imprimir otra.`, { si: 'Generar QR nuevo', peligro: true }))) return;
      ocupado(null, async () => {
        const n = await SG.api.post(`/clientes/${c.id}/nuevo-qr`);
        aviso('QR nuevo generado. Imprime la credencial nueva.');
        m.cerrar();
        SG.abrirCredencial(n, { alCambiar });
        if (alCambiar) alCambiar();
      });
    });
  };

  /** Elegir varios socios e imprimir sus credenciales en una sola hoja. */
  SG.imprimirVarias = async () => {
    const lista = await SG.api.get('/clientes');
    const hoy = SG.hoyISO();
    const recientes = (c) => SG.diaDe(c.created_at) >= SG.sumarDias(hoy, -7);
    let filtro = 'recientes';
    let q = '';
    const elegidos = new Set(lista.filter(recientes).map((c) => c.id));
    const pref = leerPref();
    const m = modal({
      titulo: 'Imprimir credenciales',
      ancho: 'ancho',
      cuerpo: html`
        <p class="ayuda">Marca a quién imprimir. En hoja carta caben 8 por hoja.</p>
        <div class="barra-herramientas">
          <label class="buscador">${icono('buscar')}<input type="search" placeholder="Buscar por nombre o código" aria-label="Buscar"></label>
          <div class="filtros"><button class="filtro activo" data-f="recientes">Últimos 7 días</button><button class="filtro" data-f="todos">Todos</button></div>
        </div>
        <ul class="lista-elegir" data-lista></ul>
        ${opcionesImpresion(pref)}
        <div class="acciones-form"><button class="btn btn-sec" data-cerrar>Cancelar</button>
          <button class="btn btn-primario" data-imprimir>${icono('imprimir')} Imprimir <span data-n></span></button></div>`,
    });
    const ul = $('[data-lista]', m.el);
    const pintarLista = () => {
      const t = q.toLowerCase();
      const filas = lista.filter((c) => (filtro === 'todos' || recientes(c) || elegidos.has(c.id)) && (!t || nombreCompleto(c).toLowerCase().includes(t) || c.codigo.includes(t)));
      pintar(ul, filas.length ? filas.slice(0, 200).map((c) => html`<li><label class="elegir-fila">
        <input type="checkbox" value="${c.id}" ${elegidos.has(c.id) ? 'checked' : ''}>
        <span><strong>${nombreCompleto(c)}</strong><small>#${c.codigo} · alta ${SG.fecha(SG.diaDe(c.created_at), { day: 'numeric', month: 'short' })}${c.tiene_foto ? '' : ' · sin foto'}</small></span></label></li>`)
        : html`<li class="vacio-chico">${filtro === 'recientes' ? 'Nadie se registró en los últimos 7 días. Elige "Todos".' : 'Nadie coincide.'}</li>`);
      $$('input[type=checkbox]', ul).forEach((i) => i.addEventListener('change', () => { if (i.checked) elegidos.add(i.value); else elegidos.delete(i.value); contar(); }));
      contar();
    };
    const contar = () => { $('[data-n]', m.el).textContent = elegidos.size ? `(${elegidos.size})` : ''; $('[data-imprimir]', m.el).disabled = !elegidos.size; };
    $('input[type=search]', m.el).addEventListener('input', (e) => { q = e.target.value.trim(); pintarLista(); });
    $$('[data-f]', m.el).forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.f; $$('[data-f]', m.el).forEach((x) => x.classList.toggle('activo', x === b)); pintarLista(); }));
    $('[data-imprimir]', m.el).addEventListener('click', () => {
      SG.imprimirCredenciales(lista.filter((c) => elegidos.has(c.id)), pref);
    });
    enlazarOpciones(m.el, pref);
    pintarLista();
  };

  // ---------------------------------------------------------------------
  //  Modal: renovar / asignar membresía
  // ---------------------------------------------------------------------
  SG.abrirRenovar = async (cliente, alTerminar) => {
    const lista = await planes();
    const m = modal({
      titulo: 'Registrar membresía',
      cuerpo: html`
        <form class="form">
          <p class="ayuda">Socio: <strong>${nombreCompleto(cliente)}</strong> · código ${cliente.codigo}</p>
          <fieldset class="planes-elegir"><legend>Plan</legend>
            ${lista.map((p, i) => html`<label class="plan-opcion"><input type="radio" name="plan_id" value="${p.id}" ${i === 0 ? 'checked' : ''}>
              <span><strong>${p.nombre}</strong><small>${p.duracion_dias} días</small><em>${dinero(p.precio)}</em></span></label>`)}
          </fieldset>
          <fieldset class="segmentos"><legend>Forma de pago</legend>${opcionesMetodo()}</fieldset>
          <p class="ayuda">Si aún tiene días vigentes, el nuevo periodo empieza cuando termine el actual.</p>
          <div class="acciones-form"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button>
            <button class="btn btn-primario">Cobrar y registrar</button></div>
        </form>`,
    });
    const f = $('form', m.el);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado($('.btn-primario', f), async () => {
        const d = datosForm(f);
        const r = await SG.api.post('/membresias', { cliente_id: cliente.id, plan_id: d.plan_id, metodo_pago: d.metodo_pago });
        aviso(`Membresía ${r.plan} registrada hasta el ${fecha(r.fecha_fin)}.`);
        m.cerrar();
        if (alTerminar) alTerminar(r);
      });
    });
  };

  // ---------------------------------------------------------------------
  //  Modal: alta / edición de cliente
  // ---------------------------------------------------------------------
  SG.abrirFormCliente = async (cliente, alGuardar) => {
    const nuevo = !cliente;
    const c = cliente || {};
    const lista = nuevo ? await planes() : [];
    const m = modal({
      titulo: nuevo ? 'Nuevo cliente' : 'Editar cliente',
      ancho: 'ancho',
      cuerpo: html`
        <form class="form form-2col">
          <div class="campo col-completa foto-campo"><span>Foto <small>(para reconocerlo al escanear su credencial)</small></span>
            <div class="foto-fila">
              <div class="foto-vista" data-vista-foto></div>
              <div class="subir-acciones">
                <button type="button" class="btn btn-sec" data-foto>${icono('camara')} Tomar foto</button>
                <button type="button" class="btn btn-fantasma" data-quitar-foto hidden>Quitar</button>
              </div>
            </div>
          </div>
          <label class="campo"><span>Nombre</span><input name="nombre" required value="${c.nombre || ''}" autocomplete="off"></label>
          <label class="campo"><span>Apellidos</span><input name="apellidos" value="${c.apellidos || ''}" autocomplete="off"></label>
          <label class="campo"><span>Teléfono</span><input name="telefono" type="tel" inputmode="tel" value="${c.telefono || ''}" placeholder="10 dígitos"></label>
          <label class="campo"><span>Correo <small>(opcional)</small></span><input name="email" type="email" value="${c.email || ''}"></label>
          <label class="campo"><span>Fecha de nacimiento <small>(opcional)</small></span><input name="fecha_nacimiento" type="date" value="${c.fecha_nacimiento || ''}"></label>
          ${nuevo ? html`
            <label class="campo"><span>Membresía inicial</span>
              <select name="plan_id"><option value="">Sin membresía por ahora</option>
                ${lista.map((p) => html`<option value="${p.id}">${p.nombre} · ${dinero(p.precio)}</option>`)}</select></label>
            <fieldset class="segmentos col-completa"><legend>Forma de pago</legend>${opcionesMetodo()}</fieldset>
            <label class="campo col-completa"><span>Contraseña para su portal <small>(opcional, mínimo 8)</small></span>
              <input name="password" type="text" minlength="8" autocomplete="off" placeholder="Déjala vacía si no usará el portal">
              <small>Entrará con su número de socio o su teléfono.</small></label>` : ''}
          <label class="campo col-completa"><span>Notas</span><textarea name="notas" rows="2" placeholder="Lesiones, objetivos, observaciones">${c.notas || ''}</textarea></label>
          <div class="acciones-form col-completa"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button>
            <button class="btn btn-primario">${nuevo ? 'Registrar cliente' : 'Guardar cambios'}</button></div>
        </form>`,
    });
    const f = $('form', m.el);
    let foto = c.foto_url || null;
    const vistaFoto = $('[data-vista-foto]', m.el);
    const bQuitarFoto = $('[data-quitar-foto]', m.el);
    const pintarFoto = () => {
      pintar(vistaFoto, foto ? html`<img src="${foto}" alt="">` : html`<span>${icono('usuario')}</span>`);
      bQuitarFoto.hidden = !foto;
    };
    pintarFoto();
    $('[data-foto]', m.el).addEventListener('click', async () => {
      const r = await SG.tomarFoto();
      if (r) { foto = r; pintarFoto(); }
    });
    bQuitarFoto.addEventListener('click', () => { foto = null; pintarFoto(); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado($('.btn-primario', f), async () => {
        const d = { ...datosForm(f), foto };
        if (nuevo) {
          const r = await SG.api.post('/clientes', d);
          aviso(`Cliente registrado. Su código es ${r.cliente.codigo}.`);
          m.cerrar();
          if (alGuardar) alGuardar(r.cliente);
        } else {
          const act = await SG.api.put(`/clientes/${c.id}`, d);
          aviso('Cambios guardados.');
          m.cerrar();
          if (alGuardar) alGuardar(act);
        }
      });
    });
  };

  // ---------------------------------------------------------------------
  //  Ficha del cliente
  // ---------------------------------------------------------------------
  SG.abrirCliente = async (id, alCambiar) => {
    const d = await SG.api.get(`/clientes/${id}`);
    const c = d.cliente;
    const lectura = SG.soloLectura();
    const m = modal({
      titulo: nombreCompleto(c),
      ancho: 'ancho',
      cuerpo: html`
        <div class="ficha">
          <section class="ficha-cab">
            <button class="ficha-codigo" data-credencial title="Ver e imprimir credencial">
              ${c.foto_url ? html`<img class="ficha-foto" src="${c.foto_url}" alt="">` : ''}
              <span class="ficha-qr">${SG.crudo(SG.qrSVG(c.qr || c.codigo, { color: '#0B2A5C', margen: 2 }))}</span>
              <span><small>Código de socio</small><strong>${c.codigo}</strong><em>Credencial</em></span></button>
            <div class="ficha-estado">${chipEstado(c.estado)}
              <p>${c.plan ? html`${c.plan} · ${c.dias_restantes >= 0 ? `vence el ${fecha(c.fecha_fin)}` : `venció el ${fecha(c.fecha_fin)}`}` : 'Sin membresía registrada'}</p></div>
            ${lectura ? '' : html`<div class="ficha-acciones">
              <button class="btn btn-primario" data-renovar>${icono('membresias')} ${c.estado === 'sin_membresia' ? 'Asignar membresía' : 'Renovar'}</button>
              <button class="btn btn-sec" data-editar>${icono('editar')} Editar</button>
            </div>`}
          </section>
          <dl class="ficha-datos">
            <div><dt>Teléfono</dt><dd>${c.telefono || '—'}</dd></div>
            <div><dt>Correo</dt><dd>${c.email || '—'}</dd></div>
            <div><dt>Cliente desde</dt><dd>${fecha(String(c.created_at).slice(0, 10))}</dd></div>
            <div><dt>Portal</dt><dd>${c.usuario_portal ? 'Con acceso' : lectura ? 'Sin acceso' : html`<button class="enlace" data-acceso>Dar acceso</button>`}</dd></div>
            ${c.notas ? html`<div class="col-completa"><dt>Notas</dt><dd>${c.notas}</dd></div>` : ''}
          </dl>
          <div class="ficha-historial">
            <section><h3>Asistencias recientes</h3>
              ${d.asistencias.length ? html`<ul class="lista-simple compacta">${d.asistencias.slice(0, 8).map((a) => html`<li><span>${fechaHora(a.created_at)}</span><small>${a.metodo}</small></li>`)}</ul>` : vacio('Sin asistencias registradas.')}
            </section>
            <section><h3>Pagos</h3>
              ${d.pagos.length ? html`<ul class="lista-simple compacta">${d.pagos.slice(0, 8).map((p) => html`<li><span>${p.concepto}<small>${fechaHora(p.created_at)}</small></span><strong>${dinero(p.monto)}</strong></li>`)}</ul>` : vacio('Sin pagos registrados.')}
            </section>
          </div>
          ${lectura ? '' : html`<footer class="ficha-pie"><button class="btn btn-fantasma peligro" data-baja>Dar de baja</button></footer>`}
        </div>`,
    });
    const recargar = () => { m.cerrar(); if (alCambiar) alCambiar(); SG.abrirCliente(id, alCambiar); };
    $('[data-credencial]', m.el).addEventListener('click', () => SG.abrirCredencial(c, { alCambiar: recargar }));
    if (lectura) return;
    $('[data-renovar]', m.el).addEventListener('click', () => SG.abrirRenovar(c, recargar));
    $('[data-editar]', m.el).addEventListener('click', () => SG.abrirFormCliente(c, recargar));
    const bAcc = $('[data-acceso]', m.el);
    if (bAcc) bAcc.addEventListener('click', () => {
      const m2 = modal({
        titulo: 'Acceso al portal',
        cuerpo: html`<form class="form"><p class="ayuda">${nombreCompleto(c)} podrá ver su membresía, asistencias y pagos desde el celular. Entrará con su código ${c.codigo} o su teléfono.</p>
          <label class="campo"><span>Contraseña</span><input name="password" minlength="8" required autocomplete="off"></label>
          <div class="acciones-form"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn btn-primario">Dar acceso</button></div></form>`,
      });
      $('form', m2.el).addEventListener('submit', (e) => {
        e.preventDefault();
        ocupado($('.btn-primario', m2.el), async () => {
          await SG.api.post(`/clientes/${c.id}/acceso`, datosForm(e.target));
          aviso('Acceso al portal activado.');
          m2.cerrar(); recargar();
        });
      });
    });
    $('[data-baja]', m.el).addEventListener('click', async () => {
      if (!(await confirmar(`¿Dar de baja a ${nombreCompleto(c)}? Su historial se conserva.`, { si: 'Dar de baja', peligro: true }))) return;
      await ocupado(null, async () => {
        await SG.api.del(`/clientes/${c.id}`);
        aviso('Cliente dado de baja.');
        m.cerrar(); if (alCambiar) alCambiar();
      });
    });
  };

  // =====================================================================
  //  CLIENTES
  // =====================================================================
  SG.vistas.clientes = async (cont) => {
    const filtros = { q: '', estado: '' };
    pintar(cont, html`
      <div class="barra-herramientas">
        <label class="buscador">${icono('buscar')}<input type="search" placeholder="Buscar por nombre, código o teléfono" aria-label="Buscar cliente"></label>
        <div class="filtros" role="group" aria-label="Filtrar por estado">
          ${[['', 'Todos'], ['vigente', 'Vigentes'], ['por_vencer', 'Por vencer'], ['vencida', 'Vencidos']].map(([v, t]) =>
            html`<button class="filtro ${v === '' ? 'activo' : ''}" data-estado="${v}">${t}</button>`)}
        </div>
        ${SG.soloLectura() ? '' : html`<button class="btn btn-sec" data-importar title="Traer socios desde Excel o del sistema anterior">${icono('descargar', 'girar-180')} Importar</button>
          <button class="btn btn-sec" data-varias>${icono('imprimir')} Imprimir credenciales</button>
          <button class="btn btn-primario" data-nuevo>${icono('mas')} Nuevo cliente</button>`}
      </div>
      <div id="tabla-clientes"></div>`);

    async function cargar() {
      const qs = new URLSearchParams(filtros).toString();
      const lista = await SG.api.get(`/clientes?${qs}`);
      const t = $('#tabla-clientes', cont);
      if (!lista.length) return pintar(t, vacio(filtros.q ? 'Nadie coincide con esa búsqueda.' : 'Aún no hay clientes con este filtro.'));
      pintar(t, html`
        <p class="conteo">${lista.length} ${lista.length === 1 ? 'cliente' : 'clientes'}</p>
        <table class="tabla tabla-clic">
          <thead><tr><th>Socio</th><th>Teléfono</th><th>Plan</th><th>Vence</th><th>Estado</th></tr></thead>
          <tbody>${lista.map((c) => html`
            <tr data-id="${c.id}" tabindex="0">
              <td class="td-principal">${c.foto_url ? html`<img class="avatar chico avatar-foto" src="${c.foto_url}" alt="" loading="lazy">` : html`<span class="avatar chico">${SG.iniciales(nombreCompleto(c))}</span>`}
                <span><strong>${nombreCompleto(c)}</strong><small>#${c.codigo}</small></span></td>
              <td data-label="Teléfono">${c.telefono || '—'}</td>
              <td data-label="Plan">${c.plan || '—'}</td>
              <td data-label="Vence">${c.fecha_fin ? fecha(c.fecha_fin) : '—'}</td>
              <td data-label="Estado">${chipEstado(c.estado)}</td>
            </tr>`)}</tbody>
        </table>`);
      $$('tr[data-id]', t).forEach((tr) => {
        const abrir = () => SG.abrirCliente(tr.dataset.id, cargar);
        tr.addEventListener('click', abrir);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(); });
      });
    }

    let espera;
    $('.buscador input', cont).addEventListener('input', (e) => {
      clearTimeout(espera);
      espera = setTimeout(() => { filtros.q = e.target.value.trim(); cargar(); }, 250);
    });
    $$('.filtro', cont).forEach((b) => b.addEventListener('click', () => {
      $$('.filtro', cont).forEach((x) => x.classList.toggle('activo', x === b));
      filtros.estado = b.dataset.estado; cargar();
    }));
    const bImp = $('[data-importar]', cont);
    if (bImp) bImp.addEventListener('click', () => SG.importarClientes(cargar));
    const bVarias = $('[data-varias]', cont);
    if (bVarias) bVarias.addEventListener('click', () => SG.imprimirVarias());
    const bNuevo = $('[data-nuevo]', cont);
    if (bNuevo) bNuevo.addEventListener('click', () => SG.abrirFormCliente(null, (c) => {
      cargar();
      SG.abrirCredencial(c, { nuevo: true, alVerFicha: () => SG.abrirCliente(c.id, cargar) });
    }));
    await cargar();
  };

  // =====================================================================
  //  MEMBRESÍAS (planes y cobro)
  // =====================================================================
  function formPlan(plan, alGuardar) {
    const p = plan || {};
    const m = modal({
      titulo: plan ? 'Editar plan' : 'Nuevo plan',
      cuerpo: html`<form class="form">
        <label class="campo"><span>Nombre</span><input name="nombre" required value="${p.nombre || ''}" placeholder="Ej. Mensual"></label>
        <div class="fila-2">
          <label class="campo"><span>Duración (días)</span><input name="duracion_dias" type="number" min="1" required value="${p.duracion_dias || 30}"></label>
          <label class="campo"><span>Precio</span><input name="precio" type="number" min="0" step="0.5" required value="${p.precio ?? ''}"></label>
        </div>
        <label class="campo"><span>Descripción</span><input name="descripcion" value="${p.descripcion || ''}"></label>
        ${plan ? html`<label class="interruptor"><input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}><span>Disponible para venta</span></label>` : ''}
        <div class="acciones-form"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn btn-primario">Guardar plan</button></div>
      </form>`,
    });
    $('form', m.el).addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado($('.btn-primario', m.el), async () => {
        const d = datosForm(e.target);
        d.activo = plan ? !!e.target.activo.checked : true;
        if (plan) await SG.api.put(`/membresias/planes/${p.id}`, d); else await SG.api.post('/membresias/planes', d);
        SG.limpiarPlanes();
        aviso('Plan guardado.'); m.cerrar(); alGuardar();
      });
    });
  }

  function buscarCliente(alElegir) {
    const m = modal({
      titulo: 'Cobrar membresía',
      cuerpo: html`<label class="buscador">${icono('buscar')}<input type="search" placeholder="Busca al socio por nombre, código o teléfono" aria-label="Buscar socio"></label>
        <ul class="resultados" aria-live="polite"></ul>
        <p class="ayuda">¿Es nuevo? <button class="enlace" data-nuevo>Regístralo primero</button>.</p>`,
    });
    const ul = $('.resultados', m.el);
    let espera;
    $('input', m.el).addEventListener('input', (e) => {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        const q = e.target.value.trim();
        if (q.length < 2) return pintar(ul, '');
        const lista = await SG.api.get(`/clientes?q=${encodeURIComponent(q)}`);
        pintar(ul, lista.slice(0, 8).map((c) => html`<li><button data-id="${c.id}">
          <span><strong>${nombreCompleto(c)}</strong><small>#${c.codigo} · ${c.telefono || 'sin teléfono'}</small></span>${chipEstado(c.estado)}</button></li>`));
        $$('button[data-id]', ul).forEach((b) => b.addEventListener('click', () => {
          m.cerrar(); alElegir(lista.find((c) => c.id === b.dataset.id));
        }));
      }, 200);
    });
    $('[data-nuevo]', m.el).addEventListener('click', () => { m.cerrar(); SG.abrirFormCliente(null, () => {}); });
  }

  SG.vistas.membresias = async (cont) => {
    SG.limpiarPlanes();
    const lista = await SG.api.get('/membresias/planes?todos=1');
    const lectura = SG.soloLectura();
    pintar(cont, html`
      <div class="barra-herramientas">
        <p class="ayuda crece">${lectura ? 'Planes y precios vigentes. Los cambios los hace el administrador.' : 'Los precios aquí se usan al cobrar en recepción.'}</p>
        ${lectura ? '' : html`<button class="btn btn-sec" data-nuevo-plan>${icono('mas')} Nuevo plan</button>
        <button class="btn btn-primario" data-cobrar>${icono('pagos')} Cobrar membresía</button>`}
      </div>
      <section class="planes">
        ${lista.map((p) => html`
          <article class="plan ${p.activo ? '' : 'inactivo'}">
            <header><h2>${p.nombre}</h2>${p.activo ? '' : html`<span class="chip chip-neutro">Oculto</span>`}</header>
            <p class="plan-precio">${dinero(p.precio)}</p>
            <p class="plan-dur">${p.duracion_dias} días${p.descripcion ? ` · ${p.descripcion}` : ''}</p>
            <footer><span><strong>${p.socios_vigentes}</strong> socios vigentes</span>
              ${lectura ? '' : html`<button class="btn btn-chico btn-fantasma" data-editar="${p.id}">${icono('editar')} Editar</button>`}</footer>
          </article>`)}
      </section>`);
    if (lectura) return;
    $('[data-nuevo-plan]', cont).addEventListener('click', () => formPlan(null, () => SG.ir('membresias')));
    $$('[data-editar]', cont).forEach((b) => b.addEventListener('click', () =>
      formPlan(lista.find((p) => p.id === b.dataset.editar), () => SG.ir('membresias'))));
    $('[data-cobrar]', cont).addEventListener('click', () => buscarCliente((c) => SG.abrirRenovar(c, () => SG.ir('membresias'))));
  };

  // =====================================================================
  //  VISITAS (pago por día)
  // =====================================================================
  SG.vistas.visitas = async (cont) => {
    const lectura = SG.soloLectura();
    const rango = { desde: SG.hoyISO(), hasta: SG.hoyISO() };
    pintar(cont, html`
      <div class="visitas ${lectura ? 'visitas-consulta' : ''}">
        ${lectura ? '' : html`<form class="tarjeta form form-visita">
          <h2>Registrar visita</h2>
          <p class="ayuda">Para quien paga solo el día y no tiene membresía.</p>
          <label class="campo"><span>Nombre</span><input name="nombre" required autocomplete="off"></label>
          <label class="campo"><span>Teléfono <small>(opcional)</small></span><input name="telefono" type="tel" inputmode="tel"></label>
          <label class="campo"><span>Monto</span><input name="monto" type="number" min="0" step="0.5" required></label>
          <fieldset class="segmentos"><legend>Forma de pago</legend>${opcionesMetodo()}</fieldset>
          <button class="btn btn-primario btn-bloque">Cobrar visita</button>
        </form>`}
        <section class="tarjeta">
          <header class="tarjeta-cab"><h2 id="tit-visitas">Visitas de hoy</h2>
            <div class="rango"><input type="date" name="desde" value="${rango.desde}" aria-label="Desde"><span>a</span><input type="date" name="hasta" value="${rango.hasta}" aria-label="Hasta"></div>
          </header>
          <div id="lista-visitas"></div>
        </section>
      </div>`);

    async function cargar() {
      const r = await SG.api.get(`/acceso/visitas?desde=${rango.desde}&hasta=${rango.hasta}`);
      const f = $('.form-visita', cont);
      if (f && !f.monto.value) f.monto.value = r.precio_sugerido;
      const total = r.visitas.reduce((s, v) => s + Number(v.monto), 0);
      $('#tit-visitas', cont).textContent = rango.desde === SG.hoyISO() && rango.hasta === rango.desde ? 'Visitas de hoy' : 'Visitas del periodo';
      pintar($('#lista-visitas', cont), r.visitas.length ? html`
        <p class="conteo">${r.visitas.length} visitas · ${dinero(total)}</p>
        <table class="tabla"><thead><tr><th>Nombre</th><th>Hora</th><th>Pago</th><th>Monto</th></tr></thead>
        <tbody>${r.visitas.map((v) => html`<tr>
          <td class="td-principal"><span><strong>${v.nombre}</strong><small>${v.telefono || ''}</small></span></td>
          <td data-label="Hora">${rango.desde === rango.hasta ? hora(v.created_at) : fechaHora(v.created_at)}</td>
          <td data-label="Pago">${METODOS[v.metodo]}</td><td data-label="Monto">${dinero(v.monto)}</td></tr>`)}</tbody></table>`
        : vacio('No hay visitas en este periodo.'));
    }

    if (!lectura) $('.form-visita', cont).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      ocupado($('button.btn-primario', f), async () => {
        const v = await SG.api.post('/acceso/visitas', datosForm(f));
        aviso(`Visita de ${v.nombre} registrada.`);
        f.nombre.value = ''; f.telefono.value = '';
        f.nombre.focus();
        cargar();
      });
    });
    $$('.rango input', cont).forEach((i) => i.addEventListener('change', () => { rango[i.name] = i.value; cargar(); }));
    await cargar();
  };
})(window.SG);
