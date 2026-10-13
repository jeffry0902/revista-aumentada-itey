// Camara con realidad aumentada: ar.html?camara=11
//
// Carga targets/<camara>.mind (todas las portadas de esa camara), crea una ancla
// por revista en el orden de revistas.json y reproduce el video de la que se detecte.
// Con una sola camara en revistas.json, ar.html sin parametros abre esa.

import { cargarDatos, camarasConRevistas, buscarCamara, nombreCamara, rutaTargets, esc } from './datos.js';
import { iniciarContador, contarVisita, contarEvento } from './contador.js';

const $ = id => document.getElementById(id);
const videoAR = $('video-ar');
const videoGrande = $('video-grande');

// Si la camara deja de ver la portada, el video espera este tiempo antes de
// pausarse: en celulares modestos el anclaje parpadea y el video tartamudearia.
const ESPERA_PAUSA_MS = 1500;

let camara = null;
let escena = null;
let sistema = null;      // mindar-image-system, disponible despues de arReady
let dimensiones = [];    // [ancho, alto] de cada portada, para ajustar el video
const planos = [];       // un plano de video por revista, en el orden del JSON
let actual = -1;         // revista cargada en el reproductor
let visible = -1;        // revista que la camara esta viendo (-1 = ninguna)
let sonido = false;      // el visitante ya toco la pantalla
let pausaPendiente = null;

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

  const camara3d = document.createElement('a-camera');
  camara3d.setAttribute('position', '0 0 0');
  camara3d.setAttribute('look-controls', 'enabled: false');
  camara3d.setAttribute('wasd-controls', 'enabled: false');
  escena.appendChild(camara3d);

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
  $('cargando').hidden = true;
  $('guia').hidden = false;

  // Error tipico al preparar la feria: el .mind no corresponde al JSON.
  if (dimensiones.length && dimensiones.length !== camara.revistas.length) {
    const aviso = $('aviso-tecnico');
    aviso.textContent = `Aviso para el docente: ${rutaTargets(camara.id)} tiene ${dimensiones.length} portadas, ` +
      `pero revistas.json tiene ${camara.revistas.length} revistas en la cámara ${nombreCamara(camara)}. Vuelve a compilarla.`;
    aviso.hidden = false;
  }
}

// ---------- Deteccion ----------

function alEncontrar(i) {
  clearTimeout(pausaPendiente);
  visible = i;
  $('guia').hidden = true;
  pintarTarjeta(i);
  if (actual !== i) cargarVideo(i);
  reproducir();
  const revista = camara.revistas[i];
  contarEvento(`ar-${revista.id}`, `AR · ${revista.id} · ${revista.titulo}`);
}

function alPerder(i) {
  if (visible === i) visible = -1;
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
  if (actual !== -1) planos[actual].setAttribute('visible', 'true');
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

async function reproducir() {
  if (!$('pantalla-completa').hidden || visible === -1) return;
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
  if (visible !== -1 && $('pantalla-completa').hidden) videoAR.play().catch(() => {});
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
