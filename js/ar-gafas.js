// Modo gafas de la camara (ar.html): pantalla partida para las gafas tipo VR Box,
// pero mostrando lo que ve la camara del celular, con el video encima de la portada.
//
// El modo VR de A-Frame no sirve aqui: dibuja solo la escena 3D y la imagen de la
// camara queda negra. Por eso, despues de cada cuadro, se copia la imagen de la
// camara (el <video> de MindAR) y la escena 3D (el lienzo de A-Frame) a un lienzo
// propio, una vez en cada mitad de la pantalla. Cada ojo ve el centro de la imagen
// a tamaño real, y en el centro va el punto de mira: mirar un boton 3D 2 segundos
// lo elige, igual que en la sala virtual.

const ESPERA_MIRADA_MS = 1800; // igual que el cursor de la sala

let activo = false;
let video = null;          // camara (MindAR)
let lienzoGL = null;       // escena 3D (A-Frame)
let salida = null;         // lienzo con las dos mitades
let ctx = null;
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

export function prepararGafas({ escena, sistema, cursor, salir }) {
  video = sistema.video;
  lienzoGL = escena.canvas;
  alSalir = salir;

  salida = document.createElement('canvas');
  salida.className = 'gafas-lienzo';
  salida.hidden = true;
  ctx = salida.getContext('2d');
  document.body.appendChild(salida);

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

// Mensaje que se ve arriba, en las dos mitades (abajo van los botones 3D).
export function textoGafas(t) {
  texto = t || '';
}

function dibujar() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = salida.clientWidth, H = salida.clientHeight;
  if (!W || !H) return;
  if (salida.width !== Math.round(W * dpr) || salida.height !== Math.round(H * dpr)) {
    salida.width = Math.round(W * dpr);
    salida.height = Math.round(H * dpr);
  }
  const mitad = W / 2;
  // Recorte del centro de la pantalla, del tamaño de una mitad: cada ojo lo ve a tamaño real.
  const x0 = (W - mitad) / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, salida.width, salida.height);

  // Donde puso MindAR el video en la pantalla (lo agranda para cubrirla y lo centra).
  const vx = parseFloat(video.style.left) || 0;
  const vy = parseFloat(video.style.top) || 0;
  const vw = parseFloat(video.style.width) || W;
  const vh = parseFloat(video.style.height) || H;
  const escalaVideo = video.videoWidth / vw;
  const escalaGL = lienzoGL.width / (lienzoGL.clientWidth || W);

  for (const ojo of [0, 1]) {
    const dx = ojo * mitad * dpr;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, 0, mitad * dpr, H * dpr);
    ctx.clip();
    if (video.videoWidth) {
      ctx.drawImage(video,
        (x0 - vx) * escalaVideo, (0 - vy) * escalaVideo, mitad * escalaVideo, H * escalaVideo,
        dx, 0, mitad * dpr, H * dpr);
    }
    ctx.drawImage(lienzoGL,
      x0 * escalaGL, 0, mitad * escalaGL, H * escalaGL,
      dx, 0, mitad * dpr, H * dpr);
    dibujarMira(dx + (mitad * dpr) / 2, (H * dpr) / 2, dpr);
    if (texto) dibujarTexto(dx + (mitad * dpr) / 2, 30 * dpr, mitad * dpr * 0.86, dpr);
    ctx.restore();
  }
  // Linea divisoria entre los ojos.
  ctx.fillStyle = '#000';
  ctx.fillRect(mitad * dpr - dpr, 0, 2 * dpr, H * dpr);
}

function dibujarMira(x, y, dpr) {
  ctx.lineWidth = 3 * dpr;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(x, y, 9 * dpr, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffd21f';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath(); ctx.arc(x, y, 8 * dpr, 0, Math.PI * 2); ctx.stroke();
  if (inicioMirada) {
    // Anillo que se llena mientras se mira un boton.
    const avance = Math.min(1, (performance.now() - inicioMirada) / ESPERA_MIRADA_MS);
    ctx.lineWidth = 4 * dpr;
    ctx.beginPath();
    ctx.arc(x, y, 15 * dpr, -Math.PI / 2, -Math.PI / 2 + avance * Math.PI * 2);
    ctx.stroke();
  }
}

function dibujarTexto(x, y, maxAncho, dpr) {
  ctx.font = `700 ${15 * dpr}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ancho = Math.min(maxAncho, ctx.measureText(texto).width + 28 * dpr);
  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  const alto = 30 * dpr;
  ctx.beginPath();
  ctx.roundRect(x - ancho / 2, y - alto / 2, ancho, alto, alto / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(texto, x, y + dpr, maxAncho - 20 * dpr);
}
