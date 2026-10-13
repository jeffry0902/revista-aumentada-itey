import { cargarDatos, camarasConRevistas, revistasPorCurso, nombreCamara, esc } from './datos.js';
import { iniciarContador, contarVisita } from './contador.js';

const contenedor = document.getElementById('cursos');
const dialogo = document.getElementById('elegir-camara');
const botonCamara = document.getElementById('abrir-camara');

try {
  const datos = await cargarDatos();
  iniciarContador(datos.goatcounter);
  contarVisita('/inicio', 'Inicio');
  if (datos.evento) document.getElementById('evento').textContent = datos.evento;

  const camaras = camarasConRevistas(datos);
  pintarCursos(revistasPorCurso(datos), camaras.length > 1);
  pintarDialogo(camaras);

  botonCamara.addEventListener('click', () => {
    // Con una sola camara no hay nada que elegir.
    if (camaras.length === 1) location.href = urlCamara(camaras[0].id);
    else dialogo.showModal();
  });
} catch (error) {
  contenedor.innerHTML = `<p class="aviso-error">${esc(error.message)}</p>`;
  botonCamara.disabled = true;
}

document.getElementById('cerrar-dialogo').addEventListener('click', () => dialogo.close());
// Tocar fuera del cuadro lo cierra.
dialogo.addEventListener('click', e => { if (e.target === dialogo) dialogo.close(); });

function urlCamara(camaraId) {
  return `ar.html?camara=${encodeURIComponent(camaraId)}`;
}

// variasCamaras: si hay mas de una, cada curso lleva el boton de la suya.
function pintarCursos(grupos, variasCamaras) {
  if (!grupos.length) {
    contenedor.innerHTML = '<p>Todavía no hay revistas publicadas.</p>';
    return;
  }
  contenedor.innerHTML = grupos.map(({ curso, revistas }) => `
    <section class="tarjeta curso">
      <div class="curso__cabeza">
        <h3 class="curso__nombre">${esc(curso)}</h3>
        ${variasCamaras ? `<a class="boton" href="${urlCamara(revistas[0].camara.id)}">Abrir cámara</a>` : ''}
      </div>
      <ul class="revistas">
        ${revistas.map(({ revista: r }) => `
          <li>
            <a href="ver.html?id=${encodeURIComponent(r.id)}&desde=lista">
              <div><strong>${esc(r.titulo)}</strong><span>${esc(r.equipo)}</span></div>
              <span class="ver">Ver video ›</span>
            </a>
          </li>`).join('')}
      </ul>
    </section>`).join('');
}

function pintarDialogo(camaras) {
  document.getElementById('rejilla-cursos').innerHTML = camaras
    .map(c => `<a class="boton" href="${urlCamara(c.id)}">${esc(nombreCamara(c))}</a>`)
    .join('');
}
