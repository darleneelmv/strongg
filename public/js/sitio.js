/* =====================================================================
   Strong Gym · sitio público (todo el contenido viene del panel
   "Sitio web" del sistema; aquí solo se dibuja y se anima).
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tactil = matchMedia('(hover: none)').matches;
  const dinero = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: Number(n) % 1 ? 2 : 0 })}`;
  const lista = (t) => String(t || '').split(',').map((x) => x.trim()).filter(Boolean);
  const digitos = (t) => String(t || '').replace(/\D/g, '');
  const wa = (num, texto) => {
    const d = digitos(num);
    if (!d) return null;
    return `https://wa.me/${d.length === 10 ? `52${d}` : d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
  };
  const urlOk = (u) => (u && /^https?:\/\//i.test(u) ? u : null);
  const vaso = (m, id) => (m.imagen ? `<img src="${esc(m.imagen)}" alt="Malteada ${esc(m.nombre || '')}" loading="lazy">` : window.SG.vasoSVG(m.color, { id }));
  const mezclar = (c, o, t) => window.SG.mezclarColor(/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#D3121F', o, t);

  // ---------- Íconos ----------
  const I = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.1-.7.1-.8.9-.9 1.1-.3.2-.6.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.4-.5.3-.5v-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c.7.3 1.3.5 1.7.6a4.2 4.2 0 0 0 1.9.1 3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.1-.3-.2-.6-.3zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.8 9.8 0 1 1 8.3 4.6zm0-21.6A11.8 11.8 0 0 0 1.9 17.9L.2 24l6.3-1.6A11.8 11.8 0 1 0 12 .2z"/></svg>',
    tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    fb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 8.5V6.6c0-.9.6-1.1 1-1.1h2.6V1.6L14 1.6c-4 0-4.9 3-4.9 4.9v2H6.8v4h2.4V22H14v-9.5h3.2l.4-4H14z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    tt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 5 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.3-1.6z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    reloj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>',
    estrella: '<svg viewBox="0 0 40 40"><path fill="currentColor" d="M20 0l4.2 13.4L38 9.8l-9.6 10.2L38 30.2l-13.8-3.6L20 40l-4.2-13.4L2 30.2l9.6-10.2L2 9.8l13.8 3.6z"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
  };
  const ADORNOS = {
    pesa: '<svg viewBox="0 0 120 48"><g fill="#fff"><rect x="24" y="20" width="72" height="8" rx="3"/><rect x="14" y="6" width="12" height="36" rx="4"/><rect x="4" y="12" width="9" height="24" rx="3"/><rect x="94" y="6" width="12" height="36" rx="4"/><rect x="107" y="12" width="9" height="24" rx="3"/></g></svg>',
    disco: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#061331"/><circle cx="50" cy="50" r="36" fill="none" stroke="#fff" stroke-width="3" opacity=".35"/><circle cx="50" cy="50" r="10" fill="#D3121F"/><text x="50" y="26" text-anchor="middle" font-family="Big Shoulders Display, Arial Narrow, sans-serif" font-weight="900" font-size="12" fill="#fff">20 KG</text></svg>',
    hoja: '<svg viewBox="0 0 120 80"><path d="M4 70 C40 20 80 8 116 10 C90 20 70 34 58 46 C74 40 92 40 104 44 C80 50 60 58 40 66 C52 66 64 70 72 76 C50 76 26 74 4 70Z" fill="#1E8A44"/><path d="M4 70 C40 40 80 20 116 10" stroke="#0f5a2b" stroke-width="3" fill="none"/></svg>',
    rayo: '<svg viewBox="0 0 60 100"><path d="M36 0 L4 58 H28 L20 100 L56 38 H32 Z" fill="#FFD23F" stroke="#061331" stroke-width="4" stroke-linejoin="round"/></svg>',
  };

  // =====================================================================
  //  INTRO
  // =====================================================================
  const intro = $('#intro');
  let introCorriendo = false;
  let terminarIntro = () => {};
  function quitarIntro(inmediato) {
    document.body.classList.remove('con-intro', 'cargando');
    document.body.classList.add('listo');
    if (inmediato) { intro.classList.add('fuera'); return; }
    intro.classList.add('saliendo');
    setTimeout(() => intro.classList.add('fuera'), 720);
  }
  function jugarIntro(colores) {
    let vista = false;
    try { vista = sessionStorage.getItem('sg-intro') === '1'; } catch (e) { /* nada */ }
    if (reducido || vista) return quitarIntro(true);
    try { sessionStorage.setItem('sg-intro', '1'); } catch (e) { /* nada */ }
    introCorriendo = true;
    document.body.classList.add('con-intro');
    const chispas = $('.intro-chispas', intro);
    const pal = [...colores, '#ffffff', '#D3121F', '#1E8A44', '#3d6fd6'];
    chispas.innerHTML = Array.from({ length: 34 }, (_, i) => {
      const ang = (i / 34) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 120 + Math.random() * Math.min(innerWidth, 900) * 0.45;
      return `<i style="--x:${Math.cos(ang) * dist}px;--y:${Math.sin(ang) * dist * 0.7 - 40}px;--t:${4 + Math.random() * 10}px;--c:${pal[i % pal.length]};animation-delay:${0.82 + Math.random() * 0.08}s"></i>`;
    }).join('');
    intro.classList.add('jugando');
    let hecho = false;
    terminarIntro = () => { if (hecho) return; hecho = true; introCorriendo = false; quitarIntro(false); };
    setTimeout(terminarIntro, 2050);
    $('.intro-saltar', intro).addEventListener('click', terminarIntro);
    intro.addEventListener('click', terminarIntro);
    addEventListener('keydown', terminarIntro, { once: true });
  }

  // =====================================================================
  //  DIBUJO
  // =====================================================================
  function render(d) {
    const s = d.sitio || {};
    const tx = s.textos || {};
    const mal = d.malteadas || [];
    const colores = mal.map((m) => m.color).filter(Boolean);
    const ws = s.whatsapp;
    const secciones = [];
    const nav = [];

    // ---------- Hero ----------
    const titulo = String(tx.hero_titulo || 'STRONG').trim().slice(0, 14) || 'STRONG';
    $('#hero-titulo').innerHTML = [...titulo].map((l, i) => (l === ' ' ? ' ' : `<span class="letra" style="--i:${i}">${esc(l)}</span>`)).join('');
    $('#hero-titulo').setAttribute('aria-label', `${titulo} · ${tx.hero_linea || 'Strong Gym Puruándiro'}`);
    $('#hero-linea').textContent = tx.hero_linea || 'Gym · Puruándiro';
    $('#hero-eslogan').textContent = s.eslogan || 'Entrena fuerte.';
    $('#hero-acciones').innerHTML = `
      ${mal.length ? '<a class="boton boton-rojo" href="#malteadas">Ver malteadas</a>' : ''}
      ${(d.planes || []).length ? '<a class="boton boton-borde" href="#planes">Planes y precios</a>' : ''}
      ${!mal.length && ws ? `<a class="boton boton-rojo" href="${esc(wa(ws, 'Hola, quiero información sobre Strong Gym.'))}" target="_blank" rel="noopener">${I.wa} Escríbenos</a>` : ''}`;
    const POS = [
      { x: '13%', y: '36%', w: 'clamp(90px, 14vw, 230px)', prof: 26, vel: -0.35, d: '.25s', t: '6s', r1: '-10deg', r2: '-2deg' },
      { x: '87%', y: '30%', w: 'clamp(84px, 12.5vw, 210px)', prof: 34, vel: -0.5, d: '.4s', t: '7s', r1: '8deg', r2: '14deg' },
      { x: '30%', y: '76%', w: 'clamp(60px, 8vw, 140px)', prof: 12, vel: -0.15, d: '.55s', t: '5s', r1: '-4deg', r2: '6deg', atras: true },
      { x: '73%', y: '78%', w: 'clamp(70px, 10vw, 170px)', prof: 20, vel: -0.25, d: '.7s', t: '6.5s', r1: '4deg', r2: '-6deg' },
    ];
    const vasosHero = (mal.length ? mal : [{ color: '#5A3220' }, { color: '#D6334F' }, { color: '#F29A1F' }, { color: '#3A3FA8' }]);
    $('#hero-vasos').innerHTML = POS.map((p, i) => {
      const m = vasosHero[i % vasosHero.length];
      return `<div class="vaso-flota ${p.atras ? 'atras' : ''}" style="--x:${p.x};--y:${p.y};--w:${p.w};--prof:${p.prof};--vel:${p.vel};--d:${p.d};--t:${p.t};--r1:${p.r1};--r2:${p.r2}"><div>${vaso(m, `h${i}`)}</div></div>`;
    }).join('') + Array.from({ length: 16 }, (_, i) => {
      const c = colores.length ? colores[i % colores.length] : '#D3121F';
      return `<i class="particula" style="--x:${(i * 61) % 100}%;--y:${60 + ((i * 37) % 40)}%;--t:${4 + (i % 5) * 2}px;--c:${mezclar(c, '#ffffff', 0.3)};--dur:${9 + (i % 7)}s;--d:${-(i * 1.3)}s"></i>`;
    }).join('');

    // ---------- Cinta ----------
    const palabras = lista(tx.marquesina);
    if (palabras.length) {
      let reps = palabras;
      while (reps.length < 8) reps = reps.concat(palabras);
      const pista = reps.map((p) => `<span><b>${esc(p)}</b>${I.estrella}</span>`).join('');
      secciones.push(`<section class="cinta" id="cinta" aria-label="${esc(palabras.join(', '))}">
        <div class="cinta-banda" aria-hidden="true"><div class="cinta-pista">${pista}${pista}</div></div>
        <div class="cinta-banda" aria-hidden="true"><div class="cinta-pista">${pista}${pista}</div></div>
      </section>`);
    }

    // ---------- Manifiesto ----------
    if (tx.manifiesto) {
      let rojo = false;
      const pals = String(tx.manifiesto).split(/\s+/).filter(Boolean).map((w) => {
        let palabra = w;
        const abre = palabra.startsWith('*');
        if (abre) { rojo = true; palabra = palabra.slice(1); }
        const cierra = /\*[.,:;!?]*$/.test(palabra);
        palabra = palabra.replace(/\*/g, '');
        const html = `<span class="pal ${rojo ? 'marca' : ''}">${esc(palabra)}</span>`;
        if (cierra) rojo = false;
        return html;
      }).join(' ');
      const m0 = mal[1] || mal[0] || { color: '#3A3FA8' };
      const gotas = Array.from({ length: 16 }, (_, i) => `<i class="gota" style="--x:${(i * 53) % 100}%;--t:${6 + (i % 4) * 4}px;--c:${i % 3 ? mezclar(m0.color, '#000000', 0.15) : '#0A1430'};--dur:${5 + (i % 5)}s;--d:${-(i * 0.7)}s"></i>`).join('');
      secciones.push(`<section class="manifiesto" id="manifiesto">
        <div class="manifiesto-fijo">
          <div class="manifiesto-lluvia" aria-hidden="true">${gotas}</div>
          <div><span class="manifiesto-etq">Strong Gym</span><p class="manifiesto-texto">${pals}</p></div>
          <div class="manifiesto-vaso" aria-hidden="true">${vaso(m0, 'man')}</div>
        </div>
      </section>`);
    }

    // ---------- Bloque rojo ----------
    const tit = String(tx.bloque_titulo || 'Entrena con todo.').trim().split(/\s+/);
    const lineas = tit.length <= 3 ? tit : [tit.slice(0, Math.ceil(tit.length / 3)).join(' '), tit.slice(Math.ceil(tit.length / 3), Math.ceil((2 * tit.length) / 3)).join(' '), tit.slice(Math.ceil((2 * tit.length) / 3)).join(' ')];
    const POS_ST = [['5%', '16%', '-8deg'], ['76%', '14%', '7deg'], ['8%', '78%', '5deg'], ['72%', '84%', '-6deg'], ['24%', '6%', '-3deg'], ['40%', '93%', '4deg']];
    const stickers = lista(tx.etiquetas).slice(0, 6).map((t, i) => `<span class="sticker" style="--x:${POS_ST[i][0]};--y:${POS_ST[i][1]};--r:${POS_ST[i][2]}">${esc(t)}</span>`).join('');
    const ad = [['pesa', '78%', '34%', 'clamp(90px,12vw,190px)', '-18deg', 30], ['disco', '4%', '40%', 'clamp(70px,9vw,140px)', '12deg', 22], ['hoja', '82%', '58%', 'clamp(80px,10vw,160px)', '-10deg', 16], ['rayo', '16%', '58%', 'clamp(36px,4vw,64px)', '14deg', 40]];
    secciones.push(`<section class="bloque" id="bloque">
      ${ad.map(([k, x, y, w, r, prof]) => `<div class="adorno" style="--x:${x};--y:${y};--w:${w};--r:${r};--prof:${prof}" aria-hidden="true">${ADORNOS[k]}</div>`).join('')}
      ${stickers}
      <div class="bloque-centro">
        <h2 class="bloque-titulo" data-rev>${tx.bloque_script ? `<span class="bloque-script">${esc(tx.bloque_script)}</span>` : ''}${lineas.map((l, k) => `<span class="l${k + 1}">${esc(l)}</span>`).join('')}</h2>
        <div class="bloque-acciones" data-rev style="--i:2">
          ${mal.length ? '<a class="boton boton-blanco" href="#malteadas">Malteadas</a>' : ''}
          ${(d.planes || []).length ? '<a class="boton boton-azul" href="#planes">Planes y precios</a>' : ''}
        </div>
      </div>
    </section>`);

    // ---------- Malteadas ----------
    if (mal.length) {
      nav.push(['malteadas', 'Malteadas']);
      const slides = mal.map((m, i) => {
        const nombre = m.nombre || '';
        const palabra = nombre.split(/\s+/)[0] || nombre;
        const ingr = lista(m.ingredientes).slice(0, 5);
        const burb = Array.from({ length: 10 }, (_, k) => {
          const ang = (k / 10) * Math.PI * 2;
          const rx = 22 + (k % 3) * 6, ry = 30 + (k % 4) * 5;
          return `<i style="--x:${50 + Math.cos(ang) * rx}%;--y:${48 + Math.sin(ang) * ry}%;--t:${8 + (k % 4) * 7}px;--c:${k % 3 === 0 ? 'rgba(255,255,255,.75)' : k % 3 === 1 ? mezclar(m.color, '#ffffff', 0.45) : mezclar(m.color, '#000000', 0.3)};--d:${k * 40}ms;--dur:${3 + (k % 4)}s"></i>`;
        }).join('');
        const pedir = ws ? `<a class="boton boton-blanco" href="${esc(wa(ws, `Hola, quiero una malteada ${nombre} 🥤`))}" target="_blank" rel="noopener">${I.wa} Pedir</a>` : '';
        return `<article class="sabor ${i === 0 ? 'activo' : ''}" data-i="${i}" style="--c:${esc(m.color)}" aria-label="${esc(nombre)}, ${esc(dinero(m.precio))}">
          <p class="sabor-palabra" aria-hidden="true">${esc(palabra)}</p>
          <div class="sabor-burbujas" aria-hidden="true">${burb}</div>
          <div class="sabor-info">
            <p class="sabor-num"><b>${String(i + 1).padStart(2, '0')}</b>/ ${String(mal.length).padStart(2, '0')}</p>
            ${m.etiqueta ? `<span class="sabor-tag">${esc(m.etiqueta)}</span>` : ''}
            <h3 class="sabor-nombre">${esc(nombre)}</h3>
            ${m.descripcion ? `<p class="sabor-desc">${esc(m.descripcion)}</p>` : ''}
            ${ingr.length ? `<ul class="sabor-ingr">${ingr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          </div>
          <div class="sabor-vaso"><div>${vaso(m, `s${i}`)}</div></div>
          <p class="sabor-script" aria-hidden="true">${esc(nombre.toLowerCase())}</p>
          <div class="sabor-precio">
            <p class="precio-grande">${esc(dinero(m.precio))}<small>MXN</small></p>
            ${m.proteina_g ? `<p class="proteina"><b>${esc(m.proteina_g)} g</b>de proteína</p>` : ''}
            ${pedir}
          </div>
        </article>`;
      }).join('');
      secciones.push(`<section class="barra-intro" id="malteadas">
          <span class="etiqueta-sec" data-rev>Menú</span>
          <h2 class="titulo-sec" data-rev style="--i:1">${esc(tx.malteadas_titulo || 'Barra de proteína')}</h2>
          ${tx.malteadas_texto ? `<p class="texto-sec" data-rev style="--i:2">${esc(tx.malteadas_texto)}</p>` : ''}
        </section>
        <section class="escaparate" id="escaparate" style="--n:${mal.length};--sabor:${esc(mal[0].color)}">
          <div class="escena" id="escena" style="--sabor:${esc(mal[0].color)}">
            <div class="escena-humo" aria-hidden="true"><i></i><i></i><i></i></div>
            ${slides}
            ${mal.length > 1 ? `<nav class="escena-puntos" aria-label="Sabores">${mal.map((m, i) => `<button type="button" data-ir="${i}" class="${i === 0 ? 'activo' : ''}" aria-label="${esc(m.nombre)}"></button>`).join('')}</nav>` : ''}
            <div class="escena-barra" aria-hidden="true"></div>
          </div>
        </section>
        <section class="menu-precios" aria-labelledby="menu-tit">
          <div class="menu-cab"><h3 id="menu-tit" data-rev>Todo el menú</h3><p data-rev style="--i:1">Pídelas en recepción antes o después de tu entrenamiento.</p></div>
          <ul class="menu-lista">${mal.map((m, i) => `<li data-rev style="--i:${i % 3}"><span class="menu-mini" style="--c:${esc(m.color)}">${vaso(m, `m${i}`)}</span>
            <span><strong>${esc(m.nombre)}</strong><small>${m.proteina_g ? `${esc(m.proteina_g)} g de proteína` : esc(m.ingredientes || '')}</small></span><em>${esc(dinero(m.precio))}</em></li>`).join('')}</ul>
        </section>`);
    }

    // ---------- Planes ----------
    const planes = d.planes || [];
    if (planes.length) {
      nav.push(['planes', 'Planes']);
      const dest = planes.findIndex((p) => /mensual/i.test(p.nombre) && !/estudiante/i.test(p.nombre));
      secciones.push(`<section class="planes" id="planes">
        <div class="planes-cab">
          <div><span class="etiqueta-sec" data-rev>Membresías</span><h2 class="titulo-sec" data-rev style="--i:1">Planes y precios</h2></div>
          <p data-rev style="--i:2">Sin letras chiquitas. Inscríbete en recepción y llévate tu credencial con código QR para entrar.</p>
        </div>
        <div class="planes-rejilla">
          ${planes.map((p, i) => `<article class="plan-t ${i === (dest < 0 ? 0 : dest) ? 'destacado' : ''}" data-rev style="--i:${i % 4}">
            <h3>${esc(p.nombre)}</h3>
            <p class="precio">${esc(dinero(p.precio))}<small>MXN</small></p>
            <p class="dur">${esc(p.duracion_dias)} ${Number(p.duracion_dias) === 1 ? 'día' : 'días'}</p>
            ${p.descripcion ? `<p>${esc(p.descripcion)}</p>` : ''}
          </article>`).join('')}
          ${d.precio_visita ? `<article class="plan-t" data-rev style="--i:${planes.length % 4}"><h3>Visita</h3><p class="precio">${esc(dinero(d.precio_visita))}<small>MXN</small></p><p class="dur">1 día</p><p>Entrena un día sin membresía.</p></article>` : ''}
        </div>
        <p class="planes-nota" data-rev>${I.qr}<span>Al inscribirte te entregamos tu credencial: la pasas por el lector al llegar y listo.</span></p>
      </section>`);
    }

    // ---------- Promociones y novedades ----------
    const promos = d.promociones || [];
    const novedades = d.novedades || [];
    if (promos.length || novedades.length) {
      nav.push(['promociones', promos.length ? 'Promos' : 'Novedades']);
      const fecha = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      secciones.push(`<section class="promos" id="promociones">
        ${promos.length ? `<span class="etiqueta-sec" data-rev>Aprovecha</span><h2 class="titulo-sec" data-rev style="--i:1">Promociones</h2>
        <div class="promos-rejilla">${promos.map((p, i) => `<article class="promo-t" data-rev style="--i:${i % 3}">
          ${p.destacada ? '<span class="promo-sello">¡Promo!</span>' : ''}
          ${p.imagen ? `<img src="${esc(p.imagen)}" alt="" loading="lazy">` : ''}
          <div class="promo-cuerpo"><h3>${esc(p.titulo)}</h3>${p.texto ? `<p>${esc(p.texto)}</p>` : ''}
            <div class="promo-pie"><span>${p.vigente_hasta ? `Válida hasta el ${esc(fecha(p.vigente_hasta))}` : 'Por tiempo limitado'}</span>
            ${ws ? `<a href="${esc(wa(ws, `Hola, me interesa la promoción "${p.titulo}".`))}" target="_blank" rel="noopener">Preguntar →</a>` : ''}</div></div>
        </article>`).join('')}</div>` : ''}
        ${novedades.length ? `<div class="novedades"><h3 data-rev>Lo nuevo en el gym</h3><ol>${novedades.map((n, i) => `<li data-rev style="--i:${i % 3}">
          <time>${esc(fecha(n.created_at))}</time><div><h4>${esc(n.titulo)}</h4>${n.texto ? `<p>${esc(n.texto)}</p>` : ''}${n.imagen ? `<img src="${esc(n.imagen)}" alt="" loading="lazy">` : ''}</div></li>`).join('')}</ol></div>` : ''}
      </section>`);
    }

    // ---------- Galería ----------
    const gal = d.galeria || [];
    if (gal.length) {
      nav.push(['galeria', 'Galería']);
      secciones.push(`<section class="galeria" id="galeria">
        <div class="galeria-cab"><div><span class="etiqueta-sec" data-rev>Así se ve</span><h2 class="titulo-sec" data-rev style="--i:1">El gym</h2></div><p data-rev>${tactil ? 'Desliza para ver más →' : 'Arrastra para ver más →'}</p></div>
        <div class="galeria-pista" id="galeria-pista">${gal.map((g, i) => `<button class="foto" type="button" data-foto="${i}"><img src="${esc(g.imagen)}" alt="${esc(g.titulo)}" loading="lazy" draggable="false"><span>${esc(g.titulo)}</span></button>`).join('')}</div>
      </section>`);
    }

    // ---------- Cierre ----------
    const cierre = String(tx.cierre_titulo || 'La fuerza no es un hábito.').trim().split(/\s+/);
    const maps = urlOk(s.maps_url);
    secciones.push(`<section class="cierre" id="cierre">
      <div class="cierre-luz" aria-hidden="true"></div>
      <div>
        <h2 class="cierre-titulo">${cierre.map((w, i) => `<span class="pal" style="--i:${i}">${esc(w)}</span>`).join(' ')}
          ${tx.cierre_script ? `<span class="cierre-script">${esc(tx.cierre_script)}</span>` : ''}</h2>
        <div class="cierre-acciones">
          ${ws ? `<a class="boton boton-rojo" href="${esc(wa(ws, 'Hola, quiero inscribirme en Strong Gym.'))}" target="_blank" rel="noopener">${I.wa} Inscríbete por WhatsApp</a>` : ''}
          ${maps ? `<a class="boton boton-borde" href="${esc(maps)}" target="_blank" rel="noopener">${I.pin} Cómo llegar</a>` : ''}
        </div>
      </div>
    </section>`);

    // ---------- Visítanos ----------
    nav.push(['visitanos', 'Visítanos']);
    const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const corto = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', weekday: 'short' }).format(new Date());
    const hoyN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(corto);
    const esHoy = (etq) => {
      const t = etq.toLowerCase();
      if (t.includes(DIAS[hoyN])) return true;
      const rango = t.match(/(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+a\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/);
      if (!rango) return false;
      const n = (x) => DIAS.indexOf(x.replace('miercoles', 'miércoles').replace('sabado', 'sábado'));
      const [a, b] = [n(rango[1]), n(rango[2])];
      return a <= b ? hoyN >= a && hoyN <= b : hoyN >= a || hoyN <= b;
    };
    const horario = String(s.horario || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const i = l.indexOf(':');
      return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ''];
    });
    const contacto = [
      ws && [wa(ws, 'Hola, quiero información sobre Strong Gym.'), I.wa, `WhatsApp ${ws}`],
      s.telefono && [`tel:${digitos(s.telefono)}`, I.tel, `Llamar al ${s.telefono}`],
      s.email && [`mailto:${s.email}`, I.mail, s.email],
      urlOk(s.facebook) && [s.facebook, I.fb, 'Facebook'],
      urlOk(s.instagram) && [s.instagram, I.ig, 'Instagram'],
      urlOk(s.tiktok) && [s.tiktok, I.tt, 'TikTok'],
    ].filter(Boolean);
    secciones.push(`<section class="visitanos" id="visitanos">
      <span class="etiqueta-sec" data-rev>Te esperamos</span><h2 class="titulo-sec" data-rev style="--i:1">Visítanos</h2>
      <div class="visitanos-rejilla">
        <article class="caja" data-rev><h3>${I.reloj} Horario</h3>
          ${horario.length ? `<dl class="horario">${horario.map(([a, b]) => `<div class="${esHoy(a) ? 'hoy' : ''}"><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>` : '<p>Pregunta por nuestro horario en recepción.</p>'}
        </article>
        <article class="caja" data-rev style="--i:1"><h3>${I.pin} Ubicación</h3>
          <p class="direccion">${esc(s.direccion || 'Puruándiro, Michoacán')}</p>
          ${maps ? `<a class="boton boton-rojo" href="${esc(maps)}" target="_blank" rel="noopener">Cómo llegar</a>` : ''}
        </article>
        <article class="caja" data-rev style="--i:2"><h3>${I.msg} Contacto</h3>
          ${contacto.length ? `<ul class="contacto">${contacto.map(([h, ic, t]) => `<li><a href="${esc(h)}" ${/^https?:/.test(h) ? 'target="_blank" rel="noopener"' : ''}>${ic}${esc(t)}</a></li>`).join('')}</ul>` : '<p>Visítanos en recepción.</p>'}
        </article>
      </div>
    </section>`);

    $('#secciones').innerHTML = secciones.join('');

    // ---------- Navegación y pie ----------
    const enlaces = nav.map(([id, t]) => `<a href="#${id}" data-sec="${id}">${esc(t)}</a>`).join('');
    $('#nav').innerHTML = enlaces;
    $('#menu-movil').innerHTML = `${enlaces}<a href="/app">Socios</a><small>Strong Gym Puruándiro</small>`;
    const redes = contacto.filter(([h]) => /^https?:/.test(h));
    $('#pie').innerHTML = `
      <p class="pie-grande" aria-hidden="true">Strong Gym</p>
      <div class="pie-fila">
        <span>© ${new Date().getFullYear()} Strong Gym Puruándiro · Desarrollado por CodeDMF</span>
        ${redes.length ? `<div class="pie-redes">${redes.map(([h, ic, t]) => `<a href="${esc(h)}" target="_blank" rel="noopener" aria-label="${esc(t)}">${ic}</a>`).join('')}</div>` : ''}
        <a href="/app">Acceso para socios y personal →</a>
      </div>`;
    if (ws) {
      const b = document.createElement('a');
      b.className = 'wa-flota';
      b.href = wa(ws, 'Hola, quiero información sobre Strong Gym.');
      b.target = '_blank'; b.rel = 'noopener';
      b.setAttribute('aria-label', 'Escríbenos por WhatsApp');
      b.innerHTML = I.wa;
      document.body.appendChild(b);
    }
    return { galeria: gal, colores };
  }

  // =====================================================================
  //  MOVIMIENTO
  // =====================================================================
  function animar(info) {
    const cab = $('#cab');
    const hero = $('.hero');
    const waBtn = $('.wa-flota');
    const manif = $('#manifiesto');
    const palabras = manif ? $$('.pal', manif) : [];
    const escap = $('#escaparate');
    const escena = $('#escena');
    const sabores = escap ? $$('.sabor', escap) : [];
    const puntos = escap ? $$('[data-ir]', escap) : [];
    let actual = 0;

    // Revelado al aparecer
    const io = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); }
    }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    $$('[data-rev], .cierre').forEach((el) => io.observe(el));

    // Sección activa en el menú
    const ioNav = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (e.isIntersecting) $$('#nav a').forEach((a) => a.classList.toggle('activo', a.dataset.sec === e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('#nav a').forEach((a) => { const s = document.getElementById(a.dataset.sec); if (s) ioNav.observe(s); });

    // Mouse sobre el hero y el bloque rojo (paralaje)
    if (!tactil && !reducido) {
      const seguir = (zona) => zona && zona.addEventListener('pointermove', (e) => {
        const r = zona.getBoundingClientRect();
        zona.style.setProperty('--mx', (((e.clientX - r.left) / r.width) - 0.5).toFixed(3));
        zona.style.setProperty('--my', (((e.clientY - r.top) / r.height) - 0.5).toFixed(3));
      });
      seguir(hero);
      seguir($('#bloque'));
    }

    // Escaparate: cambiar de sabor
    function ponerSabor(i) {
      if (i === actual || !sabores[i]) return;
      sabores.forEach((s, k) => {
        s.classList.toggle('activo', k === i);
        s.classList.toggle('salio', k < i);
      });
      puntos.forEach((p, k) => p.classList.toggle('activo', k === i));
      const c = sabores[i].style.getPropertyValue('--c');
      escena.style.setProperty('--sabor', c);
      escap.style.setProperty('--sabor', c);
      actual = i;
    }
    puntos.forEach((p) => p.addEventListener('click', () => {
      const i = Number(p.dataset.ir);
      const tope = escap.offsetTop;
      const recorrido = escap.offsetHeight - innerHeight;
      scrollTo({ top: tope + (recorrido * (i + 0.5)) / sabores.length, behavior: reducido ? 'auto' : 'smooth' });
    }));

    // Ciclo de scroll (una vez por cuadro)
    let pendiente = false;
    let ultimoY = scrollY;
    let velocidad = 0;
    function alBajar() {
      pendiente = false;
      const y = scrollY;
      const vh = innerHeight;
      velocidad = velocidad * 0.8 + (y - ultimoY) * 0.2;
      ultimoY = y;
      cab.classList.toggle('solida', y > 40);
      if (waBtn) {
        waBtn.classList.toggle('ver', y > vh * 0.8);
        if (escap) { const r = escap.getBoundingClientRect(); waBtn.classList.toggle('oculto', r.top < vh * 0.5 && r.bottom > vh * 0.5); }
      }
      if (y < vh * 1.2) hero.style.setProperty('--scroll', y.toFixed(1));
      if (reducido) return;
      if (manif) {
        const r = manif.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / (manif.offsetHeight - vh)));
        manif.style.setProperty('--p', p.toFixed(3));
        const n = Math.round(Math.min(1, p * 1.25) * palabras.length);
        palabras.forEach((w, i) => w.classList.toggle('on', i < n));
      }
      if (escap && sabores.length) {
        const r = escap.getBoundingClientRect();
        const rec = escap.offsetHeight - vh;
        const p = Math.min(0.9999, Math.max(0, -r.top / rec));
        escena.style.setProperty('--p', p.toFixed(4));
        const pos = p * sabores.length;
        const i = Math.floor(pos);
        ponerSabor(i);
        const t = pos - i;
        sabores[i].style.setProperty('--desliza', ((0.5 - t) * 14).toFixed(2));
      }
    }
    addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(alBajar); } }, { passive: true });
    addEventListener('resize', alBajar);
    alBajar();

    // Cintas: avanzan solas y aceleran con el scroll
    const bandas = $$('.cinta-pista');
    if (bandas.length && !reducido) {
      bandas.forEach((b) => { b.style.animation = 'none'; });
      const estado = bandas.map((b, k) => ({ b, x: k % 2 ? -b.scrollWidth * 0.19 : 0, dir: k % 2 ? 1 : -1, ancho: 0 }));
      let visible = false;
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe($('#cinta'));
      let antes = performance.now();
      const paso = (ahora) => {
        const dt = Math.min(0.05, (ahora - antes) / 1000);
        antes = ahora;
        if (visible) {
          const extra = Math.min(900, Math.abs(velocidad) * 22);
          estado.forEach((s) => {
            s.ancho = s.ancho || s.b.scrollWidth / 2;
            s.x += s.dir * (70 + extra) * dt;
            if (s.x <= -s.ancho) s.x += s.ancho;
            if (s.x > 0) s.x -= s.ancho;
            s.b.style.transform = `translate3d(${s.x.toFixed(1)}px,0,0)`;
          });
        }
        velocidad *= 0.92;
        requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
      addEventListener('resize', () => estado.forEach((s) => { s.ancho = 0; }));
    }

    // Stickers que se pueden arrastrar
    $$('.sticker').forEach((st) => {
      let ox = 0, oy = 0, sx = 0, sy = 0, id = null;
      st.addEventListener('pointerdown', (e) => {
        id = e.pointerId; st.setPointerCapture(id); st.classList.add('arrastrando');
        sx = e.clientX - ox; sy = e.clientY - oy;
      });
      st.addEventListener('pointermove', (e) => {
        if (e.pointerId !== id) return;
        ox = e.clientX - sx; oy = e.clientY - sy;
        st.style.translate = `${ox}px ${oy}px`;
      });
      const soltar = () => { id = null; st.classList.remove('arrastrando'); };
      st.addEventListener('pointerup', soltar);
      st.addEventListener('pointercancel', soltar);
    });

    // Galería: arrastrar con el mouse y ver en grande
    const pista = $('#galeria-pista');
    if (pista) {
      let abajo = false, x0 = 0, s0 = 0, movio = false;
      pista.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; abajo = true; movio = false; x0 = e.clientX; s0 = pista.scrollLeft; pista.classList.add('arrastrando'); });
      addEventListener('pointermove', (e) => { if (!abajo) return; const dx = e.clientX - x0; if (Math.abs(dx) > 5) movio = true; pista.scrollLeft = s0 - dx; });
      addEventListener('pointerup', () => { abajo = false; pista.classList.remove('arrastrando'); });
      const lb = $('#lightbox');
      const cerrar = () => { lb.hidden = true; document.body.classList.remove('menu-abierto'); };
      $$('[data-foto]', pista).forEach((b) => b.addEventListener('click', (e) => {
        if (movio) { e.preventDefault(); return; }
        const g = info.galeria[Number(b.dataset.foto)];
        $('img', lb).src = g.imagen; $('img', lb).alt = g.titulo; $('figcaption', lb).textContent = g.titulo;
        lb.hidden = false; document.body.classList.add('menu-abierto');
        $('.lightbox-cerrar', lb).focus();
      }));
      lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.lightbox-cerrar')) cerrar(); });
      addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) cerrar(); });
    }

    // Menú en celular
    const bMenu = $('#btn-menu');
    const menu = $('#menu-movil');
    const alternar = (abrir) => {
      bMenu.setAttribute('aria-expanded', String(abrir));
      menu.hidden = !abrir;
      document.body.classList.toggle('menu-abierto', abrir);
      bMenu.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
    };
    bMenu.addEventListener('click', () => alternar(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) alternar(false); });
  }

  // =====================================================================
  //  ARRANQUE
  // =====================================================================
  async function iniciar() {
    let d = null;
    try {
      const r = await Promise.race([
        fetch('/api/publico/sitio', { credentials: 'same-origin' }),
        new Promise((_, mal) => setTimeout(() => mal(new Error('lento')), 6000)),
      ]);
      d = await r.json();
    } catch (e) { d = null; }
    if (!d || !d.sitio) d = { sitio: {}, malteadas: [], planes: [], promociones: [], novedades: [], galeria: [] };
    const info = render(d);
    const tx = d.sitio.textos || {};
    if (tx.intro === false) quitarIntro(true); else jugarIntro(info.colores);
    animar(info);
    // Si llegó con #seccion en la dirección, ir ahí cuando ya existe
    if (location.hash && location.hash.length > 1) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView(), introCorriendo ? 2100 : 50);
    }
  }
  iniciar();
})();
