// Lee y valida revistas.json. Es lo unico que se edita para agregar revistas,
// asi que los errores se explican en palabras y con el dato que falla.
//
// Una "camara" es un grupo de revistas que se reconocen juntas: todas sus
// portadas van en un solo archivo, targets/<id de la camara>.mind.
// Hoy hay una sola camara para todo el grado 11°; si algun dia pesa demasiado,
// se parte en dos agregando otra camara en revistas.json.
//
// Convenciones que NO van en el JSON:
//   - cada revista tiene su carpeta: revistas/<id>/portada.jpg y revistas/<id>/video.mp4
//   - el archivo de reconocimiento de una camara es targets/<id de la camara>.mind
//   - el targetIndex de cada revista es su posicion dentro de la camara (0, 1, 2...)
//   - si la revista trae "paginas": N, sus paginas son revistas/<id>/paginas/1.jpg ... N.jpg
//     (las genera herramientas/paginas.html a partir del PDF)

const CAMPOS = ['id', 'curso', 'equipo', 'titulo'];
const SEGURO = /^[A-Za-z0-9-]+$/; // va dentro de direcciones y nombres de archivo

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
  for (const camara of datos.camaras) {
    for (const revista of camara.revistas) {
      revista.objetivo = `revistas/${revista.id}/portada.jpg`;
      revista.video = `revistas/${revista.id}/video.mp4`;
      revista.pagina = n => `revistas/${revista.id}/paginas/${n}.jpg`;
    }
  }
  return datos;
}

function validar(datos) {
  if (!Array.isArray(datos.camaras)) throw new Error('revistas.json debe tener la lista "camaras".');
  const vistos = new Set();
  for (const camara of datos.camaras) {
    if (!camara.id || !SEGURO.test(camara.id)) {
      throw new Error('Cada cámara necesita un "id" con solo letras, números y guiones (es el nombre de su archivo .mind).');
    }
    if (!Array.isArray(camara.revistas)) throw new Error(`La cámara ${camara.id} no tiene la lista "revistas".`);
    camara.revistas.forEach((revista, i) => {
      for (const campo of CAMPOS) {
        if (!revista[campo]) throw new Error(`En la cámara ${camara.id}, la revista n.º ${i + 1} no tiene "${campo}".`);
      }
      if (!SEGURO.test(revista.id)) {
        throw new Error(`El id "${revista.id}" solo puede tener letras, números y guiones (va dentro de la dirección del QR).`);
      }
      if (revista.paginas !== undefined && !(Number.isInteger(revista.paginas) && revista.paginas >= 1 && revista.paginas <= 80)) {
        throw new Error(`En la revista ${revista.id}, "paginas" debe ser un número entero (sin comillas) entre 1 y 80.`);
      }
      if (revista.video360 !== undefined && typeof revista.video360 !== 'boolean') {
        throw new Error(`En la revista ${revista.id}, "video360" debe ser true o false (sin comillas).`);
      }
      if (vistos.has(revista.id)) throw new Error(`El id "${revista.id}" está repetido.`);
      vistos.add(revista.id);
    });
  }
}

export function nombreCamara(camara) {
  return camara.nombre || camara.id;
}

export function camarasConRevistas(datos) {
  return datos.camaras.filter(c => c.revistas.length > 0);
}

export function buscarCamara(datos, id) {
  return datos.camaras.find(c => c.id.toLowerCase() === String(id || '').toLowerCase()) || null;
}

export function buscarRevista(datos, id) {
  for (const camara of datos.camaras) {
    const indice = camara.revistas.findIndex(r => r.id.toLowerCase() === String(id || '').toLowerCase());
    if (indice !== -1) return { camara, revista: camara.revistas[indice], indice };
  }
  return null;
}

// Todas las revistas agrupadas por curso, en orden 11A, 11B, 11C...
// Cada revista va con su camara: [{ curso, revistas: [{ revista, camara }] }]
export function revistasPorCurso(datos) {
  const grupos = new Map();
  for (const camara of datos.camaras) {
    for (const revista of camara.revistas) {
      if (!grupos.has(revista.curso)) grupos.set(revista.curso, []);
      grupos.get(revista.curso).push({ revista, camara });
    }
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
    .map(([curso, revistas]) => ({ curso, revistas }));
}

export function rutaTargets(camaraId) {
  return `targets/${camaraId}.mind`;
}

// Para insertar texto del JSON en HTML sin riesgo.
export function esc(texto) {
  return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
