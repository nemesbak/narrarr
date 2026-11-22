// Modo demo (?demo=1): imita el backend con datos falsos para ver la interfaz sin servidor.
const ahora = Date.now();
const hace = (min) => new Date(ahora - min * 60000).toISOString();
const dentro = (min) => new Date(ahora + min * 60000).toISOString();

const colores = ['#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#22c55e', '#ec4899'];
function portadaSvg(titulo, autor, i) {
  const c = colores[i % colores.length];
  const t = titulo.length > 28 ? titulo.slice(0, 26) + '…' : titulo;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0f1115"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><text x="24" y="150" font-family="Georgia,serif" font-size="24" fill="#fff" font-weight="bold">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text><text x="24" y="190" font-family="system-ui,sans-serif" font-size="16" fill="#ffffffcc">${autor}</text><circle cx="250" cy="50" r="22" fill="#ffffff22"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const libros = [
  { id: 1, asin: 'B07D1', titulo: 'El nombre del viento', subtitulo: 'Crónica del asesino de reyes: Primer día', autor: 'Patrick Rothfuss', narrador: 'Fernando de Luis', serie: 'Crónica del asesino de reyes', serie_pos: 1, anio: 2019, duracion_min: 1652, idioma: 'español', estado: 'descargado', tamano: 1288490188, añadido: hace(60 * 24 * 30), ultima_busqueda: hace(60 * 24 * 30), sinopsis: 'He robado princesas a reyes agónicos. Incendié la ciudad de Trebon. He pasado la noche con Felurian y he despertado vivo y cuerdo. Me expulsaron de la Universidad a una edad a la que a la mayoría todavía no los dejan entrar. He recorrido de noche caminos de los que otros no se atreven a hablar ni siquiera de día. He hablado con dioses, he amado a mujeres y he escrito canciones que hacen llorar a los bardos. Me llamo Kvothe. Quizá hayas oído hablar de mí.', ruta: '/audiolibros/Patrick Rothfuss/El nombre del viento (Fernando de Luis)' },
  { id: 2, asin: 'B07D2', titulo: 'El temor de un hombre sabio', subtitulo: 'Crónica del asesino de reyes: Segundo día', autor: 'Patrick Rothfuss', narrador: 'Fernando de Luis', serie: 'Crónica del asesino de reyes', serie_pos: 2, anio: 2020, duracion_min: 2530, idioma: 'español', estado: 'descargando', tamano: 0, añadido: hace(90), ultima_busqueda: hace(80), sinopsis: 'Kvothe continúa narrando su historia: su búsqueda de respuestas sobre los Chandrian y los Amyr.' },
  { id: 3, asin: 'B08P1', titulo: 'Patria', subtitulo: '', autor: 'Fernando Aramburu', narrador: 'Ramón Langa', serie: '', serie_pos: null, anio: 2018, duracion_min: 1415, idioma: 'español', estado: 'descargado', tamano: 812646400, añadido: hace(60 * 24 * 12), sinopsis: 'El día en que ETA anuncia el abandono de las armas, Bittori se dirige al cementerio para contarle a la tumba de su marido el Txato, asesinado por los terroristas, que ha decidido volver a la casa donde vivieron.' },
  { id: 4, asin: 'B08S1', titulo: 'La sombra del viento', subtitulo: 'El cementerio de los libros olvidados 1', autor: 'Carlos Ruiz Zafón', narrador: 'Jordi Boixaderas', serie: 'El cementerio de los libros olvidados', serie_pos: 1, anio: 2017, duracion_min: 1120, idioma: 'español', estado: 'deseado', añadido: hace(60 * 5), ultima_busqueda: hace(60 * 4), sinopsis: 'Un amanecer de 1945, un muchacho es conducido por su padre a un misterioso lugar oculto en el corazón de la ciudad vieja: el Cementerio de los Libros Olvidados.' },
  { id: 5, asin: 'B01HP', titulo: 'Harry Potter y la piedra filosofal', subtitulo: '', autor: 'J. K. Rowling', narrador: 'Eugenio Barona', serie: 'Harry Potter', serie_pos: 1, anio: 2016, duracion_min: 515, idioma: 'español', estado: 'descargado', tamano: 402653184, añadido: hace(60 * 24 * 60), sinopsis: 'Harry Potter se ha quedado huérfano y vive en casa de sus abominables tíos y del insoportable primo Dudley. Un día recibe una carta que cambiará su vida.' },
  { id: 6, asin: 'B01HC', titulo: 'Harry Potter y la cámara secreta', subtitulo: '', autor: 'J. K. Rowling', narrador: 'Eugenio Barona', serie: 'Harry Potter', serie_pos: 2, anio: 2016, duracion_min: 580, idioma: 'español', estado: 'buscando', añadido: hace(30), ultima_busqueda: hace(2), sinopsis: 'Tras derrotar una vez más a lord Voldemort, Harry espera impaciente en casa de sus insoportables tíos el inicio del segundo curso.' },
  { id: 7, asin: 'B09L1', titulo: 'Los pilares de la Tierra', subtitulo: '', autor: 'Ken Follett', narrador: 'Luis Posada', serie: 'Kingsbridge', serie_pos: 1, anio: 2019, duracion_min: 2460, idioma: 'español', estado: 'descargado', tamano: 2147483648, añadido: hace(60 * 24 * 3), sinopsis: 'El gran maestro de la narrativa de acción y suspense nos transporta a la Edad Media, a un fascinante mundo de reyes, damas, caballeros, pugnas feudales, castillos y ciudades amuralladas.' },
  { id: 8, asin: 'B09C1', titulo: 'Cien años de soledad', subtitulo: '', autor: 'Gabriel García Márquez', narrador: 'Kerygma Flores', serie: '', anio: 2021, duracion_min: 1033, idioma: 'español', estado: 'ignorado', añadido: hace(60 * 24 * 90), sinopsis: 'La historia de la familia Buendía a lo largo de siete generaciones en el pueblo ficticio de Macondo.' },
  { id: 9, asin: 'B0AR1', titulo: 'Reina roja', subtitulo: '', autor: 'Juan Gómez-Jurado', narrador: 'Inma Cuevas', serie: 'Reina roja', serie_pos: 1, anio: 2018, duracion_min: 860, idioma: 'español', estado: 'deseado', añadido: hace(60 * 26), ultima_busqueda: null, sinopsis: 'Antonia Scott es especial. Muy especial. No es policía ni criminalista. Nunca ha empuñado un arma ni llevado una placa, y, sin embargo, ha resuelto decenas de crímenes.' },
];
libros.forEach((l, i) => { l.portada_url = portadaSvg(l.titulo, l.autor, i); });

