// Servidor HTTPS de prueba para abrir la camara desde el celular por wifi.
// Los celulares solo dejan usar la camara en paginas https://, por eso no
// sirve un servidor http comun.
//
// Uso, desde la carpeta del proyecto:   node herramientas/servidor-https.mjs
// (opcional: otro puerto)               node herramientas/servidor-https.mjs 9443
//
// No necesita instalar nada: usa Node y el openssl que trae Git para Windows.
// La primera vez crea un certificado propio en herramientas/.cert/ (no se sube a GitHub).

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA_CERT = path.join(RAIZ, 'herramientas', '.cert');
const PUERTO = Number(process.argv[2]) || 8443;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.mind': 'application/octet-stream',
};

function ipsLocales() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => i.address);
}

function buscarOpenssl() {
  const candidatos = [
    'openssl',
    'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  ];
  for (const candidato of candidatos) {
    try {
      execFileSync(candidato, ['version'], { stdio: 'ignore' });
      return candidato;
    } catch {
      // probar el siguiente
    }
  }
  return null;
}

function certificado() {
  const llave = path.join(CARPETA_CERT, 'llave.pem');
  const cert = path.join(CARPETA_CERT, 'cert.pem');
  if (!fs.existsSync(llave) || !fs.existsSync(cert)) {
    const openssl = buscarOpenssl();
    if (!openssl) {
      console.error('No encontré openssl. Instala Git para Windows (lo trae) o prueba directamente en GitHub Pages.');
      process.exit(1);
    }
    fs.mkdirSync(CARPETA_CERT, { recursive: true });
    const nombres = ['DNS:localhost', 'IP:127.0.0.1', ...ipsLocales().map(ip => 'IP:' + ip)].join(',');
    execFileSync(openssl, [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '365',
      '-keyout', llave, '-out', cert,
      '-subj', '/CN=revista-aumentada-local',
      '-addext', 'subjectAltName=' + nombres,
    ], { stdio: 'ignore' });
  }
  return { key: fs.readFileSync(llave), cert: fs.readFileSync(cert) };
}

function atender(req, res) {
  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, 'https://local').pathname);
  } catch {
    return terminar(req, res, 400);
  }
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.join(RAIZ, ruta);
  if (!archivo.startsWith(RAIZ + path.sep) || archivo.startsWith(CARPETA_CERT)) return terminar(req, res, 403);

  fs.stat(archivo, (error, info) => {
    if (error || !info.isFile()) return terminar(req, res, 404);

    const cabeceras = {
      'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store', // cada cambio se ve al recargar en el celular
      'Accept-Ranges': 'bytes',
    };

    // Safari en iPhone exige rangos de bytes para reproducir MP4.
    const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (rango && (rango[1] || rango[2])) {
      let inicio;
      let fin;
      if (rango[1] === '') {
        inicio = Math.max(0, info.size - Number(rango[2]));
        fin = info.size - 1;
      } else {
        inicio = Number(rango[1]);
        fin = rango[2] === '' ? info.size - 1 : Math.min(Number(rango[2]), info.size - 1);
      }
      if (inicio > fin || inicio >= info.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
        return terminar(req, res, 416, true);
      }
      res.writeHead(206, { ...cabeceras, 'Content-Range': `bytes ${inicio}-${fin}/${info.size}`, 'Content-Length': fin - inicio + 1 });
      registrar(req, 206);
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(archivo, { start: inicio, end: fin }).pipe(res);
    }

    res.writeHead(200, { ...cabeceras, 'Content-Length': info.size });
    registrar(req, 200);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(archivo).pipe(res);
  });
}

function terminar(req, res, codigo, yaEscrito = false) {
  if (!yaEscrito) res.writeHead(codigo, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(codigo === 404 ? 'No existe ese archivo.' : '');
  registrar(req, codigo);
}

function registrar(req, codigo) {
  // Los videos piden muchos pedazos; con una linea por archivo basta.
  if (codigo === 206 && !/^bytes=0-/.test(req.headers.range || '')) return;
  const hora = new Date().toLocaleTimeString('es-CO', { hour12: false });
  console.log(`${hora}  ${codigo}  ${req.url}`);
}

const servidor = https.createServer(certificado(), atender);

servidor.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${PUERTO} ya está en uso. Prueba con otro: node herramientas/servidor-https.mjs 9443`);
  } else {
    console.error(error.message);
  }
  process.exit(1);
});

servidor.listen(PUERTO, '0.0.0.0', () => {
  console.log('\nRevista Aumentada · servidor de prueba\n');
  console.log(`  En este computador:            https://localhost:${PUERTO}`);
  for (const ip of ipsLocales()) console.log(`  En el celular (mismo wifi):     https://${ip}:${PUERTO}`);
  console.log('\nEl navegador dirá que la conexión no es privada: es normal en este servidor de prueba.');
  console.log('  Chrome (Android): «Configuración avanzada» → «Acceder a … (sitio no seguro)».');
  console.log('  Safari (iPhone):  «Mostrar detalles» → «visitar este sitio web».');
  console.log('Si Windows pregunta por el firewall, marca «Redes privadas» y toca «Permitir».');
  console.log('\nPara detenerlo: Ctrl + C\n');
});
