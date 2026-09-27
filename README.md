# Revista Aumentada · Feria de la Ciencia ITEY 2026

Revistas de física del grado 11° del **Instituto Técnico Empresarial El Yopal** con realidad aumentada.
El visitante apunta la cámara del celular a la portada de una revista y ve, encima de la página, el video
en el que los estudiantes explican su artículo. No hay que instalar ninguna app.

- **Dirección pública:** https://jeffry0902.github.io/revista-aumentada-itey/
- **Feria:** viernes 23 de octubre de 2026, de 8:00 a. m. a 12:00 m.
- **Tecnología:** página estática en GitHub Pages, MindAR 1.2.5 + A-Frame 1.5.0 desde CDN. No tiene servidor propio ni base de datos.

---

## Cómo funciona

| Página | Para qué |
|---|---|
| `index.html` | Inicio: instrucciones, botón **Abrir cámara** y lista de revistas por curso. |
| `ar.html?curso=11A` | Cámara con realidad aumentada de un curso. Reconoce las portadas de ese curso y reproduce el video encima. Botón **Ver video** para verlo en grande. |
| `ver.html?id=11A-01` | Solo el video de una revista. **A esta página llevan los QR impresos** (plan B sin cámara AR). |
| `herramientas/compilar.html` | Para el docente: genera el archivo de reconocimiento de un curso. |
| `herramientas/qr.html` | Para el docente: genera e imprime los QR. |

El visitante:
1. Toca **Abrir cámara** y elige el curso (aparece en la portada).
2. Permite el uso de la cámara.
3. Apunta a la portada. El video aparece anclado sobre la página y abajo sale una tarjeta con el título y el botón **Ver video**.
4. Toca la pantalla para oír el sonido. Los celulares no dejan sonar un video sin un toque previo, así que el primer video puede empezar en silencio.

Si la cámara no funciona, escanea el **QR de la revista**, que abre `ver.html` con el video.

## Estructura de carpetas

```
revista-aumentada-itey/
├─ index.html, ar.html, ver.html     páginas
├─ revistas.json                     ← lo único que se edita para agregar revistas
├─ css/                              estilos (azul institucional con filo rojo)
├─ js/                               datos.js, contador.js, inicio.js, ar.js, ver.js
├─ img/                              logo, escudo y favicon del ITEY
├─ objetivos/11A/01.jpg …            imágenes objetivo (portadas), una carpeta por curso
├─ targets/11A.mind …                archivos compilados, UNO POR CURSO
├─ videos/11A/01.mp4 …               videos comprimidos, una carpeta por curso
└─ herramientas/
   ├─ compilar.html                  compila las portadas de un curso → 11A.mind
   ├─ qr.html                        hoja de QR para imprimir (PNG/SVG)
   ├─ servidor-https.mjs             servidor de prueba para el celular por wifi
   └─ comprimir-videos.ps1           compresión de videos en lote con ffmpeg
```

## Por qué un archivo de reconocimiento por curso (y no uno solo con las 42)

Mientras la cámara no reconoce ninguna portada, que es casi todo el tiempo mientras el visitante apunta,
MindAR compara cada imagen de la cámara **contra las portadas del archivo una por una**
(`controller.worker.js`, ciclo `for` sobre los targets). El trabajo crece con el número de portadas:

| | 1 archivo con 42 | **1 por curso (~6)** ✅ | 1 por revista |
|---|---|---|---|
| Comparaciones por intento | 42 | **6** | 1 |
| Descarga antes de abrir la cámara | las 42 portadas | ~1/7 | mínima |
| Confusión entre portadas parecidas (mismo logo o plantilla) | alta | baja | ninguna |
| Si un equipo cambia su portada | recompilar 42 | recompilar su curso | una |
| Paso extra para el visitante | ninguno | elegir curso (1 toque) | elegir revista, y para eso el QR ya da el video |

En un Android de gama media la diferencia entre 42 y 6 comparaciones se nota en segundos de espera.
El toque de más para elegir el curso se evita con el **QR de cámara por curso** en cada stand
(sale en `herramientas/qr.html`), que abre `ar.html?curso=11A` directamente. Dentro de la cámara
hay un selector para cambiar de curso.

---

