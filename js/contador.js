// Contador de visitas y escaneos con GoatCounter: sin cookies y sin datos
// personales. Si "goatcounter" esta vacio en revistas.json no se carga nada,
// y si el servicio falla la pagina sigue igual.
//
// GoatCounter ignora las visitas desde localhost y la red local, asi que las
// pruebas en casa no ensucian las cifras.

let pendientes = null; // null = contador apagado
const yaContados = new Set();

export function iniciarContador(codigo) {
  if (!codigo || pendientes) return;
  pendientes = [];
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.dataset.goatcounter = `https://${codigo}.goatcounter.com/count`;
  // Contamos a mano para que la parte ?curso=... no parta las cifras.
  script.dataset.goatcounterSettings = '{"no_onload": true}';
  script.onload = () => {
    const cola = pendientes;
    pendientes = [];
    cola.forEach(enviar);
  };
  document.head.appendChild(script);
}

// Visita a una pagina: contarVisita('/camara/11A', 'Cámara 11A')
export function contarVisita(path, title) {
  registrar({ path, title, event: false });
}

// Evento, una sola vez por pagina abierta: contarEvento('ar-11A-01', 'AR · 11A-01')
export function contarEvento(nombre, title) {
  if (yaContados.has(nombre)) return;
  yaContados.add(nombre);
  registrar({ path: nombre, title, event: true });
}

function registrar(datos) {
  if (pendientes === null) return;
  if (window.goatcounter && window.goatcounter.count) enviar(datos);
  else pendientes.push(datos);
}

function enviar(datos) {
  try {
    window.goatcounter.count(datos);
  } catch {
    // El contador nunca debe romper la pagina.
  }
}
