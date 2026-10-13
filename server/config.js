/* =====================================================================
   Configuración: se lee de variables de entorno o del archivo .env
   (en la carpeta del proyecto). Ver .env.example.
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

// Carga .env sencillo (CLAVE=valor), sin dependencias
const archivoEnv = path.join(RAIZ, '.env');
if (fs.existsSync(archivoEnv)) {
  for (const linea of fs.readFileSync(archivoEnv, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || linea.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const env = process.env;
const MODO = (env.MODO || 'local').toLowerCase() === 'nube' ? 'nube' : 'local';
const DATA_DIR = path.resolve(RAIZ, env.DATA_DIR || 'datos');

module.exports = {
  RAIZ,
  PUBLICO: path.join(RAIZ, 'public'),
  MODO, // 'local' = computadora de recepción · 'nube' = servidor en internet
  PUERTO: Number(env.PORT || env.PUERTO || 3000),
  HOST: env.HOST || (MODO === 'local' ? '0.0.0.0' : '0.0.0.0'),
  DATA_DIR,
  DB_ARCHIVO: path.join(DATA_DIR, env.DB_NOMBRE || 'strong-gym.db'),
  // Sincronización (solo la copia local la inicia)
  NUBE_URL: (env.NUBE_URL || '').replace(/\/+$/, ''),
  SYNC_TOKEN: env.SYNC_TOKEN || '',
  SYNC_INTERVALO_SEG: Math.max(15, Number(env.SYNC_INTERVALO_SEG || 60)),
  // Contraseñas iniciales (solo se usan la primera vez que arranca)
  ADMIN_PASSWORD_INICIAL: env.ADMIN_PASSWORD_INICIAL || (env.SEMBRAR_DEMO === '1' ? 'admin1234' : ''),
  DUENO_PASSWORD_INICIAL: env.DUENO_PASSWORD_INICIAL || (env.SEMBRAR_DEMO === '1' ? 'dueno1234' : ''),
  // Cookies seguras cuando corre detrás de HTTPS (la nube)
  COOKIE_SEGURA: env.COOKIE_SEGURA ? env.COOKIE_SEGURA === '1' : MODO === 'nube',
  RESPALDOS_DIAS: Number(env.RESPALDOS_DIAS || 14),
  SEMBRAR_DEMO: env.SEMBRAR_DEMO === '1',
  ZONA: 'America/Mexico_City',
  // México no usa horario de verano desde 2022: el desfase es fijo
  DESFASE: env.DESFASE_HORARIO || '-06:00',
};