const autores = [
  { id: 1, nombre: 'Patrick Rothfuss', asin: 'A1', foto_url: '', vigilado: true, añadido: hace(60 * 24 * 30) },
  { id: 2, nombre: 'Fernando Aramburu', asin: 'A2', foto_url: '', vigilado: false },
  { id: 3, nombre: 'Carlos Ruiz Zafón', asin: 'A3', foto_url: '', vigilado: true },
  { id: 4, nombre: 'J. K. Rowling', asin: 'A4', foto_url: '', vigilado: true },
  { id: 5, nombre: 'Ken Follett', asin: 'A5', foto_url: '', vigilado: false },
  { id: 6, nombre: 'Juan Gómez-Jurado', asin: 'A6', foto_url: '', vigilado: false },
];

let descargas = [
  { id: 11, libro_id: 2, hash: 'abc', titulo_release: 'Patrick Rothfuss - El temor de un hombre sabio [Castellano] [M4B] [Íntegro]', indexador: 'MiTracker', tamano: 1932735283, progreso: 0.42, estado: 'descargando', velocidad: 3355443, eta: 420, añadido: hace(12) },
  { id: 12, libro_id: 6, hash: 'def', titulo_release: 'Harry Potter y la cámara secreta - Eugenio Barona (MP3 128kbps)', indexador: 'AudioES', tamano: 445644800, progreso: 0, estado: 'en_cola', añadido: hace(1) },
];