## 1. Preparar una buena imagen objetivo

La imagen objetivo es la **portada final tal como sale impresa** (o la página con la imagen del artículo).
MindAR reconoce por "puntos de interés": esquinas, bordes, letras y texturas.

**Sí:**
- Mucho detalle repartido por toda la página: texto, dibujos, fotos, patrones, bordes nítidos.
- Buen contraste (oscuro sobre claro o al revés).
- Exportarla del mismo archivo con el que se imprime (Canva, Word, Publisher) como **JPG de unos 1000 px de ancho**.
  La herramienta de compilar avisa si pasa de 2000 px o baja de 480 px.
- Imprimir en papel **mate** si se puede. El brillo del papel satinado refleja la luz y "borra" zonas.

**No:**
- Fondos lisos grandes (un degradado, un cielo, un color plano ocupando media portada).
- Patrones que se repiten igual (cuadrícula perfecta, baldosas), porque confunden la ubicación.
- Portadas casi iguales entre equipos (misma plantilla y solo cambia el título): se confunden entre sí.
  Pide que cada portada tenga una imagen grande propia.
- Cambiar la portada después de compilar: si cambia, **hay que volver a compilar el curso**.

Prueba rápida: en `compilar.html` la miniatura debe verse "cargada" de detalle. Si en la foto se ven
áreas grandes sin nada, el reconocimiento será lento o fallará.

## 2. Agregar una revista a `revistas.json`

```json
{
  "id": "11C-03",
  "equipo": "Los Newtonianos",
  "titulo": "La física del fútbol",
  "objetivo": "objetivos/11C/03.jpg",
  "video": "videos/11C/03.mp4"
}
```

| Campo | Qué es |
|---|---|
| `id` | Código único. **Va dentro del QR impreso**: una vez impreso, no se cambia. Solo letras, números y guiones. Sugerido: `CURSO-NN`. |
| `equipo` | Nombre del equipo. **Nada de nombres de estudiantes.** |
| `titulo` | Título del artículo. |
| `objetivo` | Ruta de la imagen objetivo (portada). |
| `video` | Ruta del video comprimido. |

Pasos:
1. Copia la portada en `objetivos/<curso>/` y el video comprimido en `videos/<curso>/`.
2. En `revistas.json`, busca el curso y agrega la revista dentro de su lista `"revistas"`. Separa cada revista de la anterior con una **coma**.
3. **El orden importa:** la primera revista del curso es la portada 0 del archivo `.mind`, la segunda la 1, y así.
   Si agregas, quitas o reordenas revistas de un curso, **vuelve a compilar ese curso** (paso 4).
4. Los cursos sin revistas no aparecen en la página.

Otros campos del archivo:
- `urlPublica`: dirección del sitio. La usan los QR. No la cambies después de imprimir.
- `goatcounter`: código del contador de escaneos (paso 8). Vacío = sin contador.
- `evento`: texto que sale en el encabezado.

Si el archivo queda con un error (una coma de más o de menos), la página lo dice en letras rojas. Para revisarlo
puedes abrirlo en VS Code, que subraya el error.

## 3. Comprimir los videos

Meta: MP4 H.264, 720p, de 60 a 90 s y como máximo ~8 MB. Probado con un video de 90 s de mucho movimiento: queda en **7,0 MB**.

