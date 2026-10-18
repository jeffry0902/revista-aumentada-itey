// Camara con realidad aumentada: ar.html?camara=11
//
// Carga targets/<camara>.mind (todas las portadas de esa camara), crea una ancla
// por revista en el orden de revistas.json y reproduce el video de la que se detecte.
// Con una sola camara en revistas.json, ar.html sin parametros abre esa.
//
// Si la revista trae sus paginas, la tarjeta muestra «Leer revista». En el modo
// gafas (pantalla partida, js/ar-gafas.js) no hay toques: debajo de la portada
// aparece un boton 3D «Leer revista» que se elige mirandolo 2 segundos, y las
// paginas se ven encima de la portada impresa, con flechas para pasarlas.

import { cargarDatos, camarasConRevistas, buscarCamara, nombreCamara, rutaTargets, esc } from './datos.js';
import { iniciarContador, contarVisita, contarEvento } from './contador.js';
import { abrirLector } from './lector.js';
import { prepararGafas, entrarGafas, gafasActivas, textoGafas } from './ar-gafas.js';

const $ = id => document.getElementById(id);
const videoAR = $('video-ar');
const videoGrande = $('video-grande');

// Si la camara deja de ver la portada, el video espera este tiempo antes de
// pausarse: en celulares modestos el anclaje parpadea y el video tartamudearia.
const ESPERA_PAUSA_MS = 1500;
const COLOR = { azul: '#13204a', amarillo: '#ffd21f', rojo: '#e3171e', blanco: '#ffffff' };
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

let camara = null;
let escena = null;
let sistema = null;      // mindar-image-system, disponible despues de arReady
let dimensiones = [];    // [ancho, alto] de cada portada, para ajustar el video
const planos = [];       // un plano de video por revista, en el orden del JSON
const botones3d = [];    // por revista: { leer, pagina, anterior, siguiente, video } (modo gafas)
let camara3d = null;
let lectura = null;      // { i, pagina } mientras se hojea una revista con las gafas
let lectorAbierto = false; // lector en pantalla (sin gafas)
let preparado = false;   // la primera vez que la camara quedo lista
let reiniciando = false; // MindAR se esta reiniciando (giro de pantalla, modo gafas)
let camaraHD = false;    // con las gafas se pide la camara en 1280x720
const aspectos = new Map();
let actual = -1;         // revista cargada en el reproductor
let visible = -1;        // revista que la camara esta viendo (-1 = ninguna)
let sonido = false;      // el visitante ya toco la pantalla
let pausaPendiente = null;

// MindAR pide la camara sin decir resolucion: muchos celulares le dan 640x480, que
// dentro de las gafas se ve borroso. En el modo gafas se pide 1280x720 con enfoque
// continuo (sin gafas se deja igual: los celulares economicos reconocen mas rapido).
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  const pedirCamara = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = restricciones => {
    if (camaraHD && restricciones && typeof restricciones.video === 'object') {
      restricciones = {
        ...restricciones,
        video: { ...restricciones.video, width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: 'continuous' }] },
      };
    }
    return pedirCamara(restricciones);
  };
}

iniciar();

async function iniciar() {
  let datos;
  try {
    datos = await cargarDatos();
  } catch (error) {
    return mostrarError('No se pudieron cargar las revistas', error.message);
  }
  iniciarContador(datos.goatcounter);

  const camaras = camarasConRevistas(datos);
  const pedida = new URLSearchParams(location.search).get('camara');
  camara = pedida ? buscarCamara(datos, pedida) : (camaras.length === 1 ? camaras[0] : null);
  if (!camara || !camara.revistas.length) return elegirCamara(camaras);

  pintarSelector(camaras);
  contarVisita(`/camara/${camara.id}`, `Cámara ${nombreCamara(camara)}`);
  $('guia-texto').textContent = `Apunta a la portada de una revista de ${nombreCamara(camara)}`;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return mostrarError('Este navegador no puede usar la cámara',
      'Abre esta página en Chrome (Android) o Safari (iPhone). Si llegaste desde una app lectora de QR, ' +
      'toca el menú ⋮ y elige «Abrir en Chrome».');
  }

  let targets;
  try {
    targets = await descargarTargets(rutaTargets(camara.id));
  } catch (error) {
    return mostrarError('La cámara todavía no está lista',
      `Puedes ver los videos desde la lista. (${error.message})`);
  }
  crearEscena(targets);
}

