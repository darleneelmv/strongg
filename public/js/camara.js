/* =====================================================================
   Cámara: escanear credenciales QR y tomar la foto del socio.
   - Lector QR: usa el detector del navegador si existe (Chrome en
     Android/Mac) y si no, jsQR (se descarga la primera vez).
   - La cámara solo funciona en http://localhost o con HTTPS.
   ===================================================================== */
(function (SG) {
  const { html, pintar, $, icono, modal, aviso } = SG;
  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';

  let cargaJsQR = null;
  function cargarJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (!cargaJsQR) {
      cargaJsQR = new Promise((ok, mal) => {
        const s = document.createElement('script');
        s.src = JSQR_URL;
        s.onload = () => (window.jsQR ? ok(window.jsQR) : mal(new Error('No se pudo cargar el lector.')));
        s.onerror = () => { cargaJsQR = null; mal(new Error('Para leer QR con esta cámara se necesita internet la primera vez. Usa el lector USB o escribe el código.')); };
        document.head.appendChild(s);
      });
    }
    return cargaJsQR;
  }

  async function detectorNativo() {
    try {
      if (!('BarcodeDetector' in window)) return null;
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      return formatos.includes('qr_code') ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    } catch (e) { return null; }
  }

  function mensajeError(e) {
    if (!window.isSecureContext) return 'La cámara solo funciona abriendo el sistema en http://localhost o con https.';
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) return 'Diste "Bloquear" a la cámara. Permítela desde el candado junto a la dirección.';
    if (e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError')) return 'No se encontró ninguna cámara conectada.';
    if (e && e.name === 'NotReadableError') return 'La cámara la está usando otro programa. Ciérralo e intenta de nuevo.';
    return (e && e.message) || 'No se pudo abrir la cámara.';
  }

  async function abrirCamara(video, preferir = 'environment') {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Este navegador no permite usar la cámara.');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: preferir }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    video.muted = true;
    await video.play();
    return stream;
  }
  const apagar = (stream) => { if (stream) stream.getTracks().forEach((t) => t.stop()); };

  // ---------------------------------------------------------------------
  //  Escanear QR
  // ---------------------------------------------------------------------
  SG.escanearQR = function escanearQR(alLeer) {
    let stream = null;
    let activo = true;
    const m = modal({
      titulo: 'Escanear credencial',
      ancho: 'ancho',
      cuerpo: html`
        <div class="camara">
          <video class="camara-video" muted playsinline></video>
          <div class="camara-guia" aria-hidden="true"><span></span></div>
          <p class="camara-estado" role="status">Abriendo cámara…</p>
        </div>
        <p class="ayuda">Acerca la credencial a unos 15 cm, sin reflejos. Al leerla se registra la entrada sola.</p>
        <div class="acciones-form"><button class="btn btn-sec" data-cerrar>Cerrar</button></div>`,
      alCerrar: () => { activo = false; apagar(stream); },
    });
    const video = $('video', m.el);
    const estado = $('.camara-estado', m.el);
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });

    (async () => {
      try {
        stream = await abrirCamara(video, 'environment');
        if (!activo) return apagar(stream);
        const nativo = await detectorNativo();
        const jsQR = nativo ? null : await cargarJsQR();
        estado.textContent = 'Buscando código QR…';
        let ultimo = 0;
        const paso = async (t) => {
          if (!activo) return;
          if (t - ultimo > 110 && video.readyState >= 2) {
            ultimo = t;
            let texto = null;
            if (nativo) {
              try { const r = await nativo.detect(video); if (r[0]) texto = r[0].rawValue; } catch (e) { /* sigue */ }
            } else {
              const w = 640, h = Math.round((video.videoHeight / video.videoWidth) * 640) || 480;
              lienzo.width = w; lienzo.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
              if (r && r.data) texto = r.data;
            }
            if (texto) {
              activo = false;
              m.el.querySelector('.camara').classList.add('leido');
              setTimeout(() => { m.cerrar(); alLeer(String(texto).trim()); }, 180);
              return;
            }
          }
          requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      } catch (e) {
        estado.textContent = mensajeError(e);
        m.el.querySelector('.camara').classList.add('error');
      }
    })();
    return m;
  };

  // ---------------------------------------------------------------------
  //  Tomar foto (para la ficha y la credencial del socio)
  // ---------------------------------------------------------------------
  SG.tomarFoto = function tomarFoto() {
    return new Promise((ok) => {
      let stream = null;
      let resultado = null;
      const m = modal({
        titulo: 'Foto del socio',
        cuerpo: html`
          <div class="camara camara-foto">
            <video class="camara-video espejo" muted playsinline></video>
            <div class="camara-marco" aria-hidden="true"></div>
            <p class="camara-estado" role="status">Abriendo cámara…</p>
          </div>
          <p class="ayuda">De frente, con buena luz y sin gorra. Se recorta cuadrada.</p>
          <div class="acciones-form">
            <label class="btn btn-sec">${icono('imagen')} Elegir archivo<input type="file" accept="image/*" capture="user" hidden data-archivo></label>
            <button class="btn btn-primario" data-disparar disabled>${icono('camara')} Tomar foto</button>
          </div>`,
        alCerrar: () => { apagar(stream); ok(resultado); },
      });
      const video = $('video', m.el);
      const estado = $('.camara-estado', m.el);
      const disparar = $('[data-disparar]', m.el);
      abrirCamara(video, 'user').then((s) => {
        stream = s;
        estado.textContent = '';
        disparar.disabled = false;
      }).catch((e) => {
        estado.textContent = `${mensajeError(e)} Puedes elegir un archivo.`;
        m.el.querySelector('.camara').classList.add('error');
      });
      disparar.addEventListener('click', () => {
        resultado = SG.reducirImagen(video, { lado: 480, maxChars: 120 * 1024, cuadrada: true });
        m.cerrar();
      });
      $('[data-archivo]', m.el).addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try { resultado = await SG.comprimirImagen(f, { lado: 480, maxChars: 120 * 1024, cuadrada: true }); m.cerrar(); }
        catch (err) { aviso(err.message, 'error'); }
      });
    });
  };
})(window.SG);