ffmpeg ya está instalado con scoop (`scoop install ffmpeg`). Pon los videos originales de un curso en una
carpeta **fuera del proyecto** (o en `originales/`, que no se sube a GitHub) y ejecuta en PowerShell, desde la carpeta del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\herramientas\comprimir-videos.ps1 -Entrada "C:\Users\HP\Desktop\originales\11A" -Salida .\videos\11A
```

El script:
- reduce a 720 px el lado corto (horizontal → 1280×720, vertical → 720×1280) sin agrandar videos pequeños;
- limita a 30 cuadros por segundo, audio mono y ~600 kbit/s de video;
- **borra los metadatos del celular** (ubicación GPS, modelo del equipo);
- pone el índice al comienzo del archivo (`faststart`) para que empiece a sonar antes de terminar de descargar;
- deja el nombre en minúsculas, sin tildes ni espacios (`Equipo 3.MOV` → `equipo-3.mp4`);
- al final muestra una tabla con duración y peso, y avisa si alguno pasa de 90 s o de 8 MB.

Si un video pesa más de 8 MB, vuelve a pasarlo con menos calidad: `-KbpsVideo 450`.

**Comando de ffmpeg de una sola línea** (lo mismo, sin el script):

```powershell
Get-ChildItem "C:\Users\HP\Desktop\originales\11A\*" -Include *.mp4,*.mov | ForEach-Object { ffmpeg -y -i $_.FullName -map 0:v:0 -map "0:a:0?" -map_metadata -1 -vf "scale='if(gt(iw,ih),-2,trunc(min(720,iw)/2)*2)':'if(gt(iw,ih),trunc(min(720,ih)/2)*2,-2)'" -fpsmax 30 -c:v libx264 -preset slow -crf 26 -maxrate 600k -bufsize 1200k -profile:v high -pix_fmt yuv420p -g 60 -c:a aac -b:a 64k -ac 1 -ar 44100 -movflags +faststart "videos\11A\$($_.BaseName).mp4" }
```

Presupuesto de espacio: 42 videos × ≤ 8 MB ≈ 340 MB, por debajo de los ~700 MB previstos (GitHub Pages admite hasta 1 GB).

## 4. Compilar las portadas (targets)

1. Abre `herramientas/compilar.html` en el **computador**. Sirve en el servidor de prueba (paso 6) o
   ya publicado: `https://jeffry0902.github.io/revista-aumentada-itey/herramientas/compilar.html`.
2. Elige el curso. Revisa la lista: cada portada con su número (0, 1, 2…) en el orden de `revistas.json`
   y sin avisos en rojo.
3. Toca **Compilar 11A** y espera. Con 6 portadas tarda unos minutos. **Deja la pestaña a la vista**: si cambias
   de pestaña o minimizas el navegador, la compilación se pausa hasta que vuelvas.
4. Se descarga `11A.mind` a tu carpeta de Descargas. **Muévelo a `targets/`** del proyecto (reemplaza el anterior).
5. Sube los cambios a GitHub (paso 7).

La cámara revisa que el archivo coincida con el JSON: si `11A.mind` tiene 5 portadas y el JSON 6 revistas,
sale un aviso amarillo "Aviso para el docente" al abrir la cámara de ese curso.

*Alternativa:* el compilador oficial de MindAR, https://hiukim.github.io/mind-ar-js-doc/tools/compile.
Funciona igual, pero hay que subir las imágenes **exactamente en el orden del JSON**, a mano. Si se
desordenan, cada revista muestra el video de otra. Por eso existe `compilar.html`.

## 5. Generar los QR

1. Abre `herramientas/qr.html` (en el servidor de prueba o publicado).
2. Revisa que la dirección de arriba sea `https://jeffry0902.github.io/revista-aumentada-itey/`.
3. Hay dos grupos:
   - **QR de cada revista**: abre su video (`ver.html?id=…`). Va impreso **en la revista**.
   - **QR de la cámara por curso**: abre la cámara de ese curso. Va en un cartel **en el stand**.
4. Para meter un QR en el diseño de la revista (Canva, Word…) usa el botón **PNG** (1200 px) o **SVG**.
   Para imprimir una hoja con todos, filtra por curso y toca **Imprimir** (o "Guardar como PDF").
5. Tamaño mínimo impreso: **2,5 × 2,5 cm**, sin recortar el borde blanco. Pruébalo con dos celulares antes de imprimir la revista completa.

Los QR se pueden imprimir desde ya: dependen solo de `urlPublica` y del `id`, no de que el video esté listo.

## 6. Probar en local desde Windows

### En el computador
```powershell
node herramientas/servidor-https.mjs
```
Abre `https://localhost:8443`. La primera vez crea un certificado propio en `herramientas/.cert/`
(no se sube a GitHub). El navegador dirá **"La conexión no es privada"**: es normal en este servidor de prueba.
En Chrome toca "Configuración avanzada" → "Acceder a localhost (sitio no seguro)".

