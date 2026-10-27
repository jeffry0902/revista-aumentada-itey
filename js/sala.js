// Sala virtual: sala.html
//
// El visitante se pone las gafas (celular acostado dentro) y queda en el centro
// de una galeria de arte: cada portada de revistas.json es un cuadro colgado en
// la pared, con su luz y su cartela. Mirar un cuadro saca su portada de la pared y
// seguir mirandola ~6 segundos (tiempo para leerla) abre su video en una pantalla
// gigante (la galeria queda en penumbra); mirar «Volver» 2 segundos regresa.
// Si la revista trae sus paginas, «Leer revista» la abre a
// doble pagina: mirar una pagina la acerca y las flechas la hojean.
// Sin gafas funciona igual moviendo el celular (o arrastrando con el mouse y
// haciendo clic en el computador).
//
// No tiene configuracion propia: usa las mismas carpetas revistas/<id>/ que la
// camara, asi que cada revista nueva aparece sola en la galeria.

import { cargarDatos, revistasPorCurso, videoPendiente } from './datos.js';
import { iniciarContador, contarVisita, contarEvento } from './contador.js';
import { esIOS, ajustarGafasIOS } from './pantalla.js';

const $ = id => document.getElementById(id);

// Medidas en metros. Los ojos estan a 1,6 m.
const ALTO_SALA = 3.8;
const LADOS_MIN = 12;       // la galeria es un poligono: una pared por cuadro (minimo 12 paredes)
const PARED_MIN = 1.5;      // ancho minimo de cada pared: cuadro y cartela sin tocar las columnas (con mas de 12 revistas, la sala crece)
const RADIO_MIN = 2.9;      // distancia del visitante a las paredes (mas cerca, las letras se leen mejor)
const ALTURA = 1.72;        // centro de los cuadros (un poco arriba de los ojos, como en un museo)
const ANCHO_PORTADA = 1.0;
// Ficha grande que aparece cerca al mirar un cuadro: en las gafas, lo cercano se ve
// nitido (como el lector) y las cartelas de la pared se ven pequeñas.
const FICHA = { distancia: 1.5, ancho: 1.15, alto: 1.15 * 420 / 1100, y: 0.97, anguloMax: 28 };
// Portada ampliada que sale de la pared al mirar un cuadro (borde de abajo a 1,16 m: la
// ficha queda justo debajo, sin taparse).
const AMPLIADA = { distancia: 1.7, ancho: 0.95, abajo: 1.16, borde: 0.035, esperaMs: 450 };
const MOLDURA = 0.07;       // marco de madera
const PASPARTU = 0.06;      // borde blanco entre el marco y la portada
const DIST_PANTALLA = 2.2;  // distancia de la pantalla del video
const PANTALLA_MAX = { ancho: 2.8, alto: 1.5 };
const DIST_LECTOR = 1.8;    // distancia de las paginas
const ALTO_PAGINA = 1.6;    // a doble pagina. Elegido por Jeffry con las gafas (23-oct): 1.4 se veia pequeña y 1.8
                            // quedaba encima. (Un «se ve doble» resulto ser el celular torcido dentro del visor.)
const MIRADA_MS = 1800;          // mirar fijo un boton para elegirlo (fuseTimeout del cursor)
const MIRADA_PORTADA_MS = 5400;  // mirar fijo la portada ampliada para abrir su video: el triple,
                                 // para alcanzar a leerla antes (pedido de Jeffry, 23-oct)
const ALTO_PAGINA_CERCA = 2.3; // una pagina acercada para leerla moviendo la cabeza
const ESPERA_FIN_MS = 6000; // al terminar el video, vuelve sola a la galeria
const COLOR = { azul: '#13204a', amarillo: '#ffd21f', rojo: '#e3171e', blanco: '#ffffff' };
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const escena = $('escena');
const video = $('video-sala');
const cursor = $('cursor');
const galeria = $('galeria');
const contenido = $('contenido');
const pantalla = $('pantalla');
const lector = $('lector');

let sala = null;            // { lados, paso, radio, anchoPared }
let revistas = [];          // [{ revista, angulo, el, resalte, portada }]
let abierta = null;         // revista cuyo video se esta viendo
let leyendo = null;         // { revista, angulo, vista, cerca } mientras se hojea una revista
let temporizadorFin = null;
let temporizadorAviso = null;
let audioListo = false;
const aspectos = new Map(); // alto/ancho de cada imagen ya medida

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
  // El modo gafas va con la resolucion que Chrome elige (WebXR). El 27-oct, en la feria, quedo en
  // negro dentro de las gafas pidiendole el doble; con la de Chrome se veia igual (Jeffry, 24-oct).
  await Promise.all(lista.map(r => medir(r.objetivo)));
  sala = medidasSala(lista.length);
  // La penumbra del modo cine va entre la pantalla del video (esquinas a ~2,7 m) y las paredes.
  $('penumbra').querySelector('a-sphere').setAttribute('radius', Math.min(2.9, sala.radio - 0.15));
  await construirGaleria(lista.length);
  await construirTitulo(datos.evento || 'Feria de la Ciencia');
  construirAtril();
  construirCuadros(lista);
  construirAmpliadas();
  construirPantalla();
  construirLector();
  ordenRender($('penumbra'), 1);
  ordenRender(pantalla, 2);
  ordenRender(lector, 2);
  prepararCursor();
  ajustarGafasIOS(); // en iPhone: el tamaño real de la pantalla, para que no se vea doble
  $('nota-iphone').hidden = !esIOS();
  // Abierta desde el ícono de la pantalla de inicio ya no hay barra de Safari.
  $('nota-barra').hidden = navigator.standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;

  $('estado-carga').textContent = `${lista.length} revistas en la galería.`;
  $('boton-gafas').disabled = false;
  $('boton-sin-gafas').disabled = false;
  $('boton-gafas').addEventListener('click', () => entrar(true));
  $('boton-sin-gafas').addEventListener('click', () => entrar(false));
  $('boton-salir').addEventListener('click', salir);
  // Si un video quedo sin sonido (el celular no lo dejo sonar), un toque en la pantalla se lo activa.
  document.addEventListener('touchend', () => {
    if (abierta && video.muted) {
      video.muted = false;
      video.play().catch(() => {});
      $('pantalla-aviso').setAttribute('visible', false);
    }
  });
  escena.addEventListener('exit-vr', () => { if (!$('entrada').hidden) return; salir(); });
  escena.addEventListener('enter-vr', pedirMasCuadros);
  // «No permitir» en el aviso de A-Frame al cargar (iPhone).
  escena.addEventListener('deviceorientationpermissionrejected', sinSensores);
}

// Mas cuadros por segundo = menos borroso al girar la cabeza: la pantalla del celular deja
// cada imagen encendida hasta la siguiente y, al moverse el ojo, se arrastra. Elegir la
// frecuencia solo lo permiten las gafas autonomas (Quest); en Chrome Android y en iPhone la
// decide el celular (ver README) y esto no hace nada.
function pedirMasCuadros() {
  const sesion = escena.xrSession;
  if (!sesion || !sesion.supportedFrameRates || !sesion.updateTargetFrameRate) return;
  const maximo = Math.max(...sesion.supportedFrameRates);
  if (maximo > 0) sesion.updateTargetFrameRate(maximo).catch(() => {});
}

function esperarEscena() {
  return new Promise(resolve => (escena.hasLoaded ? resolve() : escena.addEventListener('loaded', resolve, { once: true })));
}

