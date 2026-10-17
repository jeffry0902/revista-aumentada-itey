// Lector de la revista completa en la pantalla del celular (sin gafas).
// Lo usan la camara (ar.html, boton «Leer revista» de la tarjeta) y la pagina
// del video (ver.html). Las paginas son revistas/<id>/paginas/1.jpg ... N.jpg.
//
// Se desliza de lado para pasar de pagina (o con las flechas); tocar una
// pagina la acerca y se recorre arrastrando; otro toque la aleja.

const $ = (raiz, sel) => raiz.querySelector(sel);

export function abrirLector(revista, { alCerrar, textoVolver = '‹ Volver' } = {}) {
  const total = revista.paginas;
  const capa = document.createElement('div');
  capa.className = 'lector';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-label', `Revista: ${revista.titulo}`);
  capa.innerHTML = `
    <div class="lector__barra">
      <button class="lector__cerrar" type="button"></button>
      <span class="lector__titulo"></span>
      <span class="lector__numero" aria-live="polite"></span>
    </div>
    <div class="lector__paginas"></div>
    <button class="lector__flecha lector__flecha--anterior" type="button" aria-label="Página anterior">‹</button>
    <button class="lector__flecha lector__flecha--siguiente" type="button" aria-label="Página siguiente">›</button>
    <p class="lector__ayuda">Desliza para pasar de página · toca una página para acercarla</p>`;
  $(capa, '.lector__cerrar').textContent = textoVolver;
  $(capa, '.lector__titulo').textContent = revista.titulo;

  const contenedor = $(capa, '.lector__paginas');
  const hojas = [];
  for (let n = 1; n <= total; n++) {
    const hoja = document.createElement('div');
    hoja.className = 'lector__hoja';
    const img = document.createElement('img');
    img.alt = `Página ${n} de ${total}`;
    img.draggable = false;
    hoja.appendChild(img);
    hoja.addEventListener('click', () => acercar(hoja));
    contenedor.appendChild(hoja);
    hojas.push(hoja);
  }

  let actual = 0;
  // Solo se descargan la pagina a la vista y sus vecinas.
  function cargarCerca(i) {
    for (const j of [i - 1, i, i + 1, i + 2]) {
      const img = hojas[j] && hojas[j].firstChild;
      if (img && !img.src) img.src = revista.pagina(j + 1);
    }
  }
  function marcar() {
    const i = Math.round(contenedor.scrollLeft / contenedor.clientWidth);
    if (i !== actual) {
      // Al cambiar de pagina, la anterior vuelve a verse completa.
      hojas[actual].classList.remove('lector__hoja--cerca');
      actual = i;
    }
    $(capa, '.lector__numero').textContent = `${actual + 1} / ${total}`;
    $(capa, '.lector__flecha--anterior').hidden = actual === 0;
    $(capa, '.lector__flecha--siguiente').hidden = actual === total - 1;
    cargarCerca(actual);
  }
  function ir(i) {
    contenedor.scrollTo({ left: Math.max(0, Math.min(total - 1, i)) * contenedor.clientWidth, behavior: 'smooth' });
  }
  function acercar(hoja) {
    const cerca = hoja.classList.toggle('lector__hoja--cerca');
    $(capa, '.lector__ayuda').hidden = true;
    if (cerca) {
      // Empieza arriba a la izquierda, donde empieza la lectura.
      hoja.scrollTop = 0;
      hoja.scrollLeft = 0;
    }
  }
  function teclas(e) {
    if (e.key === 'ArrowRight') ir(actual + 1);
    else if (e.key === 'ArrowLeft') ir(actual - 1);
    else if (e.key === 'Escape') cerrar();
  }
  function cerrar() {
    document.removeEventListener('keydown', teclas);
    capa.remove();
    if (alCerrar) alCerrar();
  }

  contenedor.addEventListener('scroll', marcar, { passive: true });
  $(capa, '.lector__flecha--anterior').addEventListener('click', () => ir(actual - 1));
  $(capa, '.lector__flecha--siguiente').addEventListener('click', () => ir(actual + 1));
  $(capa, '.lector__cerrar').addEventListener('click', cerrar);
  document.addEventListener('keydown', teclas);
  // Los toques dentro del lector no deben llegar a la pagina de atras.
  capa.addEventListener('click', e => e.stopPropagation());

  document.body.appendChild(capa);
  marcar();
  return { cerrar };
}