### En el celular (mismo wifi que el computador)
1. Ejecuta el comando de arriba. En la terminal sale una línea `En el celular (mismo wifi): https://192.168.x.x:8443`.
2. Si Windows pregunta por el **firewall**: marca "Redes privadas" y toca **Permitir**.
3. En el celular abre esa dirección.
   - **Chrome (Android):** "La conexión no es privada" → **Configuración avanzada** → **Acceder a 192.168.x.x (sitio no seguro)**.
   - **Safari (iPhone):** "Esta conexión no es privada" → **Mostrar detalles** → **visitar este sitio web** → **Visitar sitio web**.
4. Toca Abrir cámara y apunta a la portada en la pantalla del computador o impresa.

Si el wifi del colegio bloquea la conexión entre equipos (pasa en redes de invitados), comparte datos desde
el celular al computador, o prueba directamente en GitHub Pages: después de `git push` los cambios salen en 1 o 2 minutos.

## 7. Publicar en GitHub Pages

La primera vez:
1. Entra a https://github.com/new con tu cuenta **jeffry0902**.
   - **Repository name:** `revista-aumentada-itey` (exactamente así: forma la dirección de los QR).
   - **Description:** opcional.
   - **Public** (GitHub Pages gratis exige repositorio público).
   - **Add a README file:** sin marcar. **Add .gitignore:** None. **Choose a license:** None.
   - Toca **Create repository**.
2. En PowerShell, desde la carpeta del proyecto:
   ```powershell
   git add .
   git commit -m "Revista Aumentada: prototipo"
   git branch -M main
   git remote add origin https://github.com/jeffry0902/revista-aumentada-itey.git
   git push -u origin main
   ```
3. En GitHub, dentro del repositorio: **Settings** → menú izquierdo **Pages** →
   - **Source:** Deploy from a branch
   - **Branch:** `main` y carpeta `/ (root)` → **Save**
4. Espera 1 o 2 minutos y recarga. Arriba sale **"Your site is live at https://jeffry0902.github.io/revista-aumentada-itey/"**.

Cada vez que cambies algo:
```powershell
git add .
git commit -m "Agrega revistas de 11C"
git push
```
GitHub Pages guarda en caché unos 10 minutos: si el celular no muestra el cambio, espera o recarga.

## 8. Contador de escaneos (GoatCounter)

Cuenta cuántas veces se abrió cada cosa, sin cookies y sin datos personales. Es gratis para uso no comercial.
Si GoatCounter falla, la página sigue funcionando igual.

Activarlo (una sola vez):
1. Entra a https://www.goatcounter.com y toca **Sign up**.
2. En **Code** escribe un nombre corto, por ejemplo `revista-itey`: tu panel quedará en `https://revista-itey.goatcounter.com`.
3. Completa correo y contraseña y crea la cuenta.
4. En `revistas.json` pon ese código: `"goatcounter": "revista-itey"` y publica (paso 7).

Qué se cuenta (una vez por revista cada vez que se abre la página):

| Nombre en GoatCounter | Significa |
|---|---|
| `/inicio` | visitas a la página de inicio |
| `/camara/11A` | aperturas de la cámara de 11A |
| `ar-11A-01` | la cámara **reconoció** la portada de 11A-01 |
| `qr-11A-01` | alguien escaneó el **QR** de 11A-01 |
| `lista-11A-01` | alguien abrió el video de 11A-01 desde la lista |
| `/video/11A-01` | aperturas de la página del video (QR + lista) |

Las pruebas en tu computador o en la red de la casa no cuentan: GoatCounter ignora `localhost` y las direcciones `192.168…`.
Para el informe, GoatCounter permite exportar los datos a CSV desde su panel.

## 9. Lista de chequeo para el día de la feria

**El día anterior (22 de octubre)**
- [ ] Todas las revistas cargadas en `revistas.json`, cada curso compilado y publicado.
- [ ] Abrir la cámara de **cada curso** y reconocer **cada portada impresa** (no en pantalla).
- [ ] Probar en **3 celulares distintos**: un Android de gama media, un Android económico y un iPhone.
      Con datos móviles y con el wifi del colegio.
- [ ] Escanear todos los QR con la cámara normal del celular (sin app lectora).
- [ ] Revisar que ningún curso muestre el aviso amarillo "Aviso para el docente".
- [ ] Imprimir el cartel con el **QR de cámara por curso** para cada stand.
- [ ] Imprimir 2 copias de la hoja de QR de revistas como respaldo.

