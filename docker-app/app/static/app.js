// Narrarr — interfaz (SPA sin build, módulos ES)
const DEMO = new URLSearchParams(location.search).get('demo') === '1';
let demo = null;
if (DEMO) demo = await import('./js/demo.js');

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MASCARA = '••••';
const nf = new Intl.NumberFormat('es-ES');
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const fFecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const rtf = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });

function tamano(b) {
  if (b == null || b === '' || isNaN(b)) return '—';
  b = Number(b);
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${nf1.format(b)} ${u[i]}`;
}
function duracion(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}
function relativa(f) {
  if (!f) return 'nunca';
  const d = new Date(f);
  if (isNaN(d)) return '—';
  const s = (d - Date.now()) / 1000, a = Math.abs(s);
  if (a < 45) return s < 0 ? 'hace un momento' : 'en unos segundos';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return fFecha.format(d);
}
const fechaTitulo = (f) => { const d = new Date(f); return f && !isNaN(d) ? fFecha.format(d) : ''; };
const velocidad = (bps) => (bps ? `${tamano(bps)}/s` : '');
const iniciales = (n) => (n || '?').split(/\s+/).filter((p) => p && /\p{L}/u.test(p[0])).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
const portadaUrl = (id) => (DEMO ? demo.demoPortada(id) : `/api/portada/${id}`);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- API ---------- */
async function api(ruta, { method = 'GET', body } = {}) {
  const opciones = { method, headers: {} };
  if (body !== undefined) { opciones.body = JSON.stringify(body); opciones.headers['Content-Type'] = 'application/json'; }
  let r;
  try {
    r = DEMO ? await demo.demoFetch('/api' + ruta, opciones) : await fetch('/api' + ruta, opciones);
  } catch (e) {
    throw new Error('No puedo conectar con Narrarr. ¿Está el servidor en marcha?');
  }
  let datos = null;
  const texto = await r.text();
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  if (!r.ok) {
    let msg = datos && datos.detalle;
    if (Array.isArray(msg)) msg = msg.map((x) => x.msg || x).join('; ');
    throw new Error(msg || `Error ${r.status} del servidor`);
  }
  return datos;
}

/* ---------- toasts ---------- */
function toast(msg, tipo = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast' + (tipo === 'error' ? ' error' : '');
  t.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('saliendo'); setTimeout(() => t.remove(), 300); }, tipo === 'error' ? 6000 : 3500);
}
const fallo = (e) => toast(e.message || String(e), 'error');

/* ---------- iconos ---------- */
const I = {
  biblioteca: '<path d="M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2.5zM4 19.5A2 2 0 0 0 6 22h12v-3"/><path d="M9 7h5"/>',
  anadir: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  autores: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  deseados: '<path d="M12 20.5s-8-4.7-8-10.8A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8 3.1c0 6.1-8 10.8-8 10.8z"/>',
  actividad: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sistema: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  descargar: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  editar: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  borrar: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  rejilla: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>',
  fallo: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  refrescar: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  importar: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  auriculares: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
  enlace: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  estrella: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  idioma: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
};
const ico = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

const ESTADOS = { descargado: 'Descargado', deseado: 'Deseado', buscando: 'Buscando', descargando: 'Descargando', ignorado: 'Ignorado' };
const ESTADOS_DESC = { en_cola: 'En cola', descargando: 'Descargando', completada: 'Completada', importada: 'Importada', fallida: 'Fallida' };
const TAREAS = {
  buscar_deseados: ['Buscar deseados', 'Busca los libros deseados con freno (máx. 5 por pasada)'],
  escanear_biblioteca: ['Escanear biblioteca', 'Recorre la carpeta de audiolibros y actualiza la ficha de cada libro'],
  comprobar_descargas: ['Comprobar descargas', 'Mira qBittorrent e importa lo que haya terminado'],
  vigilar_autores: ['Vigilar autores', 'Añade como deseados los libros nuevos de tus autores vigilados'],
};

/* ---------- tema ---------- */
function temaActual() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function pintarBotonTema() {
  const claro = temaActual() === 'light';
  $('#temaBtn').innerHTML = ico(claro ? 'luna' : 'sol') + `<span>${claro ? 'Tema oscuro' : 'Tema claro'}</span>`;
  $('#temaBtn').setAttribute('aria-label', claro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  document.querySelector('meta[name="theme-color"]').content = claro ? '#f4f6f9' : '#0f1115';
}
$('#temaBtn').addEventListener('click', () => {
  const nuevo = temaActual() === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem('narrarr-tema', nuevo); } catch (e) { /* sin almacenamiento */ }
  pintarBotonTema();
});
pintarBotonTema();

const guardado = (k, def) => { try { return localStorage.getItem('narrarr-' + k) ?? def; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem('narrarr-' + k, v); } catch { /* nada */ } };

/* ---------- menú ---------- */
const MENU = [
  ['biblioteca', 'Biblioteca', 'biblioteca'], ['añadir', 'Añadir', 'anadir'], ['autores', 'Autores', 'autores'],
  ['deseados', 'Deseados', 'deseados'], ['actividad', 'Actividad', 'actividad'], ['ajustes', 'Ajustes', 'ajustes'], ['sistema', 'Sistema', 'sistema'],
];
$('#menu').innerHTML = MENU.map(([r, t, i]) => `<li><a href="#/${r}" data-ruta="${r}" aria-label="${t}">${ico(i)}<span class="txt">${t}</span>${r === 'actividad' ? '<span class="cuenta-menu" id="cuentaCola" hidden></span>' : ''}</a></li>`).join('');

async function refrescarCuentaCola() {
  try {
    const d = await api('/descargas');
    const n = (d || []).filter((x) => x.estado === 'en_cola' || x.estado === 'descargando').length;
    const el = $('#cuentaCola');
    el.hidden = !n; el.textContent = n;
  } catch { /* silencio */ }
}

/* ---------- modal ---------- */
let focoPrevio = null;
function abrirModal({ titulo, cuerpo, pie = '', ancho = false }) {
  focoPrevio = document.activeElement;
  const fondo = $('#modal');
  fondo.innerHTML = `<div class="modal${ancho ? ' ancho' : ''}" role="dialog" aria-modal="true" aria-labelledby="modalTit">
    <div class="modal-cab"><h2 id="modalTit">${titulo}</h2><button class="btn ico-solo" data-cerrar aria-label="Cerrar">${ico('cerrar')}</button></div>
    <div class="modal-cuerpo">${cuerpo}</div>${pie ? `<div class="modal-pie">${pie}</div>` : ''}</div>`;
  fondo.hidden = false;
  fondo.onclick = (e) => { if (e.target === fondo || e.target.closest('[data-cerrar]')) cerrarModal(); };
  const primero = $('input, select, textarea, button:not([data-cerrar])', fondo) || $('[data-cerrar]', fondo);
  setTimeout(() => primero && primero.focus(), 30);
  return fondo;
}
function cerrarModal() {
  const f = $('#modal');
  f.hidden = true; f.innerHTML = '';
  if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
}
document.addEventListener('keydown', (e) => {
  const f = $('#modal');
  if (f.hidden) return;
  if (e.key === 'Escape') cerrarModal();
  if (e.key === 'Tab') {
    const el = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', f);
    if (!el.length) return;
    if (e.shiftKey && document.activeElement === el[0]) { e.preventDefault(); el.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === el.at(-1)) { e.preventDefault(); el[0].focus(); }
  }
});
function confirmar({ titulo, texto, boton = 'Confirmar', casilla = null, peligro = true }) {
  return new Promise((res) => {
    const f = abrirModal({
      titulo: esc(titulo),
      cuerpo: `<p>${texto}</p>${casilla ? `<label class="casilla"><input type="checkbox" id="confCasilla"> ${esc(casilla)}</label>` : ''}`,
      pie: `<button class="btn" data-cerrar>Cancelar</button><button class="btn ${peligro ? 'peligro lleno' : 'prim'}" id="confOk">${esc(boton)}</button>`,
    });
    const viejo = f.onclick;
    f.onclick = (e) => { if (e.target === f || e.target.closest('[data-cerrar]')) res(null); viejo(e); };
    $('#confOk', f).onclick = () => { const v = { casilla: !!($('#confCasilla', f) || {}).checked }; cerrarModal(); res(v); };
  });
}

/* ---------- router ---------- */
let limpiar = [];
const alSalir = (fn) => limpiar.push(fn);
const vistas = {};
function ruta() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'biblioteca';
  const [camino, qs] = h.split('?');
  const partes = camino.split('/').filter(Boolean);
  return { partes, params: new URLSearchParams(qs || '') };
}
async function navegar() {
  limpiar.forEach((f) => { try { f(); } catch { /* nada */ } });
  limpiar = [];
  if (!$('#modal').hidden) cerrarModal();
  const { partes, params } = ruta();
  let nombre = partes[0] || 'biblioteca';
  if (nombre === 'anadir') nombre = 'añadir';
  const seccion = { libro: 'biblioteca', autor: 'autores', 'autor-audible': 'añadir' }[nombre] || nombre;
  $$('#menu a').forEach((a) => (a.dataset.ruta === seccion ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const main = $('#principal');
  const fn = vistas[nombre] || vistas.biblioteca;
  main.innerHTML = '';
  const cont = document.createElement('div');
  cont.className = 'vista';
  if (DEMO) cont.innerHTML = '<div class="aviso-demo">Modo demo: datos de ejemplo, nada se guarda de verdad.</div>';
  const zona = document.createElement('div');
  cont.append(zona);
  main.append(cont);
  window.scrollTo(0, 0);
  try { await fn(zona, partes.slice(1), params); } catch (e) { zona.innerHTML = vacio('fallo', 'Algo ha fallado', esc(e.message)); fallo(e); }
  const t = $('h1', zona);
  document.title = t ? `${t.textContent} · Narrarr` : 'Narrarr';
}
window.addEventListener('hashchange', navegar);

const vacio = (icono, titulo, texto, extra = '') => `<div class="vacio">${ico(icono)}<h2>${titulo}</h2><p>${texto}</p>${extra}</div>`;
const skRejilla = (n = 12) => `<div class="rejilla">${Array.from({ length: n }, () => '<div><div class="sk" style="aspect-ratio:1;border-radius:12px"></div><div class="sk sk-linea" style="width:80%"></div><div class="sk sk-linea" style="width:50%"></div></div>').join('')}</div>`;
const skLineas = (n = 5) => Array.from({ length: n }, () => '<div class="sk" style="height:54px;margin-bottom:10px"></div>').join('');
const insignia = (estado, prog) => `<span class="insignia ${esc(estado)}">${esc(ESTADOS[estado] || ESTADOS_DESC[estado] || estado)}${estado === 'descargando' && prog != null ? ` ${Math.round(prog * 100)} %` : ''}</span>`;
const imgPortada = (src, alt = '') => `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`;
const serieTxt = (s, pos) => (s ? `${esc(s)}${pos ? `, libro ${esc(pos)}` : ''}` : '');

/* ---------- Biblioteca ---------- */
vistas.biblioteca = async (el) => {
  const estado = { filtro: guardado('filtro', ''), q: '', orden: guardado('orden', 'titulo'), vista: guardado('vista', 'rejilla') };
  el.innerHTML = `<div class="cabecera"><h1>Biblioteca</h1><span class="sub" id="contador"></span><span class="espacio"></span>
      <a class="btn prim" href="#/añadir">${ico('anadir')} Añadir</a></div>
    <div class="barra">
      <div class="buscar">${ico('buscar')}<input type="search" id="bq" placeholder="Buscar por título, autor, narrador…" aria-label="Buscar en la biblioteca"></div>
      <div class="segmentos" role="group" aria-label="Filtrar por estado" id="filtros">
        ${[['', 'Todos'], ...Object.entries(ESTADOS)].map(([k, v]) => `<button type="button" data-f="${k}" aria-pressed="${estado.filtro === k}">${v}</button>`).join('')}
      </div>
      <select id="orden" aria-label="Ordenar por">
        <option value="titulo">Título</option><option value="autor">Autor</option><option value="añadido">Añadido recientemente</option><option value="duracion">Duración</option>
      </select>
      <div class="segmentos" role="group" aria-label="Vista">
        <button type="button" data-v="rejilla" aria-pressed="${estado.vista === 'rejilla'}" aria-label="Vista en rejilla">${ico('rejilla')}</button>
        <button type="button" data-v="lista" aria-pressed="${estado.vista === 'lista'}" aria-label="Vista en lista">${ico('lista')}</button>
      </div>
    </div><div id="contenido">${skRejilla()}</div>`;
  $('#orden', el).value = estado.orden;
  let libros = [];
  try {
    libros = (await api(`/libros?orden=${encodeURIComponent(estado.orden)}`)) || [];
  } catch (e) { $('#contenido', el).innerHTML = vacio('fallo', 'No he podido cargar la biblioteca', esc(e.message)); fallo(e); return; }

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pintar = () => {
    let l = libros.filter((x) => !estado.filtro || x.estado === estado.filtro || (estado.filtro === 'deseado' && x.estado === 'buscando'));
    if (estado.q) { const q = norm(estado.q); l = l.filter((x) => norm(`${x.titulo} ${x.subtitulo} ${x.autor} ${x.narrador} ${x.serie}`).includes(q)); }
    const cmp = {
      titulo: (a, b) => norm(a.titulo).localeCompare(norm(b.titulo), 'es'),
      autor: (a, b) => norm(a.autor).localeCompare(norm(b.autor), 'es') || (a.serie_pos || 0) - (b.serie_pos || 0),
      'añadido': (a, b) => String(b['añadido'] || '').localeCompare(String(a['añadido'] || '')),
      duracion: (a, b) => (b.duracion_min || 0) - (a.duracion_min || 0),
    }[estado.orden];
    l.sort(cmp);
    $('#contador', el).textContent = `${nf.format(l.length)} de ${nf.format(libros.length)} audiolibros`;
    const c = $('#contenido', el);
    if (!libros.length) {
      c.innerHTML = vacio('auriculares', 'Tu biblioteca está vacía', 'Busca un título en Audible y Narrarr se encarga de encontrarlo y descargarlo.', `<a class="btn prim" href="#/añadir">${ico('anadir')} Añadir tu primer audiolibro</a>`);
      return;
    }
    if (!l.length) { c.innerHTML = vacio('buscar', 'Nada por aquí', 'Ningún audiolibro coincide con la búsqueda o el filtro.'); return; }
    if (estado.vista === 'lista') {
      c.innerHTML = `<div class="tabla-envolt"><table><thead><tr><th><span class="ocultar-movil">Portada</span></th><th>Título</th><th class="ocultar-movil">Autor</th><th class="ocultar-movil">Narrador</th><th class="ocultar-movil num">Duración</th><th class="ocultar-movil num">Tamaño</th><th>Estado</th></tr></thead><tbody>
        ${l.map((x) => `<tr><td><img class="mini-portada" src="${esc(portadaUrl(x.id))}" alt="" loading="lazy"></td>
          <td><a href="#/libro/${x.id}"><b>${esc(x.titulo)}</b></a>${x.serie ? `<div class="texto3 peq">${serieTxt(x.serie, x.serie_pos)}</div>` : ''}</td>
          <td class="ocultar-movil">${esc(x.autor)}</td><td class="ocultar-movil">${esc(x.narrador)}</td>
          <td class="ocultar-movil num">${duracion(x.duracion_min)}</td><td class="ocultar-movil num">${x.tamano ? tamano(x.tamano) : '—'}</td>
          <td>${insignia(x.estado, x.progreso)}</td></tr>`).join('')}</tbody></table></div>`;
    } else {
      c.innerHTML = `<div class="rejilla">${l.map((x) => `<a class="libro" href="#/libro/${x.id}" aria-label="${esc(x.titulo)} de ${esc(x.autor)}, ${esc(ESTADOS[x.estado] || x.estado)}">
        <div class="portada">${imgPortada(portadaUrl(x.id))}${insignia(x.estado, x.progreso)}${x.estado === 'descargando' && x.progreso != null ? `<div class="barra-prog"><i style="width:${Math.round(x.progreso * 100)}%"></i></div>` : ''}</div>
        <div class="titulo">${esc(x.titulo)}</div><div class="autor">${esc(x.autor)}</div></a>`).join('')}</div>`;
    }
  };
  pintar();
  $('#bq', el).addEventListener('input', (e) => { estado.q = e.target.value; pintar(); });
  $('#filtros', el).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    estado.filtro = b.dataset.f; guardar('filtro', estado.filtro);
    $$('#filtros button', el).forEach((x) => x.setAttribute('aria-pressed', x === b));
    pintar();
  });
  $('#orden', el).addEventListener('change', (e) => { estado.orden = e.target.value; guardar('orden', estado.orden); pintar(); });
  $$('[data-v]', el).forEach((b) => b.addEventListener('click', () => {
    estado.vista = b.dataset.v; guardar('vista', estado.vista);
    $$('[data-v]', el).forEach((x) => x.setAttribute('aria-pressed', x === b));
    pintar();
  }));
};

/* ---------- Ficha de libro ---------- */
vistas.libro = async (el, [id]) => {
  el.innerHTML = `<div class="ficha-cab"><div class="ficha-cont"><div class="portada sk" style="width:240px"></div><div class="ficha-info"><div class="sk" style="height:34px;width:60%"></div><div class="sk sk-linea" style="width:40%"></div><div class="sk sk-linea" style="width:70%;margin-top:20px"></div><div class="sk sk-linea" style="width:65%"></div></div></div></div>`;
  let l;
  try { l = await api(`/libros/${id}`); } catch (e) { el.innerHTML = vacio('fallo', 'No encuentro este audiolibro', esc(e.message), '<a class="btn" href="#/biblioteca">Volver a la biblioteca</a>'); return; }
  const src = portadaUrl(l.id);
  const autorEnlace = async () => {
    try {
      const autores = await api('/autores');
      const a = (autores || []).find((x) => (x.nombre || '').toLowerCase() === (l.autor || '').toLowerCase());
      if (a) $('#autorLink', el).href = `#/autor/${a.id}`;
    } catch { /* nada */ }
  };
  el.innerHTML = `<div class="ficha-cab"><div class="fondo-borroso" style="background-image:url('${esc(src)}')"></div>
    <div class="ficha-cont"><div class="portada">${imgPortada(src, 'Portada de ' + l.titulo)}</div>
    <div class="ficha-info">
      ${insignia(l.estado, l.progreso)}
      <h1>${esc(l.titulo)}</h1>
      ${l.subtitulo ? `<div class="subt">${esc(l.subtitulo)}</div>` : ''}
      <div>de <a id="autorLink" href="#/autor-audible?nombre=${encodeURIComponent((l.autor || '').split(',')[0].trim())}">${esc(l.autor || 'Autor desconocido')}</a>${l.narrador ? ` · narrado por <b>${esc(l.narrador)}</b>` : ''}</div>
      <div class="datos">
        ${l.serie ? `<span>${ico('biblioteca')} <b>${serieTxt(l.serie, l.serie_pos)}</b></span>` : ''}
        ${l.duracion_min ? `<span>${ico('reloj')} <b>${duracion(l.duracion_min)}</b></span>` : ''}
        ${l.anio ? `<span>Año <b>${esc(l.anio)}</b></span>` : ''}
        ${l.idioma ? `<span>${ico('idioma')} <b>${esc(({spanish:"Castellano",english:"Inglés",catalan:"Catalán",french:"Francés",german:"Alemán",italian:"Italiano",portuguese:"Portugués"})[String(l.idioma).toLowerCase()] || l.idioma)}</b></span>` : ''}
        ${l.tamano ? `<span>${ico('carpeta')} <b>${tamano(l.tamano)}</b></span>` : ''}
        ${l.ultima_busqueda ? `<span>Última búsqueda <b title="${esc(fechaTitulo(l.ultima_busqueda))}">${relativa(l.ultima_busqueda)}</b></span>` : ''}
      </div>
      <div id="seguimiento"></div>
      ${l.sinopsis ? `<div class="sinopsis plegada" id="sinopsis">${esc(l.sinopsis)}</div><button class="enlace-btn" id="masSinopsis" aria-expanded="false" aria-controls="sinopsis">Leer más</button>` : ''}
      <div class="acciones">
        <button class="btn prim" id="bAuto">${ico('buscar')} Buscar automáticamente</button>
        <button class="btn" id="bInter">${ico('lista')} Búsqueda interactiva</button>
        <button class="btn" id="bEditar">${ico('editar')} Editar</button>
        <button class="btn peligro" id="bBorrar">${ico('borrar')} Borrar</button>
      </div>
    </div></div></div>
    <div class="pestanas" role="tablist">
      <button role="tab" aria-selected="true" data-p="archivos" id="tabArch">Archivos</button>
      <button role="tab" aria-selected="false" data-p="historial" id="tabHist">Historial</button>
    </div><div id="panelP" role="tabpanel"></div>`;
  autorEnlace();
  // Seguimiento en vivo: Añadido → Buscado → Descargando → Importado (se refresca cada 5 s hasta terminar)
  const seguimiento = (x) => {
    const zona = $('#seguimiento', el);
    if (!zona) return;
    if (x.estado === 'descargado' && !(x.descargas || []).some((d) => d.estado !== 'importada')) { zona.innerHTML = ''; return; }
    const d = (x.descargas || [])[0];
    const pct = d ? Math.round(d.progreso || 0) : 0;   // el backend guarda 0..100
    const paso = (hecho, activo, titulo, detalle) => `<li class="paso ${hecho ? 'hecho' : ''} ${activo ? 'activo' : ''}"><span class="punto"></span><div><b>${titulo}</b>${detalle ? `<div class="texto3 peq">${detalle}</div>` : ''}</div></li>`;
    const buscado = !!x.ultima_busqueda, capturado = !!d, completo = d && ['completada', 'importada'].includes(d.estado), importado = x.estado === 'descargado';
    zona.innerHTML = `<ol class="seguimiento">
      ${paso(true, false, 'Añadido', x['añadido'] ? relativa(x['añadido']) : '')}
      ${paso(buscado, !buscado, 'Buscado', buscado ? `hace ${relativa(x.ultima_busqueda).replace(/^hace /, '')}${capturado ? '' : ' · sin lanzamiento válido todavía; se reintenta solo'}` : 'esperando turno del planificador')}
      ${paso(capturado, capturado && !completo, 'Descargando', capturado ? `${esc(d.titulo_release || '')}<div class="barra-prog"><span style="width:${completo ? 100 : pct}%"></span></div>${completo ? '100 %' : pct + ' %'}${d.error ? ` · <span class="motivo-rech">${esc(d.error)}</span>` : ''}` : '')}
      ${paso(importado, completo && !importado, 'Importado', importado ? 'en tu biblioteca' : (completo ? 'importando…' : ''))}
    </ol>`;
  };
  seguimiento(l);
  if (!['descargado', 'ignorado'].includes(l.estado)) {
    const t = setInterval(async () => {
      try { const x = await api(`/libros/${l.id}`); seguimiento(x); if (x.estado !== l.estado) { clearInterval(t); navegar(); } } catch { /* nada */ }
    }, 5000);
    limpiar.push(() => clearInterval(t));
  }
  const sin = $('#masSinopsis', el);
  if (sin) {
    const s = $('#sinopsis', el);
    if (s.scrollHeight <= s.clientHeight + 2) sin.hidden = true;
    sin.onclick = () => { const p = s.classList.toggle('plegada'); sin.textContent = p ? 'Leer más' : 'Leer menos'; sin.setAttribute('aria-expanded', !p); };
  }
  const pestana = (p) => {
    $$('.pestanas button', el).forEach((b) => b.setAttribute('aria-selected', b.dataset.p === p));
    const panel = $('#panelP', el);
    if (p === 'archivos') {
      const arch = l.archivos || [];
      const desc = l.descargas || [];
      panel.innerHTML = `${l.ruta ? `<p class="texto3 peq">${ico('carpeta')} <code>${esc(l.ruta)}</code></p>` : ''}
        ${arch.length ? `<div class="tabla-envolt"><table><thead><tr><th>Archivo</th><th class="num">Duración</th><th class="num">Tamaño</th></tr></thead><tbody>
          ${arch.map((a) => { const n = typeof a === 'string' ? a : (a.nombre || a.ruta); return `<tr><td class="trunc" title="${esc(n)}">${esc(n)}</td><td class="num">${duracion(a.duracion_min)}</td><td class="num">${a.tamano ? tamano(a.tamano) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`
          : vacio('carpeta', 'Aún no hay archivos', l.estado === 'descargado' ? 'Escanea la biblioteca para ver los archivos.' : 'Cuando se descargue e importe, aparecerán aquí.')}
        ${desc.length ? `<h3 style="margin-top:22px">Descargas</h3><div class="tabla-envolt"><table><thead><tr><th>Lanzamiento</th><th>Estado</th><th class="num">Tamaño</th><th class="ocultar-movil">Añadida</th></tr></thead><tbody>
          ${desc.map((d) => `<tr><td class="trunc" title="${esc(d.titulo_release)}">${esc(d.titulo_release)}<div class="texto3 peq">${esc(d.indexador || '')}${d.error ? ` · <span class="motivo-rech">${esc(d.error)}</span>` : ''}</div></td><td>${insignia(d.estado)}</td><td class="num">${tamano(d.tamano)}</td><td class="ocultar-movil" title="${esc(fechaTitulo(d['añadido']))}">${relativa(d['añadido'])}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    } else {
      const h = l.historial || [];
      panel.innerHTML = h.length ? `<div class="panel">${h.map(itemHistorial).join('')}</div>` : vacio('reloj', 'Sin historial', 'Aquí verás búsquedas, capturas e importaciones de este libro.');
    }
  };
  $$('.pestanas button', el).forEach((b) => b.addEventListener('click', () => pestana(b.dataset.p)));
  pestana('archivos');

  $('#bAuto', el).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="cargando"></span> Buscando…';
    try {
      const r = await api('/lanzamientos?libro_id=' + l.id);
      const mejor = (r || []).find((x) => !x.rechazado);
      if (!mejor) { toast('No he encontrado ningún lanzamiento que valga la pena', 'error'); }
      else {
        await api('/lanzamientos/capturar', { method: 'POST', body: { libro_id: l.id, guid: mejor.guid, indexador_id: mejor.indexador_id, url_descarga: mejor.url_descarga, titulo: mejor.titulo } });
        toast(`Capturado: ${mejor.titulo}`);
        navegar();
        return;
      }
    } catch (err) { fallo(err); }
    b.disabled = false; b.innerHTML = `${ico('buscar')} Buscar automáticamente`;
  };
  $('#bInter', el).onclick = () => busquedaInteractiva(l);
  $('#bEditar', el).onclick = () => editarLibro(l);
  $('#bBorrar', el).onclick = async () => {
    const r = await confirmar({ titulo: 'Borrar audiolibro', texto: `¿Quitar <b>${esc(l.titulo)}</b> de Narrarr?`, boton: 'Borrar', casilla: 'Borrar también los archivos del disco' });
    if (!r) return;
    try {
      await api(`/libros/${l.id}?borrar_archivos=${r.casilla}`, { method: 'DELETE' });
      toast(r.casilla ? 'Audiolibro y archivos borrados' : 'Audiolibro quitado de la biblioteca');
      location.hash = '#/biblioteca';
    } catch (e) { fallo(e); }
  };
};

async function busquedaInteractiva(l) {
  const f = abrirModal({ titulo: `Búsqueda interactiva · ${esc(l.titulo)}`, ancho: true, cuerpo: `<p class="texto3 peq">Buscando en Prowlarr… puede tardar unos segundos.</p>${skLineas(5)}` });
  let r;
  try { r = (await api('/lanzamientos?libro_id=' + l.id)) || []; } catch (e) { if (!f.hidden) $('.modal-cuerpo', f).innerHTML = vacio('fallo', 'La búsqueda ha fallado', esc(e.message)); return; }
  if (f.hidden) return;
  if (!r.length) { $('.modal-cuerpo', f).innerHTML = vacio('buscar', 'Sin resultados', 'Ningún indexador ha devuelto lanzamientos para este libro.'); return; }
  $('.modal-cuerpo', f).innerHTML = `<p class="texto3 peq">${nf.format(r.length)} lanzamientos, ${nf.format(r.filter((x) => !x.rechazado).length)} válidos. Pasa el ratón por la puntuación para ver los motivos.</p>
    <div class="tabla-envolt"><table><thead><tr><th>Título</th><th class="ocultar-movil">Indexador</th><th class="num">Tamaño</th><th class="num">Semillas</th><th class="ocultar-movil">Formato</th><th class="num">Puntuación</th><th><span class="ocultar-movil">Capturar</span></th></tr></thead><tbody>
    ${r.map((x, i) => {
      const mot = (x.motivos || []).join('\n');
      const rech = x.rechazado ? (x.motivos || []).filter((m) => /rechaz/i.test(m)).join(' · ') || (x.motivos || []).filter((m) => /^[−-]/.test(m)).join(' · ') || 'Rechazado' : '';
      return `<tr class="${x.rechazado ? 'rechazado' : ''}"><td style="min-width:200px"><div style="word-break:break-word">${esc(x.titulo)}</div>${rech ? `<div class="motivo-rech">${esc(rech)}</div>` : ''}${x.fecha ? `<div class="texto3 peq">${relativa(x.fecha)}</div>` : ''}</td>
        <td class="ocultar-movil">${esc(x.indexador)}</td><td class="num">${tamano(x.tamano)}</td><td class="num">${nf.format(x.semillas ?? 0)}</td>
        <td class="ocultar-movil">${esc((x.formato || '').toUpperCase())}</td>
        <td class="num"><span class="puntos ${x.puntuacion >= 0 ? 'pos' : 'neg'}" title="${esc(mot)}" tabindex="0" aria-label="Puntuación ${x.puntuacion}. ${esc(mot)}">${nf.format(x.puntuacion ?? 0)}</span></td>
        <td><button class="btn peq ${x.rechazado ? '' : 'prim'}" data-i="${i}" aria-label="Capturar ${esc(x.titulo)}">${ico('descargar')}</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
  $$('[data-i]', f).forEach((b) => b.addEventListener('click', async () => {
    const x = r[+b.dataset.i];
    if (x.rechazado) {
      const ok = await confirmar({ titulo: 'Lanzamiento rechazado', texto: 'Este lanzamiento no cumple los criterios. ¿Quieres capturarlo igualmente?', boton: 'Capturar igualmente', peligro: false });
      if (!ok) return;
    }
    b.disabled = true; b.innerHTML = '<span class="cargando"></span>';
    try {
      await api('/lanzamientos/capturar', { method: 'POST', body: { libro_id: l.id, guid: x.guid, indexador_id: x.indexador_id, url_descarga: x.url_descarga, titulo: x.titulo } });
      toast('Enviado a qBittorrent');
      cerrarModal(); navegar();
    } catch (e) { fallo(e); b.disabled = false; b.innerHTML = ico('descargar'); }
  }));
}

function editarLibro(l) {
  const campos = [['titulo', 'Título'], ['subtitulo', 'Subtítulo'], ['autor', 'Autor'], ['narrador', 'Narrador'], ['serie', 'Serie'], ['serie_pos', 'Número en la serie', 'number'], ['anio', 'Año', 'number'], ['duracion_min', 'Duración (minutos)', 'number'], ['idioma', 'Idioma'], ['asin', 'ASIN']];
  const f = abrirModal({
    titulo: 'Editar audiolibro',
    cuerpo: `<form id="fEditar"><div class="rejilla-campos">${campos.map(([k, t, tipo]) => `<div class="campo"><label for="e_${k}">${t}</label><input id="e_${k}" name="${k}" type="${tipo || 'text'}" ${tipo === 'number' ? 'step="any"' : ''} value="${esc(l[k] ?? '')}"></div>`).join('')}
      <div class="campo"><label for="e_estado">Estado</label><select id="e_estado" name="estado">${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${l.estado === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
      <div class="campo"><label for="e_sinopsis">Sinopsis</label><textarea id="e_sinopsis" name="sinopsis" rows="5">${esc(l.sinopsis || '')}</textarea></div></form>`,
    pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="eGuardar">Guardar</button>',
  });
  $('#eGuardar', f).onclick = async () => {
    const datos = {};
    new FormData($('#fEditar', f)).forEach((v, k) => {
      const num = ['serie_pos', 'anio', 'duracion_min'].includes(k);
      const nv = num ? (v === '' ? null : Number(v)) : v;
      if ((l[k] ?? (num ? null : '')) !== nv) datos[k] = nv;
    });
    if (!Object.keys(datos).length) { cerrarModal(); return; }
    try { await api(`/libros/${l.id}`, { method: 'PATCH', body: datos }); toast('Cambios guardados'); cerrarModal(); navegar(); } catch (e) { fallo(e); }
  };
}

/* ---------- Añadir ---------- */
function tarjetaResultado(r, i) {
  const autores = (r.autores || []).join(', ');
  const narr = (r.narradores || []).join(', ');
  return `<article class="res"><div class="portada">${r.portada ? imgPortada(r.portada, 'Portada de ' + r.titulo) : `<div class="avatar" style="width:100%;height:100%;border-radius:0">${esc(iniciales(r.titulo))}</div>`}</div>
    <div class="res-info"><h3>${esc(r.titulo)}</h3>${r.subtitulo ? `<div class="meta">${esc(r.subtitulo)}</div>` : ''}
      <div class="meta">de ${(r.autores || []).length ? r.autores.map((a) => `<a class="enlace-autor" href="#/autor-audible?nombre=${encodeURIComponent(a)}" title="Ver todo lo de ${esc(a)}">${esc(a)}</a>`).join(', ') : '<b style="color:var(--texto2)">Autor desconocido</b>'}</div>
      ${narr ? `<div class="meta">Narrado por ${esc(narr)}</div>` : ''}
      <div class="chips">${r.duracion_min ? `<span class="chip">${duracion(r.duracion_min)}</span>` : ''}${r.serie ? `<span class="chip">${serieTxt(r.serie, r.serie_pos)}</span>` : ''}${r.anio ? `<span class="chip">${esc(r.anio)}</span>` : ''}</div>
      <div class="acciones">${r.en_biblioteca ? `<span class="ya-tienes">${ico('ok')} Ya lo tienes</span>`
        : `<button class="btn peq" data-add="${i}">${ico('anadir')} Añadir</button><button class="btn peq prim" data-add="${i}" data-buscar="1">${ico('buscar')} Añadir y buscar</button>`}</div>
    </div></article>`;
}
function enlazarAnadir(cont, lista) {
  $$('[data-add]', cont).forEach((b) => b.addEventListener('click', async () => {
    const r = lista[+b.dataset.add];
    const buscar = !!b.dataset.buscar;
    const zona = b.parentElement;
    $$('button', zona).forEach((x) => (x.disabled = true));
    try {
      const n = await api('/libros', { method: 'POST', body: { asin: r.asin, buscar_ya: buscar } });
      r.en_biblioteca = true;
      zona.innerHTML = `<span class="ya-tienes">${ico('ok')} ${buscar ? 'Añadido · buscando' : 'Añadido a deseados'}</span>${n && n.id ? ` <a class="btn peq" href="#/libro/${n.id}">Ver progreso →</a>` : ''}`;
      toast(buscar ? `«${r.titulo}» añadido; ya lo estoy buscando` : `«${r.titulo}» añadido a deseados`);
    } catch (e) { fallo(e); $$('button', zona).forEach((x) => (x.disabled = false)); }
  }));
}
vistas['añadir'] = async (el, _p, params) => {
  const q0 = params.get('q') || '';
  el.innerHTML = `<div class="cabecera"><h1>Añadir audiolibro</h1><span class="espacio"></span><button class="btn" id="aMano">${ico('editar')} Añadir a mano</button></div>
    <div class="buscador-grande">${ico('buscar')}<input type="search" id="aq" placeholder="Título, autor o ASIN de Audible…" aria-label="Buscar en Audible" value="${esc(q0)}" autocomplete="off"></div>
    <div id="aRes" aria-live="polite"></div>`;
  const res = $('#aRes', el);
  const inicial = () => { res.innerHTML = vacio('auriculares', 'Busca en Audible España', 'Escribe un título o un autor y elige qué quieres escuchar. Si ya lo tienes, te lo diré.'); };
  let turno = 0;
  const buscar = async (q) => {
    q = q.trim();
    history.replaceState(null, '', location.pathname + location.search + '#/añadir' + (q ? '?q=' + encodeURIComponent(q) : ''));
    if (q.length < 2) { inicial(); return; }
    const mio = ++turno;
    res.innerHTML = `<div class="resultados">${Array.from({ length: 4 }, () => '<div class="res"><div class="sk" style="width:110px;aspect-ratio:1"></div><div style="flex:1"><div class="sk" style="height:18px;width:70%"></div><div class="sk sk-linea" style="width:50%"></div><div class="sk sk-linea" style="width:40%"></div></div></div>').join('')}</div>`;
    try {
      const lista = (await api('/metadatos/buscar?q=' + encodeURIComponent(q))) || [];
      if (mio !== turno) return;
      if (!lista.length) { res.innerHTML = vacio('buscar', 'Sin resultados', `No encuentro nada para «${esc(q)}». Prueba con otras palabras o añádelo a mano.`); return; }
      res.innerHTML = `<div class="resultados">${lista.map(tarjetaResultado).join('')}</div>`;
      enlazarAnadir(res, lista);
    } catch (e) { if (mio === turno) { res.innerHTML = vacio('fallo', 'La búsqueda ha fallado', esc(e.message)); } }
  };
  const db = debounce(buscar, 400);
  $('#aq', el).addEventListener('input', (e) => db(e.target.value));
  $('#aq', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(e.target.value); });
  if (q0) buscar(q0); else inicial();
  setTimeout(() => $('#aq', el).focus(), 50);
  $('#aMano', el).onclick = () => {
    const f = abrirModal({
      titulo: 'Añadir a mano',
      cuerpo: `<p class="texto3 peq">Para libros que no están en Audible. Se añadirá como deseado.</p><form id="fMano">
        <div class="campo"><label for="mTit">Título</label><input id="mTit" required></div>
        <div class="campo"><label for="mAut">Autor</label><input id="mAut" required></div>
        <label class="casilla"><input type="checkbox" id="mBus"> Buscarlo ya</label></form>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="mOk">Añadir</button>',
    });
    $('#mOk', f).onclick = async () => {
      const titulo = $('#mTit', f).value.trim(), autor = $('#mAut', f).value.trim();
      if (!titulo || !autor) { toast('Pon al menos el título y el autor', 'error'); return; }
      try {
        const n = await api('/libros', { method: 'POST', body: { titulo, autor, buscar_ya: $('#mBus', f).checked } });
        toast(`«${titulo}» añadido`); cerrarModal();
        if (n && n.id) location.hash = `#/libro/${n.id}`;
      } catch (e) { fallo(e); }
    };
  };
};