// ---------------------------------------------------------------- entrada

function entrar(conGafas) {
  // Este toque es el permiso del navegador para reproducir con sonido mas tarde,
  // cuando el visitante "elija" una revista con la mirada (eso no cuenta como toque).
  desbloquearAudio();
  pedirSensores();
  pedirPantallaEncendida();
  $('entrada').hidden = true;
  // En iPhone no hay barra ni boton del navegador para salir de las gafas: queda el de la pagina.
  $('boton-salir').hidden = conGafas && !esIOS();
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
  ocultarAmpliada();
  cerrarVideo();
  cerrarLector();
  if (escena.is('vr-mode')) escena.exitVR();
  $('boton-salir').hidden = true;
  $('entrada').hidden = false;
}

function desbloquearAudio() {
  if (audioListo) return;
  audioListo = true;
  video.muted = false;
  // Un segundo de silencio: basta para el permiso y no descarga ni decodifica un video real
  // justo cuando Chrome abre el modo gafas (desde que la primera revista tiene video, el
  // 27-oct, la galeria quedaba en negro dentro de las gafas).
  video.src = 'img/silencio.mp4';
  const intento = video.play();
  if (intento && intento.then) intento.then(() => video.pause()).catch(() => {});
}

// iPhone: los sensores de movimiento necesitan permiso, y solo se puede pedir con un
// toque. A-Frame muestra su propio aviso al cargar (traducido en sala.html); si el
// visitante no lo contesto, se pide aqui, con el toque de «Entrar».
// Se pregunta siempre (si ya se contesto, responde al instante sin aviso): A-Frame marca el
// permiso como dado aunque el visitante haya tocado «No permitir».
function pedirSensores() {
  if (!window.DeviceOrientationEvent || !DeviceOrientationEvent.requestPermission) return;
  const ui = escena.components['device-orientation-permission-ui'];
  DeviceOrientationEvent.requestPermission().then(estado => {
    if (estado !== 'granted') return sinSensores();
    if (ui && !ui.permissionGranted) {
      ui.permissionGranted = true;
      escena.emit('deviceorientationpermissiongranted'); // asi A-Frame empieza a seguir el celular
    }
  }).catch(() => {});
}

// Sin permiso de movimiento la galeria no sigue la cabeza: se sale y se explica.
function sinSensores() {
  salir();
  $('estado-carga').textContent = 'El iPhone no dejó usar el movimiento del celular, y sin eso la galería no sigue la cabeza. ' +
    'Cierra Safari (o la app de la galería) deslizándola hacia arriba, vuelve a abrir la galería y toca «Permitir».';
}

// La pantalla no debe apagarse dentro de las gafas. El navegador suelta este permiso
// cada vez que la pagina se oculta (una notificacion, el Centro de control): se pide de nuevo al volver.
let bloqueoPantalla = null;
async function pedirPantallaEncendida() {
  try {
    if ('wakeLock' in navigator && !bloqueoPantalla) {
      bloqueoPantalla = await navigator.wakeLock.request('screen');
      bloqueoPantalla.addEventListener('release', () => { bloqueoPantalla = null; });
    }
  } catch {
    // Opcional: algunos navegadores no lo permiten.
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && $('entrada').hidden) pedirPantallaEncendida();
});

// ---------------------------------------------------------------- galeria

// La sala es un poligono regular con el visitante en el centro. Con pocas
// revistas sobran paredes atras; con muchas, la sala se agranda para que
// cada cuadro tenga su pared.
function medidasSala(n) {
  const lados = Math.max(LADOS_MIN, n);
  const tan = Math.tan(Math.PI / lados);
  const radio = Math.max(RADIO_MIN, PARED_MIN / (2 * tan));
  return { lados, paso: 360 / lados, radio, anchoPared: 2 * radio * tan };
}

// 0° = al frente; positivo = a la derecha. El cuadro i queda en la pared i.
function anguloPared(k, n) {
  return (k - (n - 1) / 2) * sala.paso;
}

function enPared(angulo, distancia, y) {
  const rad = angulo * Math.PI / 180;
  return `${(distancia * Math.sin(rad)).toFixed(3)} ${y} ${(-distancia * Math.cos(rad)).toFixed(3)}`;
}

async function construirGaleria(n) {
  const { lados, radio, anchoPared } = sala;
  const esquina = radio / Math.cos(Math.PI / lados); // distancia del centro a cada esquina
  const conLuz = lienzo(512, 1024, ctx => dibujarPared(ctx, anchoPared, true));
  const sinLuz = lienzo(512, 1024, ctx => dibujarPared(ctx, anchoPared, false));
  const escudo = await cargarImagen('img/escudo-itey.jpg').catch(() => null);

  for (let k = 0; k < lados; k++) {
    const angulo = anguloPared(k, n);
    const pared = crear('a-plane', {
      width: anchoPared + 0.02,
      height: ALTO_SALA,
      position: enPared(angulo, radio, ALTO_SALA / 2),
      rotation: `0 ${-angulo} 0`,
      material: 'shader: flat',
      src: k < n ? conLuz : sinLuz,
    });
    // Columnas en las esquinas entre paredes.
    const columna = crear('a-box', {
      width: 0.12, depth: 0.08, height: ALTO_SALA,
      position: enPared(angulo + sala.paso / 2, esquina - 0.04, ALTO_SALA / 2),
      rotation: `0 ${-(angulo + sala.paso / 2)} 0`,
      material: 'color: #e6dccb; roughness: 1',
    });
    galeria.append(pared, columna);
    if (k < n) {
      // Lampara en el riel del techo apuntando al cuadro.
      const lampara = crear('a-cylinder', {
        radius: 0.05, height: 0.2,
        position: enPared(angulo, radio - 0.9, ALTO_SALA - 0.32),
        rotation: `50 ${-angulo} 0`, // inclinada hacia la pared
        material: 'color: #1d1d1f; roughness: 0.6',
      });
      const foco = crear('a-circle', {
        radius: 0.045,
        position: '0 -0.101 0',
        rotation: '90 0 0',
        material: 'shader: flat; color: #fff6d8',
      });
      lampara.appendChild(foco);
      galeria.appendChild(lampara);
    }
  }
  // Pared del fondo (a la espalda): el escudo del colegio, si sobran paredes.
  if (escudo && lados > n) {
    const atras = anguloPared((n - 1) / 2 + lados / 2, n);
    galeria.appendChild(crear('a-image', {
      src: lienzo(512, 512, ctx => {
        ctx.beginPath(); ctx.arc(256, 256, 250, 0, Math.PI * 2);
        ctx.fillStyle = COLOR.blanco; ctx.fill(); ctx.clip();
        ctx.drawImage(escudo, 26, 26, 460, 460);
      }),
      width: 1.1, height: 1.1,
      position: enPared(atras, radio - 0.02, 2.0),
      rotation: `0 ${-atras} 0`,
      material: 'shader: flat; transparent: true',
    }));
  }

  // Piso de madera, alfombra con los colores del ITEY, techo y riel de luces.
  // Son planos subdivididos y no circulos: el circulo es un abanico de triangulos
  // con la punta bajo los pies, y algunos celulares lo dibujan mal al mirar al frente.
  const lado = 2 * esquina + 0.4;
  galeria.appendChild(crear('a-plane', {
    width: lado, height: lado, rotation: '-90 0 0', 'segments-width': 8, 'segments-height': 8,
    material: 'shader: flat; repeat: 3 3', src: lienzo(1024, 1024, dibujarMadera),
  }));
  galeria.appendChild(crear('a-plane', {
    width: 2.7, height: 2.7, rotation: '-90 0 0', position: '0 0.005 0', 'segments-width': 4, 'segments-height': 4,
    material: 'shader: flat; transparent: true', src: lienzo(1024, 1024, dibujarAlfombra),
  }));
  galeria.appendChild(crear('a-plane', {
    width: lado, height: lado, rotation: '90 0 0', position: `0 ${ALTO_SALA} 0`, 'segments-width': 8, 'segments-height': 8,
    material: 'shader: flat', src: lienzo(1024, 1024, dibujarTecho),
  }));
  galeria.appendChild(crear('a-torus', {
    radius: radio - 0.9, 'radius-tubular': 0.018, rotation: '90 0 0', position: `0 ${ALTO_SALA - 0.22} 0`,
    'segments-radial': 6, 'segments-tubular': 64,
    material: 'color: #26262a; roughness: 0.5',
  }));
  galeria.appendChild(contenido); // los cuadros quedan encima de todo lo anterior
}

