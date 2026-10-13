// Sala virtual: sala.html
//
// El visitante se pone las gafas (celular acostado dentro) y queda en una sala
// circular con todas las portadas de revistas.json colgadas a su alrededor.
// Mirar una portada 2 segundos abre su video en una pantalla gigante; mirar
// «Volver» 2 segundos regresa a la sala. Sin gafas funciona igual moviendo el
// celular (o arrastrando con el mouse y haciendo clic en el computador).
//
// No tiene configuracion propia: usa las mismas carpetas revistas/<id>/ que la
// camara, asi que cada revista nueva aparece sola en la sala.

import { cargarDatos, revistasPorCurso } from './datos.js';
import { iniciarContador, contarVisita, contarEvento } from './contador.js';

const $ = id => document.getElementById(id);

// Medidas en metros. Los ojos estan a 1,6 m.
const RADIO = 3.0;          // distancia de las portadas al visitante
const ALTURA = 1.62;        // centro de las portadas (a la altura de los ojos)
const ANCHO_PORTADA = 0.95;
const PASO_MAX = 30;        // grados maximos entre portadas (con pocas revistas no se reparten en 360°)
const DIST_PANTALLA = 2.2;  // distancia de la pantalla del video
const PANTALLA_MAX = { ancho: 2.8, alto: 1.5 };
const ESPERA_FIN_MS = 6000; // al terminar el video, vuelve sola a la sala

const COLOR = { azul: '#13204a', amarillo: '#ffd21f', rojo: '#e3171e', blanco: '#ffffff' };
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const escena = $('escena');
const video = $('video-sala');
const cursor = $('cursor');
const contenido = $('contenido');
const pantalla = $('pantalla');

let revistas = [];          // [{ revista, angulo, el, marco, portada }]
let abierta = null;         // revista cuyo video se esta viendo
let temporizadorFin = null;
let audioListo = false;

iniciar();

async function iniciar() {
  let datos;
  try {
    datos = await cargarDatos();
  } catch (error) {
    $('estado-carga').textContent = 'No se pudieron cargar las revistas: ' + error.message;
    return;
  }
  iniciarContador(datos.goatcounter);
  contarVisita('/sala', 'Sala virtual');
  if (datos.evento) $('evento').textContent = datos.evento;

  const lista = revistasPorCurso(datos).flatMap(g => g.revistas.map(r => r.revista));
  if (!lista.length) {
    $('estado-carga').textContent = 'Todavía no hay revistas en revistas.json.';
    return;
  }

  await esperarEscena();
  const aspectos = await Promise.all(lista.map(r => aspectoImagen(r.objetivo)));
  await construirTitulo(datos.evento || 'Feria de la Ciencia');
  construirPortadas(lista, aspectos);
  construirPantalla();
  prepararCursor();

  $('estado-carga').textContent = `${lista.length} revistas en la sala.`;
  $('boton-gafas').disabled = false;
  $('boton-sin-gafas').disabled = false;
  $('boton-gafas').addEventListener('click', () => entrar(true));
  $('boton-sin-gafas').addEventListener('click', () => entrar(false));
  $('boton-salir').addEventListener('click', salir);
  escena.addEventListener('exit-vr', () => { if (!$('entrada').hidden) return; salir(); });
}

function esperarEscena() {
  return new Promise(resolve => (escena.hasLoaded ? resolve() : escena.addEventListener('loaded', resolve, { once: true })));
}

// ---------------------------------------------------------------- entrada

function entrar(conGafas) {
  // Este toque es el permiso del navegador para reproducir con sonido mas tarde,
  // cuando el visitante "elija" una revista con la mirada (eso no cuenta como toque).
  desbloquearAudio();
  pedirPantallaEncendida();
  $('entrada').hidden = true;
  $('boton-salir').hidden = conGafas;
  contarEvento(conGafas ? 'sala-gafas' : 'sala-sin-gafas', conGafas ? 'Sala · con gafas' : 'Sala · sin gafas');
  if (conGafas) {
    // enterVR debe llamarse dentro del toque (pide pantalla completa).
    escena.enterVR().catch(() => {
      // Si el navegador no tiene modo gafas, queda en modo "ventana" moviendo el celular.
      $('boton-salir').hidden = false;
    });
  }
}

function salir() {
  cerrarVideo();
  if (escena.is('vr-mode')) escena.exitVR();
  $('boton-salir').hidden = true;
  $('entrada').hidden = false;
}