/* ---------- Autor desde Audible (al pinchar un autor en Añadir) ---------- */
vistas['autor-audible'] = async (el, _p, params) => {
  const nombre = params.get('nombre') || '';
  el.innerHTML = `<div class="cabecera"><h1>${esc(nombre)}</h1></div>${skLineas(4)}`;
  let d;
  try { d = await api('/metadatos/autor?nombre=' + encodeURIComponent(nombre)); } catch (e) { el.innerHTML = vacio('fallo', 'No he podido leer este autor', esc(e.message)); return; }
  const libros = d.libros || [];
  const faltan = () => libros.filter((x) => !x.en_biblioteca);
  const pintar = () => {
    el.innerHTML = `<div class="cabecera">${avatar({ nombre })}<div><h1>${esc(nombre)}</h1>
        <div class="texto3 peq">${nf.format(libros.length)} audiolibros en castellano en Audible · ${nf.format(libros.length - faltan().length)} en tu biblioteca</div></div>
        <span class="espacio"></span>
        <label class="casilla" title="Añade solo sus libros nuevos como deseados"><input type="checkbox" id="aaVig" ${d.vigilado ? 'checked' : ''}> Vigilar novedades</label>
        <button class="btn prim" id="aaTodos" ${faltan().length ? '' : 'disabled'}>${ico('anadir')} Añadir los ${nf.format(faltan().length)} que faltan</button></div>
      ${libros.length ? `<div class="resultados">${libros.map(tarjetaResultado).join('')}</div>` : vacio('autores', 'Sin libros', 'Audible no tiene audiolibros en castellano de este autor.')}`;
    enlazarAnadir(el, libros);
    $('#aaVig', el).onchange = async (e) => {
      try {
        let id = d.autor_id;
        if (!id) { const a = await api('/autores', { method: 'POST', body: { nombre } }); id = d.autor_id = a && a.id; }
        await api(`/autores/${id}`, { method: 'PATCH', body: { vigilado: e.target.checked } });
        d.vigilado = e.target.checked;
        toast(e.target.checked ? `Vigilando a ${nombre}: sus novedades se añadirán solas` : `Ya no vigilas a ${nombre}`);
      } catch (err) { fallo(err); e.target.checked = !e.target.checked; }
    };
    $('#aaTodos', el).onclick = async (e) => {
      const lista = faltan();
      const ok = await confirmar({ titulo: 'Añadir todos', texto: `Se añadirán <b>${lista.length}</b> libros de ${esc(nombre)} como <b>deseados</b>. Se irán buscando poco a poco (como mucho 5 cada 6 horas) para no saturar el tracker.`, boton: 'Añadir todos', peligro: false });
      if (!ok) return;
      e.currentTarget.disabled = true;
      let n = 0;
      for (const x of lista) {
        try { await api('/libros', { method: 'POST', body: { asin: x.asin, buscar_ya: false } }); x.en_biblioteca = true; n++; } catch { /* ya estaba u otro fallo: seguimos */ }
      }
      toast(`${n} libros de ${nombre} añadidos a deseados`);
      pintar();
    };
  };
  pintar();
};

