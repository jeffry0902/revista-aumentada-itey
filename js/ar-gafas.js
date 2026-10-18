// Modo gafas de la camara (ar.html): pantalla partida para las gafas tipo VR Box,
// pero mostrando lo que ve la camara del celular, con el video encima de la portada.
//
// El modo VR de A-Frame no sirve aqui: dibuja solo la escena 3D y la imagen de la
// camara queda negra. Por eso se hace en dos pasos, despues de cada cuadro:
//   1. Se arma la imagen de un ojo en un lienzo 2D: la camara (el <video> de
//      MindAR), encima la escena 3D (el lienzo de A-Frame), el punto de mira y el
//      mensaje. La camara ocupa solo el centro, casi a tamaño real: si llenara el
//      visor se veria el doble de grande y cada giro de cabeza la moveria el doble
//      de rapido, y eso marea.
//   2. Se dibuja esa imagen en los dos visores con la misma deformacion de lente
//      que usa la sala virtual (Cardboard): por eso los lados quedan redondeados
//      y, vista a traves de las lentes, la imagen se ve recta.
// Mirar un boton 3D 2 segundos lo elige, igual que en la sala virtual.

const ESPERA_MIRADA_MS = 1800; // igual que el cursor de la sala

// Medido en la sala virtual (A-Frame en modo gafas) en un Samsung de 6,9":
// cada visor es un cuadrado de 36 % del ancho de la pantalla, centrado al 31 % y
// al 69 % del ancho y al 56 % del alto.
const VISOR = { lado: 0.36, centroX: 0.19, centroY: 0.56 };
// Deformacion de las lentes de Cardboard (los mismos coeficientes de A-Frame).
const LENTE = [0.34, 0.55];
// Que parte del alto de la imagen del ojo ocupa la camara. Con ~0,55 la camara
// se ve casi a tamaño real a traves de las lentes.
const CAMARA = 0.58;
const LADO_OJO = 1024; // pixeles de la imagen de un ojo

let activo = false;
let sistema = null;        // MindAR: su .video cambia si se reinicia la camara
let lienzoGL = null;       // escena 3D (A-Frame)
let salida = null;         // lienzo de la pantalla, con WebGL
let gl = null;
let textura = null;
let ojo = null;            // imagen de un ojo (2D)
let octx = null;
let texto = '';
let inicioMirada = 0;      // cuando empezo a mirar un boton (0 = no esta mirando)
let alSalir = null;
let bloqueo = null;        // wake lock: que la pantalla no se apague

// Se registra al cargar el modulo: A-Frame ya esta cargado en <head>.
AFRAME.registerComponent('pantalla-partida', {
  // tock corre despues de que A-Frame dibuja el cuadro: el lienzo 3D todavia tiene la imagen.
  tock() {
    if (activo) dibujar();
  },
});

export function prepararGafas({ escena, sistema: s, cursor, salir }) {
  sistema = s;
  lienzoGL = escena.canvas;
  alSalir = salir;

  ojo = document.createElement('canvas');
  ojo.width = ojo.height = LADO_OJO;
  octx = ojo.getContext('2d');

  salida = document.createElement('canvas');
  salida.className = 'gafas-lienzo';
  salida.hidden = true;
  document.body.appendChild(salida);
  prepararWebGL();

  // Fuera de las gafas: tocar la pantalla muestra el boton para salir.
  const botonSalir = document.createElement('button');
  botonSalir.className = 'gafas-salir boton boton--blanco';
  botonSalir.type = 'button';
  botonSalir.textContent = 'Salir del modo gafas';
  botonSalir.hidden = true;
  document.body.appendChild(botonSalir);
  let temporizador = null;
  salida.addEventListener('click', () => {
    botonSalir.hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { botonSalir.hidden = true; }, 4000);
  });
  botonSalir.addEventListener('click', e => {
    e.stopPropagation();
    botonSalir.hidden = true;
    salirGafas();
  });
  document.addEventListener('fullscreenchange', () => {
    if (activo && !document.fullscreenElement) salirGafas();
  });

  // Progreso de la mirada sobre un boton.
  cursor.addEventListener('fusing', () => { inicioMirada = performance.now(); });
  cursor.addEventListener('mouseleave', () => { inicioMirada = 0; });
  cursor.addEventListener('click', () => { inicioMirada = 0; });
}