function desbloquearAudio() {
  if (audioListo) return;
  audioListo = true;
  video.muted = false;
  video.src = revistas[0].revista.video;
  const intento = video.play();
  if (intento && intento.then) intento.then(() => video.pause()).catch(() => {});
}

async function pedirPantallaEncendida() {
  try {
    if ('wakeLock' in navigator) await navigator.wakeLock.request('screen');
  } catch {
    // Opcional: algunos navegadores no lo permiten.
  }
}

// ---------------------------------------------------------------- escena

function construirPortadas(lista, aspectos) {
  const n = lista.length;
  const paso = Math.min(360 / n, PASO_MAX);
  // La etiqueta no puede ser mas ancha que el espacio entre portadas vecinas.
  const anchoEtiqueta = Math.min(1.25, 2 * Math.PI * RADIO * paso / 360 * 0.94);
  lista.forEach((revista, i) => {
    const angulo = (i - (n - 1) / 2) * paso; // 0° = al frente; positivo = a la derecha
    const rad = angulo * Math.PI / 180;
    const alto = ANCHO_PORTADA * aspectos[i];

    const grupo = document.createElement('a-entity');
    grupo.setAttribute('position', `${(RADIO * Math.sin(rad)).toFixed(3)} ${ALTURA} ${(-RADIO * Math.cos(rad)).toFixed(3)}`);
    grupo.setAttribute('rotation', `0 ${-angulo} 0`);

    const marco = document.createElement('a-plane');
    marco.setAttribute('width', ANCHO_PORTADA + 0.06);
    marco.setAttribute('height', alto + 0.06);
    marco.setAttribute('position', '0 0 -0.01');
    marco.setAttribute('material', `shader: flat; color: ${COLOR.amarillo}`);
    marco.setAttribute('visible', 'false');

    const portada = document.createElement('a-image');
    portada.setAttribute('src', revista.objetivo);
    portada.setAttribute('width', ANCHO_PORTADA);
    portada.setAttribute('height', alto);
    portada.setAttribute('material', 'shader: flat');
    portada.classList.add('seleccionable');

    const etiqueta = document.createElement('a-image');
    etiqueta.setAttribute('src', lienzoEtiqueta(revista));
    etiqueta.setAttribute('width', anchoEtiqueta);
    etiqueta.setAttribute('height', anchoEtiqueta * 300 / 900);
    etiqueta.setAttribute('position', `0 ${-(alto / 2 + 0.25)} 0`);
    etiqueta.setAttribute('material', 'shader: flat; transparent: true');

    grupo.append(marco, portada, etiqueta);
    contenido.appendChild(grupo);

    portada.addEventListener('mouseenter', () => resaltar(grupo, marco, true));
    portada.addEventListener('mouseleave', () => resaltar(grupo, marco, false));
    portada.addEventListener('click', () => abrirVideo(revista, angulo));
    revistas.push({ revista, angulo, el: grupo, marco, portada });
  });
}

function resaltar(grupo, marco, si) {
  marco.setAttribute('visible', si);
  grupo.setAttribute('animation__escala', `property: scale; to: ${si ? '1.07 1.07 1.07' : '1 1 1'}; dur: 200; easing: easeOutQuad`);
}

