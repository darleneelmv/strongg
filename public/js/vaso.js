/* =====================================================================
   Ilustración de malteada (SVG) en el color de cada sabor.
   Se usa cuando la malteada no tiene foto propia.
   Uso: SG.vasoSVG('#5A3220', { id: 'choco' })  -> texto <svg>
   ===================================================================== */
(function (raiz) {
  const SG = (raiz.SG = raiz.SG || {});

  function mezclar(hex, otro, t) {
    const a = hex.match(/\w\w/g).map((x) => parseInt(x, 16));
    const b = otro.match(/\w\w/g).map((x) => parseInt(x, 16));
    return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
  }
  SG.mezclarColor = mezclar;

  SG.vasoSVG = function vasoSVG(color = '#D3121F', { id = 'v', etiqueta = 'STRONG' } = {}) {
    const c = /^#[0-9a-f]{6}$/i.test(color) ? color : '#D3121F';
    const claro = mezclar(c, '#ffffff', 0.35);
    const oscuro = mezclar(c, '#000000', 0.35);
    const crema = mezclar(c, '#ffffff', 0.86);
    const k = String(id).replace(/[^a-z0-9]/gi, '');
    // Motas de ingredientes dentro del vaso (posiciones fijas = siempre igual)
    const motas = [[78, 170, 3], [118, 186, 2.4], [96, 214, 2.8], [132, 228, 2], [70, 240, 2.2], [110, 258, 3], [88, 196, 1.8], [126, 160, 2]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${oscuro}" opacity=".45"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320" class="vaso-svg" role="img" aria-label="Malteada">
  <defs>
    <linearGradient id="liq${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${claro}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient>
    <linearGradient id="bri${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".18" stop-color="#fff" stop-opacity=".55"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".86" stop-color="#fff" stop-opacity="0"/><stop offset=".93" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="tapa${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></linearGradient>
    <clipPath id="cuerpo${k}"><path d="M30 118 L170 118 L152 304 Q151 312 143 312 L57 312 Q49 312 48 304 Z"/></clipPath>
  </defs>
  <!-- popote -->
  <rect x="112" y="-6" width="13" height="120" rx="5" fill="#D3121F" transform="rotate(14 118 60)"/>
  <rect x="115" y="-6" width="3" height="120" fill="#fff" opacity=".35" transform="rotate(14 118 60)"/>
  <!-- cuerpo -->
  <g clip-path="url(#cuerpo${k})">
    <rect x="20" y="100" width="160" height="220" fill="url(#liq${k})"/>
    ${motas}
    <path d="M-10 262 L210 232 L210 262 L-10 292 Z" fill="#D3121F"/>
    <text x="100" y="266" text-anchor="middle" font-family="'Big Shoulders Display','Arial Narrow',Arial,sans-serif" font-weight="900" font-size="21" letter-spacing="2" fill="#fff" transform="rotate(-7.8 100 262)">${etiqueta}</text>
    <rect x="20" y="100" width="160" height="220" fill="url(#bri${k})"/>
  </g>
  <path d="M30 118 L170 118 L152 304 Q151 312 143 312 L57 312 Q49 312 48 304 Z" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
  <!-- crema batida -->
  <path d="M34 120 C30 104 46 96 56 100 C58 84 78 80 88 90 C94 74 120 74 124 90 C136 80 156 88 152 102 C166 102 172 116 164 122 Z" fill="${crema}"/>
  <path d="M52 104 C66 98 74 108 88 100 M104 92 C116 100 128 92 140 100" stroke="${oscuro}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".7"/>
  <!-- tapa domo -->
  <path d="M26 120 C26 66 174 66 174 120 Z" fill="url(#tapa${k})" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>
  <rect x="22" y="114" width="156" height="10" rx="5" fill="#fff" opacity=".85"/>
  <path d="M48 92 C58 78 78 72 92 72" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>
</svg>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
