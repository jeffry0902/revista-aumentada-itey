// Video de una revista a pantalla completa: ver.html?id=11A-01
// Es el destino de los QR impresos (plan B cuando la camara no funciona).
// Desde la lista de inicio llega con &desde=lista, para contar aparte los QR.

import { cargarDatos, buscarRevista, esc } from './datos.js';
import { iniciarContador, contarVisita, contarEvento } from './contador.js';

const contenido = document.getElementById('contenido');
const parametros = new URLSearchParams(location.search);

try {
  const datos = await cargarDatos();
  iniciarContador(datos.goatcounter);
  const encontrado = buscarRevista(datos, parametros.get('id'));
  if (!encontrado) {
    mostrarNoEncontrada();
  } else {
    mostrar(encontrado.camara, encontrado.revista);
    const origen = parametros.get('desde') === 'lista' ? 'lista' : 'qr';
    contarVisita(`/video/${encontrado.revista.id}`, `Video · ${encontrado.revista.id}`);
    contarEvento(`${origen}-${encontrado.revista.id}`, `${origen.toUpperCase()} · ${encontrado.revista.id} · ${encontrado.revista.titulo}`);
  }
} catch (error) {
  contenido.innerHTML = `<p class="aviso-error">${esc(error.message)}</p>`;
}

function mostrar(camara, revista) {
  document.title = `${revista.titulo} · Revista Aumentada ITEY`;
  contenido.innerHTML = `
    <p class="etiqueta">${esc(revista.curso)} · ${esc(revista.equipo)}</p>
    <h2 class="titulo-revista">${esc(revista.titulo)}</h2>
    <div class="video-marco">
      <video id="video" src="${esc(revista.video)}" controls playsinline webkit-playsinline preload="metadata"></video>
      <button class="video-marco__play" id="play" type="button">
        <span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>
          Reproducir con sonido
        </span>
      </button>
    </div>
    <div class="acciones">
      <a class="boton" href="ar.html?camara=${encodeURIComponent(camara.id)}">Abrir la cámara</a>
      <a class="boton boton--borde" href="./#lista">Ver todas las revistas</a>
    </div>`;

  const video = document.getElementById('video');
  const boton = document.getElementById('play');
  boton.addEventListener('click', () => video.play());
  video.addEventListener('play', () => { boton.hidden = true; });
  video.addEventListener('error', () => {
    boton.hidden = true;
    video.insertAdjacentHTML('afterend',
      '<p class="aviso-error">No se pudo cargar el video. Revisa la conexión e inténtalo de nuevo.</p>');
  });
  // Si el navegador deja reproducir con sonido sin tocar, arranca solo.
  video.play().catch(() => {});
}

function mostrarNoEncontrada() {
  contenido.innerHTML = `
    <p class="aviso-error">No encontramos esa revista. Puede que el código esté mal impreso.</p>
    <p><a class="boton" href="./#lista">Ver todas las revistas</a></p>`;
}