const historial = [
  { id: 1, fecha: hace(1), tipo: 'capturado', libro_id: 6, mensaje: 'Enviado a qBittorrent: Harry Potter y la cámara secreta - Eugenio Barona (MP3)' },
  { id: 2, fecha: hace(2), tipo: 'buscado', libro_id: 6, mensaje: 'Búsqueda automática: 7 lanzamientos, 3 válidos' },
  { id: 3, fecha: hace(12), tipo: 'capturado', libro_id: 2, mensaje: 'Enviado a qBittorrent: El temor de un hombre sabio [M4B]' },
  { id: 4, fecha: hace(60 * 3), tipo: 'importado', libro_id: 7, mensaje: 'Importado en /audiolibros/Ken Follett/Los pilares de la Tierra (Luis Posada)' },
  { id: 5, fecha: hace(60 * 4), tipo: 'fallo', libro_id: 4, mensaje: 'Ningún lanzamiento supera la puntuación mínima' },
  { id: 6, fecha: hace(60 * 30), tipo: 'borrado', libro_id: null, mensaje: 'Quitado de la biblioteca: El código Da Vinci' },
];

let ajustes = {
  prowlarr_url: 'http://192.168.1.25:9696', prowlarr_key: '••••',
  qbit_url: 'http://192.168.1.25:8080', qbit_usuario: 'admin', qbit_clave: '••••', qbit_categoria: 'audiolibros', qbit_ruta_remota: '/datos/torrents/audiolibros',
  ruta_biblioteca: '/audiolibros', ruta_descargas: '/descargas', formato_carpeta: '{Autor}/{Título} ({Narrador})',
  solo_castellano: true,
  telegram_token: '', telegram_chat: '', jellyfin_url: 'http://192.168.1.25:8096', jellyfin_key: '••••', emby_url: '', emby_key: '',
  preferir_m4b: true, semillas_minimas: 1, tamano_max_gb: 10,
  intervalo_buscar_deseados_h: 6, intervalo_escanear_biblioteca_h: 12, intervalo_vigilar_autores_h: 24, max_libros_por_pasada: 5,
};

const tareas = [
  { nombre: 'comprobar_descargas', ultimo: hace(0.5), proximo: dentro(0.5), intervalo_min: 1 },
  { nombre: 'buscar_deseados', ultimo: hace(120), proximo: dentro(240), intervalo_min: 360 },
  { nombre: 'escanear_biblioteca', ultimo: hace(300), proximo: dentro(420), intervalo_min: 720 },
  { nombre: 'vigilar_autores', ultimo: hace(600), proximo: dentro(840), intervalo_min: 1440 },
];