async function construirTitulo(evento) {
  const escudo = await cargarImagen('img/escudo-itey.jpg').catch(() => null);
  const url = lienzo(1800, 420, ctx => {
    if (escudo) {
      ctx.save();
      ctx.beginPath(); ctx.arc(170, 210, 150, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = COLOR.blanco; ctx.fill(); ctx.clip();
      ctx.drawImage(escudo, 40, 80, 260, 260);
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOR.blanco;
    ctx.font = `900 120px ${FUENTE}`;
    ctx.fillText('REVISTA AUMENTADA', 360, 190, 1420);
    ctx.fillStyle = COLOR.amarillo;
    ctx.fillRect(364, 222, 300, 12);
    ctx.fillStyle = COLOR.rojo;
    ctx.fillRect(676, 222, 70, 12);
    ctx.fillStyle = COLOR.amarillo;
    ctx.font = `700 60px ${FUENTE}`;
    ctx.fillText(`Sala virtual · ${evento} · ITEY`, 364, 305, 1420);
    ctx.fillStyle = '#c7d2fe';
    ctx.font = `500 46px ${FUENTE}`;
    ctx.fillText('Mira una portada 2 segundos para ver su video', 364, 375, 1420);
  });
  const titulo = document.createElement('a-image');
  titulo.id = 'titulo-sala';
  titulo.setAttribute('src', url);
  titulo.setAttribute('width', 2.6);
  titulo.setAttribute('height', 2.6 * 420 / 1800);
  titulo.setAttribute('position', `0 2.78 ${-(RADIO + 0.05)}`);
  titulo.setAttribute('material', 'shader: flat; transparent: true');
  escena.appendChild(titulo);
}

function construirPantalla() {
  $('boton-volver').setAttribute('src', lienzoBoton('‹  Volver', COLOR.amarillo, COLOR.azul));
  $('boton-repetir').setAttribute('src', lienzoBoton('⟲  Repetir', COLOR.blanco, COLOR.azul));
  for (const id of ['boton-volver', 'boton-repetir']) {
    const b = $(id);
    b.setAttribute('width', 0.62);
    b.setAttribute('height', 0.62 * 160 / 560);
    b.addEventListener('mouseenter', () => b.setAttribute('animation__escala', 'property: scale; to: 1.12 1.12 1.12; dur: 150'));
    b.addEventListener('mouseleave', () => b.setAttribute('animation__escala', 'property: scale; to: 1 1 1; dur: 150'));
  }
  $('boton-volver').addEventListener('click', cerrarVideo);
  $('boton-repetir').addEventListener('click', () => {
    clearTimeout(temporizadorFin);
    $('pantalla-aviso').setAttribute('visible', false);
    video.currentTime = 0;
    video.play().catch(() => {});
  });

  video.addEventListener('loadedmetadata', ajustarPantalla);
  video.addEventListener('playing', () => $('pantalla-aviso').setAttribute('visible', false));
  video.addEventListener('waiting', () => mostrarAviso('Cargando video…'));
  video.addEventListener('ended', () => {
    mostrarAviso('Fin del video · volviendo a la sala…');
    temporizadorFin = setTimeout(cerrarVideo, ESPERA_FIN_MS);
  });
  video.addEventListener('error', () => { if (abierta) mostrarAviso('No se pudo cargar el video'); });
}

function prepararCursor() {
  // En el computador no hay giroscopio: se mira arrastrando y se elige con clic.
  const conMouse = matchMedia('(pointer: fine)').matches && !('ontouchstart' in window);
  if (conMouse) cursor.setAttribute('cursor', 'rayOrigin: mouse; fuse: false');
}

// ---------------------------------------------------------------- video

function abrirVideo(revista, angulo) {
  if (abierta) return;
  abierta = revista;
  clearTimeout(temporizadorFin);
  contarEvento(`sala-${revista.id}`, `Sala · ${revista.id}`);

  // La pantalla aparece donde esta mirando el visitante: frente a la portada elegida.
  const rad = angulo * Math.PI / 180;
  pantalla.setAttribute('position', `${(DIST_PANTALLA * Math.sin(rad)).toFixed(3)} 1.6 ${(-DIST_PANTALLA * Math.cos(rad)).toFixed(3)}`);
  pantalla.setAttribute('rotation', `0 ${-angulo} 0`);
  $('pantalla-titulo').setAttribute('src', lienzoTituloVideo(revista));
  pantalla.setAttribute('visible', true);
  pantalla.setAttribute('animation__entra', 'property: scale; from: 0.6 0.6 0.6; to: 1 1 1; dur: 250; easing: easeOutBack');
  // Modo cine: solo la pantalla, sin las demas portadas alrededor.
  contenido.setAttribute('visible', false);
  $('titulo-sala').setAttribute('visible', false);

  // Mientras se ve el video solo se pueden elegir los botones de la pantalla.
  seleccionables(revistas.map(r => r.portada), false);
  seleccionables([$('boton-volver'), $('boton-repetir')], true);

  mostrarAviso('Cargando video…');
  ajustarPantalla({ ancho: 9, alto: 16 }); // vertical mientras llega el video real
  video.muted = false;
  video.src = revista.video;
  video.currentTime = 0;
  video.play().catch(() => mostrarAviso('Toca la pantalla para oír el video'));
}

function cerrarVideo() {
  if (!abierta) return;
  abierta = null;
  clearTimeout(temporizadorFin);
  video.pause();
  pantalla.setAttribute('visible', false);
  $('pantalla-aviso').setAttribute('visible', false);
  contenido.setAttribute('visible', true);
  $('titulo-sala').setAttribute('visible', true);
  revistas.forEach(r => {
    r.el.setAttribute('scale', '1 1 1');
    r.marco.setAttribute('visible', false);
  });
  seleccionables([$('boton-volver'), $('boton-repetir')], false);
  seleccionables(revistas.map(r => r.portada), true);
}

function seleccionables(elementos, si) {
  elementos.forEach(el => el.classList.toggle('seleccionable', si));
  const rc = cursor.components.raycaster;
  if (rc) rc.refreshObjects();
}

function ajustarPantalla(medidas) {
  const ancho = medidas && medidas.ancho ? medidas.ancho : video.videoWidth || 9;
  const alto = medidas && medidas.alto ? medidas.alto : video.videoHeight || 16;
  const escala = Math.min(PANTALLA_MAX.ancho / ancho, PANTALLA_MAX.alto / alto);
  const w = ancho * escala, h = alto * escala;
  const pv = $('pantalla-video');
  pv.setAttribute('width', w);
  pv.setAttribute('height', h);
  const fondo = $('pantalla-fondo');
  fondo.setAttribute('width', w + 0.08);
  fondo.setAttribute('height', h + 0.08);
  const t = $('pantalla-titulo');
  t.setAttribute('width', 2.2);
  t.setAttribute('height', 2.2 * 200 / 1400);
  t.setAttribute('position', `0 ${h / 2 + 0.22} 0`);
  $('boton-volver').setAttribute('position', `-0.36 ${-(h / 2 + 0.2)} 0.02`);
  $('boton-repetir').setAttribute('position', `0.36 ${-(h / 2 + 0.2)} 0.02`);
  const aviso = $('pantalla-aviso');
  aviso.setAttribute('width', 1.6);
  aviso.setAttribute('height', 1.6 * 140 / 1200);
  aviso.setAttribute('position', '0 0 0.03');
}

function mostrarAviso(texto) {
  const aviso = $('pantalla-aviso');
  aviso.setAttribute('src', lienzo(1200, 140, ctx => {
    redondeado(ctx, 0, 0, 1200, 140, 40, 'rgba(19,32,74,0.88)');
    ctx.fillStyle = COLOR.blanco;
    ctx.font = `700 62px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(texto, 600, 92);
  }));
  aviso.setAttribute('visible', true);
}

// ---------------------------------------------------------------- texturas de texto
// Los textos se dibujan en un lienzo 2D (con las fuentes del sistema, que traen
// tildes y ñ) y se usan como imagen dentro de la escena.

function lienzo(ancho, alto, dibujar) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  dibujar(c.getContext('2d'));
  return c.toDataURL('image/png');
}

function lienzoEtiqueta(revista) {
  return lienzo(900, 300, ctx => {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.amarillo;
    ctx.font = `800 58px ${FUENTE}`;
    ctx.fillText(`${revista.curso} · ${revista.equipo}`, 450, 66, 880);
    ctx.fillStyle = COLOR.blanco;
    ctx.font = `700 62px ${FUENTE}`;
    const lineas = envolver(ctx, revista.titulo, 870);
    if (lineas.length > 3) lineas.splice(2, lineas.length - 2, lineas.slice(2).join(' '));
    lineas.slice(0, 3).forEach((linea, i) => ctx.fillText(linea, 450, 146 + i * 72, 880));
  });
}

function lienzoTituloVideo(revista) {
  return lienzo(1400, 200, ctx => {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.amarillo;
    ctx.font = `800 52px ${FUENTE}`;
    ctx.fillText(`${revista.curso} · ${revista.equipo}`, 700, 66, 1360);
    ctx.fillStyle = COLOR.blanco;
    ctx.font = `700 58px ${FUENTE}`;
    const lineas = envolver(ctx, revista.titulo, 1360);
    ctx.fillText(lineas.length > 1 ? lineas[0] + '…' : lineas[0], 700, 150, 1360);
  });
}

function lienzoBoton(texto, fondo, color) {
  return lienzo(560, 160, ctx => {
    redondeado(ctx, 6, 6, 548, 148, 74, fondo);
    ctx.fillStyle = color;
    ctx.font = `800 70px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(texto, 280, 104);
  });
}

function redondeado(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function envolver(ctx, texto, maxAncho) {
  const lineas = [];
  let actual = '';
  for (const palabra of String(texto).split(/\s+/)) {
    const prueba = actual ? actual + ' ' + palabra : palabra;
    if (ctx.measureText(prueba).width > maxAncho && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// ---------------------------------------------------------------- utilidades

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function aspectoImagen(src) {
  try {
    const img = await cargarImagen(src);
    return img.naturalHeight / img.naturalWidth;
  } catch {
    return 1.33; // carta vertical aproximada
  }
}
