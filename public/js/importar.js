/* =====================================================================
   Importar socios desde un archivo CSV (Excel → "Guardar como" → CSV).
   Sirve para migrar los clientes del sistema anterior.
   1) Lee el archivo  2) el servidor revisa sin guardar  3) se confirma.
   ===================================================================== */
(function (SG) {
  const { html, pintar, $, icono, modal, ocupado, aviso, fecha } = SG;

  // Nombres de columna que se aceptan (sin acentos ni mayúsculas)
  const SINONIMOS = {
    codigo: ['codigo', 'no_socio', 'num_socio', 'numero_socio', 'numero', 'num', 'id_socio', 'folio', 'clave', 'matricula'],
    nombre: ['nombre', 'nombres', 'nombre_s', 'nombre_completo'],
    apellidos: ['apellidos', 'apellido', 'apellido_paterno', 'paterno'],
    apellido2: ['apellido_materno', 'materno'],
    telefono: ['telefono', 'tel', 'celular', 'cel', 'movil', 'whatsapp', 'telefono_celular'],
    email: ['email', 'correo', 'correo_electronico', 'e_mail', 'mail'],
    fecha_nacimiento: ['fecha_nacimiento', 'nacimiento', 'cumpleanos', 'fecha_de_nacimiento'],
    plan: ['plan', 'membresia', 'tipo', 'tipo_membresia', 'paquete'],
    fecha_inicio: ['fecha_inicio', 'inicio', 'desde', 'fecha_de_inicio', 'ultimo_pago', 'fecha_pago'],
    fecha_fin: ['fecha_fin', 'vence', 'vencimiento', 'fecha_vencimiento', 'hasta', 'fecha_de_vencimiento', 'fin'],
    precio: ['precio', 'monto', 'importe', 'pago', 'costo'],
    alta: ['alta', 'fecha_alta', 'registro', 'fecha_registro', 'inscripcion', 'fecha_inscripcion'],
    notas: ['notas', 'nota', 'observaciones', 'comentarios'],
  };
  const clave = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  /** Lee el archivo como texto: UTF-8 y, si trae acentos rotos, como Windows-1252 (Excel en español). */
  function leerTexto(archivo) {
    return archivo.arrayBuffer().then((buf) => {
      try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (e) { return new TextDecoder('windows-1252').decode(buf); }
    });
  }

  /** Separa un CSV respetando comillas. Detecta si usa coma, punto y coma o tabulador. */
  function parsearCSV(texto) {
    texto = texto.replace(/^﻿/, '');
    const primera = texto.split(/\r?\n/)[0] || '';
    const sep = [';', '\t', ','].map((s) => [s, primera.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
    const filas = [];
    let fila = [], campo = '', comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (comillas) {
        if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
        else campo += ch;
      } else if (ch === '"') comillas = true;
      else if (ch === sep) { fila.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); campo = '';
        if (fila.some((c) => c.trim() !== '')) filas.push(fila);
        fila = [];
      } else campo += ch;
    }
    fila.push(campo);
    if (fila.some((c) => c.trim() !== '')) filas.push(fila);
    return filas;
  }

  function aObjetos(tabla) {
    const [titulos, ...resto] = tabla;
    const mapa = titulos.map((t) => {
      const k = clave(t);
      return Object.keys(SINONIMOS).find((campo) => SINONIMOS[campo].includes(k)) || null;
    });
    if (!mapa.includes('nombre')) throw new Error('No encontré la columna "nombre". Revisa que la primera fila tenga los títulos (usa la plantilla).');
    const reconocidas = [...new Set(mapa.filter(Boolean))];
    const ignoradas = titulos.filter((t, i) => !mapa[i] && t.trim());
    const filas = resto.map((r) => {
      const o = {};
      mapa.forEach((campo, i) => { if (campo && r[i] !== undefined && String(r[i]).trim() !== '') o[campo] = String(r[i]).trim(); });
      if (o.apellido2) { o.apellidos = [o.apellidos, o.apellido2].filter(Boolean).join(' '); delete o.apellido2; }
      // Si solo viene "nombre completo", se separa: primera palabra = nombre
      if (o.nombre && !o.apellidos && mapa.includes('nombre') && clave(titulos[mapa.indexOf('nombre')]) === 'nombre_completo') {
        const partes = o.nombre.split(/\s+/);
        if (partes.length > 2) { o.nombre = partes.slice(0, partes.length - 2).join(' '); o.apellidos = partes.slice(-2).join(' '); }
        else if (partes.length === 2) { o.nombre = partes[0]; o.apellidos = partes[1]; }
      }
      return o;
    });
    return { filas, reconocidas, ignoradas };
  }

  SG.importarClientes = (alTerminar) => {
    let datos = null;
    const m = modal({
      titulo: 'Importar socios',
      ancho: 'ancho',
      cuerpo: html`
        <div class="importar">
          <ol class="pasos-importar">
            <li>Descarga la <a class="enlace" href="/plantillas/clientes-plantilla.csv" download>plantilla de ejemplo</a> o usa la lista que ya tengas en Excel.</li>
            <li>En Excel: <strong>Archivo → Guardar como → CSV UTF-8</strong>.</li>
            <li>Elige el archivo aquí. Antes de guardar verás qué se va a importar.</li>
          </ol>
          <label class="soltar-archivo" data-zona>
            ${icono('descargar', 'girar-180')}
            <strong>Elegir archivo CSV</strong>
            <small>Solo la columna "nombre" es obligatoria. Si trae "vence", se crea su membresía.</small>
            <input type="file" accept=".csv,text/csv,text/plain" hidden data-archivo>
          </label>
          <div data-resultado></div>
        </div>`,
    });
    const res = $('[data-resultado]', m.el);

    async function revisar(archivo) {
      pintar(res, SG.cargando());
      try {
        const tabla = parsearCSV(await leerTexto(archivo));
        if (tabla.length < 2) throw new Error('El archivo no tiene filas debajo de los títulos.');
        datos = aObjetos(tabla);
        const r = await SG.api.post('/clientes/importar', { filas: datos.filas, confirmar: false });
        mostrar(r, archivo.name);
      } catch (e) {
        datos = null;
        pintar(res, html`<p class="aviso-importar error">${icono('alerta')} ${e.message}</p>`);
      }
    }

    function mostrar(r, nombreArchivo) {
      const problemas = [...r.errores.map((x) => ({ ...x, tipo: 'error' })), ...r.omitidos.map((x) => ({ ...x, tipo: 'omitido' }))].sort((a, b) => a.fila - b.fila);
      pintar(res, html`
        <p class="ayuda">Archivo: <strong>${nombreArchivo}</strong> · ${r.total} filas · columnas reconocidas: ${datos.reconocidas.join(', ')}
          ${datos.ignoradas.length ? html` · <span class="texto-error">ignoradas: ${datos.ignoradas.join(', ')}</span>` : ''}</p>
        <section class="kpis kpis-chicos importar-kpis">
          <article class="kpi"><p class="kpi-etq">Se van a importar</p><p class="kpi-num">${r.nuevos}</p></article>
          <article class="kpi"><p class="kpi-etq">Con membresía</p><p class="kpi-num">${r.con_membresia}</p><p class="kpi-nota">${r.vigentes} vigentes hoy</p></article>
          <article class="kpi"><p class="kpi-etq">Ya existían</p><p class="kpi-num">${r.omitidos.length}</p><p class="kpi-nota">se saltan</p></article>
          <article class="kpi"><p class="kpi-etq">Con error</p><p class="kpi-num ${r.errores.length ? 'num-neg' : ''}">${r.errores.length}</p></article>
        </section>
        ${r.codigos_conservados ? html`<p class="ayuda">${r.codigos_conservados} socios conservan su número anterior (6 dígitos). Los demás reciben uno nuevo y el anterior queda en sus notas.</p>` : ''}
        ${r.planes_sin_coincidencia.length ? html`<p class="aviso-importar">${icono('alerta')} Estos planes no existen en Membresías y se guardan tal cual: <strong>${r.planes_sin_coincidencia.join(', ')}</strong>. Al renovar, recepción elige un plan actual.</p>` : ''}
        ${r.muestra.length ? html`<h3 class="subtitulo">Así quedarán (primeros ${r.muestra.length})</h3>
          <table class="tabla"><thead><tr><th>Socio</th><th>Teléfono</th><th>Plan</th><th>Vence</th></tr></thead>
          <tbody>${r.muestra.map((x) => html`<tr><td class="td-principal"><span><strong>${x.nombre}</strong><small>#${x.codigo}</small></span></td>
            <td data-label="Teléfono">${x.telefono || '—'}</td><td data-label="Plan">${x.plan || '—'}</td><td data-label="Vence">${x.vence ? fecha(x.vence) : '—'}</td></tr>`)}</tbody></table>` : ''}
        ${problemas.length ? html`<h3 class="subtitulo">Filas que no se importan (${problemas.length})</h3>
          <ul class="lista-simple compacta problemas">${problemas.slice(0, 60).map((x) => html`<li><span>Fila ${x.fila}${x.nombre ? ` · ${x.nombre}` : ''}<small>${x.motivo}</small></span>
            <span class="chip ${x.tipo === 'error' ? 'chip-no' : 'chip-neutro'}">${x.tipo === 'error' ? 'Error' : 'Ya existe'}</span></li>`)}</ul>
          ${problemas.length > 60 ? html`<p class="ayuda">…y ${problemas.length - 60} más.</p>` : ''}` : ''}
        <div class="acciones-form">
          <button class="btn btn-sec" data-otro>Elegir otro archivo</button>
          <button class="btn btn-primario" data-confirmar ${r.nuevos ? '' : 'disabled'}>Importar ${r.nuevos} ${r.nuevos === 1 ? 'socio' : 'socios'}</button>
        </div>`);
      $('[data-otro]', res).addEventListener('click', () => $('[data-archivo]', m.el).click());
      $('[data-confirmar]', res).addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
        const fin = await SG.api.post('/clientes/importar', { filas: datos.filas, confirmar: true });
        aviso(`Listo: ${fin.nuevos} socios importados.`);
        m.cerrar();
        if (alTerminar) alTerminar();
      }));
    }

    const input = $('[data-archivo]', m.el);
    input.addEventListener('change', () => { if (input.files[0]) revisar(input.files[0]); input.value = ''; });
    const zona = $('[data-zona]', m.el);
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('encima'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
    zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('encima'); if (e.dataTransfer.files[0]) revisar(e.dataTransfer.files[0]); });
  };

  SG.parsearCSV = parsearCSV; // usado en pruebas
})(window.SG);
