// Que los celulares vean siempre lo ultimo publicado.
//
// GitHub Pages deja guardadas las paginas 10 minutos en el navegador, y quien ya
// habia abierto el sitio seguia viendo la version vieja. Este service worker pide
// al servidor las paginas, el codigo, los estilos y los datos cada vez (si no
// cambiaron, el servidor responde "igual" y casi no gasta datos). Sin conexion,
// usa la ultima copia guardada: util si el wifi de la feria se cae un momento.
// Imagenes y videos no pasan por aqui: los maneja el navegador como siempre.

const CACHE = 'revista-aumentada';
const TIPOS = /(\/|\.html|\.js|\.mjs|\.css|\.json|\.mind)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', evento => evento.waitUntil(self.clients.claim()));

self.addEventListener('fetch', evento => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  if (pedido.method !== 'GET' || url.origin !== location.origin || !TIPOS.test(url.pathname)) return;
  evento.respondWith(
    fetch(pedido.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(respuesta => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then(cache => cache.put(pedido.url, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(pedido.url).then(guardada => guardada || Response.error())),
  );
});
