/* =====================================================================
   Generador de códigos QR sin dependencias (funciona sin internet).
   Modo byte (UTF-8), corrección de errores nivel M, versiones 1 a 10
   (hasta ~210 caracteres; sobra para un código de socio).
   Basado en el algoritmo del estándar ISO/IEC 18004, siguiendo la
   implementación de referencia de Project Nayuki (licencia MIT).

   Uso:  SG.qrSVG('482913', { color: '#0B2A5C' })  -> texto <svg>
         SG.qrMatriz('482913')                      -> arreglo de filas booleanas
   ===================================================================== */
(function (raiz) {
  // Por versión (índice 1..10), nivel M
  const ECC_POR_BLOQUE = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const NUM_BLOQUES = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const FORMATO_M = 0; // bits de formato del nivel M

  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  function modulosDatos(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  const codewordsDatos = (ver) => Math.floor(modulosDatos(ver) / 8) - ECC_POR_BLOQUE[ver] * NUM_BLOQUES[ver];

  // ---------- Reed-Solomon sobre GF(256) ----------
  function mul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function divisor(grado) {
    const r = new Array(grado).fill(0);
    r[grado - 1] = 1;
    let raizG = 1;
    for (let i = 0; i < grado; i++) {
      for (let j = 0; j < r.length; j++) {
        r[j] = mul(r[j], raizG);
        if (j + 1 < r.length) r[j] ^= r[j + 1];
      }
      raizG = mul(raizG, 0x02);
    }
    return r;
  }
  function residuo(datos, div) {
    const r = div.map(() => 0);
    for (const b of datos) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => { r[i] ^= mul(c, f); });
    }
    return r;
  }

  function utf8(texto) {
    const s = unescape(encodeURIComponent(texto));
    return Array.from(s, (c) => c.charCodeAt(0));
  }

  function qrMatriz(texto) {
    const bytes = utf8(String(texto));
    // 1) Versión mínima que alcance
    let ver = 1;
    for (; ver <= 10; ver++) {
      const ccBits = ver < 10 ? 8 : 16;
      if (4 + ccBits + bytes.length * 8 <= codewordsDatos(ver) * 8) break;
    }
    if (ver > 10) throw new Error('Texto demasiado largo para el QR');
    const tam = ver * 4 + 17;

    // 2) Flujo de bits: modo byte, longitud, datos, terminador y relleno
    const bits = [];
    const poner = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    poner(0b0100, 4);
    poner(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach((b) => poner(b, 8));
    const capacidad = codewordsDatos(ver) * 8;
    poner(0, Math.min(4, capacidad - bits.length));
    poner(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacidad; pad ^= 0xec ^ 0x11) poner(pad, 8);
    const datos = [];
    for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(''), 2));

    // 3) Bloques con corrección de errores, intercalados
    const nBloques = NUM_BLOQUES[ver];
    const eccLen = ECC_POR_BLOQUE[ver];
    const totalCw = Math.floor(modulosDatos(ver) / 8);
    const nCortos = nBloques - (totalCw % nBloques);
    const largoCorto = Math.floor(totalCw / nBloques);
    const div = divisor(eccLen);
    const bloques = [];
    for (let i = 0, k = 0; i < nBloques; i++) {
      const dat = datos.slice(k, k + largoCorto - eccLen + (i < nCortos ? 0 : 1));
      k += dat.length;
      const ecc = residuo(dat, div);
      if (i < nCortos) dat.push(0);
      bloques.push(dat.concat(ecc));
    }
    const final = [];
    for (let i = 0; i < bloques[0].length; i++) {
      bloques.forEach((b, j) => { if (i !== largoCorto - eccLen || j >= nCortos) final.push(b[i]); });
    }

    // 4) Patrones fijos
    const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const fijo = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const fija = (x, y, v) => { m[y][x] = v; fijo[y][x] = true; };

    for (let i = 0; i < tam; i++) { fija(6, i, i % 2 === 0); fija(i, 6, i % 2 === 0); }
    const buscador = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)); const x = cx + dx; const y = cy + dy;
        if (x >= 0 && x < tam && y >= 0 && y < tam) fija(x, y, d !== 2 && d !== 4);
      }
    };
    buscador(3, 3); buscador(tam - 4, 3); buscador(3, tam - 4);

    if (ver > 1) {
      const n = Math.floor(ver / 7) + 2;
      const paso = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      const pos = [6];
      for (let p = tam - 7; pos.length < n; p -= paso) pos.splice(1, 0, p);
      pos.forEach((y, i) => pos.forEach((x, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fija(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));
    }

    const formato = (mascara) => {
      const d = (FORMATO_M << 3) | mascara;
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) fija(8, i, bit(b, i));
      fija(8, 7, bit(b, 6)); fija(8, 8, bit(b, 7)); fija(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) fija(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) fija(tam - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) fija(8, tam - 15 + i, bit(b, i));
      fija(8, tam - 8, true);
    };
    formato(0); // reserva el área

    if (ver >= 7) {
      let r = ver;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) {
        const v = bit(b, i); const a = tam - 11 + (i % 3); const c = Math.floor(i / 3);
        fija(a, c, v); fija(c, a, v);
      }
    }

    // 5) Datos en zigzag
    let i = 0;
    for (let der = tam - 1; der >= 1; der -= 2) {
      if (der === 6) der = 5;
      for (let v = 0; v < tam; v++) {
        for (let j = 0; j < 2; j++) {
          const x = der - j;
          const arriba = ((der + 1) & 2) === 0;
          const y = arriba ? tam - 1 - v : v;
          if (!fijo[y][x] && i < final.length * 8) { m[y][x] = bit(final[i >>> 3], 7 - (i & 7)); i++; }
        }
      }
    }

    // 6) Máscara con menor penalización
    const MASCARAS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const aplicar = (k) => {
      for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fijo[y][x] && MASCARAS[k](x, y)) m[y][x] = !m[y][x];
    };
    const penalizacion = () => {
      let p = 0, oscuros = 0;
      for (let a = 0; a < tam; a++) {
        let rf = 1, rc = 1;
        for (let b = 1; b < tam; b++) {
          if (m[a][b] === m[a][b - 1]) { rf++; if (rf === 5) p += 3; else if (rf > 5) p++; } else rf = 1;
          if (m[b][a] === m[b - 1][a]) { rc++; if (rc === 5) p += 3; else if (rc > 5) p++; } else rc = 1;
        }
      }
      for (let y = 0; y < tam - 1; y++) for (let x = 0; x < tam - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
      }
      m.forEach((f) => f.forEach((c) => { if (c) oscuros++; }));
      p += Math.floor(Math.abs(oscuros * 20 - tam * tam * 10) / (tam * tam)) * 10;
      return p;
    };
    let mejor = 0, menor = Infinity;
    for (let k = 0; k < 8; k++) {
      aplicar(k); formato(k);
      const p = penalizacion();
      if (p < menor) { menor = p; mejor = k; }
      aplicar(k);
    }
    aplicar(mejor); formato(mejor);
    return m;
  }

  function qrSVG(texto, { color = '#000', fondo = '#fff', margen = 4 } = {}) {
    const m = qrMatriz(texto);
    const n = m.length + margen * 2;
    let d = '';
    m.forEach((fila, y) => fila.forEach((c, x) => { if (c) d += `M${x + margen} ${y + margen}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="Código QR ${String(texto).replace(/[<>&"]/g, '')}">`
      + `<rect width="${n}" height="${n}" fill="${fondo}"/><path d="${d}" fill="${color}"/></svg>`;
  }

  const SG = (raiz.SG = raiz.SG || {});
  SG.qrMatriz = qrMatriz;
  SG.qrSVG = qrSVG;
  if (typeof module !== 'undefined') module.exports = { qrMatriz, qrSVG };
})(typeof window !== 'undefined' ? window : globalThis);
