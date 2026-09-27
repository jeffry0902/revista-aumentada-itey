// Lee y valida revistas.json. Es lo unico que se edita para agregar revistas,
// asi que los errores se explican en palabras y con el dato que falla.
//
// Convenciones que NO van en el JSON:
//   - el archivo de reconocimiento de un curso es targets/<curso>.mind
//   - el targetIndex de cada revista es su posicion dentro del curso (0, 1, 2...)

const CAMPOS = ['id', 'equipo', 'titulo', 'objetivo', 'video'];

// base: prefijo para llegar a la raiz del sitio ('' desde la raiz, '../' desde herramientas/).
export async function cargarDatos(base = '') {
  let respuesta;
  try {
    respuesta = await fetch(base + 'revistas.json', { cache: 'no-cache' });
  } catch {
    throw new Error('No hay conexión a internet o el servidor no responde.');
  }
  if (!respuesta.ok) throw new Error(`No se pudo leer revistas.json (error ${respuesta.status}).`);

  let datos;
  try {
    datos = await respuesta.json();
  } catch (e) {
    throw new Error('revistas.json tiene un error de formato (una coma o comilla de más o de menos). ' + e.message);
  }
  validar(datos);
  return datos;
}

function validar(datos) {
  if (!Array.isArray(datos.cursos)) throw new Error('revistas.json debe tener la lista "cursos".');
  const vistos = new Set();
  for (const curso of datos.cursos) {
    if (!curso.id) throw new Error('Hay un curso sin "id" en revistas.json.');
    if (!Array.isArray(curso.revistas)) throw new Error(`El curso ${curso.id} no tiene la lista "revistas".`);
    curso.revistas.forEach((revista, i) => {
      for (const campo of CAMPOS) {
        if (!revista[campo]) throw new Error(`En ${curso.id}, la revista n.º ${i + 1} no tiene "${campo}".`);
      }
      if (!/^[A-Za-z0-9-]+$/.test(revista.id)) {
        throw new Error(`El id "${revista.id}" solo puede tener letras, números y guiones (va dentro de la dirección del QR).`);
      }
      if (vistos.has(revista.id)) throw new Error(`El id "${revista.id}" está repetido.`);
      vistos.add(revista.id);
    });
  }
}

export function cursosConRevistas(datos) {
  return datos.cursos.filter(c => c.revistas.length > 0);
}

export function buscarCurso(datos, id) {
  return datos.cursos.find(c => c.id.toLowerCase() === String(id || '').toLowerCase()) || null;
}

export function buscarRevista(datos, id) {
  for (const curso of datos.cursos) {
    const indice = curso.revistas.findIndex(r => r.id.toLowerCase() === String(id || '').toLowerCase());
    if (indice !== -1) return { curso, revista: curso.revistas[indice], indice };
  }
  return null;
}

export function rutaTargets(cursoId) {
  return `targets/${cursoId}.mind`;
}

// Para insertar texto del JSON en HTML sin riesgo.
export function esc(texto) {
  return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