// Debe llamarse dentro de un toque: pantalla completa y giro a horizontal lo exigen.
export async function entrarGafas() {
  activo = true;
  salida.hidden = false;
  document.body.classList.add('modo-gafas');
  try {
    if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch {
    // iPhone no deja: el visitante gira el celular a mano.
  }
  try {
    if ('wakeLock' in navigator) bloqueo = await navigator.wakeLock.request('screen');
  } catch {
    // Opcional.
  }
}

export function salirGafas() {
  if (!activo) return;
  activo = false;
  salida.hidden = true;
  document.body.classList.remove('modo-gafas');
  if (bloqueo) bloqueo.release().catch(() => {});
  bloqueo = null;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (screen.orientation && screen.orientation.unlock) {
    try { screen.orientation.unlock(); } catch { /* sin pantalla completa no aplica */ }
  }
  if (alSalir) alSalir();
}

export function gafasActivas() {
  return activo;
}

// Mensaje que se ve sobre la imagen de la camara, en los dos visores.
export function textoGafas(t) {
  texto = t || '';
}

// ---------------------------------------------------------------- paso 1: imagen del ojo

function armarOjo() {
  const L = LADO_OJO;
  const video = sistema.video;
  const W = lienzoGL.clientWidth || window.innerWidth;
  const H = lienzoGL.clientHeight || window.innerHeight;
  octx.fillStyle = '#0b1430';
  octx.fillRect(0, 0, L, L);

  // Recorte cuadrado del centro de la pantalla (lo que MindAR muestra de la camara).
  const lado = Math.min(W, H);
  const x0 = (W - lado) / 2, y0 = (H - lado) / 2;
  const destino = L * CAMARA;
  const d0 = (L - destino) / 2;
  if (video && video.videoWidth) {
    // Donde puso MindAR el video en la pantalla (lo agranda para cubrirla y lo centra).
    const vx = parseFloat(video.style.left) || 0;
    const vy = parseFloat(video.style.top) || 0;
    const vw = parseFloat(video.style.width) || W;
    const e = video.videoWidth / vw;
    octx.drawImage(video, (x0 - vx) * e, (y0 - vy) * e, lado * e, lado * e, d0, d0, destino, destino);
  }
  const g = lienzoGL.width / W;
  octx.drawImage(lienzoGL, x0 * g, y0 * g, lado * g, lado * g, d0, d0, destino, destino);

  dibujarMira(L / 2, L / 2);
  // El mensaje va dentro de la imagen, arriba: mas al borde la lente lo deforma.
  if (texto) dibujarTexto(L / 2, d0 + 42, destino * 0.96);
}

function dibujarMira(x, y) {
  octx.lineWidth = 7;
  octx.strokeStyle = 'rgba(0,0,0,0.55)';
  octx.beginPath(); octx.arc(x, y, 15, 0, Math.PI * 2); octx.stroke();
  octx.strokeStyle = '#ffd21f';
  octx.lineWidth = 4;
  octx.beginPath(); octx.arc(x, y, 14, 0, Math.PI * 2); octx.stroke();
  if (inicioMirada) {
    // Anillo que se llena mientras se mira un boton.
    const avance = Math.min(1, (performance.now() - inicioMirada) / ESPERA_MIRADA_MS);
    octx.lineWidth = 7;
    octx.beginPath();
    octx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + avance * Math.PI * 2);
    octx.stroke();
  }
}

function dibujarTexto(x, y, maxAncho) {
  octx.font = '700 30px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  const ancho = Math.min(maxAncho, octx.measureText(texto).width + 44);
  const alto = 50;
  octx.fillStyle = 'rgba(19,32,74,0.95)';
  octx.beginPath();
  octx.roundRect(x - ancho / 2, y - alto / 2, ancho, alto, alto / 2);
  octx.fill();
  octx.fillStyle = '#fff';
  octx.fillText(texto, x, y + 2, maxAncho - 30);
}

// ---------------------------------------------------------------- paso 2: lentes

const VERTICES = `
attribute vec2 posicion;
varying vec2 p;
void main() {
  p = posicion;
  gl_Position = vec4(posicion, 0.0, 1.0);
}`;

// p va de -1 a 1 en el visor. Cada punto toma la imagen de mas afuera cuanto mas
// lejos esta del centro (deformacion de barril): las lentes la vuelven a enderezar.
const FRAGMENTOS = `
precision mediump float;
uniform sampler2D imagen;
uniform vec2 lente;
varying vec2 p;
void main() {
  float r2 = dot(p, p);
  float f = (1.0 + lente.x * r2 + lente.y * r2 * r2) / (1.0 + lente.x + lente.y);
  vec2 s = p * f;
  if (abs(s.x) > 1.0 || abs(s.y) > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = texture2D(imagen, vec2(s.x * 0.5 + 0.5, 0.5 - s.y * 0.5));
  }
}`;

function prepararWebGL() {
  gl = salida.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  const programa = gl.createProgram();
  for (const [tipo, codigo] of [[gl.VERTEX_SHADER, VERTICES], [gl.FRAGMENT_SHADER, FRAGMENTOS]]) {
    const sh = gl.createShader(tipo);
    gl.shaderSource(sh, codigo);
    gl.compileShader(sh);
    gl.attachShader(programa, sh);
  }
  gl.linkProgram(programa);
  gl.useProgram(programa);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(programa, 'posicion');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(programa, 'lente'), LENTE[0], LENTE[1]);

  textura = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textura);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function dibujar() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = salida.clientWidth, H = salida.clientHeight;
  if (!W || !H) return;
  if (salida.width !== Math.round(W * dpr) || salida.height !== Math.round(H * dpr)) {
    salida.width = Math.round(W * dpr);
    salida.height = Math.round(H * dpr);
  }
  armarOjo();
  gl.bindTexture(gl.TEXTURE_2D, textura);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ojo);

  gl.viewport(0, 0, salida.width, salida.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const lado = Math.min(W * VISOR.lado, H * 0.86) * dpr;
  const cy = (1 - VISOR.centroY) * H * dpr; // WebGL cuenta desde abajo
  for (const cx of [(0.5 - VISOR.centroX) * W * dpr, (0.5 + VISOR.centroX) * W * dpr]) {
    gl.viewport(Math.round(cx - lado / 2), Math.round(cy - lado / 2), Math.round(lado), Math.round(lado));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
