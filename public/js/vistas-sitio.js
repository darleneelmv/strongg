/* =====================================================================
   Módulo "Sitio web": el administrador cambia todo lo que se ve en la
   página de inicio sin tocar código (el dueño solo consulta).
   Pestañas: Publicaciones · Malteadas · Página de inicio · Información
   ===================================================================== */
(function (SG) {
  const { html, pintar, $, $$, icono, dinero, fecha, modal, datosForm, ocupado, vacio, aviso } = SG;

  const TIPOS = { promocion: 'Promoción', novedad: 'Novedad', galeria: 'Foto de galería' };
  const COLORES = ['#5A3220', '#D6334F', '#F29A1F', '#3A3FA8', '#2A2F3A', '#8A5A3C', '#1E8A44', '#7B3FA0', '#D3121F', '#0B2A5C'];

  // ---------------------------------------------------------------------
  //  Publicaciones (promociones, novedades y galería)
  // ---------------------------------------------------------------------
  function formPublicacion(pub, alGuardar) {
    const p = pub || { tipo: 'promocion' };
    let imagen = p.imagen || null;
    const m = modal({
      titulo: pub ? 'Editar publicación' : 'Nueva publicación',
      ancho: 'ancho',
      cuerpo: html`<form class="form form-2col">
        <fieldset class="segmentos col-completa"><legend>Tipo</legend>
          ${Object.entries(TIPOS).map(([v, t]) => html`<label class="segmento"><input type="radio" name="tipo" value="${v}" ${p.tipo === v ? 'checked' : ''}><span>${t}</span></label>`)}
        </fieldset>
        <label class="campo col-completa"><span>Título</span><input name="titulo" required maxlength="120" value="${p.titulo || ''}" placeholder="Ej. Inscripción gratis en octubre"></label>
        <label class="campo col-completa"><span>Texto <small>(opcional)</small></span><textarea name="texto" rows="3" maxlength="2000" placeholder="Detalles, condiciones, fechas…">${p.texto || ''}</textarea></label>
        <div class="campo col-completa"><span>Imagen <small id="nota-img">(opcional; se reduce automáticamente)</small></span>
          <div class="subir-imagen">
            <div class="vista-imagen" id="vista-img">${imagen ? html`<img src="${imagen}" alt="">` : html`<span>Sin imagen</span>`}</div>
            <div class="subir-acciones">
              <label class="btn btn-sec">${icono('imagen')} Elegir foto<input type="file" accept="image/*" hidden data-archivo></label>
              <button type="button" class="btn btn-fantasma" data-quitar ${imagen ? '' : 'hidden'}>Quitar</button>
            </div>
          </div>
        </div>
        <label class="campo" data-solo-promo><span>Válida hasta <small>(opcional)</small></span><input type="date" name="vigente_hasta" value="${p.vigente_hasta || ''}">
          <small>Después de esta fecha deja de mostrarse sola.</small></label>
        <label class="interruptor" data-solo-promo><input type="checkbox" name="destacada" ${p.destacada ? 'checked' : ''}><span>Destacar (aparece primero)</span></label>
        ${pub ? html`<label class="interruptor col-completa"><input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}><span>Visible en el sitio</span></label>` : ''}
        <div class="acciones-form col-completa"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button>
          <button class="btn btn-primario">${pub ? 'Guardar cambios' : 'Publicar'}</button></div>
      </form>`,
    });
    const f = $('form', m.el);
    const vista = $('#vista-img', m.el);
    const bQuitar = $('[data-quitar]', m.el);
    const pintarImg = () => { pintar(vista, imagen ? html`<img src="${imagen}" alt="">` : html`<span>Sin imagen</span>`); bQuitar.hidden = !imagen; };
    const sincTipo = () => {
      const t = f.tipo.value;
      $$('[data-solo-promo]', m.el).forEach((el) => { el.hidden = t !== 'promocion'; });
      $('#nota-img', m.el).textContent = t === 'galeria' ? '(obligatoria para la galería)' : '(opcional; se reduce automáticamente)';
    };
    $$('input[name=tipo]', m.el).forEach((r) => r.addEventListener('change', sincTipo));
    sincTipo();
    $('[data-archivo]', m.el).addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      pintar(vista, html`<span>Procesando…</span>`);
      try { imagen = await SG.comprimirImagen(archivo); } catch (err) { aviso(err.message, 'error'); }
      pintarImg();
    });
    bQuitar.addEventListener('click', () => { imagen = null; pintarImg(); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado($('.btn-primario', f), async () => {
        const d = { ...datosForm(f), imagen, destacada: !!(f.destacada && f.destacada.checked) };
        if (pub) d.activo = !!f.activo.checked;
        if (pub) await SG.api.put(`/sitio/publicaciones/${p.id}`, d); else await SG.api.post('/sitio/publicaciones', d);
        aviso(pub ? 'Publicación actualizada.' : 'Publicado en el sitio.');
        m.cerrar(); alGuardar();
      });
    });
  }

  // ---------------------------------------------------------------------
  //  Malteadas (barra de proteína)
  // ---------------------------------------------------------------------
  const vistaVaso = (x) => (x.imagen ? html`<img src="${x.imagen}" alt="">` : SG.crudo(SG.vasoSVG(x.color, { id: x.id || 'nuevo' })));

  function formMalteada(mal, alGuardar) {
    const x = mal ? { ...mal } : { color: COLORES[0], orden: 99 };
    let imagen = x.imagen || null;
    const m = modal({
      titulo: mal ? `Editar · ${mal.nombre}` : 'Nueva malteada',
      ancho: 'ancho',
      cuerpo: html`<form class="form form-malteada">
        <div class="malteada-editor">
          <div class="malteada-muestra" data-muestra style="--sabor:${x.color}">${vistaVaso(x)}</div>
          <div class="form form-2col">
            <label class="campo col-completa"><span>Nombre</span><input name="nombre" required maxlength="60" value="${x.nombre || ''}" placeholder="Ej. Chocolate Power"></label>
            <label class="campo"><span>Precio</span><input name="precio" type="number" min="0" step="0.5" required value="${x.precio ?? ''}"></label>
            <label class="campo"><span>Proteína (g) <small>(opcional)</small></span><input name="proteina_g" type="number" min="0" max="200" value="${x.proteina_g ?? ''}"></label>
            <label class="campo col-completa"><span>Descripción corta</span><input name="descripcion" maxlength="300" value="${x.descripcion || ''}" placeholder="Lo que la hace especial"></label>
            <label class="campo col-completa"><span>Ingredientes <small>(separados por coma)</small></span><input name="ingredientes" maxlength="200" value="${x.ingredientes || ''}" placeholder="Chocolate, plátano, crema de cacahuate"></label>
            <label class="campo"><span>Etiqueta <small>(opcional)</small></span><input name="etiqueta" maxlength="30" value="${x.etiqueta || ''}" placeholder="Nueva, Más pedida…"></label>
            <label class="campo"><span>Orden <small>(1 = primero)</small></span><input name="orden" type="number" min="0" value="${x.orden ?? 99}"></label>
          </div>
        </div>
        <fieldset class="campo"><legend>Color del sabor <small class="ayuda">(fondo de su sección en la página)</small></legend>
          <div class="colores">
            ${COLORES.map((c) => html`<label class="color-opcion" style="--c:${c}"><input type="radio" name="color_rapido" value="${c}" ${c === x.color ? 'checked' : ''}><span aria-label="${c}"></span></label>`)}
            <label class="color-libre">${icono('editar')}<input type="color" name="color" value="${x.color || '#D3121F'}" aria-label="Otro color"></label>
          </div>
        </fieldset>
        <div class="campo"><span>Foto <small>(opcional · ideal PNG sin fondo; si no subes una, se dibuja el vaso con el color)</small></span>
          <div class="subir-acciones">
            <label class="btn btn-sec">${icono('imagen')} Elegir foto<input type="file" accept="image/png,image/webp,image/jpeg" hidden data-archivo></label>
            <button type="button" class="btn btn-fantasma" data-quitar ${imagen ? '' : 'hidden'}>Usar dibujo</button>
          </div>
        </div>
        ${mal ? html`<label class="interruptor"><input type="checkbox" name="activo" ${x.activo !== false ? 'checked' : ''}><span>Visible en el sitio</span></label>` : ''}
        <div class="acciones-form"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button>
          <button class="btn btn-primario">${mal ? 'Guardar cambios' : 'Agregar al menú'}</button></div>
      </form>`,
    });
    const f = $('form', m.el);
    const muestra = $('[data-muestra]', m.el);
    const bQuitar = $('[data-quitar]', m.el);
    const refrescar = () => {
      x.color = f.color.value;
      muestra.style.setProperty('--sabor', x.color);
      pintar(muestra, vistaVaso({ ...x, imagen }));
      bQuitar.hidden = !imagen;
    };
    $$('input[name=color_rapido]', m.el).forEach((r) => r.addEventListener('change', () => { f.color.value = r.value; refrescar(); }));
    f.color.addEventListener('input', () => { $$('input[name=color_rapido]', m.el).forEach((r) => { r.checked = r.value === f.color.value; }); refrescar(); });
    $('[data-archivo]', m.el).addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      try { imagen = await SG.comprimirImagen(archivo, { lado: 900, maxChars: 600 * 1024, alfa: true }); } catch (err) { aviso(err.message, 'error'); }
      refrescar();
    });
    bQuitar.addEventListener('click', () => { imagen = null; refrescar(); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado($('.btn-primario', f), async () => {
        const d = datosForm(f);
        delete d.color_rapido;
        d.imagen = imagen;
        if (mal) d.activo = !!f.activo.checked;
        if (mal) await SG.api.put(`/sitio/malteadas/${mal.id}`, d); else await SG.api.post('/sitio/malteadas', d);
        aviso(mal ? 'Malteada actualizada.' : 'Malteada agregada al menú.');
        m.cerrar(); alGuardar();
      });
    });
  }

  // ---------------------------------------------------------------------
  //  Vista principal del módulo
  // ---------------------------------------------------------------------
  SG.vistas.sitio = async (cont) => {
    const lectura = SG.soloLectura();
    let tab = sessionStorageGet('sg-sitio-tab') || 'malteadas';
    let filtro = '';
    const d = await SG.api.get('/sitio');
    const hoy = SG.hoyISO();
    const estadoPub = (p) => (!p.activo ? ['Oculta', 'neutro'] : p.tipo === 'promocion' && p.vigente_hasta && p.vigente_hasta < hoy ? ['Vencida', 'aviso'] : ['Visible', 'ok']);
    const recargar = () => SG.ir('sitio');

    function pintarTodo() {
      const s = d.sitio;
      const tx = s.textos || {};
      const TABS = [['malteadas', `Malteadas`, d.malteadas.length], ['publicaciones', 'Publicaciones', d.publicaciones.length], ['inicio', 'Página de inicio'], ['info', 'Información y contacto']];
      pintar(cont, html`
        <div class="barra-herramientas">
          <p class="ayuda crece">${lectura ? 'Contenido de la página pública. Los cambios los hace el administrador.' : 'Todo lo que cambies aquí se ve en la página de inicio (en la nube se actualiza en menos de un minuto).'}</p>
          <a class="btn btn-sec" href="/" target="_blank" rel="noopener">${icono('externo')} Ver sitio</a>
          ${lectura ? '' : tab === 'malteadas' ? html`<button class="btn btn-primario" data-nueva-mal>${icono('mas')} Nueva malteada</button>`
            : tab === 'publicaciones' ? html`<button class="btn btn-primario" data-nueva>${icono('mas')} Nueva publicación</button>` : ''}
        </div>
        <div class="pestanas" role="tablist">${TABS.map(([k, t, n]) => html`<button class="pestana ${tab === k ? 'activo' : ''}" data-tab="${k}" role="tab">${t}${n !== undefined ? html` <small>${n}</small>` : ''}</button>`)}</div>
        ${tab === 'malteadas' ? pintarMalteadas() : tab === 'publicaciones' ? pintarPublicaciones() : tab === 'inicio' ? html`
          <form class="tarjeta form form-2col form-sitio" data-form="textos" ${lectura ? html`inert` : ''}>
            <p class="ayuda col-completa">Textos grandes de la página de inicio. Escribe corto: se ven enormes.</p>
            <label class="interruptor col-completa"><input type="checkbox" name="intro" ${tx.intro !== false ? 'checked' : ''}><span>Mostrar la animación de entrada (una vez por visita)</span></label>
            <h3 class="col-completa sub-form">Portada</h3>
            <label class="campo"><span>Palabra gigante</span><input name="hero_titulo" maxlength="14" value="${tx.hero_titulo || ''}" placeholder="STRONG"><small>Máximo 14 letras.</small></label>
            <label class="campo"><span>Línea debajo</span><input name="hero_linea" maxlength="60" value="${tx.hero_linea || ''}" placeholder="Gym · Puruándiro"></label>
            <label class="campo col-completa"><span>Cinta en movimiento</span><input name="marquesina" maxlength="300" value="${tx.marquesina || ''}" placeholder="Fuerza, Proteína, Disciplina"><small>Palabras separadas por coma.</small></label>
            <label class="campo col-completa"><span>Frase que se ilumina al bajar</span><textarea name="manifiesto" rows="2" maxlength="300">${tx.manifiesto || ''}</textarea>
              <small>Encierra entre *asteriscos* las palabras que quieras en rojo. Ej. Levantamos a *Puruándiro*.</small></label>
            <h3 class="col-completa sub-form">Bloque rojo</h3>
            <label class="campo"><span>Título</span><input name="bloque_titulo" maxlength="40" value="${tx.bloque_titulo || ''}" placeholder="Entrena con todo."></label>
            <label class="campo"><span>Frase manuscrita</span><input name="bloque_script" maxlength="60" value="${tx.bloque_script || ''}" placeholder="sin excusas, solo resultados"></label>
            <label class="campo col-completa"><span>Etiquetas (stickers)</span><input name="etiquetas" maxlength="300" value="${tx.etiquetas || ''}"><small>Separadas por coma. Ej. Abrimos 6 AM, Pesas y cardio.</small></label>
            <h3 class="col-completa sub-form">Malteadas</h3>
            <label class="campo"><span>Título de la sección</span><input name="malteadas_titulo" maxlength="40" value="${tx.malteadas_titulo || ''}" placeholder="Barra de proteína"></label>
            <label class="campo"><span>Texto</span><input name="malteadas_texto" maxlength="200" value="${tx.malteadas_texto || ''}"></label>
            <h3 class="col-completa sub-form">Cierre</h3>
            <label class="campo"><span>Título</span><input name="cierre_titulo" maxlength="50" value="${tx.cierre_titulo || ''}" placeholder="La fuerza no es un hábito."></label>
            <label class="campo"><span>Frase manuscrita</span><input name="cierre_script" maxlength="60" value="${tx.cierre_script || ''}" placeholder="es un estilo de vida"></label>
            ${lectura ? '' : html`<div class="acciones-form col-completa"><button class="btn btn-primario">Guardar textos</button></div>`}
          </form>` : html`
          <form class="tarjeta form form-2col form-sitio" data-form="info" ${lectura ? html`inert` : ''}>
            <label class="campo col-completa"><span>Eslogan</span><input name="eslogan" maxlength="160" value="${s.eslogan || ''}"></label>
            <label class="campo col-completa"><span>Descripción</span><textarea name="descripcion" rows="3" maxlength="1000">${s.descripcion || ''}</textarea></label>
            <label class="campo col-completa"><span>Horario</span><textarea name="horario" rows="4" maxlength="600" placeholder="Lunes a viernes: 6:00 a 22:00">${s.horario || ''}</textarea>
              <small>Un renglón por día o grupo de días, con dos puntos antes de la hora.</small></label>
            <label class="campo"><span>Precio de la visita (un día)</span><input name="precio_visita" type="number" min="0" step="0.5" value="${s.precio_visita ?? 50}"></label>
            <label class="campo"><span>WhatsApp</span><input name="whatsapp" inputmode="tel" value="${s.whatsapp || ''}" placeholder="10 dígitos"></label>
            <label class="campo"><span>Teléfono</span><input name="telefono" inputmode="tel" value="${s.telefono || ''}"></label>
            <label class="campo"><span>Correo</span><input name="email" type="email" value="${s.email || ''}"></label>
            <label class="campo col-completa"><span>Dirección</span><input name="direccion" value="${s.direccion || ''}" placeholder="Calle, número, colonia"></label>
            <label class="campo col-completa"><span>Enlace de Google Maps</span><input name="maps_url" value="${s.maps_url || ''}" placeholder="https://maps.app.goo.gl/…">
              <small>En Google Maps busca el gimnasio → Compartir → Copiar enlace.</small></label>
            <label class="campo"><span>Facebook</span><input name="facebook" value="${s.facebook || ''}" placeholder="https://facebook.com/…"></label>
            <label class="campo"><span>Instagram</span><input name="instagram" value="${s.instagram || ''}" placeholder="https://instagram.com/…"></label>
            <label class="campo"><span>TikTok</span><input name="tiktok" value="${s.tiktok || ''}" placeholder="https://tiktok.com/@…"></label>
            <h3 class="col-completa sub-form">Reverso de la credencial</h3>
            <p class="ayuda col-completa">El reverso muestra el horario (primeros 3 renglones), el WhatsApp o teléfono, la dirección y este texto.</p>
            <label class="campo"><span>Página web <small>(opcional, como se imprime)</small></span><input name="sitio_web" maxlength="60" value="${s.sitio_web || ''}" placeholder="stronggym.mx"></label>
            <label class="campo"><span>Texto al pie</span><input name="credencial_texto" maxlength="140" value="${s.credencial_texto || ''}" placeholder="Credencial personal e intransferible."></label>
            ${lectura ? '' : html`<div class="acciones-form col-completa"><button class="btn btn-primario">Guardar información</button></div>`}
          </form>`}`);
      enlazar();
    }

    function pintarMalteadas() {
      if (!d.malteadas.length) return vacio('Aún no hay malteadas en el menú.', lectura ? '' : html`<button class="btn btn-primario" data-nueva-mal>${icono('mas')} Agregar la primera</button>`);
      return html`<p class="conteo">${d.malteadas.filter((x) => x.activo).length} visibles en el sitio · aparecen en este orden</p>
        <div class="malteadas-admin">${d.malteadas.map((x) => html`
          <article class="mal-tarjeta ${x.activo ? '' : 'inactivo'}" style="--sabor:${x.color}">
            <div class="mal-vaso">${vistaVaso(x)}</div>
            <div class="mal-cuerpo">
              <p class="pub-meta">${x.activo ? html`<span class="chip chip-ok">Visible</span>` : html`<span class="chip chip-neutro">Oculta</span>`}${x.etiqueta ? html`<span class="chip chip-aviso">${x.etiqueta}</span>` : ''}</p>
              <h3>${x.nombre}</h3>
              <p class="mal-precio">${dinero(x.precio)}${x.proteina_g ? html` <small>· ${x.proteina_g} g proteína</small>` : ''}</p>
              ${x.descripcion ? html`<p class="pub-texto">${x.descripcion}</p>` : ''}
            </div>
            ${lectura ? '' : html`<div class="pub-acciones">
              <button class="btn btn-chico btn-sec" data-editar-mal="${x.id}">${icono('editar')} Editar</button>
              <button class="btn btn-chico btn-fantasma" data-alternar-mal="${x.id}">${x.activo ? 'Ocultar' : 'Mostrar'}</button></div>`}
          </article>`)}</div>`;
    }

    function pintarPublicaciones() {
      const lista = d.publicaciones.filter((p) => !filtro || p.tipo === filtro);
      return html`
        <div class="filtros filtros-sitio" role="group" aria-label="Filtrar">
          ${[['', 'Todas'], ['promocion', 'Promociones'], ['novedad', 'Novedades'], ['galeria', 'Galería']].map(([v, t]) =>
            html`<button class="filtro ${v === filtro ? 'activo' : ''}" data-filtro="${v}">${t}</button>`)}
        </div>
        ${lista.length ? html`<div class="pubs">${lista.map((p) => {
          const [et, cls] = estadoPub(p);
          return html`<article class="pub ${p.activo ? '' : 'inactivo'}">
            <div class="pub-img">${p.imagen ? html`<img src="${p.imagen}" alt="" loading="lazy">` : html`<span>${TIPOS[p.tipo]}</span>`}</div>
            <div class="pub-cuerpo">
              <p class="pub-meta"><span>${TIPOS[p.tipo]}</span><span class="chip chip-${cls}">${et}</span>${p.destacada ? html`<span class="chip chip-no">Destacada</span>` : ''}</p>
              <h3>${p.titulo}</h3>
              ${p.texto ? html`<p class="pub-texto">${p.texto}</p>` : ''}
              <small>${p.vigente_hasta ? `Hasta el ${fecha(p.vigente_hasta)} · ` : ''}${p.autor ? `Publicó ${p.autor}` : ''}</small>
            </div>
            ${lectura ? '' : html`<div class="pub-acciones">
              <button class="btn btn-chico btn-sec" data-editar-pub="${p.id}">${icono('editar')} Editar</button>
              <button class="btn btn-chico btn-fantasma" data-alternar="${p.id}">${p.activo ? 'Ocultar' : 'Mostrar'}</button></div>`}
          </article>`;
        })}</div>` : vacio(filtro ? 'No hay publicaciones de este tipo.' : 'Aún no hay publicaciones. Empieza con una promoción.')}`;
    }

    function enlazar() {
      $$('[data-tab]', cont).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; sessionStorageSet('sg-sitio-tab', tab); pintarTodo(); }));
      $$('[data-filtro]', cont).forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.filtro; pintarTodo(); }));
      if (lectura) return;
      $$('[data-nueva]', cont).forEach((b) => b.addEventListener('click', () => formPublicacion(null, recargar)));
      $$('[data-nueva-mal]', cont).forEach((b) => b.addEventListener('click', () => formMalteada(null, recargar)));
      $$('[data-editar-pub]', cont).forEach((b) => b.addEventListener('click', () =>
        formPublicacion(d.publicaciones.find((p) => p.id === b.dataset.editarPub), recargar)));
      $$('[data-alternar]', cont).forEach((b) => b.addEventListener('click', () => ocupado(b, async () => {
        const p = d.publicaciones.find((x) => x.id === b.dataset.alternar);
        await SG.api.put(`/sitio/publicaciones/${p.id}`, { ...p, activo: !p.activo });
        aviso(p.activo ? 'Publicación oculta del sitio.' : 'Publicación visible en el sitio.');
        recargar();
      })));
      $$('[data-editar-mal]', cont).forEach((b) => b.addEventListener('click', () =>
        formMalteada(d.malteadas.find((x) => x.id === b.dataset.editarMal), recargar)));
      $$('[data-alternar-mal]', cont).forEach((b) => b.addEventListener('click', () => ocupado(b, async () => {
        const x = d.malteadas.find((y) => y.id === b.dataset.alternarMal);
        await SG.api.put(`/sitio/malteadas/${x.id}`, { ...x, activo: !x.activo });
        aviso(x.activo ? 'Malteada oculta del sitio.' : 'Malteada visible en el sitio.');
        recargar();
      })));
      const fInfo = $('[data-form="info"]', cont);
      if (fInfo) fInfo.addEventListener('submit', (e) => {
        e.preventDefault();
        ocupado($('.btn-primario', fInfo), async () => {
          d.sitio = await SG.api.put('/sitio', datosForm(fInfo));
          if (SG.limpiarDatosGym) SG.limpiarDatosGym();
          aviso('Información del sitio guardada.');
        });
      });
      const fTx = $('[data-form="textos"]', cont);
      if (fTx) fTx.addEventListener('submit', (e) => {
        e.preventDefault();
        ocupado($('.btn-primario', fTx), async () => {
          const textos = datosForm(fTx);
          textos.intro = !!fTx.intro.checked;
          d.sitio = await SG.api.put('/sitio', { textos });
          aviso('Textos de la página guardados.');
        });
      });
    }
    pintarTodo();
  };

  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* nada */ } }
})(window.SG);