const catalogo = [
  { asin: 'B0AR1', titulo: 'Reina roja', autores: ['Juan Gómez-Jurado'], narradores: ['Inma Cuevas'], serie: 'Reina roja', serie_pos: 1, duracion_min: 860, anio: 2018, idioma: 'español' },
  { asin: 'B0AR2', titulo: 'Loba negra', autores: ['Juan Gómez-Jurado'], narradores: ['Inma Cuevas'], serie: 'Reina roja', serie_pos: 2, duracion_min: 900, anio: 2019, idioma: 'español' },
  { asin: 'B0AR3', titulo: 'Rey blanco', autores: ['Juan Gómez-Jurado'], narradores: ['Inma Cuevas'], serie: 'Reina roja', serie_pos: 3, duracion_min: 780, anio: 2020, idioma: 'español' },
  { asin: 'B07D1', titulo: 'El nombre del viento', autores: ['Patrick Rothfuss'], narradores: ['Fernando de Luis'], serie: 'Crónica del asesino de reyes', serie_pos: 1, duracion_min: 1652, anio: 2019, idioma: 'español' },
  { asin: 'B0DQ1', titulo: 'Don Quijote de la Mancha', autores: ['Miguel de Cervantes'], narradores: ['Luis Posada', 'Carmen Gómez'], serie: '', duracion_min: 2380, anio: 2015, idioma: 'español' },
  { asin: 'B0IN1', titulo: 'La ciudad de las bestias', autores: ['Isabel Allende'], narradores: ['Mercè Montalà'], serie: 'Memorias del Águila y del Jaguar', serie_pos: 1, duracion_min: 610, anio: 2022, idioma: 'español' },
];
catalogo.forEach((c, i) => {
  c.portada = portadaSvg(c.titulo, c.autores[0], i + 3);
  c.sinopsis = 'Un audiolibro en castellano de ' + c.autores[0] + ' narrado por ' + c.narradores.join(' y ') + '.';
  c.subtitulo = '';
});

function lanzamientosPara(libro) {
  const t = libro ? libro.titulo : 'audiolibro';
  const a = libro ? libro.autor : '';
  return [
    { guid: 'g1', titulo: `${a} - ${t} [Castellano] [M4B] [Íntegro]`, indexador: 'MiTracker', indexador_id: 3, tamano: 1288490188, semillas: 34, pares: 2, fecha: hace(60 * 24 * 40), formato: 'm4b', idioma: 'castellano', puntuacion: 258, motivos: ['+100 castellano detectado', '+40 formato m4b', '+20 íntegro', '+58 coincide el título', '+30 coincide el autor', '+20 semillas (34)'], rechazado: false, url_descarga: '#' },
    { guid: 'g2', titulo: `${t} - ${a} (MP3 64kbps) ESP`, indexador: 'AudioES', indexador_id: 5, tamano: 734003200, semillas: 8, pares: 0, fecha: hace(60 * 24 * 200), formato: 'mp3', idioma: 'castellano', puntuacion: 198, motivos: ['+100 castellano detectado', '+20 formato mp3', '+50 coincide el título', '+20 coincide el autor', '+8 semillas (8)'], rechazado: false, url_descarga: '#' },
    { guid: 'g3', titulo: `${t} [Latino] MP3`, indexador: 'AudioES', indexador_id: 5, tamano: 690000000, semillas: 15, pares: 1, fecha: hace(60 * 24 * 90), formato: 'mp3', idioma: 'latino', puntuacion: -887, motivos: ['−1000 latino sin castellano', '+20 formato mp3', '+58 coincide el título', '+15 semillas (15)'], rechazado: true, url_descarga: '#' },
    { guid: 'g4', titulo: `${t} - Resumen (ePub + PDF)`, indexador: 'MiTracker', indexador_id: 3, tamano: 2400000, semillas: 0, pares: 0, fecha: hace(60 * 24 * 10), formato: 'epub', idioma: '', puntuacion: -460, motivos: ['−500 resumen/ebook', '+40 coincide el título', 'Rechazado: 0 semillas', 'Rechazado: menos de 5 MB'], rechazado: true, url_descarga: '#' },
  ];
}