/* ---------- Autores ---------- */
const avatar =(a, grande = false) => `<div class="avatar${grande ? ' grande' : ''}" aria-hidden="true">${a.foto_url ? `<img src="${esc(a.foto_url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}${a.foto_url ? '' : esc(iniciales(a.nombre))}</div>`;
vistas.autores = async (el) => {
  el.innerHTML = `<div class="cabecera"><h1>Autores</h1><span class="sub" id="contA"></span><span class="espacio"></span><button class="btn prim" id="nuevoA">${ico('anadir')} Añadir autor</button></div>
    <div class="barra"><div class="buscar">${ico('buscar')}<input type="search" id="fa" placeholder="Filtrar autores…" aria-label="Filtrar autores"></div></div>
    <div id="lA">${skRejilla(8)}</div>`;
  let lista;
  try { lista = (await api('/autores')) || []; } catch (e) { $('#lA', el).innerHTML = vacio('fallo', 'No he podido cargar los autores', esc(e.message)); return; }
  const pintar = (q = '') => {
    const l = lista.filter((a) => a.nombre.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    $('#contA', el).textContent = `${nf.format(lista.length)} autores`;
    $('#lA', el).innerHTML = !lista.length ? vacio('autores', 'Aún no sigues a ningún autor', 'Añade un autor para ver todos sus audiolibros y, si quieres, vigilar sus novedades.')
      : !l.length ? vacio('buscar', 'Nadie con ese nombre', 'Prueba con otra búsqueda.')
      : `<div class="rejilla">${l.map((a) => `<a class="autor-tarj" href="#/autor/${a.id}">${avatar(a)}<b>${esc(a.nombre)}</b>
          ${(a.libros_total ?? (typeof a.libros === "number" ? a.libros : null)) != null ? `<span class="texto3 peq">${nf.format(a.libros_total ?? a.libros)} en tu biblioteca</span>` : ''}${a.vigilado ? `<span class="vigilado">${ico('campana', 'ico')} Vigilado</span>` : ''}</a>`).join('')}</div>`;
  };
  pintar();
  $('#fa', el).addEventListener('input', (e) => pintar(e.target.value));
  $('#nuevoA', el).onclick = () => {
    const f = abrirModal({ titulo: 'Añadir autor', cuerpo: '<div class="campo"><label for="nA">Nombre del autor</label><input id="nA" placeholder="p. ej. Carlos Ruiz Zafón"></div>', pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="okA">Añadir</button>' });
    const ir = async () => {
      const nombre = $('#nA', f).value.trim(); if (!nombre) return;
      try { const a = await api('/autores', { method: 'POST', body: { nombre } }); toast(`${nombre} añadido`); cerrarModal(); if (a && a.id) location.hash = `#/autor/${a.id}`; else navegar(); } catch (e) { fallo(e); }
    };
    $('#okA', f).onclick = ir;
    $('#nA', f).addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(); });
  };
};
vistas.autor = async (el, [id]) => {
  el.innerHTML = `<div class="panel" style="display:flex;gap:20px;align-items:center"><div class="sk" style="width:150px;height:150px;border-radius:50%"></div><div style="flex:1"><div class="sk" style="height:30px;width:50%"></div></div></div>${skRejilla(6)}`;
  let a;
  try { a = await api(`/autores/${id}`); } catch (e) { el.innerHTML = vacio('fallo', 'No encuentro este autor', esc(e.message), '<a class="btn" href="#/autores">Volver</a>'); return; }
  const libros = a.catalogo || a.libros || [];
  const tiene = libros.filter((x) => x.en_biblioteca).length;
  el.innerHTML = `<div class="panel ficha-autor" style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">${avatar(a, true)}
      <div style="flex:1;min-width:200px"><h1 style="margin:0">${esc(a.nombre)}</h1>
      <p class="texto3">${nf.format(libros.length)} audiolibros en Audible · tienes ${nf.format(tiene)}</p>
      <label class="interruptor"><input type="checkbox" id="vig" ${a.vigilado ? 'checked' : ''}> <span><b>Vigilar</b> <span class="texto3 peq">— añadir como deseado cada libro nuevo en castellano</span></span></label></div>
      <button class="btn peligro" id="borrarA">${ico('borrar')} Quitar autor</button></div>
    <div class="resultados" id="lAut">${libros.length ? '' : ''}</div>`;
  const cont = $('#lAut', el);
  if (!libros.length) cont.outerHTML = vacio('biblioteca', 'No hay libros', 'No he encontrado audiolibros de este autor en Audible.');
  else {
    cont.innerHTML = libros.map((x, i) => {
      if (x.en_biblioteca && x.libro_id) {
        return tarjetaResultado({ ...x, en_biblioteca: false, portada: x.portada || portadaUrl(x.libro_id) }, i)
          .replace(/<div class="acciones">[\s\S]*<\/div>\s*<\/div><\/article>$/, `<div class="acciones"><span class="ya-tienes">${ico('ok')} Ya lo tienes</span><a class="btn peq" href="#/libro/${x.libro_id}">Ver ficha</a>${x.estado ? insignia(x.estado) : ''}</div></div></article>`);
      }
      return tarjetaResultado(x, i);
    }).join('');
    enlazarAnadir(cont, libros);
  }
  $('#vig', el).addEventListener('change', async (e) => {
    try { await api(`/autores/${a.id}`, { method: 'PATCH', body: { vigilado: e.target.checked } }); toast(e.target.checked ? `Vigilando a ${a.nombre}` : `Ya no vigilas a ${a.nombre}`); }
    catch (err) { e.target.checked = !e.target.checked; fallo(err); }
  });
  $('#borrarA', el).onclick = async () => {
    if (!(await confirmar({ titulo: 'Quitar autor', texto: `¿Quitar a <b>${esc(a.nombre)}</b>? Sus libros de la biblioteca no se tocan.`, boton: 'Quitar' }))) return;
    try { await api(`/autores/${a.id}`, { method: 'DELETE' }); toast('Autor quitado'); location.hash = '#/autores'; } catch (e) { fallo(e); }
  };
};

/* ---------- Deseados ---------- */
vistas.deseados = async (el) => {
  el.innerHTML = `<div class="cabecera"><h1>Deseados</h1><span class="sub" id="contD"></span><span class="espacio"></span>
    <button class="btn prim" id="todos">${ico('buscar')} Buscar todos</button></div>
    <p class="texto3 peq">Para no enfadar a los trackers privados, la búsqueda masiva va con freno: como mucho 5 libros por pasada y 30 s entre búsquedas.</p>
    <div id="lD">${skLineas(4)}</div>`;
  let lista;
  try { lista = ((await api('/libros')) || []).filter((x) => x.estado === 'deseado' || x.estado === 'buscando'); } catch (e) { $('#lD', el).innerHTML = vacio('fallo', 'No he podido cargar los deseados', esc(e.message)); return; }
  $('#contD', el).textContent = `${nf.format(lista.length)} pendientes`;
  if (!lista.length) { $('#lD', el).innerHTML = vacio('deseados', 'Nada pendiente', 'Todo lo que quieres ya está en tu biblioteca. ¡A escuchar!', `<a class="btn prim" href="#/añadir">${ico('anadir')} Añadir más</a>`); $('#todos', el).disabled = true; return; }
  $('#lD', el).innerHTML = `<div class="tabla-envolt"><table><thead><tr><th></th><th>Título</th><th class="ocultar-movil">Autor</th><th class="ocultar-movil">Añadido</th><th>Última búsqueda</th><th></th></tr></thead><tbody>
    ${lista.map((x) => `<tr><td><img class="mini-portada" src="${esc(portadaUrl(x.id))}" alt="" loading="lazy"></td>
      <td><a href="#/libro/${x.id}"><b>${esc(x.titulo)}</b></a> ${x.estado === 'buscando' ? insignia('buscando') : ''}</td>
      <td class="ocultar-movil">${esc(x.autor)}</td><td class="ocultar-movil" title="${esc(fechaTitulo(x['añadido']))}">${relativa(x['añadido'])}</td>
      <td title="${esc(fechaTitulo(x.ultima_busqueda))}">${relativa(x.ultima_busqueda)}</td>
      <td><button class="btn peq" data-b="${x.id}" aria-label="Buscar ${esc(x.titulo)}">${ico('buscar')}<span class="ocultar-movil">Buscar</span></button></td></tr>`).join('')}</tbody></table></div>`;
  $$('[data-b]', el).forEach((b) => b.addEventListener('click', () => {
    const l = lista.find((x) => x.id === +b.dataset.b);
    busquedaInteractiva(l);
  }));
  $('#todos', el).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { const r = await api('/tareas/buscar_deseados', { method: 'POST' }); toast((r && r.mensaje) || 'Búsqueda de deseados lanzada en segundo plano'); } catch (err) { fallo(err); }
    b.disabled = false;
  };
};

