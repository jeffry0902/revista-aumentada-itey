import { cargarDatos, cursosConRevistas, esc } from './datos.js';
import { iniciarContador, contarVisita } from './contador.js';

const contenedor = document.getElementById('cursos');
const dialogo = document.getElementById('elegir-curso');
const botonCamara = document.getElementById('abrir-camara');

try {
  const datos = await cargarDatos();
  iniciarContador(datos.goatcounter);
  contarVisita('/inicio', 'Inicio');
  if (datos.evento) document.getElementById('evento').textContent = datos.evento;

  const cursos = cursosConRevistas(datos);
  pintarCursos(cursos);
  pintarDialogo(cursos);

  botonCamara.addEventListener('click', () => {
    // Con un solo curso no hay nada que elegir.
    if (cursos.length === 1) location.href = urlCamara(cursos[0].id);
    else dialogo.showModal();
  });
} catch (error) {
  contenedor.innerHTML = `<p class="aviso-error">${esc(error.message)}</p>`;
  botonCamara.disabled = true;
}

document.getElementById('cerrar-dialogo').addEventListener('click', () => dialogo.close());
// Tocar fuera del cuadro lo cierra.
dialogo.addEventListener('click', e => { if (e.target === dialogo) dialogo.close(); });

function urlCamara(cursoId) {
  return `ar.html?curso=${encodeURIComponent(cursoId)}`;
}

function pintarCursos(cursos) {
  if (!cursos.length) {
    contenedor.innerHTML = '<p>Todavía no hay revistas publicadas.</p>';
    return;
  }
  contenedor.innerHTML = cursos.map(curso => `
    <section class="tarjeta curso">
      <div class="curso__cabeza">
        <h3 class="curso__nombre">${esc(curso.id)}</h3>
        <a class="boton" href="${urlCamara(curso.id)}">Abrir cámara ${esc(curso.id)}</a>
      </div>
      <ul class="revistas">
        ${curso.revistas.map(r => `
          <li>
            <a href="ver.html?id=${encodeURIComponent(r.id)}&desde=lista">
              <div><strong>${esc(r.titulo)}</strong><span>${esc(r.equipo)}</span></div>
              <span class="ver">Ver video ›</span>
            </a>
          </li>`).join('')}
      </ul>
    </section>`).join('');
}

function pintarDialogo(cursos) {
  document.getElementById('rejilla-cursos').innerHTML = cursos
    .map(c => `<a class="boton" href="${urlCamara(c.id)}">${esc(c.id)}</a>`)
    .join('');
}
