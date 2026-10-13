/* Portal del cliente: Mi membresía, Asistencias y Pagos (pensado primero para celular) */
(function (SG) {
  const { html, pintar, $, icono, dinero, fecha, fechaHora, hora, METODOS, vacio, diaDe } = SG;

  let cache = null, cacheHora = 0;
  async function resumen() {
    if (!cache || Date.now() - cacheHora > 30000) { cache = await SG.api.get('/portal/resumen'); cacheHora = Date.now(); }
    return cache;
  }

  SG.vistas['mi-membresia'] = async (cont) => {
    const d = await resumen();
    const c = d.cliente;
    const dias = c.dias_restantes;
    const vigente = c.estado === 'vigente' || c.estado === 'por_vencer';
    let pct = 0;
    if (vigente && c.fecha_inicio) {
      const total = (new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / 86400000 + 1;
      pct = Math.max(4, Math.min(100, Math.round(((dias + 1) / total) * 100)));
    }
    pintar(cont, html`
      <section class="portal">
        <article class="membresia-tarjeta" data-estado="${c.estado}">
          <p class="mt-hola">Hola, ${c.nombre}</p>
          <p class="mt-plan">${c.plan || 'Sin membresía activa'}</p>
          ${vigente ? html`
            <p class="mt-dias"><span>${dias}</span>${dias === 1 ? 'día restante' : 'días restantes'}</p>
            <div class="mt-barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
            <p class="mt-fechas">Del ${fecha(c.fecha_inicio)} al ${fecha(c.fecha_fin)}</p>`
          : html`<p class="mt-dias mt-vencida"><span>${c.fecha_fin ? 'Vencida' : '—'}</span></p>
            <p class="mt-fechas">${c.fecha_fin ? `Terminó el ${fecha(c.fecha_fin)}. Renueva en recepción.` : 'Pasa a recepción para elegir un plan.'}</p>`}
          ${c.estado === 'por_vencer' ? html`<p class="mt-aviso">${icono('alerta')} Tu membresía está por terminar. Renueva en recepción para no perder días.</p>` : ''}
        </article>

        <article class="tarjeta credencial">
          <div class="qr">${SG.crudo(SG.qrSVG(c.qr || c.codigo, { color: '#0B2A5C', margen: 2 }))}</div>
          <div><h2>Tu credencial</h2>
            <p class="credencial-codigo">${c.codigo}</p>
            <p class="ayuda">Muéstralo en el lector de recepción al llegar. Sube el brillo de tu pantalla.</p>
            <p class="ayuda">Tip: toma una captura de pantalla y úsala aunque no tengas internet. También puedes pedir tu credencial impresa en recepción.</p></div>
        </article>

        <section class="mini-stats">
          <article class="kpi"><p class="kpi-etq">Este mes</p><p class="kpi-num">${d.asistencias_mes}</p><p class="kpi-nota">entrenamientos</p></article>
          <article class="kpi"><p class="kpi-etq">Última visita</p><p class="kpi-num kpi-num-chico">${d.asistencias[0] ? fecha(diaDe(d.asistencias[0].created_at), { day: 'numeric', month: 'short' }) : '—'}</p>
            <p class="kpi-nota">${d.asistencias[0] ? hora(d.asistencias[0].created_at) : 'Aún no registras entradas'}</p></article>
        </section>
      </section>`);
  };

  SG.vistas['mis-asistencias'] = async (cont) => {
    const d = await resumen();
    const dias = new Set(d.asistencias.map((a) => diaDe(a.created_at)));
    let [anio, mes] = SG.hoyISO().split('-').map(Number);

    function pintarMes() {
      const primero = new Date(Date.UTC(anio, mes - 1, 1));
      const total = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
      const desfase = (primero.getUTCDay() + 6) % 7; // semana inicia en lunes
      const hoy = SG.hoyISO();
      const celdas = [];
      for (let i = 0; i < desfase; i++) celdas.push(html`<span class="dia vacio-dia"></span>`);
      let cuenta = 0;
      for (let n = 1; n <= total; n++) {
        const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
        const fue = dias.has(iso);
        if (fue) cuenta++;
        celdas.push(html`<span class="dia ${fue ? 'fue' : ''} ${iso === hoy ? 'hoy' : ''}" ${fue ? html`aria-label="Entrenaste el ${n}"` : ''}>${n}</span>`);
      }
      const titulo = SG.mayus(primero.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
      pintar($('#calendario', cont), html`
        <header class="cal-cab">
          <button class="btn-icono" data-ant aria-label="Mes anterior">${icono('atras')}</button>
          <h2>${titulo}</h2>
          <button class="btn-icono girar" data-sig aria-label="Mes siguiente">${icono('atras')}</button>
        </header>
        <p class="cal-resumen"><strong>${cuenta}</strong> ${cuenta === 1 ? 'día entrenado' : 'días entrenados'}</p>
        <div class="cal-semana">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => html`<span>${x}</span>`)}</div>
        <div class="cal-dias">${celdas}</div>`);
      $('[data-ant]', cont).addEventListener('click', () => { mes--; if (mes < 1) { mes = 12; anio--; } pintarMes(); });
      $('[data-sig]', cont).addEventListener('click', () => { mes++; if (mes > 12) { mes = 1; anio++; } pintarMes(); });
    }

    pintar(cont, html`
      <section class="portal">
        <article class="tarjeta" id="calendario"></article>
        <article class="tarjeta"><h2>Entradas recientes</h2>
          ${d.asistencias.length ? html`<ul class="lista-simple">${d.asistencias.slice(0, 20).map((a) => html`
            <li><span>${fecha(diaDe(a.created_at), { weekday: 'long', day: 'numeric', month: 'long' })}</span><strong>${hora(a.created_at)}</strong></li>`)}</ul>`
            : vacio('Aún no tienes entradas registradas.')}
        </article>
      </section>`);
    pintarMes();
  };

  SG.vistas['mis-pagos'] = async (cont) => {
    const d = await resumen();
    pintar(cont, html`<section class="portal"><article class="tarjeta"><h2>Historial de pagos</h2>
      ${d.pagos.length ? html`<ul class="lista-simple">${d.pagos.map((p) => html`
        <li><span>${p.concepto}<small>${fechaHora(p.created_at)} · ${METODOS[p.metodo]}</small></span><strong>${dinero(p.monto)}</strong></li>`)}</ul>`
        : vacio('Todavía no hay pagos registrados.')}
    </article></section>`);
  };
})(window.SG);