/* ---------- Actividad ---------- */
const ICO_HIST = { buscado: 'buscar', capturado: 'descargar', importado: 'importar', fallo: 'fallo', borrado: 'borrar' };
const TIPO_HIST = { buscado: 'Búsqueda', capturado: 'Capturado', importado: 'Importado', fallo: 'Fallo', borrado: 'Borrado' };
function itemHistorial(h) {
  return `<div class="hist-item"><div class="hist-ico t-${esc(h.tipo)}" title="${esc(TIPO_HIST[h.tipo] || h.tipo)}">${ico(ICO_HIST[h.tipo] || 'reloj')}</div>
    <div style="min-width:0;flex:1"><div><b>${esc(TIPO_HIST[h.tipo] || h.tipo)}</b>${h.libro_id ? ` · <a href="#/libro/${h.libro_id}">${esc(h.libro_titulo || 'ver libro')}</a>` : ''}</div>
    <div style="word-break:break-word">${esc(h.mensaje)}</div></div>
    <time class="fecha" datetime="${esc(h.fecha)}" title="${esc(fechaTitulo(h.fecha))}">${relativa(h.fecha)}</time></div>`;
}
vistas.actividad = async (el, [sub]) => {
  const tab = sub === 'historial' ? 'historial' : 'cola';
  el.innerHTML = `<div class="cabecera"><h1>Actividad</h1></div>
    <div class="pestanas" role="tablist"><button role="tab" data-t="cola" aria-selected="${tab === 'cola'}">Cola</button><button role="tab" data-t="historial" aria-selected="${tab === 'historial'}">Historial</button></div>
    <div id="pAct" role="tabpanel">${skLineas(4)}</div>`;
  $$('[data-t]', el).forEach((b) => b.addEventListener('click', () => { location.hash = '#/actividad/' + b.dataset.t; }));
  const p = $('#pAct', el);
  if (tab === 'historial') {
    try {
      const h = (await api('/historial?limite=100')) || [];
      p.innerHTML = h.length ? `<div class="panel">${h.map(itemHistorial).join('')}</div>` : vacio('reloj', 'Sin historial todavía', 'Aquí aparecerán búsquedas, capturas e importaciones.');
    } catch (e) { p.innerHTML = vacio('fallo', 'No he podido cargar el historial', esc(e.message)); }
    return;
  }
  let primera = true;
  const cargar = async () => {
    let d;
    try { d = (await api('/descargas')) || []; } catch (e) { if (primera) p.innerHTML = vacio('fallo', 'No he podido cargar la cola', esc(e.message)); return; }
    primera = false;
    const n = d.filter((x) => x.estado === 'en_cola' || x.estado === 'descargando').length;
    const cc = $('#cuentaCola'); cc.hidden = !n; cc.textContent = n;
    if (!d.length) { p.innerHTML = vacio('descargar', 'La cola está vacía', 'Cuando captures un lanzamiento, verás aquí cómo avanza.'); return; }
    p.innerHTML = `<div class="tabla-envolt"><table><thead><tr><th>Lanzamiento</th><th>Estado</th><th style="min-width:130px">Progreso</th><th class="num ocultar-movil">Tamaño</th><th class="ocultar-movil">Velocidad</th><th></th></tr></thead><tbody>
      ${d.map((x) => { const pr = Math.round((x.progreso || 0) * 100); return `<tr><td style="min-width:180px"><div style="word-break:break-word">${esc(x.titulo_release)}</div>
        <div class="texto3 peq">${x.libro_id ? `<a href="#/libro/${x.libro_id}">${esc(x.libro_titulo || 'ver libro')}</a> · ` : ''}${esc(x.indexador || '')} · ${relativa(x['añadido'])}</div>${x.error ? `<div class="motivo-rech">${esc(x.error)}</div>` : ''}</td>
        <td>${insignia(x.estado)}</td>
        <td><div class="prog" role="progressbar" aria-valuenow="${pr}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso"><i style="width:${pr}%"></i></div><div class="texto3 peq">${pr} %${x.eta ? ` · quedan ${duracion(Math.ceil(x.eta / 60))}` : ''}</div></td>
        <td class="num ocultar-movil">${tamano(x.tamano)}</td><td class="ocultar-movil">${velocidad(x.velocidad)}</td>
        <td style="white-space:nowrap">${x.estado === 'completada' || x.estado === 'fallida' ? `<button class="btn peq" data-imp="${x.id}" aria-label="Importar a mano" title="Importar a mano">${ico('importar')}</button>` : ''}
          <button class="btn peq peligro" data-quitar="${x.id}" aria-label="Quitar de la cola" title="Quitar">${ico('borrar')}</button></td></tr>`; }).join('')}</tbody></table></div>`;
    $$('[data-quitar]', p).forEach((b) => b.addEventListener('click', async () => {
      const r = await confirmar({ titulo: 'Quitar descarga', texto: '¿Quitar esta descarga de la cola?', boton: 'Quitar', casilla: 'Borrar también los datos descargados de qBittorrent' });
      if (!r) return;
      try { await api(`/descargas/${b.dataset.quitar}?borrar_datos=${r.casilla}`, { method: 'DELETE' }); toast('Descarga quitada'); cargar(); } catch (e) { fallo(e); }
    }));
    $$('[data-imp]', p).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { const r = await api(`/descargas/${b.dataset.imp}/importar`, { method: 'POST' }); toast((r && r.mensaje) || 'Importado'); cargar(); } catch (e) { fallo(e); b.disabled = false; }
    }));
  };
  await cargar();
  const t = setInterval(() => { if (!document.hidden && $('#modal').hidden) cargar(); }, 5000);
  alSalir(() => clearInterval(t));
};

