/* Vistas: Acceso (registro de entrada) y Panel de indicadores */
(function (SG) {
  const { html, pintar, $, $$, icono, dinero, hora, fecha, nombreCompleto, ocupado, vacio, aviso } = SG;

  // =====================================================================
  //  ACCESO · pantalla principal de recepción
  // =====================================================================
  SG.vistas.acceso = async (cont) => {
    pintar(cont, html`
      <div class="acceso">
        <section class="acceso-principal">
          <form class="escaner" autocomplete="off">
            <label for="codigo" class="escaner-etiqueta">Código del socio</label>
            <div class="escaner-campo">
              ${icono('acceso')}
              <input id="codigo" name="codigo" placeholder="Escanea la credencial, o escribe código, teléfono o nombre" required>
              <button type="button" class="btn btn-sec" data-camara title="Leer la credencial con la cámara">${icono('camara')}<span class="solo-escritorio">Cámara</span></button>
              <button class="btn btn-primario">Registrar entrada</button>
            </div>
            <p class="ayuda">Con lector QR USB: el lector escribe el código y presiona Enter solo. Sin lector: usa el botón Cámara. Si olvidó su credencial, escribe su teléfono o su nombre.</p>
          </form>
          <div class="marcador" data-estado="espera" aria-live="assertive">
            <p class="marcador-estado">Listo para escanear</p>
            <p class="marcador-nombre">Strong Gym</p>
            <p class="marcador-detalle">Las entradas aparecen aquí al instante.</p>
            <div class="marcador-acciones"></div>
          </div>
        </section>
        <aside class="tarjeta entradas-hoy">
          <header class="entradas-cab"><span class="contador" id="contador">0</span><span>entradas hoy</span></header>
          <ol class="lista-entradas" id="entradas"></ol>
        </aside>
      </div>`);

    const input = $('#codigo', cont);
    const marcador = $('.marcador', cont);
    let temporizador;

    async function cargarHoy() {
      const lista = await SG.api.get('/acceso/hoy');
      $('#contador', cont).textContent = lista.length;
      pintar($('#entradas', cont), lista.length
        ? lista.slice(0, 40).map((a) => html`<li><span class="avatar chico">${SG.iniciales(nombreCompleto(a))}</span>
            <span class="entrada-nombre">${nombreCompleto(a)}</span><time>${hora(a.created_at)}</time></li>`)
        : html`<li class="vacio-chico">Aún no hay entradas hoy.</li>`);
    }

    function mostrar(r) {
      clearTimeout(temporizador);
      const c = r.cliente;
      let est = 'no', titulo = 'Acceso denegado';
      if (r.permitido) {
        est = c && c.estado === 'por_vencer' ? 'aviso' : 'ok';
        titulo = r.repetida ? 'Ya está dentro' : 'Acceso permitido';
      } else if (r.motivo === 'no_encontrado') titulo = 'Código no encontrado';
      else if (r.motivo === 'qr_invalido') titulo = 'Credencial no válida';
      else if (r.motivo === 'vencida') titulo = 'Membresía vencida';
      else if (r.motivo === 'sin_membresia') titulo = 'Sin membresía';

      marcador.dataset.estado = est;
      SG.sonido(r.repetida ? 'aviso' : est);
      pintar(marcador, html`
        ${c ? html`<div class="marcador-foto">${c.foto_url ? html`<img src="${c.foto_url}" alt="Foto de ${nombreCompleto(c)}">` : html`<span>${SG.iniciales(nombreCompleto(c))}</span>`}</div>` : ''}
        <p class="marcador-estado">${icono(r.permitido ? 'check' : 'alerta')} ${titulo}</p>
        <p class="marcador-nombre">${c ? nombreCompleto(c) : input.value}</p>
        <p class="marcador-detalle">
          ${c && c.plan ? html`<span>${c.plan}</span>` : ''}
          ${c && c.fecha_fin ? html`<span>${c.dias_restantes >= 0 ? `Vence el ${fecha(c.fecha_fin)}` : `Venció el ${fecha(c.fecha_fin)}`}</span>` : ''}
          <span>${r.mensaje}</span>
        </p>
        ${c && c.foto_url ? '' : c ? html`<p class="marcador-nota">Sin foto en su ficha: tómasela para verificarlo en sus próximas visitas.</p>` : ''}
        <div class="marcador-acciones">
          ${c && !r.permitido && r.motivo !== 'qr_invalido' ? html`<button class="btn btn-claro" data-renovar>Renovar membresía</button>` : ''}
          ${c && r.motivo === 'qr_invalido' ? html`<button class="btn btn-claro" data-ficha>Ver ficha</button>` : ''}
          ${!r.permitido ? html`<button class="btn btn-borde-claro" data-visita>Registrar visita</button>` : ''}
        </div>`);
      const bR = $('[data-renovar]', marcador);
      if (bR) bR.addEventListener('click', () => SG.abrirRenovar(c, () => { input.value = c.codigo; enviar(); }));
      const bF = $('[data-ficha]', marcador);
      if (bF) bF.addEventListener('click', () => SG.abrirCliente(c.id));
      const bV = $('[data-visita]', marcador);
      if (bV) bV.addEventListener('click', () => SG.ir('visitas'));
      input.value = '';
      input.focus();
      temporizador = setTimeout(() => {
        marcador.dataset.estado = 'espera';
        pintar(marcador, html`<p class="marcador-estado">Listo para escanear</p><p class="marcador-nombre">Strong Gym</p>
          <p class="marcador-detalle">Las entradas aparecen aquí al instante.</p><div class="marcador-acciones"></div>`);
      }, r.permitido ? 6000 : 15000);
    }

    async function registrar(codigo, metodo = 'lector') {
      const r = await SG.api.post('/acceso/entrada', { codigo, metodo });
      mostrar(r);
      if (r.permitido && !r.repetida) cargarHoy();
    }

    // Si se escribió un nombre, se busca y se elige a la persona
    function elegir(lista, texto) {
      clearTimeout(temporizador);
      marcador.dataset.estado = 'elegir';
      pintar(marcador, html`
        <p class="marcador-estado">${icono('buscar')} ${lista.length} coincidencias con “${texto}”</p>
        <p class="marcador-detalle"><span>Elige a la persona para registrar su entrada.</span></p>
        <div class="elegir-socio">${lista.slice(0, 8).map((c) => html`
          <button data-cod="${c.codigo}"><strong>${nombreCompleto(c)}</strong><small>#${c.codigo}${c.telefono ? ` · ${c.telefono}` : ''}</small>${SG.chipEstado(c.estado)}</button>`)}</div>`);
      $$('[data-cod]', marcador).forEach((b) => b.addEventListener('click', () =>
        ocupado(b, () => registrar(b.dataset.cod, 'manual'))));
      input.value = '';
    }

    async function enviar() {
      const codigo = input.value.trim();
      if (!codigo) return input.focus();
      await ocupado($('.escaner .btn-primario', cont), async () => {
        if (/[a-záéíóúüñ]/i.test(codigo)) {
          const lista = await SG.api.get(`/clientes?q=${encodeURIComponent(codigo)}`);
          if (!lista.length) return mostrar({ permitido: false, motivo: 'no_encontrado', mensaje: `Nadie coincide con “${codigo}”. Revisa cómo se escribe o búscalo en Clientes.` });
          if (lista.length === 1) return registrar(lista[0].codigo, 'manual');
          return elegir(lista, codigo);
        }
        return registrar(codigo, /^\d{10}$/.test(codigo) ? 'lector' : 'manual');
      });
    }

    $('[data-camara]', cont).addEventListener('click', () => SG.escanearQR((texto) => {
      input.value = texto.replace(/\D/g, '');
      if (!input.value) return aviso('Ese QR no es una credencial de Strong Gym.', 'error');
      ocupado($('.escaner .btn-primario', cont), () => registrar(input.value, 'camara'));
    }));

    $('.escaner', cont).addEventListener('submit', (e) => { e.preventDefault(); enviar(); });
    // Si se da clic en otro lado, el cursor regresa al campo (para el lector)
    const reenfocar = (e) => {
      if (!document.querySelector('.modal-fondo') && !e.target.closest('button, a, input, select, textarea')) input.focus();
    };
    document.addEventListener('click', reenfocar);
    await cargarHoy();
    input.focus();
    const refresco = setInterval(cargarHoy, 30000);
    return () => { clearInterval(refresco); clearTimeout(temporizador); document.removeEventListener('click', reenfocar); };
  };

  // =====================================================================
  //  PANEL DE INDICADORES
  // =====================================================================
  function grafica(serie) {
    const W = 640, H = 220, pad = 28, base = H - pad;
    const totales = serie.map((d) => d.membresias + d.ventas + d.visitas);
    const max = Math.max(...totales, 1);
    const ancho = (W - pad * 2) / serie.length;
    const barra = Math.min(46, ancho * 0.6);
    const dia = (iso) => fecha(iso, { weekday: 'short' }).replace('.', '');
    const segmentos = serie.map((d, i) => {
      const x = pad + i * ancho + (ancho - barra) / 2;
      let y = base;
      const partes = [['membresias', 'g-memb'], ['ventas', 'g-vent'], ['visitas', 'g-visi']].map(([k, cls]) => {
        const h = (d[k] / max) * (base - 16);
        y -= h;
        return h > 0 ? `<rect class="${cls}" x="${x}" y="${y}" width="${barra}" height="${h}" rx="3"><title>${k}: ${dinero(d[k])}</title></rect>` : '';
      }).join('');
      return `${partes}
        <text class="g-etq" x="${x + barra / 2}" y="${H - 8}" text-anchor="middle">${dia(d.dia)}</text>
        ${totales[i] ? `<text class="g-val" x="${x + barra / 2}" y="${y - 6}" text-anchor="middle">${Math.round(totales[i] / 100) / 10}k</text>` : ''}`;
    }).join('');
    return SG.crudo(`<svg class="grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos de los últimos 7 días">
      <line class="g-base" x1="${pad}" x2="${W - pad}" y1="${base}" y2="${base}"/>${segmentos}</svg>`);
  }

  SG.vistas.panel = async (cont) => {
    const d = await SG.api.get('/dashboard');
    const h = d.hoy;
    const maxTop = Math.max(...d.top_productos.map((p) => p.unidades), 1);
    const tel = (t) => String(t || '').replace(/\D/g, '');

    pintar(cont, html`
      <section class="kpis">
        <article class="kpi kpi-destacado">
          <p class="kpi-etq">Ingresos de hoy</p>
          <p class="kpi-num">${dinero(h.ingresos)}</p>
          <ul class="kpi-desglose">
            <li><i class="punto g-memb"></i>Membresías <strong>${dinero(h.membresias)}</strong></li>
            <li><i class="punto g-vent"></i>Ventas <strong>${dinero(h.ventas)}</strong></li>
            <li><i class="punto g-visi"></i>Visitas <strong>${dinero(h.visitas)}</strong></li>
          </ul>
        </article>
        <article class="kpi"><p class="kpi-etq">Asistencias hoy</p><p class="kpi-num">${h.asistencias}</p>
          <p class="kpi-nota">${h.visitas_num} visitas sin membresía</p></article>
        <article class="kpi"><p class="kpi-etq">Socios vigentes</p><p class="kpi-num">${d.socios.vigentes}</p>
          <p class="kpi-nota">${d.socios.por_vencer} por vencer · ${d.socios.vencidos} vencidos</p></article>
        <article class="kpi"><p class="kpi-etq">Ganancia de hoy</p><p class="kpi-num">${dinero(h.ganancia)}</p>
          <p class="kpi-nota">Ventas menos su costo, más membresías y visitas</p></article>
      </section>

      <section class="rejilla-panel">
        <article class="tarjeta tarjeta-grafica">
          <header class="tarjeta-cab"><h2>Últimos 7 días</h2>
            <p class="leyenda"><span><i class="punto g-memb"></i>Membresías</span><span><i class="punto g-vent"></i>Ventas</span><span><i class="punto g-visi"></i>Visitas</span></p></header>
          ${grafica(d.serie)}
          <p class="asist-semana">${d.serie.map((s) => html`<span><strong>${s.asistencias}</strong> ${fecha(s.dia, { weekday: 'short' }).replace('.', '')}</span>`)}</p>
        </article>

        <article class="tarjeta">
          <header class="tarjeta-cab"><h2>Más vendidos</h2><p class="ayuda">Últimos 30 días</p></header>
          ${d.top_productos.length ? html`<ol class="top">${d.top_productos.map((p) => html`
            <li><div class="top-fila"><span>${p.nombre}</span><strong>${p.unidades} u</strong></div>
              <div class="top-barra"><i style="width:${Math.round((p.unidades / maxTop) * 100)}%"></i></div></li>`)}</ol>`
            : vacio('Todavía no hay ventas registradas.')}
        </article>

        <article class="tarjeta">
          <header class="tarjeta-cab"><h2>Por vencer</h2><p class="ayuda">Próximos 5 días</p></header>
          ${d.por_vencer.length ? html`<ul class="lista-simple">${d.por_vencer.map((c) => html`
            <li><div><strong>${nombreCompleto(c)}</strong><small>${c.plan} · ${c.dias_restantes === 0 ? 'vence hoy' : `vence en ${c.dias_restantes} días`}</small></div>
              ${c.telefono && !SG.soloLectura() ? html`<a class="btn btn-chico btn-sec" target="_blank" rel="noopener"
                href="https://wa.me/52${tel(c.telefono)}?text=${encodeURIComponent(`Hola ${c.nombre}, tu membresía de Strong Gym vence el ${fecha(c.fecha_fin)}. ¡Te esperamos para renovar!`)}">
                ${icono('mensaje')} Avisar</a>` : ''}</li>`)}</ul>`
            : vacio('Nadie vence en los próximos días.')}
        </article>

        <article class="tarjeta">
          <header class="tarjeta-cab"><h2>Stock bajo</h2><a class="enlace" href="#/inventario">Ver inventario</a></header>
          ${d.stock_bajo.length ? html`<ul class="lista-simple">${d.stock_bajo.map((p) => html`
            <li><span>${p.nombre}</span><span class="chip ${p.stock <= 0 ? 'chip-no' : 'chip-aviso'}">${p.stock} en stock</span></li>`)}</ul>`
            : vacio('Todo el inventario está por encima del mínimo.')}
        </article>
      </section>`);
  };

  SG.graficaSemana = grafica;
})(window.SG);