// Descarga el .mind con barra de progreso y lo entrega como blob: asi se ve el
// avance con wifi lento y un archivo que falta se explica en vez de colgarse.
async function descargarTargets(ruta) {
  textoCargando('Descargando las portadas…');
  let respuesta;
  try {
    respuesta = await fetch(ruta);
  } catch {
    throw new Error('sin conexión');
  }
  if (!respuesta.ok) throw new Error(respuesta.status === 404 ? `falta ${ruta}` : `error ${respuesta.status} con ${ruta}`);

  const total = Number(respuesta.headers.get('Content-Length')) || 0;
  if (!respuesta.body || !total) return URL.createObjectURL(await respuesta.blob());

  $('progreso').hidden = false;
  const lector = respuesta.body.getReader();
  const partes = [];
  let recibido = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    partes.push(value);
    recibido += value.length;
    $('progreso-barra').style.width = Math.min(100, (recibido / total) * 100) + '%';
  }
  return URL.createObjectURL(new Blob(partes));
}

function crearEscena(targets) {
  escena = document.createElement('a-scene');
  escena.setAttribute('mindar-image',
    `imageTargetSrc: ${targets}; maxTrack: 1; uiLoading: no; uiScanning: no; uiError: no; ` +
    // Filtro mas fuerte que el de fabrica: el video tiembla menos sobre la pagina.
    'filterMinCF: 0.0001; filterBeta: 0.001');
  escena.setAttribute('color-space', 'sRGB');
  escena.setAttribute('renderer', 'colorManagement: true');
  escena.setAttribute('vr-mode-ui', 'enabled: false');
  escena.setAttribute('device-orientation-permission-ui', 'enabled: false');
  escena.setAttribute('loading-screen', 'enabled: false');
  escena.setAttribute('pantalla-partida', '');

  camara3d = document.createElement('a-camera');
  camara3d.setAttribute('position', '0 0 0');
  camara3d.setAttribute('look-controls', 'enabled: false');
  camara3d.setAttribute('wasd-controls', 'enabled: false');
  // Punto de mira del modo gafas: el centro de la camara. Solo apunta a los
  // botones 3D que tienen la clase .mirable (unicamente con las gafas puestas).
  // Las portadas miden unas 1000 unidades de MindAR: el rayo tiene que llegar lejos.
  camara3d.setAttribute('cursor', 'fuse: true; fuseTimeout: 1800; rayOrigin: entity');
  camara3d.setAttribute('raycaster', 'objects: .mirable; far: 1000000; interval: 100');
  escena.appendChild(camara3d);
  const texturas = {
    leer: lienzoBoton('Leer revista', COLOR.rojo, COLOR.blanco),
    video: lienzoBoton('▶  Ver video', COLOR.blanco, COLOR.azul),
    anterior: lienzoFlecha('‹'),
    siguiente: lienzoFlecha('›'),
  };

  camara.revistas.forEach((revista, i) => {
    const ancla = document.createElement('a-entity');
    ancla.setAttribute('mindar-image-target', `targetIndex: ${i}`);
    const plano = document.createElement('a-plane');
    plano.setAttribute('material', 'shader: flat; src: #video-ar');
    plano.setAttribute('width', '1');
    plano.setAttribute('height', '0.5625');
    plano.setAttribute('position', '0 0 0.01');
    plano.setAttribute('visible', 'false');
    ancla.appendChild(plano);
    const b = {
      pagina: crear('a-plane', { material: 'shader: flat', visible: 'false', position: '0 0 0.02' }),
      leer: botonMirable(texturas.leer, 0.6, 0.6 * 160 / 560),
      video: botonMirable(texturas.video, 0.6, 0.6 * 160 / 560),
      anterior: botonMirable(texturas.anterior, 0.26, 0.26),
      siguiente: botonMirable(texturas.siguiente, 0.26, 0.26),
    };
    b.leer.addEventListener('click', () => leerConGafas(i));
    b.video.addEventListener('click', () => salirLectura(true));
    b.anterior.addEventListener('click', () => hojear(-1));
    b.siguiente.addEventListener('click', () => hojear(1));
    Object.values(b).forEach(el => ancla.appendChild(el));
    botones3d.push(b);
    ancla.addEventListener('targetFound', () => alEncontrar(i));
    ancla.addEventListener('targetLost', () => alPerder(i));
    escena.appendChild(ancla);
    planos.push(plano);
  });

  escena.addEventListener('arReady', alEstarListo);
  escena.addEventListener('arError', () => mostrarError('No se pudo abrir la cámara',
    'Revisa que le diste permiso: toca el candado junto a la dirección, entra a «Permisos» y activa la cámara. ' +
    'Luego toca «Reintentar». Si llegaste desde una app lectora de QR, abre la página en Chrome o Safari.'));

  document.body.appendChild(escena);
  $('progreso').hidden = true;
  textoCargando('Abriendo la cámara…');
}