/* ---------- Ajustes ---------- */
const SECCIONES = [
  { id: 'indexadores', titulo: 'Indexadores', ico: 'buscar', probar: ['prowlarr'], desc: 'Narrarr busca a través de Prowlarr (categorías 3030 Audio/Audiobook y 3000).', campos: [
    ['prowlarr_url', 'URL de Prowlarr', 'url', 'p. ej. http://192.168.1.25:9696'], ['prowlarr_key', 'Clave API de Prowlarr', 'clave'] ] },
  { id: 'cliente', titulo: 'Cliente de descargas', ico: 'descargar', probar: ['qbit'], desc: 'qBittorrent con la Web UI activada.', campos: [
    ['qbit_url', 'URL de qBittorrent', 'url', 'p. ej. http://192.168.1.25:8080'], ['qbit_usuario', 'Usuario', 'text'], ['qbit_clave', 'Contraseña', 'clave'],
    ['qbit_categoria', 'Categoría', 'text', 'Por defecto «audiolibros»'], ['qbit_ruta_remota', 'Ruta remota', 'text', 'Dónde guarda qBittorrent las descargas, vista desde qBit (se traduce a /descargas)'] ] },
  { id: 'biblioteca', titulo: 'Biblioteca', ico: 'carpeta', campos: [
    ['ruta_biblioteca', 'Carpeta de audiolibros', 'text', 'Dentro del contenedor, normalmente /audiolibros'], ['ruta_descargas', 'Carpeta de descargas', 'text', 'Normalmente /descargas'] ] },
  { id: 'metadatos', titulo: 'Metadatos', ico: 'idioma', campos: [['solo_castellano', 'Solo audiolibros en castellano', 'bool', 'Oculta en las búsquedas de Audible los libros en otros idiomas']] },
  { id: 'notificaciones', titulo: 'Notificaciones', ico: 'campana', probar: ['telegram', 'jellyfin', 'emby'], desc: 'Opcional: aviso por Telegram al importar y refresco de Jellyfin/Emby.', campos: [
    ['telegram_token', 'Token del bot de Telegram', 'clave'], ['telegram_chat', 'Chat de Telegram', 'text', 'ID numérico del chat o canal'],
    ['jellyfin_url', 'URL de Jellyfin', 'url'], ['jellyfin_key', 'Clave API de Jellyfin', 'clave'], ['emby_url', 'URL de Emby', 'url'], ['emby_key', 'Clave API de Emby', 'clave'] ] },
  { id: 'puntuacion', titulo: 'Puntuación', ico: 'estrella', desc: 'El castellano siempre manda: latino o inglés sin castellano se descarta.', campos: [
    ['captura_automatica', 'Capturar automáticamente', 'bool', 'Al buscar deseados, descarga el mejor lanzamiento que no esté rechazado'],
    ['puntuacion_minima', 'Puntuación mínima', 'number', 'Por debajo de esta puntuación no se captura solo'],
    ['puntos_m4b', 'Puntos por M4B', 'number'], ['puntos_mp3', 'Puntos por MP3', 'number'], ['puntos_flac', 'Puntos por FLAC', 'number'] ] },
  { id: 'programacion', titulo: 'Programación', ico: 'reloj', desc: 'Cada cuánto se ejecutan las tareas automáticas.', campos: [
    ['intervalo_buscar_deseados', 'Buscar deseados cada (minutos)', 'number'], ['intervalo_escanear_biblioteca', 'Escanear biblioteca cada (minutos)', 'number'],
    ['intervalo_vigilar_autores', 'Vigilar autores cada (minutos)', 'number'], ['intervalo_comprobar_descargas', 'Comprobar descargas cada (minutos)', 'number'],
    ['freno_max_libros', 'Máximo de libros por pasada', 'number', 'Freno anti-baneo de trackers privados'], ['freno_pausa_segundos', 'Pausa entre búsquedas (s)', 'number'],
    ['freno_horas_por_libro', 'Horas mínimas entre búsquedas del mismo libro', 'number'] ] },
];
const NOMBRE_SERV = { prowlarr: 'Prowlarr', qbit: 'qBittorrent', telegram: 'Telegram', jellyfin: 'Jellyfin', emby: 'Emby' };

