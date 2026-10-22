// Medidas fisicas de la pantalla, para que en las gafas cada imagen quede frente a su lente.
//
// En Android, el modo gafas de la sala lo hace Chrome, que conoce el tamaño real de
// cada pantalla: funciona igual en celulares grandes y pequeños, y aqui no se toca.
// En iPhone (Safari) no hay modo gafas propio y A-Frame usa un reemplazo que busca el
// tamaño del celular en una lista que llega solo hasta el iPhone XS/XR (la lista en
// internet que tambien consultaba ya no existe). Para los demas supone una pantalla de
// 10,4 cm de ancho: en un iPhone 13 (14 cm) cada imagen queda casi 1 cm corrida y se ve doble.
//
// Los iPhone no informan su tamaño, pero se deduce de la densidad de la pantalla: los de
// devicePixelRatio 3 (del X al 17) tienen unos 460 pixeles por pulgada y los de 2 (XR, 11,
// SE), 326. Excepciones: el 12/13 mini (476 ppp: las imagenes quedan ~4 mm mas juntas, se
// corrige con la rueda de las lentes) y el «Zoom de pantalla» de Ajustes (cambia la
// resolucion: hay que dejarlo en «Predeterminado», lo dice la nota de iPhone de la galeria).

const CAMPO_IOS = 30; // grados de vision por ojo en el modo gafas del iPhone

export function esIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad que se presenta como Mac
}

// Pixeles fisicos por pulgada de un iPhone o iPad; null en Android y computadores.
export function pppIOS() {
  if (!esIOS()) return null;
  const dpr = window.devicePixelRatio || 1;
  if (Math.min(screen.width, screen.height) > 760) return 264; // iPad (el mini es 326, como los iPhone ×2)
  return dpr >= 3 ? 460 : 326;
}

// Pixeles CSS por milimetro cuando se conoce el tamaño fisico (iPhone); si no, null.
export function pxPorMm() {
  const ppp = pppIOS();
  return ppp ? ppp / (window.devicePixelRatio || 1) / 25.4 : null;
}

// Le da al modo gafas de A-Frame el tamaño real de la pantalla del iPhone.
// Se llama con la escena ya cargada (el reemplazo de A-Frame ya existe) y antes de entrar.
export async function ajustarGafasIOS() {
  const ppp = pppIOS();
  if (!ppp || !navigator.getVRDisplays) return; // Android/computador: no hace falta
  try {
    const pantallas = await navigator.getVRDisplays();
    for (const pantalla of pantallas) {
      // Metodo del reemplazo de A-Frame (cardboard-vr-display): recalcula las medidas
      // de la pantalla y la deformacion de las lentes. bevelMm: borde negro del iPhone.
      // Imagen de cada ojo mas pequeña y centrada en su lente, como la que hace Chrome en
      // Android: con el campo de vision original (40°) cada imagen llena media pantalla y
      // el otro ojo alcanza a ver el borde de la vecina (se ve doble).
      const visor = pantalla.deviceInfo_ && pantalla.deviceInfo_.viewer;
      if (visor && typeof pantalla.onViewerChanged_ === 'function') {
        pantalla.onViewerChanged_({ ...visor, fov: CAMPO_IOS });
      }
      if (typeof pantalla.onDeviceParamsUpdated_ === 'function') {
        pantalla.onDeviceParamsUpdated_({ xdpi: ppp, ydpi: ppp, bevelMm: 4 });
      }
    }
  } catch {
    // Si la version de A-Frame cambia, queda como estaba.
  }
}
