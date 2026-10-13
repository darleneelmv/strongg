/* Respaldo automático diario de la base de datos (carpeta datos/respaldos) */
const fs = require('node:fs');
const path = require('node:path');
const cfg = require('./config');
const { db } = require('./db');
const { hoy } = require('./util');

const CARPETA = path.join(cfg.DATA_DIR, 'respaldos');

function respaldar() {
  try {
    fs.mkdirSync(CARPETA, { recursive: true });
    const destino = path.join(CARPETA, `strong-gym-${hoy()}.db`);
    if (fs.existsSync(destino)) return;
    db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
    // Conserva solo los últimos N días
    const archivos = fs.readdirSync(CARPETA).filter((f) => /^strong-gym-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    archivos.slice(0, Math.max(0, archivos.length - cfg.RESPALDOS_DIAS)).forEach((f) => fs.unlinkSync(path.join(CARPETA, f)));
    console.log(`Respaldo guardado: ${destino}`);
  } catch (e) {
    console.error('No se pudo hacer el respaldo:', e.message);
  }
}

function iniciarRespaldos() {
  setTimeout(respaldar, 20000).unref();
  setInterval(respaldar, 3600e3).unref(); // revisa cada hora; respalda una vez al día
}

/** Copia completa y consistente de la base (para descargarla desde el sistema). */
function copiaParaDescargar() {
  fs.mkdirSync(CARPETA, { recursive: true });
  const tmp = path.join(CARPETA, `descarga-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  try { return fs.readFileSync(tmp); } finally { fs.rmSync(tmp, { force: true }); }
}

module.exports = { respaldar, iniciarRespaldos, copiaParaDescargar };