function alEstarListo() {
  sistema = escena.systems['mindar-image-system'];
  dimensiones = (sistema.controller && sistema.controller.markerDimensions) || [];
  reiniciando = false;
  if (preparado) return pintarGafas(); // termino un reinicio
  preparado = true;
  $('cargando').hidden = true;
  $('guia').hidden = false;
  prepararGafas({ escena, sistema, cursor: camara3d, salir: alSalirGafas });
  $('boton-gafas').hidden = false;
  if (screen.orientation) screen.orientation.addEventListener('change', programarReinicio);
  else window.addEventListener('orientationchange', programarReinicio);

  // Error tipico al preparar la feria: el .mind no corresponde al JSON.
  if (dimensiones.length && dimensiones.length !== camara.revistas.length) {
    const aviso = $('aviso-tecnico');
    aviso.textContent = `Aviso para el docente: ${rutaTargets(camara.id)} tiene ${dimensiones.length} portadas, ` +
      `pero revistas.json tiene ${camara.revistas.length} revistas en la cámara ${nombreCamara(camara)}. Vuelve a compilarla.`;
    aviso.hidden = false;
  }
}

// MindAR calcula la posicion de la portada con las medidas de la camara de cuando
// arranco. Al girar el celular la imagen de la camara cambia de forma y el video
// sale torcido sobre la portada: hay que volver a arrancarla con las medidas nuevas.
let reinicioPendiente = null;
function programarReinicio() {
  clearTimeout(reinicioPendiente);
  reinicioPendiente = setTimeout(reiniciarCamara, 500);
}

function reiniciarCamara() {
  if (!sistema || reiniciando) return;
  reiniciando = true;
  // Las portadas quedan "perdidas": asi, al volver a verlas, MindAR avisa de nuevo.
  escena.querySelectorAll('[mindar-image-target]').forEach(ancla => ancla.components['mindar-image-target'].updateWorldMatrix(null));
  visible = -1;
  planos.forEach(p => p.setAttribute('visible', 'false'));
  pintarGafas();
  try {
    sistema.stop();
  } catch {
    // Si la camara ya estaba detenida, se arranca igual.
  }
  sistema.start(); // al terminar vuelve a emitir arReady
}

// ---------- Deteccion ----------

function alEncontrar(i) {
  clearTimeout(pausaPendiente);
  visible = i;
  $('guia').hidden = true;
  pintarTarjeta(i);
  if (lectura && lectura.i !== i) salirLectura(false); // otra revista: vuelve al video
  if (actual !== i) cargarVideo(i);
  if (!lectura) reproducir();
  pintarGafas();
  const revista = camara.revistas[i];
  contarEvento(`ar-${revista.id}`, `AR · ${revista.id} · ${revista.titulo}`);
}

function alPerder(i) {
  if (visible === i) visible = -1;
  pintarGafas();
  clearTimeout(pausaPendiente);
  pausaPendiente = setTimeout(() => {
    if (visible !== -1) return;
    videoAR.pause();
    $('guia').hidden = false;
  }, ESPERA_PAUSA_MS);
}

