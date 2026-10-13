/* Vistas: Ventas (punto de venta) e Inventario */
(function (SG) {
  const { html, pintar, $, $$, icono, dinero, hora, fechaHora, METODOS, modal, datosForm, ocupado, vacio, aviso } = SG;

  // =====================================================================
  //  VENTAS · consulta por fechas (dueño: solo consulta)
  // =====================================================================
  async function historialVentas(cont) {
    const rango = { desde: SG.hoyISO(), hasta: SG.hoyISO() };
    pintar(cont, html`
      <div class="barra-herramientas">
        <p class="ayuda crece">Ventas de la tienda registradas por el administrador.</p>
        <div class="rango"><input type="date" name="desde" value="${rango.desde}" aria-label="Desde"><span>a</span>
          <input type="date" name="hasta" value="${rango.hasta}" aria-label="Hasta"></div>
      </div>
      <div id="historial"></div>`);
    async function cargar() {
      const lista = await SG.api.get(`/ventas?desde=${rango.desde}&hasta=${rango.hasta}`);
      const total = lista.reduce((s, v) => s + Number(v.total), 0);
      const ganancia = lista.reduce((s, v) => s + Number(v.total) - Number(v.costo_total), 0);
      const unDia = rango.desde === rango.hasta;
      pintar($('#historial', cont), lista.length ? html`
        <section class="kpis kpis-chicos">
          <article class="kpi"><p class="kpi-etq">Vendido</p><p class="kpi-num">${dinero(total)}</p></article>
          <article class="kpi"><p class="kpi-etq">Ganancia</p><p class="kpi-num">${dinero(ganancia)}</p></article>
          <article class="kpi"><p class="kpi-etq">Ventas</p><p class="kpi-num">${lista.length}</p></article>
          <article class="kpi"><p class="kpi-etq">Ticket promedio</p><p class="kpi-num">${dinero(total / lista.length)}</p></article>
        </section>
        <table class="tabla"><thead><tr><th>Folio</th><th>${unDia ? 'Hora' : 'Fecha'}</th><th>Productos</th><th>Pago</th><th>Total</th></tr></thead>
        <tbody>${lista.map((v) => html`<tr>
          <td class="td-principal"><span><strong>${v.folio}</strong><small>${v.vendedor || ''}</small></span></td>
          <td data-label="${unDia ? 'Hora' : 'Fecha'}">${unDia ? hora(v.created_at) : fechaHora(v.created_at)}</td>
          <td data-label="Productos">${(v.productos || []).map((p) => `${p.cantidad}× ${p.nombre}`).join(', ')}</td>
          <td data-label="Pago">${METODOS[v.metodo_pago]}</td>
          <td data-label="Total"><strong>${dinero(v.total)}</strong></td></tr>`)}</tbody></table>`
        : vacio('No hay ventas en este periodo.'));
    }
    $$('.rango input', cont).forEach((i) => i.addEventListener('change', () => { rango[i.name] = i.value; cargar(); }));
    await cargar();
  }

  // =====================================================================
  //  VENTAS · punto de venta (administrador)
  // =====================================================================
  SG.vistas.ventas = async (cont) => {
    if (SG.soloLectura()) return historialVentas(cont);
    let productos = await SG.api.get('/ventas/productos');
    const carrito = new Map(); // producto_id -> cantidad
    let categoria = '';
    let busqueda = '';
    let metodo = 'efectivo';
    const categorias = [...new Set(productos.map((p) => p.categoria))];

    pintar(cont, html`
      <div class="pestanas" role="tablist">
        <button class="pestana activo" data-tab="vender" role="tab">Vender</button>
        <button class="pestana" data-tab="hoy" role="tab">Ventas de hoy</button>
      </div>
      <div class="pos" data-panel="vender">
        <section class="pos-catalogo">
          <div class="barra-herramientas">
            <label class="buscador">${icono('buscar')}<input type="search" placeholder="Buscar producto" aria-label="Buscar producto"></label>
            <div class="filtros" role="group" aria-label="Categoría">
              <button class="filtro activo" data-cat="">Todo</button>
              ${categorias.map((c) => html`<button class="filtro" data-cat="${c}">${c}</button>`)}
            </div>
          </div>
          <div class="productos" id="productos"></div>
        </section>
        <aside class="carrito" id="carrito" aria-label="Venta actual"></aside>
        <button class="carrito-barra" id="carrito-barra" aria-controls="carrito"></button>
      </div>
      <div data-panel="hoy" hidden><div id="ventas-hoy"></div></div>`);

    const enCarrito = () => [...carrito.entries()].map(([id, cant]) => ({ p: productos.find((x) => x.id === id), cant }));
    const total = () => enCarrito().reduce((s, { p, cant }) => s + p.precio_venta * cant, 0);
    const piezas = () => [...carrito.values()].reduce((a, b) => a + b, 0);

    function pintarProductos() {
      const lista = productos.filter((p) => (!categoria || p.categoria === categoria) &&
        (!busqueda || p.nombre.toLowerCase().includes(busqueda) || (p.sku || '').toLowerCase().includes(busqueda)));
      pintar($('#productos', cont), lista.length ? lista.map((p) => {
        const disp = p.stock - (carrito.get(p.id) || 0);
        return html`<button class="producto ${disp <= 0 ? 'agotado' : ''}" data-id="${p.id}" ${disp <= 0 ? 'disabled' : ''}>
          <span class="producto-cat">${p.categoria}</span>
          <strong class="producto-nombre">${p.nombre}</strong>
          <span class="producto-pie"><span class="producto-precio">${dinero(p.precio_venta)}</span>
            <small class="${p.stock <= p.stock_minimo ? 'bajo' : ''}">${disp <= 0 ? 'Agotado' : `${disp} disp.`}</small></span>
          ${carrito.get(p.id) ? html`<span class="producto-cant">${carrito.get(p.id)}</span>` : ''}
        </button>`;
      }) : vacio('No hay productos con ese filtro.'));
      $$('.producto', cont).forEach((b) => b.addEventListener('click', () => cambiar(b.dataset.id, 1)));
    }

    function pintarCarrito() {
      const items = enCarrito();
      pintar($('#carrito', cont), html`
        <header class="carrito-cab"><h2>Venta actual</h2>
          <button class="btn-icono solo-movil" data-cerrar-carrito aria-label="Cerrar">${icono('cerrar')}</button></header>
        ${items.length ? html`<ul class="carrito-lista">${items.map(({ p, cant }) => html`
          <li><div class="carrito-prod"><strong>${p.nombre}</strong><small>${dinero(p.precio_venta)} c/u</small></div>
            <div class="cantidad">
              <button class="btn-icono" data-menos="${p.id}" aria-label="Quitar uno">${icono('menos')}</button>
              <span>${cant}</span>
              <button class="btn-icono" data-mas="${p.id}" aria-label="Agregar uno" ${cant >= p.stock ? 'disabled' : ''}>${icono('mas')}</button>
            </div>
            <strong class="carrito-sub">${dinero(p.precio_venta * cant)}</strong></li>`)}</ul>`
          : html`<p class="carrito-vacio">Toca un producto para agregarlo.</p>`}
        <footer class="carrito-pie">
          <fieldset class="segmentos"><legend>Forma de pago</legend>
            ${Object.entries(METODOS).map(([v, t]) => html`<label class="segmento"><input type="radio" name="metodo" value="${v}" ${v === metodo ? 'checked' : ''}><span>${t}</span></label>`)}
          </fieldset>
          <div class="carrito-total"><span>Total</span><strong>${dinero(total())}</strong></div>
          <button class="btn btn-primario btn-bloque btn-grande" data-cobrar ${items.length ? '' : 'disabled'}>Cobrar ${items.length ? dinero(total()) : ''}</button>
          ${items.length ? html`<button class="btn btn-fantasma btn-bloque" data-vaciar>Vaciar venta</button>` : ''}
        </footer>`);
      const barra = $('#carrito-barra', cont);
      pintar(barra, html`<span>${icono('ventas')} ${piezas()} ${piezas() === 1 ? 'producto' : 'productos'}</span><strong>${dinero(total())}</strong>`);
      barra.hidden = !items.length;

      $$('[data-menos]', cont).forEach((b) => b.addEventListener('click', () => cambiar(b.dataset.menos, -1)));
      $$('[data-mas]', cont).forEach((b) => b.addEventListener('click', () => cambiar(b.dataset.mas, 1)));
      $$('input[name=metodo]', cont).forEach((i) => i.addEventListener('change', () => { metodo = i.value; }));
      const v = $('[data-vaciar]', cont); if (v) v.addEventListener('click', () => { carrito.clear(); refrescar(); });
      $('[data-cerrar-carrito]', cont).addEventListener('click', () => $('#carrito', cont).classList.remove('abierto'));
      const cobrar = $('[data-cobrar]', cont);
      cobrar.addEventListener('click', () => ocupado(cobrar, async () => {
        const venta = await SG.api.post('/ventas', {
          metodo_pago: metodo, items: items.map(({ p, cant }) => ({ producto_id: p.id, cantidad: cant })),
        });
        carrito.clear();
        productos = await SG.api.get('/ventas/productos');
        $('#carrito', cont).classList.remove('abierto');
        refrescar();
        ticket(venta);
      }));
    }

    function ticket(v) {
      modal({
        titulo: 'Venta registrada',
        cuerpo: html`<div class="ticket">
          <p class="ticket-folio">Folio ${v.folio} · ${hora(v.created_at)}</p>
          <ul>${v.lineas.map((l) => html`<li><span>${l.cantidad} × ${l.nombre}</span><span>${dinero(l.precio * l.cantidad)}</span></li>`)}</ul>
          <p class="ticket-total"><span>Total · ${METODOS[v.metodo_pago]}</span><strong>${dinero(v.total)}</strong></p>
        </div>
        <div class="acciones-form"><button class="btn btn-primario" data-cerrar>Nueva venta</button></div>`,
      });
    }

    function cambiar(id, d) {
      const p = productos.find((x) => x.id === id);
      const n = (carrito.get(id) || 0) + d;
      if (n <= 0) carrito.delete(id);
      else if (n <= p.stock) carrito.set(id, n);
      else aviso(`Solo hay ${p.stock} de ${p.nombre}.`, 'error');
      refrescar();
    }
    function refrescar() { pintarProductos(); pintarCarrito(); }

    async function cargarHoy() {
      const lista = await SG.api.get('/ventas');
      const t = lista.reduce((s, v) => s + Number(v.total), 0);
      pintar($('#ventas-hoy', cont), lista.length ? html`
        <p class="conteo">${lista.length} ventas · ${dinero(t)}</p>
        <table class="tabla"><thead><tr><th>Folio</th><th>Hora</th><th>Productos</th><th>Pago</th><th>Total</th></tr></thead>
        <tbody>${lista.map((v) => html`<tr>
          <td class="td-principal"><span><strong>${v.folio}</strong><small>${v.vendedor || ''}</small></span></td>
          <td data-label="Hora">${hora(v.created_at)}</td>
          <td data-label="Productos">${(v.productos || []).map((p) => `${p.cantidad}× ${p.nombre}`).join(', ')}</td>
          <td data-label="Pago">${METODOS[v.metodo_pago]}</td>
          <td data-label="Total"><strong>${dinero(v.total)}</strong></td></tr>`)}</tbody></table>`
        : vacio('Aún no hay ventas hoy.'));
    }

    $('.buscador input', cont).addEventListener('input', (e) => { busqueda = e.target.value.trim().toLowerCase(); pintarProductos(); });
    $$('[data-cat]', cont).forEach((b) => b.addEventListener('click', () => {
      $$('[data-cat]', cont).forEach((x) => x.classList.toggle('activo', x === b));
      categoria = b.dataset.cat; pintarProductos();
    }));
    $('#carrito-barra', cont).addEventListener('click', () => $('#carrito', cont).classList.add('abierto'));
    $$('[data-tab]', cont).forEach((b) => b.addEventListener('click', () => {
      $$('[data-tab]', cont).forEach((x) => x.classList.toggle('activo', x === b));
      $$('[data-panel]', cont).forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.tab; });
      if (b.dataset.tab === 'hoy') cargarHoy();
    }));
    refrescar();
  };

  // =====================================================================
  //  INVENTARIO
  // =====================================================================
  function formProducto(prod, alGuardar) {
    const p = prod || {};
    const m = modal({
      titulo: prod ? 'Editar producto' : 'Nuevo producto',
      cuerpo: html`<form class="form">
        <label class="campo"><span>Nombre</span><input name="nombre" required value="${p.nombre || ''}"></label>
        <div class="fila-2">
          <label class="campo"><span>Categoría</span><input name="categoria" list="cats" value="${p.categoria || ''}" placeholder="Suplementos, Bebidas…"></label>
          <label class="campo"><span>SKU / código <small>(opcional)</small></span><input name="sku" value="${p.sku || ''}"></label>
        </div>
        <datalist id="cats"><option>Suplementos</option><option>Bebidas</option><option>Snacks</option><option>Accesorios</option></datalist>
        <div class="fila-2">
          <label class="campo"><span>Precio de venta</span><input name="precio_venta" type="number" min="0" step="0.5" required value="${p.precio_venta ?? ''}"></label>
          <label class="campo"><span>Costo</span><input name="costo" type="number" min="0" step="0.5" value="${p.costo ?? 0}"><small>Sirve para calcular la ganancia.</small></label>
        </div>
        <div class="fila-2">
          <label class="campo"><span>Stock mínimo</span><input name="stock_minimo" type="number" min="0" value="${p.stock_minimo ?? 3}"></label>
          ${prod ? html`<label class="interruptor"><input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}><span>A la venta</span></label>`
            : html`<label class="campo"><span>Existencia inicial</span><input name="stock_inicial" type="number" min="0" value="0"></label>`}
        </div>
        <div class="acciones-form"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn btn-primario">Guardar producto</button></div>
      </form>`,
    });
    $('form', m.el).addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado($('.btn-primario', m.el), async () => {
        const d = datosForm(e.target);
        if (prod) { d.activo = !!e.target.activo.checked; await SG.api.put(`/ventas/productos/${p.id}`, d); }
        else await SG.api.post('/ventas/productos', d);
        aviso('Producto guardado.'); m.cerrar(); alGuardar();
      });
    });
  }

  function formMovimiento(p, alGuardar) {
    const m = modal({
      titulo: `Inventario · ${p.nombre}`,
      cuerpo: html`<form class="form">
        <p class="ayuda">Existencia actual: <strong>${p.stock}</strong></p>
        <fieldset class="segmentos"><legend>Tipo de movimiento</legend>
          <label class="segmento"><input type="radio" name="tipo" value="entrada" checked><span>Entrada de mercancía</span></label>
          <label class="segmento"><input type="radio" name="tipo" value="merma"><span>Merma / dañado</span></label>
          <label class="segmento"><input type="radio" name="tipo" value="ajuste"><span>Ajuste por conteo</span></label>
        </fieldset>
        <label class="campo"><span>Cantidad</span><input name="cantidad" type="number" step="1" required>
          <small>En ajuste usa negativo para restar (ej. -2).</small></label>
        <label class="campo"><span>Motivo <small>(opcional)</small></span><input name="motivo" placeholder="Proveedor, factura, conteo semanal…"></label>
        <div class="acciones-form"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn btn-primario">Registrar movimiento</button></div>
      </form>
      <h3 class="subtitulo">Últimos movimientos</h3><div data-hist>${SG.cargando()}</div>`,
    });
    SG.api.get(`/ventas/productos/${p.id}/movimientos`).then((lista) => {
      pintar($('[data-hist]', m.el), lista.length ? html`<ul class="lista-simple compacta">${lista.slice(0, 12).map((x) => html`
        <li><span>${x.motivo || x.tipo}<small>${fechaHora(x.created_at)} · ${x.usuario || 'sistema'}</small></span>
          <strong class="${x.cantidad < 0 ? 'num-neg' : 'num-pos'}">${x.cantidad > 0 ? '+' : ''}${x.cantidad}</strong></li>`)}</ul>` : vacio('Sin movimientos.'));
    });
    $('form', m.el).addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado($('.btn-primario', m.el), async () => {
        const d = datosForm(e.target);
        await SG.api.post(`/ventas/productos/${p.id}/movimientos`, { ...d, cantidad: parseInt(d.cantidad, 10) });
        aviso('Movimiento registrado.'); m.cerrar(); alGuardar();
      });
    });
  }

  SG.vistas.inventario = async (cont) => {
    const lectura = SG.soloLectura();
    let soloBajo = false;
    pintar(cont, html`
      <div class="barra-herramientas">
        <label class="buscador">${icono('buscar')}<input type="search" placeholder="Buscar producto" aria-label="Buscar producto"></label>
        <label class="interruptor"><input type="checkbox" data-bajo><span>Solo stock bajo</span></label>
        ${lectura ? '' : html`<button class="btn btn-primario" data-nuevo>${icono('mas')} Nuevo producto</button>`}
      </div>
      <div id="tabla-inv"></div>`);
    let lista = [];
    let q = '';
    async function cargar() { lista = await SG.api.get('/ventas/productos?todos=1'); pintarTabla(); }
    function pintarTabla() {
      const filas = lista.filter((p) => (!soloBajo || p.stock_bajo) && (!q || p.nombre.toLowerCase().includes(q)));
      const valor = lista.filter((p) => p.activo).reduce((s, p) => s + p.costo * Math.max(p.stock, 0), 0);
      pintar($('#tabla-inv', cont), filas.length ? html`
        <p class="conteo">${filas.length} productos · inventario valuado en ${dinero(valor)} (a costo)</p>
        <table class="tabla">
          <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Existencia</th>${lectura ? '' : html`<th><span class="sr">Acciones</span></th>`}</tr></thead>
          <tbody>${filas.map((p) => html`<tr class="${p.activo ? '' : 'inactivo'}">
            <td class="td-principal"><span><strong>${p.nombre}</strong><small>${p.sku || 'sin SKU'}${p.activo ? '' : ' · no se vende'}</small></span></td>
            <td data-label="Categoría">${p.categoria}</td>
            <td data-label="Precio">${dinero(p.precio_venta)}</td>
            <td data-label="Costo">${dinero(p.costo)}</td>
            <td data-label="Existencia"><span class="stock ${p.stock <= 0 ? 'stock-no' : p.stock_bajo ? 'stock-aviso' : ''}">${p.stock}</span><small> mín. ${p.stock_minimo}</small></td>
            ${lectura ? '' : html`<td class="td-acciones">
              <button class="btn btn-chico btn-sec" data-mov="${p.id}">${icono('entrada')} Entrada</button>
              <button class="btn-icono" data-edit="${p.id}" aria-label="Editar ${p.nombre}">${icono('editar')}</button></td>`}
          </tr>`)}</tbody></table>` : vacio(soloBajo ? 'Ningún producto está por debajo del mínimo.' : 'No hay productos.'));
      $$('[data-mov]', cont).forEach((b) => b.addEventListener('click', () => formMovimiento(lista.find((p) => p.id === b.dataset.mov), cargar)));
      $$('[data-edit]', cont).forEach((b) => b.addEventListener('click', () => formProducto(lista.find((p) => p.id === b.dataset.edit), cargar)));
    }
    $('[data-bajo]', cont).addEventListener('change', (e) => { soloBajo = e.target.checked; pintarTabla(); });
    $('.buscador input', cont).addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); pintarTabla(); });
    if (!lectura) $('[data-nuevo]', cont).addEventListener('click', () => formProducto(null, cargar));
    await cargar();
  };
})(window.SG);