vistas.ajustes = async (el) => {
  el.innerHTML = `<div class="cabecera"><h1>Ajustes</h1></div>${skLineas(6)}`;
  let aj;
  try { aj = (await api('/ajustes')) || {}; } catch (e) { el.innerHTML = vacio('fallo', 'No he podido cargar los ajustes', esc(e.message)); return; }
  const conocidas = new Set(SECCIONES.flatMap((s) => s.campos.map((c) => c[0])));
  const otras = Object.keys(aj).filter((k) => !conocidas.has(k) && typeof aj[k] !== 'object');
  const secciones = otras.length ? [...SECCIONES, { id: 'otros', titulo: 'Otros', ico: 'ajustes', campos: otras.map((k) => [k, k.replace(/_/g, ' '), typeof aj[k] === 'boolean' ? 'bool' : typeof aj[k] === 'number' ? 'number' : 'text']) }] : SECCIONES;
  const campo = ([k, t, tipo, ayuda]) => {
    const v = aj[k];
    if (tipo === 'bool') return `<div class="campo"><label class="interruptor"><input type="checkbox" name="${k}" ${v ? 'checked' : ''}> <span>${esc(t)}</span></label>${ayuda ? `<span class="ayuda">${esc(ayuda)}</span>` : ''}</div>`;
    const esClave = tipo === 'clave';
    const guardada = esClave && v === MASCARA;
    return `<div class="campo"><label for="aj_${k}">${esc(t)}</label>
      <input id="aj_${k}" name="${k}" type="${esClave ? 'password' : tipo === 'number' ? 'number' : tipo === 'url' ? 'url' : 'text'}" ${tipo === 'number' ? 'step="any"' : ''}
        value="${guardada ? '' : esc(v ?? '')}" ${guardada ? 'placeholder="•••• guardada (escribe para cambiarla)"' : ''} ${esClave ? 'autocomplete="new-password"' : 'autocomplete="off"'} data-tipo="${tipo}">
      ${ayuda ? `<span class="ayuda">${esc(ayuda)}</span>` : ''}</div>`;
  };
  el.innerHTML = `<div class="cabecera"><h1>Ajustes</h1><span class="sub">Los cambios se aplican al guardar</span></div>
    <form id="fAj" novalidate>${secciones.map((s) => `<section class="panel ajuste-sec" aria-labelledby="sec_${s.id}"><h2 id="sec_${s.id}">${ico(s.ico)} ${esc(s.titulo)}</h2>
      ${s.desc ? `<p class="texto3 peq" style="margin-top:-6px">${esc(s.desc)}</p>` : ''}<div class="rejilla-campos">${s.campos.map(campo).join('')}</div>
      ${s.probar ? `<div class="pie-sec">${s.probar.map((p) => `<button type="button" class="btn peq" data-probar="${p}">${ico('enlace')} Probar ${NOMBRE_SERV[p]}</button><span class="resultado" id="res_${p}" aria-live="polite"></span>`).join('')}</div>` : ''}
    </section>`).join('')}
    <div class="guardar-fijo"><button type="submit" class="btn prim" id="ajGuardar">${ico('ok')} Guardar cambios</button></div></form>`;
  const recoger = () => {
    const datos = {};
    $$('#fAj input', el).forEach((i) => {
      const k = i.name; if (!k) return;
      if (i.type === 'checkbox') { if (!!aj[k] !== i.checked) datos[k] = i.checked; return; }
      if (i.dataset.tipo === 'clave') { if (i.value !== '') datos[k] = i.value; return; }
      const v = i.dataset.tipo === 'number' ? (i.value === '' ? null : Number(i.value)) : i.value.trim();
      if ((aj[k] ?? (i.dataset.tipo === 'number' ? null : '')) !== v) datos[k] = v;
    });
    return datos;
  };
  $('#fAj', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = recoger();
    if (!Object.keys(datos).length) { toast('No hay cambios que guardar'); return; }
    const b = $('#ajGuardar', el); b.disabled = true;
    try { const r = await api('/ajustes', { method: 'PUT', body: datos }); aj = r && typeof r === 'object' && !r.ok ? r : { ...aj, ...datos }; toast('Ajustes guardados'); vistas.ajustes(el); }
    catch (err) { fallo(err); b.disabled = false; }
  });
  $$('[data-probar]', el).forEach((b) => b.addEventListener('click', async () => {
    const s = b.dataset.probar, out = $('#res_' + s, el);
    b.disabled = true; out.className = 'resultado'; out.innerHTML = '<span class="cargando"></span>';
    const pend = recoger();
    try {
      if (Object.keys(pend).length) { await api('/ajustes', { method: 'PUT', body: pend }); Object.assign(aj, pend); $$('#fAj input[data-tipo="clave"]', el).forEach((i) => { if (i.value) { aj[i.name] = MASCARA; i.value = ''; i.placeholder = '•••• guardada (escribe para cambiarla)'; } }); }
      const r = await api('/ajustes/probar/' + s, { method: 'POST' });
      out.className = 'resultado ' + (r && r.ok ? 'ok' : 'ko');
      out.textContent = `${r && r.ok ? '✓' : '✕'} ${(r && r.mensaje) || (r && r.ok ? 'Conexión correcta' : 'No conecta')}`;
    } catch (e) { out.className = 'resultado ko'; out.textContent = '✕ ' + e.message; }
    b.disabled = false;
  }));
};