function cargarVideo(i) {
  actual = i;
  planos.forEach(p => p.setAttribute('visible', 'false'));
  videoAR.src = camara.revistas[i].video;
}

// El plano se muestra cuando ya hay imagen, para no dejar ver el ultimo cuadro
// del video anterior ni un rectangulo negro mientras carga.
videoAR.addEventListener('loadedmetadata', () => ajustarPlano(actual));
videoAR.addEventListener('playing', () => {
  if (actual !== -1 && !lectura) planos[actual].setAttribute('visible', 'true');
});

// El video cubre la pagina lo mas posible sin salirse: horizontal o vertical.
function ajustarPlano(i) {
  if (i === -1 || !videoAR.videoWidth) return;
  const [anchoPagina, altoPagina] = dimensiones[i] || [1, 1.414];
  const proporcionPagina = altoPagina / anchoPagina;
  const proporcionVideo = videoAR.videoHeight / videoAR.videoWidth;
  let ancho = 1;
  let alto = proporcionVideo;
  if (alto > proporcionPagina) {
    alto = proporcionPagina;
    ancho = proporcionPagina / proporcionVideo;
  }
  planos[i].setAttribute('width', String(ancho));
  planos[i].setAttribute('height', String(alto));
}

// Hay algo encima de la camara (video en grande, lector) o se esta leyendo con las gafas.
function ocupado() {
  return !$('pantalla-completa').hidden || lectorAbierto || !!lectura;
}

async function reproducir() {
  if (ocupado() || visible === -1) return;
  videoAR.muted = !sonido;
  try {
    await videoAR.play();
  } catch (error) {
    if (error.name === 'AbortError') return; // se cambio de video mientras cargaba
    // El celular no dejo sonar el video: sigue sin sonido y con el boton a la vista.
    if (!videoAR.muted) {
      sonido = false;
      videoAR.muted = true;
      videoAR.play().catch(() => {});
    }
  }
  pintarBotonSonido();
}

// ---------- Sonido ----------
// Los celulares solo dejan sonar un video despues de que la persona toca la
// pantalla. El primer toque en cualquier parte activa el sonido.

function activarSonido() {
  sonido = true;
  videoAR.muted = false;
  if (visible !== -1 && !ocupado()) videoAR.play().catch(() => {});
  pintarBotonSonido();
}
document.addEventListener('click', activarSonido);

function pintarBotonSonido() {
  $('boton-sonido').hidden = sonido && !videoAR.muted;
}

// ---------- Video en grande (respaldo si el anclaje falla) ----------

$('boton-ver').addEventListener('click', () => {
  if (actual === -1) return;
  const revista = camara.revistas[actual];
  const segundo = videoAR.currentTime || 0;
  videoAR.pause();
  if (sistema) sistema.pause(); // libera el procesador mientras se ve el video
  videoGrande.src = revista.video;
  // Sigue desde donde iba. Se salta al cargar: antes el navegador lo ignora.
  if (segundo > 1) {
    videoGrande.addEventListener('loadedmetadata', () => { videoGrande.currentTime = segundo; }, { once: true });
  }
  $('pantalla-completa').hidden = false;
  videoGrande.muted = false;
  videoGrande.play().catch(() => {});
});

$('cerrar-grande').addEventListener('click', () => {
  videoGrande.pause();
  if (videoGrande.currentTime > 0) videoAR.currentTime = videoGrande.currentTime;
  $('pantalla-completa').hidden = true;
  if (sistema) sistema.unpause();
  reproducir();
});

// ---------- Revista completa en la pantalla (sin gafas) ----------

$('boton-leer').addEventListener('click', () => {
  if (actual === -1) return;
  const revista = camara.revistas[actual];
  videoAR.pause();
  if (sistema) sistema.pause();
  lectorAbierto = true;
  contarEvento(`ar-leer-${revista.id}`, `AR · leer ${revista.id}`);
  abrirLector(revista, {
    textoVolver: '‹ Volver a la cámara',
    alCerrar: () => {
      lectorAbierto = false;
      if (sistema) sistema.unpause();
      reproducir();
    },
  });
});

// ---------- Modo gafas ----------