**Montaje del stand**
- [ ] Luz pareja sobre las revistas, sin reflejos: nada de lámpara directa sobre papel brillante ni sol de frente.
      Si la portada es satinada, inclínala un poco hasta que no brille.
- [ ] Revista plana (sobre la mesa o en un atril), no enrollada ni doblada.
- [ ] Cartel visible: "Escanea el QR · Abre la cámara · Apunta a la portada".
- [ ] Un estudiante por stand que sepa guiar al visitante.

**Consejos para el visitante (que los estudiantes los repitan)**
- Subir el **brillo** del celular al máximo.
- Limpiar el lente de la cámara.
- Apuntar a la portada **completa** a unos 30 cm, quieto 2 segundos.
- Si no reconoce en 10 segundos: usar el **QR** (plan B).
- Si el video no suena: tocar la pantalla y revisar que el celular no esté en silencio.
- Si abrió el enlace desde una app lectora de QR y la cámara no abre: menú ⋮ → **Abrir en Chrome**.

**Plan B y plan C**
- Plan B: QR de la revista → video directo (no usa realidad aumentada).
- Plan C, si falla internet: un computador o celular del stand con los videos descargados para mostrarlos sin conexión.
  Si el wifi del colegio es malo, un celular con datos compartidos en el stand ayuda a los visitantes cercanos.

## 10. Cronograma

| Fecha | Tarea |
|---|---|
| Hasta el 16 de octubre | Prototipo funcionando con 2 revistas de prueba ✔ (este repositorio). Publicar en GitHub Pages y probar en celulares. |
| 19 al 21 de octubre | Cargar portadas y videos reales: comprimir (paso 3), `revistas.json` (paso 2), compilar por curso (paso 4), QR (paso 5), publicar (paso 7). |
| 22 de octubre | Pruebas finales en celulares (lista de chequeo). |
| 23 de octubre | Feria, 8:00 a. m. – 12:00 m. |

Qué pedir a cada equipo: portada final en JPG (la misma que se imprime), video de 60–90 s, título del artículo y nombre del equipo.

## Privacidad

- El sitio no usa cookies ni formularios, y no pide datos personales. Solo se publican el nombre del equipo y el curso.
- El script de compresión borra la ubicación GPS y los datos del celular que vienen dentro de los videos.
- GoatCounter no usa cookies ni guarda la dirección IP de los visitantes.
- **Importante:** los videos muestran la imagen y la voz de estudiantes menores de edad y quedan públicos en internet.
  Según la Ley 1581 de 2012, se requiere la **autorización de los padres o acudientes** para publicarlos.
  Si algún estudiante no la tiene, puede aparecer solo con su voz, o el equipo puede explicar con diapositivas o dibujos.
- Después de la feria se puede despublicar el sitio (Settings → Pages → Unpublish) o borrar el repositorio.

## Solución de problemas

| Problema | Qué hacer |
|---|---|
| No reconoce la portada | Más luz y sin reflejos, portada completa en pantalla, 30 cm. Si una portada nunca se reconoce, tiene poco detalle (paso 1). |
| Reconoce la revista equivocada | El orden de `revistas.json` no coincide con el `.mind`: recompila el curso (paso 4). |
| Sale "La cámara de 11A todavía no está lista" | Falta `targets/11A.mind` o no se publicó. |
| Sale "Aviso para el docente" | El `.mind` tiene otro número de portadas que el JSON: recompila. |
| "Este navegador no puede usar la cámara" | Se abrió dentro de una app (lector de QR, Facebook, WhatsApp). Abrir en Chrome o Safari. |
| La cámara se ve negra o pide permiso otra vez | Candado junto a la dirección → Permisos → Cámara → Permitir, y recargar. |
| El video empieza sin sonido | Normal: tocar la pantalla. Revisar el botón de volumen y el modo silencio. |
| El video tarda en empezar | Red lenta: el video pesa hasta 8 MB. El botón "Ver video" o el QR son iguales de pesados; ayuda un wifi mejor o datos móviles. |
| La página no muestra un cambio | Caché de GitHub Pages: esperar 10 minutos o recargar. |