function dibujarPared(ctx, anchoPared, conLuz) {
  const W = 512, H = 1024;
  const y = m => H * (1 - m / ALTO_SALA); // altura en metros -> pixeles
  // Pared clara calida, un poco mas oscura hacia el techo.
  const fondo = ctx.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, '#cfc5b2');
  fondo.addColorStop(0.5, '#e7dfcf');
  fondo.addColorStop(1, '#e9e2d3');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, H);
  if (conLuz) {
    // Charco de luz de la lampara sobre el cuadro.
    const escalaX = (W / anchoPared) / (H / ALTO_SALA);
    ctx.save();
    ctx.translate(W / 2, y(ALTURA + 0.35));
    ctx.scale(escalaX, 1);
    const luz = ctx.createRadialGradient(0, 0, 0, 0, 0, 340);
    luz.addColorStop(0, 'rgba(255,250,232,0.95)');
    luz.addColorStop(0.45, 'rgba(255,246,222,0.45)');
    luz.addColorStop(1, 'rgba(255,246,222,0)');
    ctx.fillStyle = luz;
    ctx.fillRect(-W, -H, 2 * W, 2 * H);
    ctx.restore();
  }
  // Cornisa arriba.
  ctx.fillStyle = '#f3eee4';
  ctx.fillRect(0, 0, W, y(ALTO_SALA - 0.16));
  ctx.fillStyle = '#b9ae99';
  ctx.fillRect(0, y(ALTO_SALA - 0.16), W, 4);
  // Zocalo azul con filete amarillo (los colores del colegio) y guardaescoba de madera.
  ctx.fillStyle = COLOR.azul;
  ctx.fillRect(0, y(0.9), W, H - y(0.9));
  ctx.fillStyle = '#1d2c5f';
  ctx.fillRect(0, y(0.9) + 18, W, y(0.14) - y(0.9) - 36);
  ctx.fillStyle = COLOR.amarillo;
  ctx.fillRect(0, y(0.9) - 3, W, 6);
  ctx.fillStyle = '#3b2a1e';
  ctx.fillRect(0, y(0.14), W, H - y(0.14));
}

function dibujarMadera(ctx) {
  const W = 1024, filas = 12, alto = W / filas;
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let f = 0; f < filas; f++) {
    let x = -azar() * 300;
    while (x < W) {
      const largo = 260 + azar() * 220;
      const tono = 0.85 + azar() * 0.2;
      ctx.fillStyle = `rgb(${Math.round(150 * tono)},${Math.round(104 * tono)},${Math.round(66 * tono)})`;
      ctx.fillRect(x, f * alto, largo, alto);
      // Vetas.
      ctx.strokeStyle = 'rgba(70,42,20,0.18)';
      ctx.lineWidth = 2;
      for (let v = 0; v < 4; v++) {
        const vy = f * alto + 10 + azar() * (alto - 20);
        ctx.beginPath();
        ctx.moveTo(x, vy);
        ctx.bezierCurveTo(x + largo * 0.3, vy - 6, x + largo * 0.7, vy + 6, x + largo, vy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,24,12,0.55)';
      ctx.fillRect(x, f * alto, 3, alto);
      x += largo;
    }
    ctx.fillStyle = 'rgba(40,24,12,0.6)';
    ctx.fillRect(0, f * alto, W, 3);
  }
}