$('boton-gafas').addEventListener('click', async () => {
  activarSonido(); // este toque es el permiso para que suene dentro de las gafas
  camaraHD = true;
  contarEvento('ar-gafas', 'AR · modo gafas');
  pintarGafas();
  await entrarGafas();
  programarReinicio(); // camara en alta resolucion y con las medidas de la pantalla acostada
});

function alSalirGafas() {
  salirLectura(false);
  pintarGafas();
}

// Muestra los botones 3D que tocan y el mensaje de arriba segun lo que se ve.
function pintarGafas() {
  const conGafas = gafasActivas();
  const elegibles = [];
  botones3d.forEach((b, i) => {
    const revista = camara.revistas[i];
    const aqui = conGafas && visible === i;
    const leyendo = aqui && lectura && lectura.i === i;
    const ver = {
      leer: aqui && !leyendo && !!revista.paginas,
      video: leyendo,
      anterior: leyendo && lectura.pagina > 1,
      siguiente: leyendo && lectura.pagina < revista.paginas,
    };
    for (const [nombre, si] of Object.entries(ver)) {
      b[nombre].setAttribute('visible', si);
      if (si) elegibles.push(b[nombre]);
    }
    b.pagina.setAttribute('visible', !!(lectura && lectura.i === i && conGafas));
    if (aqui) colocarBotones(i);
  });
  document.querySelectorAll('.mirable').forEach(el => el.classList.remove('mirable'));
  elegibles.forEach(el => el.classList.add('mirable'));
  const rc = camara3d && camara3d.components.raycaster;
  if (rc) rc.refreshObjects();

  if (!conGafas) return;
  if (reiniciando) textoGafas('Ajustando la cámara…');
  else if (visible === -1) textoGafas('Mira la portada de una revista');
  else if (lectura) textoGafas(`Página ${lectura.pagina} de ${camara.revistas[lectura.i].paginas}`);
  else if (camara.revistas[visible].paginas) textoGafas('Mira «Leer revista» 2 segundos');
  else textoGafas('');
}

// En unidades de MindAR la portada mide 1 de ancho; el alto sale de su proporcion.
function colocarBotones(i) {
  const [anchoPortada, altoPortada] = dimensiones[i] || [1, 1.414];
  const altoP = altoPortada / anchoPortada;
  const b = botones3d[i];
  b.leer.setAttribute('position', `0 ${-(altoP / 2 + 0.16)} 0.03`);
  if (lectura && lectura.i === i) {
    // La pagina un poco mas grande que la portada, para leerla mejor.
    const revista = camara.revistas[i];
    const alto = altoP * 1.15;
    const ancho = alto / (aspectos.get(revista.pagina(lectura.pagina)) || 1.414);
    b.pagina.setAttribute('width', ancho);
    b.pagina.setAttribute('height', alto);
    b.anterior.setAttribute('position', `${-(ancho / 2 + 0.1)} 0 0.03`);
    b.siguiente.setAttribute('position', `${ancho / 2 + 0.1} 0 0.03`);
    b.video.setAttribute('position', `0 ${-(alto / 2 + 0.16)} 0.03`);
  }
}

async function leerConGafas(i) {
  const revista = camara.revistas[i];
  if (!revista.paginas || !gafasActivas()) return;
  contarEvento(`ar-leer-${revista.id}`, `AR · leer ${revista.id}`);
  videoAR.pause();
  planos[i].setAttribute('visible', 'false');
  lectura = { i, pagina: 1 };
  await mostrarPagina();
}

async function hojear(direccion) {
  if (!lectura) return;
  const total = camara.revistas[lectura.i].paginas;
  lectura.pagina = Math.min(total, Math.max(1, lectura.pagina + direccion));
  await mostrarPagina();
}

async function mostrarPagina() {
  const actualLectura = lectura;
  const revista = camara.revistas[lectura.i];
  const src = revista.pagina(lectura.pagina);
  await medir(src);
  if (lectura !== actualLectura) return;
  botones3d[lectura.i].pagina.setAttribute('src', src);
  pintarGafas();
  // La siguiente queda descargada para que el cambio sea inmediato.
  if (lectura.pagina < revista.paginas) medir(revista.pagina(lectura.pagina + 1));
}

