/* Cliente de la API: llama al servidor (/api/...) y convierte los errores en mensajes. */
(function (SG) {
  async function api(metodo, ruta, cuerpo) {
    let r;
    try {
      r = await fetch(`/api${ruta}`, {
        method: metodo,
        headers: cuerpo ? { 'content-type': 'application/json' } : {},
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        credentials: 'same-origin',
      });
    } catch (e) {
      throw new Error('No hay conexión con el servidor. Revisa que el sistema esté encendido o tu internet.');
    }
    const datos = await r.json().catch(() => ({}));
    if (r.status === 401 && ruta !== '/auth/login' && ruta !== '/auth/me') {
      SG.alExpirar && SG.alExpirar();
    }
    if (!r.ok) {
      const err = new Error(datos.error || `Error ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return datos;
  }
  SG.api = {
    get: (ruta) => api('GET', ruta),
    post: (ruta, cuerpo = {}) => api('POST', ruta, cuerpo),
    put: (ruta, cuerpo = {}) => api('PUT', ruta, cuerpo),
    del: (ruta) => api('DELETE', ruta),
  };
})(window.SG);