const json = (datos, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function demoFetch(url, opciones = {}) {
  await espera(250 + Math.random() * 350);
  const u = new URL(url, location.origin);
  const p = u.pathname.replace(/^\/api/, '');
  const m = (opciones.method || 'GET').toUpperCase();
  const cuerpo = opciones.body ? JSON.parse(opciones.body) : {};
  let r;

  if (p === '/estado') {
    const cuenta = {};
    libros.forEach((l) => { cuenta[l.estado] = (cuenta[l.estado] || 0) + 1; });
    return json({ version: '1.0.0-demo', conexiones: { prowlarr: true, qbit: true, jellyfin: true, emby: false }, libros: cuenta, total_libros: libros.length, espacio_libre: 3.4e12, espacio_total: 12e12, proxima_tarea: { nombre: 'comprobar_descargas', proximo: dentro(1) } });
  }
  if (p === '/libros' && m === 'GET') {
    let l = libros.slice();
    const est = u.searchParams.get('estado');
    if (est) l = l.filter((x) => x.estado === est);
    return json(l);
  }
  if (p === '/libros' && m === 'POST') {
    const c = catalogo.find((x) => x.asin === cuerpo.asin);
    const nuevo = c
      ? { id: libros.length + 100, asin: c.asin, titulo: c.titulo, subtitulo: c.subtitulo, autor: c.autores.join(', '), narrador: c.narradores.join(', '), serie: c.serie, serie_pos: c.serie_pos, anio: c.anio, duracion_min: c.duracion_min, idioma: c.idioma, sinopsis: c.sinopsis, portada_url: c.portada, estado: cuerpo.buscar_ya ? 'buscando' : 'deseado', añadido: new Date().toISOString() }
      : { id: libros.length + 100, titulo: cuerpo.titulo, autor: cuerpo.autor, estado: cuerpo.buscar_ya ? 'buscando' : 'deseado', añadido: new Date().toISOString(), portada_url: portadaSvg(cuerpo.titulo || '?', cuerpo.autor || '', libros.length) };
    libros.push(nuevo);
    if (c) c.en_biblioteca = true;
    return json(nuevo, 201);
  }
  if ((r = p.match(/^\/libros\/(\d+)$/))) {
    const l = libros.find((x) => x.id === +r[1]);
    if (!l) return json({ detalle: 'No encuentro ese libro' }, 404);
    if (m === 'GET') {
      return json({ ...l,
        archivos: l.estado === 'descargado' ? [{ nombre: l.titulo + '.m4b', tamano: l.tamano, duracion_min: l.duracion_min }, { nombre: 'cover.jpg', tamano: 182000 }, { nombre: 'metadata.json', tamano: 2100 }] : [],
        descargas: descargas.filter((d) => d.libro_id === l.id),
        historial: historial.filter((h) => h.libro_id === l.id) });
    }
    if (m === 'PATCH') { Object.assign(l, cuerpo); return json(l); }
    if (m === 'DELETE') { libros.splice(libros.indexOf(l), 1); return json({ ok: true }); }
  }
  if (p === '/metadatos/buscar') {
    const q = (u.searchParams.get('q') || '').toLowerCase();
    const res = catalogo.filter((c) => !q || (c.titulo + ' ' + c.autores.join(' ')).toLowerCase().includes(q) || q.length > 2);
    res.forEach((c) => { c.en_biblioteca = libros.some((l) => l.asin === c.asin); });
    return json(res);
  }
  if (p === '/autores' && m === 'GET') return json(autores.map((a) => ({ ...a, libros_total: libros.filter((l) => l.autor === a.nombre).length })));
  if (p === '/autores' && m === 'POST') { const a = { id: autores.length + 1, nombre: cuerpo.nombre, vigilado: false }; autores.push(a); return json(a, 201); }
  if ((r = p.match(/^\/autores\/(\d+)$/))) {
    const a = autores.find((x) => x.id === +r[1]);
    if (!a) return json({ detalle: 'No encuentro ese autor' }, 404);
    if (m === 'GET') {
      const suyos = libros.filter((l) => l.autor === a.nombre).map((l) => ({ asin: l.asin, titulo: l.titulo, serie: l.serie, serie_pos: l.serie_pos, anio: l.anio, duracion_min: l.duracion_min, narradores: [l.narrador], portada: l.portada_url, en_biblioteca: true, libro_id: l.id, estado: l.estado }));
      const extra = catalogo.filter((c) => c.autores.includes(a.nombre) && !suyos.some((s) => s.asin === c.asin)).map((c) => ({ ...c, en_biblioteca: false }));
      return json({ ...a, libros: [...suyos, ...extra] });
    }
    if (m === 'PATCH') { Object.assign(a, cuerpo); return json(a); }
    if (m === 'DELETE') { autores.splice(autores.indexOf(a), 1); return json({ ok: true }); }
  }
  if (p === '/lanzamientos') {
    await espera(900);
    return json(lanzamientosPara(libros.find((x) => x.id === +u.searchParams.get('libro_id'))));
  }
  if (p === '/lanzamientos/capturar') {
    const l = libros.find((x) => x.id === cuerpo.libro_id);
    if (l) l.estado = 'descargando';
    descargas.push({ id: Date.now(), libro_id: cuerpo.libro_id, titulo_release: cuerpo.titulo, indexador: 'MiTracker', tamano: 900000000, progreso: 0, estado: 'en_cola', añadido: new Date().toISOString() });
    return json({ ok: true, mensaje: 'Enviado a qBittorrent' });
  }
  if (p === '/descargas') {
    descargas.forEach((d) => { if (d.estado === 'descargando') d.progreso = Math.min(1, d.progreso + 0.02); if (d.progreso >= 1) d.estado = 'completada'; });
    return json(descargas.map((d) => ({ ...d, libro_titulo: (libros.find((l) => l.id === d.libro_id) || {}).titulo })));
  }
  if ((r = p.match(/^\/descargas\/(\d+)(\/importar)?$/))) {
    if (r[2]) return json({ ok: true, mensaje: 'Importado en la biblioteca' });
    descargas = descargas.filter((d) => d.id !== +r[1]);
    return json({ ok: true });
  }
  if (p === '/historial') return json(historial);
  if (p === '/ajustes' && m === 'GET') return json(ajustes);
  if (p === '/ajustes' && m === 'PUT') { ajustes = { ...ajustes, ...cuerpo }; return json(ajustes); }
  if ((r = p.match(/^\/ajustes\/probar\/(\w+)$/))) {
    await espera(500);
    if (r[1] === 'emby' || r[1] === 'telegram') return json({ ok: false, mensaje: 'No hay URL o clave configurada' });
    return json({ ok: true, mensaje: r[1] === 'prowlarr' ? 'Conectado: 4 indexadores con audiolibros' : 'Conexión correcta' });
  }
  if (p === '/tareas' && m === 'GET') return json(tareas);
  if ((r = p.match(/^\/tareas\/(\w+)$/))) {
    const t = tareas.find((x) => x.nombre === r[1]);
    if (t) t.ultimo = new Date().toISOString();
    return json({ ok: true, mensaje: 'Tarea lanzada' });
  }
  if (p === '/sistema/log') {
    const lineas = [];
    for (let i = 30; i > 0; i--) {
      const f = new Date(ahora - i * 47000).toISOString().replace('T', ' ').slice(0, 19);
      const tipos = ['INFO  comprobar_descargas: 2 descargas activas', 'INFO  qBittorrent: El temor de un hombre sabio al 42 %', 'INFO  buscar_deseados: freno activo, siguiente búsqueda en 30 s', 'WARNING prowlarr: el indexador AudioES tardó 8 s en responder', 'ERROR emby: no hay URL configurada, no se refresca'];
      lineas.push(`${f} ${tipos[i % tipos.length]}`);
    }
    return json({ lineas });
  }
  if ((r = p.match(/^\/portada\/(\d+)$/))) {
    const l = libros.find((x) => x.id === +r[1]);
    return new Response('', { status: 302, headers: { Location: l ? l.portada_url : '' } });
  }
  return json({ detalle: 'Ruta no disponible en el modo demo' }, 404);
}

// En demo las portadas salen del propio libro (no hay /api/portada).
export function demoPortada(id) {
  const l = libros.find((x) => x.id === +id);
  return l ? l.portada_url : portadaSvg('?', '', 0);
}