function salirLectura(volverAlVideo) {
  if (!lectura) return;
  const i = lectura.i;
  lectura = null;
  botones3d[i].pagina.setAttribute('visible', 'false');
  if (volverAlVideo) reproducir();
  pintarGafas();
}

function medir(src) {
  if (aspectos.has(src)) return Promise.resolve(aspectos.get(src));
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { aspectos.set(src, img.naturalHeight / img.naturalWidth); resolve(); };
    img.onerror = () => { aspectos.set(src, 1.414); resolve(); };
    img.src = src;
  });
}

function crear(etiqueta, atributos) {
  const el = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) el.setAttribute(nombre, valor);
  return el;
}

function botonMirable(src, ancho, alto) {
  const b = crear('a-image', { src, width: ancho, height: alto, visible: 'false', material: 'shader: flat; transparent: true' });
  b.addEventListener('mouseenter', () => b.setAttribute('scale', '1.15 1.15 1.15'));
  b.addEventListener('mouseleave', () => b.setAttribute('scale', '1 1 1'));
  return b;
}

function lienzo(ancho, alto, dibujar) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  dibujar(c.getContext('2d'));
  return c.toDataURL('image/png');
}

function lienzoBoton(texto, fondo, color) {
  return lienzo(560, 160, ctx => {
    ctx.fillStyle = fondo;
    ctx.beginPath();
    ctx.roundRect(6, 6, 548, 148, 74);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = `800 70px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(texto, 280, 104, 500);
  });
}

function lienzoFlecha(texto) {
  return lienzo(300, 300, ctx => {
    ctx.fillStyle = COLOR.amarillo;
    ctx.beginPath(); ctx.arc(150, 150, 144, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOR.azul;
    ctx.font = `900 260px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, 150, 136);
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    videoAR.pause();
    videoGrande.pause();
  } else {
    reproducir();
  }
});

// Un .mind danado o de otra version de MindAR revienta dentro de la libreria
// sin avisar; mientras la capa de carga siga a la vista, lo explicamos.
window.addEventListener('unhandledrejection', () => {
  if ($('cargando').hidden || !camara) return;
  mostrarError('No se pudo preparar la cámara',
    `El archivo ${rutaTargets(camara.id)} está dañado o no es de MindAR 1.2.5. Hay que volver a compilarlo.`);
});

// ---------- Interfaz ----------

function pintarTarjeta(i) {
  const revista = camara.revistas[i];
  $('tarjeta-curso').textContent = revista.curso;
  $('tarjeta-titulo').textContent = revista.titulo;
  $('tarjeta-equipo').textContent = revista.equipo;
  $('boton-leer').hidden = !revista.paginas;
  $('tarjeta-ar').hidden = false;
  pintarBotonSonido();
}

// Solo aparece si revistas.json tiene mas de una camara.
function pintarSelector(camaras) {
  if (camaras.length < 2) return;
  const selector = $('selector-camara');
  selector.innerHTML = camaras
    .map(c => `<option value="${esc(c.id)}"${c === camara ? ' selected' : ''}>${esc(nombreCamara(c))}</option>`)
    .join('');
  selector.addEventListener('change', () => {
    location.href = `ar.html?camara=${encodeURIComponent(selector.value)}`;
  });
  $('etiqueta-camara').hidden = false;
}

function elegirCamara(camaras) {
  $('cargando').hidden = true;
  if (!camaras.length) return mostrarError('Todavía no hay revistas', 'Vuelve a intentarlo más tarde.');
  $('rejilla-camaras').innerHTML = camaras
    .map(c => `<a class="boton" href="ar.html?camara=${encodeURIComponent(c.id)}">${esc(nombreCamara(c))}</a>`)
    .join('');
  $('elegir').hidden = false;
}

function textoCargando(texto) {
  $('cargando-texto').textContent = texto;
}

function mostrarError(titulo, texto) {
  $('cargando').hidden = true;
  $('guia').hidden = true;
  $('error-titulo').textContent = titulo;
  $('error-texto').textContent = texto;
  $('error').hidden = false;
}