function dibujarAlfombra(ctx) {
  const c = 512;
  ctx.beginPath(); ctx.arc(c, c, 510, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.azul; ctx.fill();
  ctx.lineWidth = 18; ctx.strokeStyle = COLOR.amarillo;
  ctx.beginPath(); ctx.arc(c, c, 470, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = COLOR.rojo;
  ctx.beginPath(); ctx.arc(c, c, 440, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#1d2c5f';
  ctx.beginPath(); ctx.arc(c, c, 300, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,210,31,0.6)';
  ctx.beginPath(); ctx.arc(c, c, 300, 0, Math.PI * 2); ctx.stroke();
}

function dibujarTecho(ctx) {
  const techo = ctx.createRadialGradient(512, 512, 0, 512, 512, 724);
  techo.addColorStop(0, '#fffdf6');   // claraboya
  techo.addColorStop(0.16, '#f4efe3');
  techo.addColorStop(0.19, '#d9d0bf');
  techo.addColorStop(1, '#c4baa6');
  ctx.fillStyle = techo;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = 'rgba(150,138,118,0.6)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(512, 512, 120, 0, Math.PI * 2); ctx.stroke();
}

// Atril frente al visitante con la instruccion: se ve al mirar hacia abajo y
// queda por debajo de la linea de vista a las cartelas.
function construirAtril() {
  const atril = crear('a-entity', { id: 'atril', position: '0 0 -1.0' });
  atril.appendChild(crear('a-box', {
    width: 0.46, height: 0.62, depth: 0.26, position: '0 0.31 -0.05',
    material: `color: ${COLOR.azul}; roughness: 0.9`,
  }));
  const tabla = crear('a-entity', { position: '0 0.8 0', rotation: '-40 0 0' });
  tabla.appendChild(crear('a-box', {
    width: 0.68, height: 0.46, depth: 0.03,
    material: 'color: #3b2a1e; roughness: 0.8',
  }));
  tabla.appendChild(crear('a-image', {
    src: lienzo(1000, 640, dibujarInstruccion),
    width: 0.62, height: 0.62 * 640 / 1000, position: '0 0 0.017',
    material: 'shader: flat',
  }));
  atril.appendChild(tabla);
  galeria.appendChild(atril);
}

function dibujarInstruccion(ctx) {
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(0, 0, 1000, 640);
  ctx.strokeStyle = COLOR.amarillo; ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 986, 626);
  // Ojo.
  ctx.save();
  ctx.translate(500, 150);
  ctx.fillStyle = COLOR.azul;
  ctx.beginPath();
  ctx.moveTo(-120, 0);
  ctx.quadraticCurveTo(0, -105, 120, 0);
  ctx.quadraticCurveTo(0, 105, -120, 0);
  ctx.fill();
  ctx.fillStyle = COLOR.amarillo;
  ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLOR.azul;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.azul;
  ctx.font = `900 74px ${FUENTE}`;
  ctx.fillText('Mira fijo una portada', 500, 330, 940);
  ctx.fillText('6 segundos', 500, 415, 940);
  ctx.fillStyle = COLOR.rojo;
  ctx.font = `800 60px ${FUENTE}`;
  ctx.fillText('y se reproduce tu video', 500, 500, 940);
  ctx.fillStyle = '#4b5563';
  ctx.font = `600 44px ${FUENTE}`;
  ctx.fillText('Gira la cabeza para recorrer la galería', 500, 585, 940);
}

function construirCuadros(lista) {
  const n = lista.length;
  lista.forEach((revista, i) => {
    const angulo = anguloPared(i, n);
    const alto = ANCHO_PORTADA * aspectos.get(revista.objetivo);
    const borde = MOLDURA + PASPARTU;

    const grupo = crear('a-entity', {
      position: enPared(angulo, sala.radio - 0.035, ALTURA),
      rotation: `0 ${-angulo} 0`,
    });
    const sombra = 0.08; // el lienzo del marco trae su sombra alrededor
    const marco = crear('a-image', {
      src: lienzo(Math.round((ANCHO_PORTADA + 2 * (borde + sombra)) * 500), Math.round((alto + 2 * (borde + sombra)) * 500),
        ctx => dibujarMarco(ctx, ANCHO_PORTADA, alto, sombra)),
      width: ANCHO_PORTADA + 2 * (borde + sombra),
      height: alto + 2 * (borde + sombra),
      material: 'shader: flat; transparent: true',
    });
    const resalte = crear('a-plane', {
      width: ANCHO_PORTADA + 0.07, height: alto + 0.07, position: '0 0 0.004', visible: false,
      material: `shader: flat; color: ${COLOR.amarillo}`,
    });
    const portada = crear('a-image', {
      src: revista.objetivo, width: ANCHO_PORTADA, height: alto, position: '0 0 0.008',
      material: 'shader: flat',
    });
    portada.classList.add('seleccionable');
    const cartela = crear('a-image', {
      src: lienzoCartela(revista),
      width: 1.2, height: 1.2 * 400 / 1200,
      position: `0 ${-(ALTURA - 0.52)} 0.01`,
      material: 'shader: flat',
    });
    grupo.append(marco, resalte, portada, cartela);
    contenido.appendChild(grupo);

    const datos = { revista, angulo, el: grupo, resalte, portada };
    portada.addEventListener('mouseenter', () => { resaltar(grupo, resalte, true); programarAmpliada(datos); });
    portada.addEventListener('mouseleave', () => {
      resaltar(grupo, resalte, false);
      clearTimeout(temporizadorAmpliar);
      vigilarAmpliada();
    });
    // Con mouse (computador): un clic saca la portada ampliada; otro clic en ella abre el video.
    portada.addEventListener('click', () => mostrarAmpliada(datos));
    revistas.push(datos);
  });
}

function dibujarMarco(ctx, ancho, alto, sombra) {
  const px = 500; // pixeles por metro
  const s = sombra * px, m = MOLDURA * px, p = PASPARTU * px;
  const W = (ancho + 2 * (MOLDURA + PASPARTU)) * px;
  const H = (alto + 2 * (MOLDURA + PASPARTU)) * px;
  // Sombra suave sobre la pared (la luz viene de arriba).
  ctx.save();
  ctx.shadowColor = 'rgba(30,20,10,0.55)';
  ctx.shadowBlur = s * 0.6;
  ctx.shadowOffsetY = s * 0.35;
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(s, s, W, H);
  ctx.restore();
  // Moldura de madera oscura con biseles (arriba claro, abajo oscuro).
  const biseles = [
    ['#7a5232', [[0, 0], [W, 0], [W - m, m], [m, m]]],
    ['#3a2414', [[0, H], [W, H], [W - m, H - m], [m, H - m]]],
    ['#5c3c22', [[0, 0], [m, m], [m, H - m], [0, H]]],
    ['#4a2f1a', [[W, 0], [W - m, m], [W - m, H - m], [W, H]]],
  ];
  for (const [color, puntos] of biseles) {
    ctx.fillStyle = color;
    ctx.beginPath();
    puntos.forEach(([x, y], i) => (i ? ctx.lineTo(s + x, s + y) : ctx.moveTo(s + x, s + y)));
    ctx.closePath();
    ctx.fill();
  }
  // Filo dorado y paspartu.
  ctx.fillStyle = '#c9a646';
  ctx.fillRect(s + m - 4, s + m - 4, W - 2 * m + 8, H - 2 * m + 8);
  ctx.fillStyle = '#f7f4ee';
  ctx.fillRect(s + m, s + m, W - 2 * m, H - 2 * m);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(s + m + p - 2, s + m + p - 2, W - 2 * (m + p) + 4, H - 2 * (m + p) + 4);
}

// ---------------------------------------------------------------- ficha cercana

let ampliada = null;        // revista cuya portada ampliada se ve
let vigia = null;
let temporizadorAmpliar = null;

// Por cada revista, ya armadas y en su sitio (al mirar un cuadro solo se muestran):
// - la portada ampliada, entre el visitante y el cuadro, a la altura de los ojos, con borde
//   amarillo; mirarla 5,4 segundos (MIRADA_PORTADA_MS) abre el video;
// - la ficha (curso, equipo y titulo), debajo de la portada ampliada, inclinada hacia los ojos.
function construirAmpliadas() {
  const inclinacion = Math.atan2(1.6 - FICHA.y, FICHA.distancia) * 180 / Math.PI;
  revistas.forEach(r => {
    const alto = AMPLIADA.ancho * aspectos.get(r.revista.objetivo);
    const borde = AMPLIADA.borde;
    const y = AMPLIADA.abajo + borde + alto / 2; // el borde de abajo fijo: no tapa la ficha
    const desde = enPared(r.angulo, sala.radio - 0.2, ALTURA);
    const hasta = enPared(r.angulo, AMPLIADA.distancia, y);
    r.ampliada = crear('a-entity', {
      visible: false, position: hasta, rotation: `0 ${-r.angulo} 0`,
      // Sale de la pared hacia el visitante.
      animation__sale: `property: position; from: ${desde}; to: ${hasta}; dur: 300; easing: easeOutCubic; startEvents: mostrar`,
      animation__crece: 'property: scale; from: 0.6 0.6 0.6; to: 1 1 1; dur: 300; easing: easeOutCubic; startEvents: mostrar',
    });
    r.ampliada.appendChild(crear('a-plane', {
      width: AMPLIADA.ancho + 2 * borde, height: alto + 2 * borde,
      material: `shader: flat; transparent: true; color: ${COLOR.amarillo}`,
    }));
    r.ampliadaImagen = crear('a-image', {
      src: r.revista.objetivo, width: AMPLIADA.ancho, height: alto, position: '0 0 0.005', material: 'shader: flat; transparent: true',
    });
    r.ampliadaImagen.addEventListener('click', () => abrirVideo(r.revista, r.angulo));
    r.ampliadaImagen.addEventListener('mouseleave', vigilarAmpliada);
    r.ampliada.appendChild(r.ampliadaImagen);
    // Por encima de la penumbra, como la pantalla y el lector: la parte de arriba de la portada
    // queda fuera de la esfera de la penumbra y se veia con sombra.
    ordenRender(r.ampliada, 2);

    r.ficha = crear('a-image', {
      src: lienzoFicha(r.revista), visible: false, width: FICHA.ancho, height: FICHA.alto,
      position: enPared(r.angulo, FICHA.distancia, FICHA.y),
      rotation: `${-inclinacion} ${-r.angulo} 0`,
      material: 'shader: flat',
      animation__entra: 'property: scale; from: 0.85 0.85 0.85; to: 1 1 1; dur: 220; easing: easeOutQuad; startEvents: mostrar',
    });
    galeria.append(r.ampliada, r.ficha);
  });
}

// Mirar un cuadro un momento: su portada sale de la pared, grande, y la galeria queda en
// penumbra suave para que resalte.
function programarAmpliada(r) {
  clearTimeout(temporizadorAmpliar);
  if (ampliada !== r) temporizadorAmpliar = setTimeout(() => mostrarAmpliada(r), AMPLIADA.esperaMs);
}

function mostrarAmpliada(r) {
  clearTimeout(temporizadorAmpliar);
  if (abierta || leyendo || ampliada === r || !$('entrada').hidden) return;
  clearInterval(vigia);
  if (ampliada) {
    ampliada.ampliada.setAttribute('visible', false);
    ampliada.ficha.setAttribute('visible', false);
  }
  ampliada = r;
  for (const el of [r.ampliada, r.ficha]) {
    el.setAttribute('visible', true);
    el.emit('mostrar');
  }
  penumbra(true, true);
  activar([...revistas.map(x => x.portada), r.ampliadaImagen]);
  vigilarAmpliada(); // se va sola si la cabeza gira hacia otro lado
}

// Al dejar de mirarla, la portada ampliada y su ficha se quedan mientras la cabeza siga
// hacia ese cuadro (para bajar la mirada y leer la ficha) y se van al girar hacia otro lado.
function vigilarAmpliada() {
  clearInterval(vigia);
  const r = ampliada;
  if (!r) return;
  const direccion = new AFRAME.THREE.Vector3();
  vigia = setInterval(() => {
    // Hacia donde apunta el cursor: la cabeza en las gafas, el mouse en el computador.
    const rc = cursor.components.raycaster;
    const d = rc ? rc.raycaster.ray.direction : escena.camera.getWorldDirection(direccion);
    const vista = Math.atan2(d.x, -d.z) * 180 / Math.PI;
    const diferencia = Math.abs(((vista - r.angulo) % 360 + 540) % 360 - 180);
    // Sin cancelar la portada vecina que ya se esta mirando: sale a su tiempo.
    if (diferencia > FICHA.anguloMax) ocultarAmpliada(false);
  }, 250);
}

function ocultarAmpliada(cancelarPendiente = true) {
  if (cancelarPendiente) clearTimeout(temporizadorAmpliar);
  clearInterval(vigia);
  if (!ampliada) return;
  ampliada.ampliada.setAttribute('visible', false);
  ampliada.ficha.setAttribute('visible', false);
  ampliada = null;
  penumbra(false);
  activar(revistas.map(x => x.portada));
}

function resaltar(grupo, resalte, si) {
  resalte.setAttribute('visible', si);
  grupo.setAttribute('animation__escala', `property: scale; to: ${si ? '1.06 1.06 1.06' : '1 1 1'}; dur: 200; easing: easeOutQuad`);
}

async function construirTitulo(evento) {
  const escudo = await cargarImagen('img/escudo-itey.jpg').catch(() => null);
  const url = lienzo(1800, 420, ctx => {
    redondeado(ctx, 0, 0, 1800, 420, 40, COLOR.azul);
    ctx.fillStyle = COLOR.amarillo;
    ctx.fillRect(0, 404, 1800, 16);
    if (escudo) {
      ctx.save();
      ctx.beginPath(); ctx.arc(190, 205, 150, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = COLOR.blanco; ctx.fill(); ctx.clip();
      ctx.drawImage(escudo, 60, 75, 260, 260);
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOR.blanco;
    ctx.font = `900 120px ${FUENTE}`;
    ctx.fillText('REVISTA AUMENTADA', 380, 175, 1380);
    ctx.fillStyle = COLOR.amarillo;
    ctx.fillRect(384, 207, 300, 12);
    ctx.fillStyle = COLOR.rojo;
    ctx.fillRect(696, 207, 70, 12);
    ctx.fillStyle = COLOR.amarillo;
    ctx.font = `700 60px ${FUENTE}`;
    ctx.fillText(`Galería virtual · ${evento} · ITEY`, 384, 290, 1380);
    ctx.fillStyle = '#c7d2fe';
    ctx.font = `500 46px ${FUENTE}`;
    ctx.fillText('Mira fijo una portada 6 segundos para ver tu video', 384, 360, 1380);
  });
  // Letrero colgado del techo, delante de las paredes del frente.
  const y = 3.08, ancho = 2.4, alto = ancho * 420 / 1800;
  const titulo = crear('a-entity', { id: 'titulo-sala', position: `0 ${y} ${-(sala.radio - 0.45)}` });
  titulo.appendChild(crear('a-image', { src: url, width: ancho, height: alto, material: 'shader: flat; transparent: true' }));
  for (const x of [-ancho * 0.4, ancho * 0.4]) {
    const largo = ALTO_SALA - y - alto / 2;
    titulo.appendChild(crear('a-cylinder', {
      radius: 0.006, height: largo, position: `${x} ${alto / 2 + largo / 2} 0`,
      material: 'shader: flat; color: #3a3a3a',
    }));
  }
  galeria.appendChild(titulo);
}

function prepararCursor() {
  // En el computador no hay giroscopio: se mira arrastrando y se elige con clic.
  const conMouse = matchMedia('(pointer: fine)').matches && !('ontouchstart' in window);
  if (conMouse) cursor.setAttribute('cursor', 'rayOrigin: mouse; fuse: false');
}

// Solo lo que esta en la lista se puede elegir con la mirada.
function activar(elementos) {
  document.querySelectorAll('.seleccionable').forEach(el => el.classList.remove('seleccionable'));
  elementos.forEach(el => el.classList.add('seleccionable'));
  const rc = cursor.components.raycaster;
  if (rc) rc.refreshObjects();
  // Con una portada ampliada a la vista, la mirada tarda mas: da tiempo de leerla.
  const conPortada = elementos.some(el => revistas.some(r => r.ampliadaImagen === el));
  tiempoMirada(conPortada ? MIRADA_PORTADA_MS : MIRADA_MS);
}

// Tiempo que hay que mirar algo para elegirlo, y el anillo amarillo que se cierra al mismo ritmo.
function tiempoMirada(ms) {
  if (Number(cursor.getAttribute('cursor').fuseTimeout) === ms) return;
  cursor.setAttribute('cursor', 'fuseTimeout', ms);
  cursor.setAttribute('animation__mirando', 'dur', ms);
}

// Modo cine: la galeria queda en penumbra detras de la pantalla o del lector.
// suave: con la portada ampliada (la galeria se ve detras); fuerte: con el video o la revista.
function penumbra(si, suave = false) {
  const el = $('penumbra');
  el.setAttribute('visible', si);
  if (si) [...el.children].forEach(c => c.setAttribute('material', 'opacity', suave ? 0.55 : 0.84));
  $('atril').setAttribute('visible', !si);
}

// ---------------------------------------------------------------- video

function construirPantalla() {
  $('boton-volver').setAttribute('src', lienzoBoton('‹  Volver', COLOR.amarillo, COLOR.azul));
  $('boton-repetir').setAttribute('src', lienzoBoton('⟲  Repetir', COLOR.blanco, COLOR.azul));
  $('boton-leer').setAttribute('src', lienzoBoton('Leer revista', COLOR.rojo, COLOR.blanco));
  for (const id of ['boton-volver', 'boton-repetir', 'boton-leer']) prepararBoton($(id), 0.62);
  $('boton-volver').addEventListener('click', cerrarVideo);
  $('boton-repetir').addEventListener('click', () => {
    clearTimeout(temporizadorFin);
    $('pantalla-aviso').setAttribute('visible', false);
    video.currentTime = 0;
    video.play().catch(() => {});
  });
  $('boton-leer').addEventListener('click', () => {
    const { revista, angulo } = abierta;
    cerrarVideo();
    abrirLector(revista, angulo);
  });

  video.addEventListener('loadedmetadata', () => ajustarPantalla());
  video.addEventListener('playing', () => {
    if (abierta && abierta.revista.video360 && !abierta.avisado) {
      // La primera vez se recuerda que hay que mirar alrededor.
      abierta.avisado = true;
      mostrarAviso('Video 360°: mira a tu alrededor');
      avisoTemporal(3500);
    } else {
      $('pantalla-aviso').setAttribute('visible', false);
    }
  });
  video.addEventListener('waiting', () => mostrarAviso('Cargando video…'));
  video.addEventListener('ended', () => {
    if (!abierta) return;
    mostrarAviso('Fin del video · volviendo a la galería…');
    temporizadorFin = setTimeout(() => {
      const r = abierta && revistas.find(x => x.revista === abierta.revista);
      cerrarVideo();
      if (r) bloquearPortada(r);
    }, ESPERA_FIN_MS);
  });
  video.addEventListener('error', async () => {
    if (!abierta) return;
    const revista = abierta.revista;
    const pendiente = await videoPendiente(revista.video);
    if (abierta && abierta.revista === revista) mostrarAviso(pendiente ? 'Video disponible muy pronto' : 'No se pudo cargar el video');
  });
}

function prepararBoton(b, ancho) {
  b.setAttribute('width', ancho);
  b.setAttribute('height', ancho * 160 / 560);
  b.addEventListener('mouseenter', () => b.setAttribute('animation__escala', 'property: scale; to: 1.12 1.12 1.12; dur: 150'));
  b.addEventListener('mouseleave', () => b.setAttribute('animation__escala', 'property: scale; to: 1 1 1; dur: 150'));
}

function abrirVideo(revista, angulo) {
  if (abierta || leyendo) return;
  abierta = { revista, angulo };
  ocultarAmpliada();
  clearTimeout(temporizadorFin);
  contarEvento(`sala-${revista.id}`, `Sala · ${revista.id}`);

  // La pantalla aparece donde esta mirando el visitante: frente a la portada elegida.
  pantalla.setAttribute('position', enPared(angulo, DIST_PANTALLA, 1.6));
  pantalla.setAttribute('rotation', `0 ${-angulo} 0`);
  $('pantalla-titulo').setAttribute('src', lienzoTituloVideo(revista));
  $('boton-leer').setAttribute('visible', !!revista.paginas);
  pantalla.setAttribute('visible', true);
  pantalla.setAttribute('animation__entra', 'property: scale; from: 0.6 0.6 0.6; to: 1 1 1; dur: 250; easing: easeOutBack');
  revistas.forEach(r => resaltar(r.el, r.resalte, false));

  const botones = [$('boton-volver'), $('boton-repetir')];
  if (revista.paginas) botones.push($('boton-leer'));
  activar(botones);

  if (revista.video360) {
    // Video 360°: el visitante queda dentro del video; el frente del video queda
    // hacia la portada que eligio. Los botones quedan abajo, a la altura del pecho.
    const esfera = $('esfera-360');
    if (!esfera.getAttribute('src')) esfera.setAttribute('src', '#video-sala');
    esfera.setAttribute('rotation', `0 ${-90 - angulo} 0`);
    esfera.setAttribute('visible', true);
    galeria.setAttribute('visible', false);
    $('pantalla-fondo').setAttribute('visible', false);
    $('pantalla-video').setAttribute('visible', false);
    $('pantalla-titulo').setAttribute('visible', false);
    colocarBotonesVideo(-0.95);
  } else {
    penumbra(true);
    ajustarPantalla({ ancho: 9, alto: 16 }); // vertical mientras llega el video real
  }

  mostrarAviso('Cargando video…');
  video.muted = false;
  video.src = revista.video;
  video.currentTime = 0;
  video.play().catch(error => {
    // Solo si el celular no dejo sonar el video (por ejemplo, en modo de bajo consumo) y sigue
    // abierto (cerrarlo mientras carga tambien rechaza play()): sigue sin sonido para que al
    // menos se vea, y un toque en la pantalla le activa el sonido.
    if (error.name !== 'NotAllowedError' || !abierta || abierta.revista !== revista) return;
    video.muted = true;
    video.play().catch(() => {});
    mostrarAviso('Toca la pantalla para oír el video');
  });
}

function cerrarVideo() {
  if (!abierta) return;
  abierta = null;
  clearTimeout(temporizadorFin);
  clearTimeout(temporizadorAviso);
  video.pause();
  pantalla.setAttribute('visible', false);
  $('pantalla-aviso').setAttribute('visible', false);
  $('esfera-360').setAttribute('visible', false);
  for (const id of ['pantalla-fondo', 'pantalla-video', 'pantalla-titulo']) $(id).setAttribute('visible', true);
  galeria.setAttribute('visible', true);
  penumbra(false);
  volverAGaleria();
}

function volverAGaleria() {
  revistas.forEach(r => {
    r.el.setAttribute('scale', '1 1 1');
    r.resalte.setAttribute('visible', false);
  });
  activar(revistas.map(r => r.portada));
}

// Al volver sola cuando termina un video, la mirada suele seguir sobre su portada: no se
// vuelve a abrir el mismo video hasta que la mirada salga de ella.
let bloqueo = null;

function bloquearPortada(r) {
  desbloquearPortada(false);
  activar(revistas.filter(x => x !== r).map(x => x.portada));
  bloqueo = setInterval(() => {
    const rc = cursor.components.raycaster;
    if (abierta || leyendo || !rc || !rc.raycaster.intersectObject(r.portada.object3D, true).length) desbloquearPortada();
  }, 250);
}

function desbloquearPortada(reactivar = true) {
  if (!bloqueo) return;
  clearInterval(bloqueo);
  bloqueo = null;
  if (reactivar && !abierta && !leyendo && !ampliada) activar(revistas.map(x => x.portada));
}

function ajustarPantalla(medidas) {
  if (abierta && abierta.revista.video360) return;
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
  colocarBotonesVideo(-(h / 2 + 0.2));
}

function colocarBotonesVideo(y) {
  const conLeer = $('boton-leer').getAttribute('visible');
  const xs = conLeer ? [-0.7, 0, 0.7] : [-0.36, 0.36];
  $('boton-volver').setAttribute('position', `${xs[0]} ${y} 0.02`);
  $('boton-repetir').setAttribute('position', `${xs[1]} ${y} 0.02`);
  if (conLeer) $('boton-leer').setAttribute('position', `${xs[2]} ${y} 0.02`);
  const aviso = $('pantalla-aviso');
  aviso.setAttribute('width', 1.6);
  aviso.setAttribute('height', 1.6 * 140 / 1200);
  aviso.setAttribute('position', '0 0 0.03');
}

function mostrarAviso(texto, id = 'pantalla-aviso') {
  const aviso = $(id);
  aviso.setAttribute('src', lienzoAviso(texto));
  aviso.setAttribute('visible', true);
}

function avisoTemporal(ms) {
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => $('pantalla-aviso').setAttribute('visible', false), ms);
}

// ---------------------------------------------------------------- revista completa

// Vistas como en una revista de papel: la portada sola, luego de a dos paginas
// (2-3, 4-5...) y la contraportada sola si queda impar.
function vistas(total) {
  const lista = [[1]];
  for (let p = 2; p <= total; p += 2) lista.push(p + 1 <= total ? [p, p + 1] : [p]);
  return lista;
}

function construirLector() {
  $('lector-anterior').setAttribute('src', lienzoFlecha('‹'));
  $('lector-siguiente').setAttribute('src', lienzoFlecha('›'));
  $('lector-volver').setAttribute('src', lienzoBoton('‹  Volver', COLOR.amarillo, COLOR.azul));
  $('lector-video').setAttribute('src', lienzoBoton('▶  Ver video', COLOR.blanco, COLOR.azul));
  $('lector-acercar').setAttribute('src', lienzoBoton('+  Acercar', COLOR.rojo, COLOR.blanco));
  $('lector-alejar').setAttribute('src', lienzoBoton('−  Alejar', COLOR.rojo, COLOR.blanco));
  for (const id of ['lector-volver', 'lector-video', 'lector-acercar', 'lector-alejar']) prepararBoton($(id), 0.56);
  for (const id of ['lector-anterior', 'lector-siguiente']) {
    const b = $(id);
    b.setAttribute('width', 0.32);
    b.setAttribute('height', 0.32);
    b.addEventListener('mouseenter', () => b.setAttribute('animation__escala', 'property: scale; to: 1.2 1.2 1.2; dur: 150'));
    b.addEventListener('mouseleave', () => b.setAttribute('animation__escala', 'property: scale; to: 1 1 1; dur: 150'));
  }
  $('lector-anterior').addEventListener('click', () => hojear(-1));
  $('lector-siguiente').addEventListener('click', () => hojear(1));
  $('lector-volver').addEventListener('click', cerrarLector);
  $('lector-video').addEventListener('click', () => {
    const { revista, angulo } = leyendo;
    cerrarLector();
    abrirVideo(revista, angulo);
  });
  // Acercar: la primera pagina de la vista, grande; las flechas pasan de a una pagina.
  $('lector-acercar').addEventListener('click', () => {
    leyendo.cerca = vistas(leyendo.revista.paginas)[leyendo.vista][0];
    mostrarVista();
  });
  $('lector-alejar').addEventListener('click', () => {
    // Vuelve a la doble pagina donde esta la pagina que se estaba leyendo.
    const pagina = leyendo.cerca;
    leyendo.cerca = null;
    leyendo.vista = vistas(leyendo.revista.paginas).findIndex(v => v.includes(pagina));
    mostrarVista();
  });
}

function abrirLector(revista, angulo) {
  if (leyendo || !revista.paginas) return;
  leyendo = { revista, angulo, vista: 0, cerca: null };
  ocultarAmpliada();
  contarEvento(`sala-leer-${revista.id}`, `Sala · leer ${revista.id}`);
  lector.setAttribute('position', enPared(angulo, DIST_LECTOR, 1.6));
  lector.setAttribute('rotation', `0 ${-angulo} 0`);
  lector.setAttribute('visible', true);
  penumbra(true);
  mostrarVista();
}

function cerrarLector() {
  if (!leyendo) return;
  leyendo = null;
  lector.setAttribute('visible', false);
  $('lector-aviso').setAttribute('visible', false);
  penumbra(false);
  volverAGaleria();
}

function hojear(direccion) {
  const total = leyendo.revista.paginas;
  if (leyendo.cerca) {
    leyendo.cerca = Math.min(total, Math.max(1, leyendo.cerca + direccion));
  } else {
    leyendo.vista = Math.min(vistas(total).length - 1, Math.max(0, leyendo.vista + direccion));
  }
  mostrarVista();
}

async function mostrarVista() {
  const actual = leyendo;
  const { revista } = actual;
  const total = revista.paginas;
  const paginas = actual.cerca ? [actual.cerca] : vistas(total)[actual.vista];
  const altoPagina = actual.cerca ? ALTO_PAGINA_CERCA : ALTO_PAGINA;

  activar([]);
  mostrarAviso('Cargando páginas…', 'lector-aviso');
  $('lector-aviso').setAttribute('width', 1.4);
  $('lector-aviso').setAttribute('height', 1.4 * 140 / 1200);
  $('lector-aviso').setAttribute('position', '0 0 0.05');
  await Promise.all(paginas.map(p => medir(revista.pagina(p))));
  if (leyendo !== actual) return; // cerro el lector mientras cargaba
  $('lector-aviso').setAttribute('visible', false);

  // Paginas una al lado de la otra, sin espacio en el lomo.
  const anchos = paginas.map(p => altoPagina / aspectos.get(revista.pagina(p)));
  const anchoTotal = anchos.reduce((a, b) => a + b, 0);
  ['pagina-1', 'pagina-2'].forEach((id, i) => {
    const el = $(id);
    if (i >= paginas.length) { el.setAttribute('visible', false); return; }
    const x = i === 0 ? -anchoTotal / 2 + anchos[0] / 2 : anchoTotal / 2 - anchos[1] / 2;
    el.dataset.pagina = paginas[i];
    el.setAttribute('src', revista.pagina(paginas[i]));
    el.setAttribute('width', anchos[i]);
    el.setAttribute('height', altoPagina);
    el.setAttribute('position', `${x} 0 0`);
    el.setAttribute('visible', true);
  });

  const hayAnterior = actual.cerca ? actual.cerca > 1 : actual.vista > 0;
  const haySiguiente = actual.cerca ? actual.cerca < total : actual.vista < vistas(total).length - 1;
  const xFlecha = anchoTotal / 2 + 0.3;
  $('lector-anterior').setAttribute('position', `${-xFlecha} 0 0.02`);
  $('lector-siguiente').setAttribute('position', `${xFlecha} 0 0.02`);
  $('lector-anterior').setAttribute('visible', hayAnterior);
  $('lector-siguiente').setAttribute('visible', haySiguiente);

  const texto = paginas.length > 1 ? `Páginas ${paginas[0]} y ${paginas[1]} de ${total}` : `Página ${paginas[0]} de ${total}`;
  const titulo = $('lector-titulo');
  titulo.setAttribute('src', lienzoTituloLector(revista, texto, !actual.cerca));
  titulo.setAttribute('width', 2.0);
  titulo.setAttribute('height', 2.0 * 200 / 1400);
  titulo.setAttribute('position', `0 ${altoPagina / 2 + 0.2} 0`);

  // Botones: con las paginas en tamaño normal, abajo (Volver · Acercar · Ver video); con
  // una pagina cerca, «Alejar» bajo la flecha izquierda (abajo quedaria a la altura de los pies).
  // Las paginas no se eligen con la mirada: se leen mirandolas sin que se muevan.
  const yBotones = actual.cerca ? -0.42 : -(altoPagina / 2 + 0.2);
  $('lector-volver').setAttribute('visible', !actual.cerca);
  $('lector-video').setAttribute('visible', !actual.cerca);
  $('lector-acercar').setAttribute('visible', !actual.cerca);
  $('lector-alejar').setAttribute('visible', !!actual.cerca);
  $('lector-volver').setAttribute('position', `-0.62 ${yBotones} 0.02`);
  $('lector-acercar').setAttribute('position', `0 ${yBotones} 0.02`);
  $('lector-video').setAttribute('position', `0.62 ${yBotones} 0.02`);
  $('lector-alejar').setAttribute('position', `${-xFlecha} ${yBotones} 0.02`);

  const elegibles = [];
  if (hayAnterior) elegibles.push($('lector-anterior'));
  if (haySiguiente) elegibles.push($('lector-siguiente'));
  if (actual.cerca) elegibles.push($('lector-alejar'));
  else elegibles.push($('lector-volver'), $('lector-acercar'), $('lector-video'));
  activar(elegibles);

  // Deja lista la siguiente vista para que el cambio sea inmediato.
  const proximas = actual.cerca ? [actual.cerca + 1] : (vistas(total)[actual.vista + 1] || []);
  proximas.filter(p => p <= total).forEach(p => medir(revista.pagina(p)));
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

// Cartela de museo bajo cada cuadro.
// Cartela de museo bajo cada cuadro (letras gruesas: en las gafas lo delgado se pierde).
function lienzoCartela(revista) {
  return lienzo(1200, 400, ctx => {
    ctx.fillStyle = '#fbf8f1';
    ctx.fillRect(0, 0, 1200, 400);
    ctx.fillStyle = COLOR.amarillo;
    ctx.fillRect(0, 0, 18, 400);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9a1a1e';
    ctx.font = `800 64px ${FUENTE}`;
    ctx.fillText(`${revista.curso} · ${revista.equipo}`, 56, 84, 1110);
    ctx.fillStyle = COLOR.azul;
    escribirTitulo(ctx, revista.titulo, { x: 56, arriba: 112, abajo: 300, ancho: 1110, tamanos: [70, 60, 52] });
    // Pie: que se puede hacer con este cuadro.
    ctx.fillStyle = '#374151';
    const extra = revista.video360 ? 'video 360°' : 'video';
    const pie = revista.paginas ? `Mira fijo: ${extra} · revista de ${revista.paginas} pág.` : `Mira fijo 6 segundos: ${extra}`;
    ctx.beginPath();
    ctx.moveTo(56, 326); ctx.lineTo(56, 368); ctx.lineTo(92, 347); ctx.closePath();
    ctx.fill();
    escribirLinea(ctx, pie, 110, 365, 1060, [50, 44, 38]);
  });
}

// Ficha que aparece cerca al mirar un cuadro: lo mismo que la cartela, mas grande.
function lienzoFicha(revista) {
  return lienzo(1100, 420, ctx => {
    redondeado(ctx, 0, 0, 1100, 420, 36, '#fbf8f1');
    ctx.fillStyle = COLOR.amarillo;
    ctx.fillRect(0, 392, 1100, 28);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9a1a1e';
    ctx.font = `800 58px ${FUENTE}`;
    ctx.fillText(`${revista.curso} · ${revista.equipo}`, 550, 78, 1040);
    ctx.fillStyle = COLOR.azul;
    escribirTitulo(ctx, revista.titulo, { x: 550, arriba: 104, abajo: 300, ancho: 1040, tamanos: [68, 58, 50] });
    ctx.fillStyle = '#374151';
    const extra = revista.video360 ? 'video 360°' : 'video';
    escribirLinea(ctx, revista.paginas ? `Mira fijo la portada: ${extra} · revista de ${revista.paginas} pág.`
      : `Mira fijo la portada 6 segundos: ${extra}`, 550, 350, 1040, [46, 40, 36]);
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

function lienzoTituloLector(revista, texto, conAyuda) {
  return lienzo(1400, 200, ctx => {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.amarillo;
    ctx.font = `800 52px ${FUENTE}`;
    ctx.fillText(`${revista.curso} · ${revista.equipo} · ${texto}`, 700, 66, 1360);
    ctx.fillStyle = '#c7d2fe';
    ctx.font = `600 44px ${FUENTE}`;
    ctx.fillText(conAyuda ? 'Mira «Acercar» para leer de cerca · las flechas pasan la página'
      : 'Mueve la cabeza para leer · «Alejar» vuelve a la doble página', 700, 145, 1360);
  });
}

function lienzoBoton(texto, fondo, color) {
  return lienzo(560, 160, ctx => {
    redondeado(ctx, 6, 6, 548, 148, 74, fondo);
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

function lienzoAviso(texto) {
  return lienzo(1200, 140, ctx => {
    redondeado(ctx, 0, 0, 1200, 140, 40, 'rgba(19,32,74,0.88)');
    ctx.fillStyle = COLOR.blanco;
    ctx.font = `700 62px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(texto, 600, 92, 1140);
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

// Escribe un titulo entre las alturas arriba y abajo con la letra mas grande con la
// que cabe (en las lineas que haga falta). Nunca aprieta el texto.
function escribirTitulo(ctx, texto, { x, arriba, abajo, ancho, tamanos }) {
  let lineas = [], tamano = tamanos[tamanos.length - 1];
  for (const t of tamanos) {
    ctx.font = `800 ${t}px ${FUENTE}`;
    lineas = envolver(ctx, texto, ancho);
    tamano = t;
    if (lineas.length * t * 1.12 <= abajo - arriba) break;
  }
  // Si ni con la letra mas pequeña cabe, lo que sobre se corta con puntos suspensivos.
  const caben = Math.max(1, Math.floor((abajo - arriba) / (tamano * 1.12)));
  if (lineas.length > caben) {
    lineas = lineas.slice(0, caben);
    let ultima = lineas[caben - 1];
    while (ultima.includes(' ') && ctx.measureText(ultima + '…').width > ancho) ultima = ultima.slice(0, ultima.lastIndexOf(' '));
    lineas[caben - 1] = ultima + '…';
  }
  const alto = tamano * 1.12;
  const inicio = arriba + ((abajo - arriba) - alto * lineas.length) / 2 + tamano * 0.85;
  lineas.forEach((linea, i) => ctx.fillText(linea, x, inicio + i * alto, ancho));
}

// Una linea con la letra mas grande con la que cabe (sin apretarla).
function escribirLinea(ctx, texto, x, y, ancho, tamanos) {
  for (const t of tamanos) {
    ctx.font = `700 ${t}px ${FUENTE}`;
    if (ctx.measureText(texto).width <= ancho) break;
  }
  ctx.fillText(texto, x, y, ancho);
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

function crear(etiqueta, atributos) {
  const el = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) el.setAttribute(nombre, valor);
  return el;
}

// Orden de dibujo de lo transparente: galeria (0), penumbra (1), pantalla y lector (2).
// Asi la penumbra oscurece la galeria pero no los botones que flotan delante.
function ordenRender(el, orden) {
  const aplicar = () => el.object3D.traverse(o => { o.renderOrder = orden; });
  aplicar();
  el.addEventListener('object3dset', aplicar);
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Guarda el alto/ancho de una imagen (portada o pagina).
async function medir(src) {
  if (aspectos.has(src)) return aspectos.get(src);
  let aspecto;
  try {
    const img = await cargarImagen(src);
    aspecto = img.naturalHeight / img.naturalWidth;
  } catch {
    aspecto = 1.33; // carta vertical aproximada
  }
  aspectos.set(src, aspecto);
  return aspecto;
}