/* ---------- Sistema ---------- */
vistas.sistema = async (el) => {
  el.innerHTML = `<div class="cabecera"><h1>Sistema</h1><span class="sub" id="ver"></span></div>
    <section class="panel"><h2>${ico('enlace')} Estado</h2><div id="sEst">${skLineas(2)}</div></section>
    <section class="panel"><h2>${ico('reloj')} Tareas</h2><div id="sTar">${skLineas(3)}</div></section>
    <section class="panel"><h2 style="flex-wrap:wrap">${ico('lista')} Registro <span class="espacio"></span>
      <label class="interruptor peq" style="font-weight:500"><input type="checkbox" id="autoLog"> Autorefresco</label>
      <button class="btn peq" id="recLog">${ico('refrescar')} Recargar</button></h2><pre class="log" id="log" tabindex="0" aria-label="Registro del sistema">Cargando…</pre></section>`;
  const estado = async () => {
    try {
      const s = await api('/estado');
      $('#ver', el).textContent = s.version ? `Narrarr ${s.version}` : '';
      const con = s.conexiones || {};
      const cuenta = s.libros || s.conteos || {};
      const total = s.total_libros ?? Object.values(cuenta).reduce((a, b) => a + (+b || 0), 0);
      const pt = s.proxima_tarea;
      $('#sEst', el).innerHTML = `<div class="estado-rej" style="margin-bottom:14px">
          ${Object.entries(con).map(([k, v]) => { const ok = v === true || v === 'ok' || (v && v.ok); const conf = v !== null && v !== undefined && !(v && v.configurado === false); return `<div class="dato-tarj"><div><span class="punto ${conf ? (ok ? 'ok' : 'ko') : ''}" aria-hidden="true"></span><b>${esc(NOMBRE_SERV[k] || k)}</b></div><div class="e">${!conf ? 'Sin configurar' : ok ? 'Conectado' : esc((v && v.mensaje) || 'Sin conexión')}</div></div>`; }).join('')}
        </div><div class="estado-rej">
          <div class="dato-tarj"><div class="v">${nf.format(total)}</div><div class="e">Audiolibros</div></div>
          ${Object.entries(ESTADOS).map(([k, t]) => `<div class="dato-tarj"><div class="v">${nf.format(cuenta[k] || 0)}</div><div class="e">${t}</div></div>`).join('')}
          ${(s.espacio_libre ?? (s.espacio||{}).libre) != null ? `<div class="dato-tarj"><div class="v">${tamano(s.espacio_libre ?? s.espacio.libre)}</div><div class="e">Libres en /audiolibros${(s.espacio_total ?? (s.espacio||{}).total) ? ` de ${tamano(s.espacio_total ?? s.espacio.total)}` : ''}</div></div>` : ''}
          ${pt ? `<div class="dato-tarj"><div class="v" style="font-size:1rem">${esc((TAREAS[pt.nombre] || [pt.nombre || pt])[0])}</div><div class="e">Próxima tarea ${pt.proximo ? relativa(pt.proximo) : ''}</div></div>` : ''}
        </div>`;
    } catch (e) { $('#sEst', el).innerHTML = `<p class="resultado ko">${esc(e.message)}</p>`; }
  };
  const tareas = async () => {
    try {
      const t = (await api('/tareas')) || [];
      $('#sTar', el).innerHTML = `<div class="tabla-envolt"><table><thead><tr><th>Tarea</th><th>Última vez</th><th class="ocultar-movil">Próxima</th><th></th></tr></thead><tbody>
        ${t.map((x) => { const [n, d] = TAREAS[x.nombre] || [x.nombre, x.descripcion || '']; return `<tr><td><b>${esc(n)}</b><div class="texto3 peq">${esc(x.descripcion || d)}</div></td>
          <td title="${esc(fechaTitulo(x.ultimo))}">${relativa(x.ultimo)}${x.ultimo_resultado ? `<div class="texto3 peq">${esc(x.ultimo_resultado)}</div>` : ''}</td><td class="ocultar-movil" title="${esc(fechaTitulo(x.proximo))}">${relativa(x.proximo)}</td>
          <td><button class="btn peq" data-tarea="${esc(x.id || x.nombre)}" aria-label="Ejecutar ahora ${esc(n)}">${ico('play')}<span class="ocultar-movil">Ejecutar ahora</span></button></td></tr>`; }).join('')}</tbody></table></div>`;
      $$('[data-tarea]', el).forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        try { const r = await api('/tareas/' + b.dataset.tarea, { method: 'POST' }); toast((r && r.mensaje) || 'Tarea lanzada'); setTimeout(tareas, 1500); } catch (e) { fallo(e); b.disabled = false; }
      }));
    } catch (e) { $('#sTar', el).innerHTML = `<p class="resultado ko">${esc(e.message)}</p>`; }
  };
  const log = async () => {
    const pre = $('#log', el);
    try {
      const r = await api('/sistema/log?lineas=200');
      const lineas = Array.isArray(r) ? r : r && Array.isArray(r.lineas) ? r.lineas : String((r && (r.log || r.texto)) ?? r ?? '').split('\n');
      const abajo = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 30;
      pre.innerHTML = lineas.length && lineas.join('') ? lineas.map((l) => { const c = /\b(ERROR|CRITICAL)\b/.test(l) ? 'err' : /\bWARN(ING)?\b/.test(l) ? 'warn' : ''; return c ? `<span class="${c}">${esc(l)}</span>` : esc(l); }).join('\n') : 'El registro está vacío.';
      if (abajo) pre.scrollTop = pre.scrollHeight;
    } catch (e) { pre.textContent = 'No he podido leer el registro: ' + e.message; }
  };
  await Promise.all([estado(), tareas(), log()]);
  let t = null;
  const auto = $('#autoLog', el);
  auto.checked = guardado('autolog', '0') === '1';
  const ponAuto = () => { clearInterval(t); t = auto.checked ? setInterval(() => { if (!document.hidden) log(); }, 5000) : null; };
  auto.addEventListener('change', () => { guardar('autolog', auto.checked ? '1' : '0'); ponAuto(); });
  ponAuto();
  $('#recLog', el).onclick = () => { log(); estado(); };
  alSalir(() => clearInterval(t));
};

/* ---------- arranque ---------- */
navegar();
refrescarCuentaCola();
setInterval(() => { if (!document.hidden && !location.hash.startsWith('#/actividad')) refrescarCuentaCola(); }, 30000);
