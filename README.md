# Revista Aumentada · Feria de la Ciencia ITEY 2026

Revistas de física del grado 11° del **Instituto Técnico Empresarial El Yopal** con realidad aumentada.
El visitante apunta la cámara del celular a la portada de una revista y ve, encima de la página, el video
en el que los estudiantes explican su artículo. No hay que instalar ninguna app.

- **Dirección pública:** https://jeffry0902.github.io/revista-aumentada-itey/
- **Feria:** martes 27 de octubre de 2026 (se aplazó; estaba para el viernes 23).
- **Revistas:** **16 elegidas** por el docente con dos juezas invitadas (23-oct): 2 de 11A y 11C, 3 de 11D y 11E,
  1 de 11F y 11G, 4 de 11I. Los videos se cargan cuando los equipos los envíen en buena calidad; mientras tanto
  la cámara, la galería y la página del video dicen "disponible muy pronto".
- **Tecnología:** página estática en GitHub Pages, MindAR 1.2.5 + A-Frame 1.5.0 desde CDN. No tiene servidor propio ni base de datos.

---

## Cómo funciona

| Página | Para qué |
|---|---|
| `index.html` | Inicio: instrucciones, botón **Abrir cámara** y lista de revistas agrupadas por curso. |
| `ar.html?camara=11` | La cámara con realidad aumentada. **Una sola cámara reconoce las 16 revistas.** Reproduce el video encima de la portada; botón **Ver video** para verlo en grande y **Leer revista** si la revista tiene páginas. Botón **Modo gafas** para usarla con las gafas VR. |
| `ver.html?id=11A-01` | Solo el video de una revista. **A esta página llevan los QR impresos en las revistas** (plan B sin cámara AR). |
| `herramientas/compilar.html` | Para el docente: genera el archivo de reconocimiento de las portadas. |
| `herramientas/qr.html` | Para el docente: genera e imprime los QR. |
| `sala.html` | Galería virtual para gafas VR: las portadas como cuadros, sus videos y las revistas completas. |
| `herramientas/paginas.html` | Para el docente: convierte el PDF de una revista en las páginas que se leen en la galería. |

El visitante:
1. Toca **Abrir cámara** (o escanea el QR de la cámara en la portada).
2. Toca **Toca para empezar**. Los celulares no dejan sonar un video sin un toque previo: ese toque da el permiso y desde ahí los videos suenan solos.
3. Permite el uso de la cámara.
4. Apunta a la portada de cualquier revista. El video aparece anclado sobre la página, con sonido, y abajo sale una tarjeta con el curso, el título y los botones **Ver video** y **Leer revista**.

Puede pasar de stand en stand sin cerrar la cámara: reconoce cualquier revista de la feria.
Si la cámara no funciona, escanea el **QR de la revista**, que abre `ver.html` con el video.

## Estructura de carpetas

**Cada revista tiene su carpeta** con su portada y su video. El nombre de la carpeta es el `id` de la revista:

```
revista-aumentada-itey/
├─ index.html, ar.html, ver.html     páginas
├─ revistas.json                     ← lo único que se edita para agregar revistas
├─ revistas/
│  ├─ 11A-01/
│  │  ├─ portada.jpg                 la imagen que reconoce la cámara
│  │  ├─ video.mp4                   el video comprimido
│  │  └─ paginas/1.jpg, 2.jpg…       (opcional) la revista completa para la galería virtual
│  ├─ 11A-02/
│  │  ├─ portada.jpg
│  │  └─ video.mp4
│  └─ …                              una carpeta por revista
├─ targets/11.mind                   las portadas compiladas de la cámara "Grado 11°"
├─ css/, js/, img/                   diseño, código, logo y escudo del ITEY
└─ herramientas/
   ├─ compilar.html                  compila las portadas → targets/11.mind
   ├─ qr.html                        hoja de QR para imprimir (PNG/SVG)
   ├─ paginas.html                   PDF de la revista → revistas/<id>/paginas/
   ├─ servidor-https.mjs             servidor de prueba para el celular por wifi
   └─ comprimir-videos.ps1           compresión de videos con ffmpeg
```

Los nombres son fijos: siempre `portada.jpg` y `video.mp4`. Así nunca se confunde la portada de un video con la de otro.

## Una sola cámara para todas las revistas

MindAR guarda todas las portadas de una cámara en un solo archivo (`targets/11.mind`). Mientras no reconoce
ninguna, compara cada imagen de la cámara **contra esas portadas una por una**. Con 14 es manejable:

| | Una cámara por curso (7 de 2) | **Una cámara para todo 11° (14)** ✅ |
|---|---|---|
| Qué hace el visitante | cambia de cámara al pasar a un stand de otro curso | abre la cámara una vez y reconoce todo |
| QR para los carteles de los stands | 7 distintos | **1 solo** |
| Descarga antes de abrir la cámara | ~1,6 MB | ~0,4–0,8 MB por portada → **~6–11 MB**, una vez por visitante |
| Velocidad para reconocer | la más rápida | algo más lenta en celulares modestos |
| Si un equipo cambia su portada | recompilar 2 | recompilar las 14 (3–5 minutos) |

**Plan si resulta pesada o lenta:** cuando estén las 14 portadas reales, medir el peso de `targets/11.mind` y
probar en un celular económico. Si tarda mucho, se parte en dos cámaras agregando una segunda en
`revistas.json` (por ejemplo 11A–11E y 11F–11I). No hay que tocar el código.

Prueba del prototipo (26 de septiembre): Samsung S25 Ultra con Chrome reconoce en ~1 s y tiembla muy poco;
en un iPhone 17 Pro Max el video funciona bien (lo que costó fue leer el QR en la pantalla del computador).

---

## 1. Qué pedirle a cada equipo

**Entregas por OneDrive:** cada revista va en su propia carpeta dentro de `E:\OneDrive\Revista aumentada\entregas\`
(hay una `_PLANTILLA - curso - equipo` con un `datos.txt` de ejemplo, y un `LEEME` con el paso a paso).
La portada puede venir como PDF de la revista (se usa la página 1) o como imagen.

Cada equipo entrega **una carpeta** con el nombre `curso - equipo`, por ejemplo `11B - Los Newtonianos`, con:
- **La portada** tal como se va a imprimir: JPG o PNG de **al menos 1000 px de ancho**. Exportada del mismo
  archivo con el que se imprime (Canva, Word, Publisher), no una captura de pantalla ni una imagen de internet pequeña.
- **El video** de 60 a 90 segundos, horizontal o vertical, grabado con el celular. No hace falta comprimirlo.
- **El título del artículo** y **el nombre del equipo** (en el mensaje o en un archivo de texto). **Sin nombres de estudiantes.**

## 2. Preparar una buena portada

MindAR reconoce por "puntos de interés": esquinas, bordes, letras y texturas.

**Sí:**
- Mucho detalle repartido por toda la página: texto, dibujos, fotos, patrones, bordes nítidos.
- Buen contraste (oscuro sobre claro o al revés).
- Unos 1000 px de ancho. La herramienta de compilar avisa si pasa de 2000 px o baja de 480 px.
- Imprimir en papel **mate** si se puede. El brillo del papel satinado refleja la luz y "borra" zonas.

**No:**
- Fondos lisos grandes (un degradado, un cielo, un color plano ocupando media portada).
- Patrones que se repiten igual (cuadrícula perfecta, baldosas), porque confunden la ubicación.
- Portadas casi iguales entre equipos (misma plantilla y solo cambia el título): se confunden entre sí.
  Con 14 revistas en una sola cámara esto importa más: pide que cada portada tenga una imagen grande propia.
- Cambiar la portada después de compilar: si cambia, **hay que volver a compilar** (paso 5).

## 3. Agregar una revista

1. Elige su `id`: curso + número, por ejemplo `11B-01` y `11B-02`. **El id va dentro del QR impreso**: una vez impreso, no se cambia.
2. Crea la carpeta `revistas\11B-01\`.
3. Pon la portada con el nombre **`portada.jpg`**. Si viene en PNG, ábrela en Paint y usa *Guardar como → JPEG*.
4. Comprime el video directamente a esa carpeta (paso 4); queda como **`video.mp4`**.
5. En `revistas.json`, dentro de la lista `"revistas"` de la cámara, agrega:
   ```json
   {
     "id": "11B-01",
     "curso": "11B",
     "equipo": "Los Newtonianos",
     "titulo": "La física del fútbol"
   }
   ```
   Separa cada revista de la anterior con una **coma**.
6. **Vuelve a compilar** (paso 5). El orden importa: la primera revista de la lista es la portada 0 del archivo `.mind`,
   la segunda la 1, y así. Si agregas, quitas o reordenas revistas, hay que recompilar.
7. Publica (paso 8).

| Campo | Qué es |
|---|---|
| `id` | Código único, también es el nombre de la carpeta. Solo letras, números y guiones. |
| `curso` | El curso que sale en la tarjeta de la cámara y agrupa la lista de inicio. |
| `equipo` | Nombre del equipo. **Nada de nombres de estudiantes.** |
| `titulo` | Título del artículo. |
| `paginas` | *(Opcional)* Cuántas páginas tiene la revista completa en `revistas/<id>/paginas/`. Número sin comillas. Ver "Revista completa en la galería". |
| `video360` | *(Opcional)* `true` si el video es 360°. Ver "Videos 360°". |

Otros campos de `revistas.json`:
- `camaras`: la lista de cámaras. Hoy hay una: `"id": "11"` (su archivo es `targets/11.mind`) y `"nombre": "Grado 11°"`.
- `urlPublica`: dirección del sitio. La usan los QR. No la cambies después de imprimir.
- `goatcounter`: código del contador de escaneos (paso 9). Vacío = sin contador.
- `evento`: texto que sale en el encabezado.

Si el archivo queda con un error (una coma de más o de menos), la página lo dice en letras rojas. Para revisarlo
puedes abrirlo en VS Code, que subraya el error.

## 4. Comprimir los videos

Meta: MP4 H.264, 720p, de 60 a 90 s y como máximo ~8 MB. Probado con un video de 90 s de mucho movimiento: queda en **7,0 MB**;
un video real de 74 s grabado con celular pasó de 12,5 MB a **6,0 MB**.

ffmpeg ya está instalado con scoop (`scoop install ffmpeg`). Para **una revista**, desde la carpeta del proyecto en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\herramientas\comprimir-videos.ps1 -Entrada "E:\OneDrive\Escritorio\entregas\11B - Los Newtonianos" -Salida .\revistas\11B-01 -Nombre video
```

- `-Entrada`: la carpeta que entregó el equipo. Debe tener **un solo video** (la portada puede estar ahí también, no estorba).
- `-Salida`: la carpeta de la revista. Si no existe, se crea.
- `-Nombre video`: el archivo queda como `video.mp4`.

El script:
- reduce a 720 px el lado corto (horizontal → 1280×720, vertical → 720×1280) sin agrandar videos pequeños;
- limita a 30 cuadros por segundo, audio mono y ~600 kbit/s de video;
- **borra los metadatos del celular** (ubicación GPS, modelo del equipo);
- pone el índice al comienzo del archivo (`faststart`) para que empiece a sonar antes de terminar de descargar;
- al final muestra duración y peso, y avisa si pasa de 90 s o de 8 MB.

Si un video pesa más de 8 MB, vuelve a pasarlo con menos calidad: agrega `-KbpsVideo 450`.
Sin `-Nombre`, el script comprime **todos** los videos de una carpeta y conserva sus nombres (en minúsculas, sin tildes ni espacios).

**Comando de ffmpeg de una sola línea** (lo mismo, sin el script, para todos los videos de una carpeta):

```powershell
Get-ChildItem "E:\OneDrive\Escritorio\originales\*" -Include *.mp4,*.mov | ForEach-Object { ffmpeg -y -i $_.FullName -map 0:v:0 -map "0:a:0?" -map_metadata -1 -vf "scale='if(gt(iw,ih),-2,trunc(min(720,iw)/2)*2)':'if(gt(iw,ih),trunc(min(720,ih)/2)*2,-2)'" -fpsmax 30 -c:v libx264 -preset slow -crf 26 -maxrate 600k -bufsize 1200k -profile:v high -pix_fmt yuv420p -g 60 -c:a aac -b:a 64k -ac 1 -ar 44100 -movflags +faststart "E:\OneDrive\Escritorio\comprimidos\$($_.BaseName).mp4" }
```

Presupuesto de espacio: 14 videos × ≤ 8 MB ≈ 110 MB. GitHub Pages admite hasta 1 GB.

## 5. Compilar las portadas

1. Abre `herramientas/compilar.html` en el **computador**: en el servidor de prueba (paso 7) o
   ya publicado, `https://jeffry0902.github.io/revista-aumentada-itey/herramientas/compilar.html`.
2. Revisa la lista: cada portada con su número (0, 1, 2…) en el orden de `revistas.json` y sin avisos en rojo.
3. Toca **Compilar Grado 11°** y espera. Con 14 portadas tarda unos minutos. **Deja la pestaña a la vista**: si cambias
   de pestaña o minimizas el navegador, la compilación se pausa hasta que vuelvas.
4. Se descarga `11.mind` a tu carpeta de Descargas. **Muévelo a `targets\`** del proyecto (reemplaza el anterior).
5. Publica (paso 8).

La cámara revisa que el archivo coincida con el JSON: si `11.mind` tiene 13 portadas y el JSON 14 revistas,
sale un aviso amarillo "Aviso para el docente" al abrir la cámara.

*Alternativa:* el compilador oficial de MindAR, https://hiukim.github.io/mind-ar-js-doc/tools/compile.
Funciona igual, pero hay que subir las imágenes **exactamente en el orden del JSON**, a mano. Si se
desordenan, cada revista muestra el video de otra. Por eso existe `compilar.html`.

## 6. Generar los QR

1. Abre `herramientas/qr.html` (en el servidor de prueba o publicado).
2. Revisa que la dirección de arriba sea `https://jeffry0902.github.io/revista-aumentada-itey/`.
3. Hay dos grupos:
   - **QR de cada revista**: abre su video (`ver.html?id=…`). Va impreso **en la revista**.
   - **QR de la cámara · Grado 11°**: abre la cámara. **Es el mismo para todos**: va en la **portada de cada revista**
     (en una esquina libre) y en un cartel en cada stand.

   **Dónde va cada QR en la revista:** portada → QR de la cámara; contraportada → QR del video de esa revista.
   Como el QR de la cámara queda impreso en la portada, **la `portada.jpg` que se compila debe ser la portada con su QR**,
   exactamente como se imprime. Probado: el QR de la cámara solo no activa ninguna revista, y cada portada con QR
   se reconoce únicamente como ella misma.
4. Para meter un QR en el diseño de la revista (Canva, Word…) usa el botón **PNG** (1200 px) o **SVG**.
   Para imprimir una hoja, filtra por curso si quieres y toca **Imprimir** (o "Guardar como PDF").
5. Tamaño mínimo impreso: **2,5 × 2,5 cm**, sin recortar el borde blanco. Pruébalo **impreso** con un Android y un iPhone
   antes de imprimir la revista completa: en la pantalla del computador los iPhone a veces cuestan más en leerlos.

Los QR se pueden imprimir desde ya: dependen solo de `urlPublica` y del `id`, no de que el video esté listo.

## 7. Probar en local desde Windows

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

## 8. Publicar en GitHub Pages

Ya está publicado: repositorio `jeffry0902/revista-aumentada-itey`, rama `main`, carpeta raíz.

Cada vez que cambies algo, en PowerShell desde la carpeta del proyecto:
```powershell
git add .
git commit -m "Agrega revistas de 11C"
git push
```
GitHub Pages guarda en caché unos 10 minutos: si el celular no muestra el cambio, espera o recarga.

<details>
<summary>Cómo se publicó la primera vez (por si hay que repetirlo)</summary>

1. En https://github.com/new: **Repository name** `revista-aumentada-itey`, **Public**, sin README, sin .gitignore, sin licencia → **Create repository**.
2. `git remote add origin https://github.com/jeffry0902/revista-aumentada-itey.git` y `git push -u origin main`.
3. En el repositorio: **Settings** → **Pages** → **Source:** Deploy from a branch → **Branch:** `main` y `/ (root)` → **Save**.
4. A los 1–2 minutos: "Your site is live at https://jeffry0902.github.io/revista-aumentada-itey/".
</details>

## 9. Contador de escaneos (GoatCounter, opcional)

Cuenta cuántas veces se abrió cada cosa, sin cookies y sin datos personales. Es gratis para uso no comercial.
Si GoatCounter falla, la página sigue funcionando igual. **Hoy está apagado** (`"goatcounter": ""`).

Activarlo (una sola vez):
1. Entra a https://www.goatcounter.com/signup.
2. En el primer campo (el nombre de la cuenta) escribe un nombre corto, por ejemplo `revista-itey`:
   tu panel quedará en `https://revista-itey.goatcounter.com`. **Site domain** se puede dejar vacío.
3. Completa correo y contraseña (mínimo 8 caracteres), escribe el número que pide la verificación
   anti-spam y toca **Sign up**.
4. En `revistas.json` pon ese nombre: `"goatcounter": "revista-itey"` y publica (paso 8).

Qué se cuenta (una vez por revista cada vez que se abre la página):

| Nombre en GoatCounter | Significa |
|---|---|
| `/inicio` | visitas a la página de inicio |
| `/camara/11` | aperturas de la cámara |
| `ar-11A-01` | la cámara **reconoció** la portada de 11A-01 |
| `qr-11A-01` | alguien escaneó el **QR** de 11A-01 |
| `lista-11A-01` | alguien abrió el video de 11A-01 desde la lista |
| `/video/11A-01` | aperturas de la página del video (QR + lista) |

Las pruebas en tu computador o en la red de la casa no cuentan: GoatCounter ignora `localhost` y las direcciones `192.168…`.
Para el informe, GoatCounter permite exportar los datos a CSV desde su panel.

## 10. Lista de chequeo para el día de la feria

**El día anterior (22 de octubre)**
- [ ] Las 16 revistas en `revistas.json`, cada una con su carpeta, compiladas y publicadas.
- [ ] Abrir la cámara y reconocer **cada una de las 16 portadas impresas** (no en pantalla).
- [ ] Probar en **3 celulares distintos**: un Android de gama media, un Android económico y un iPhone.
      Con datos móviles y con el wifi del colegio.
- [ ] Escanear todos los QR impresos con la cámara normal del celular (sin app lectora).
- [ ] Revisar que no salga el aviso amarillo "Aviso para el docente".
- [ ] Imprimir un cartel con el **QR de la cámara** para cada stand.
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
- Si no reconoce en 10 segundos: usar el **QR** de la revista (plan B).
- Si el video no suena: subir el volumen, revisar que el celular no esté en silencio y tocar la pantalla.
- Si abrió el enlace desde una app lectora de QR y la cámara no abre: menú ⋮ → **Abrir en Chrome**.

**Plan B y plan C**
- Plan B: QR de la revista → video directo (no usa realidad aumentada).
- Plan C, si falla internet: un computador o celular del stand con los videos descargados para mostrarlos sin conexión.
  Si el wifi del colegio es malo, un celular con datos compartidos en el stand ayuda a los visitantes cercanos.

## 11. Cronograma

| Fecha | Tarea |
|---|---|
| Hasta el 16 de octubre | Prototipo funcionando con 2 revistas de prueba ✔ publicado y probado en Android y iPhone. |
| 19 al 21 de octubre | Recibir las carpetas de los 14 equipos (paso 1), crear sus carpetas y comprimir videos (pasos 3–4), compilar (paso 5), QR (paso 6), publicar (paso 8). |
| 22 de octubre | Pruebas finales en celulares (lista de chequeo). |
| 27 de octubre | Feria (aplazada desde el 23). |

## Galería virtual con gafas (`sala.html`)

Para el stand con gafas de realidad virtual tipo VR Box (el celular va adentro):
el visitante queda en el centro de una **galería de arte**: paredes claras con zócalo azul y filete amarillo,
piso de madera, techo con claraboya y un riel de luces. **Cada portada es un cuadro enmarcado** con su luz y una
cartela de museo (curso, equipo, título). Al frente, un **atril con la instrucción** ("Mira fijo una portada
6 segundos y se reproduce tu video") y un letrero colgado del techo con el nombre de la feria.

- **Mirar un cuadro** medio segundo: su **portada sale de la pared**, grande y con borde amarillo, a 1,7 m, con su
  **ficha** (curso, equipo y título) debajo y la galería en penumbra suave. **Seguir mirando la portada unos 6 segundos** (tiempo para leerla; `MIRADA_PORTADA_MS` = 5,4 s después de que sale)
  abre su video en una pantalla gigante (modo cine). Al girar la cabeza hacia otro lado, la portada vuelve a la pared.
  Mirar **«Volver»** 2 segundos regresa. Al terminar un video, la galería vuelve sola a los 6 segundos.
- Si la revista tiene sus páginas, junto al video aparece **«Leer revista»** (ver abajo).
- Dirección: `https://jeffry0902.github.io/revista-aumentada-itey/sala.html` (también está en la página de inicio).
- No hay nada que configurar: usa las mismas carpetas `revistas/<id>/` y `revistas.json`. Cada revista nueva aparece sola
  como un cuadro. La sala tiene 12 paredes; con más de 12 revistas se agranda para que cada cuadro tenga su pared
  (probado con 14). Si sobran paredes, la del fondo lleva el escudo del colegio.
- **Uso en el stand:** abrir `sala.html` en el celular de las gafas, tocar **Entrar con gafas** (ese toque habilita
  el sonido) y meter el celular **acostado** en las gafas. Para el siguiente visitante no hay que tocar nada.
  **Ver sin gafas** sirve para probar moviendo el celular; en el computador se arrastra con el mouse y se hace clic.
- **Gafas:** VR Shinecon (lentes asféricas de 40 mm, campo de visión 90–100°, distancia entre lentes ajustable de
  58 a 67 mm, para celulares de 4,7" a 6"). Funcionan también con celulares más grandes (probado con un Samsung S25
  Ultra de 6,9") porque la galería no usa media pantalla para cada ojo: pone cada imagen **frente a su lente, a 60 mm
  entre centros**, sea cual sea el tamaño del celular (por eso las imágenes son dos recuadros redondeados en el centro).
  Los videos "VR" de YouTube que llenan media pantalla por ojo sí fallan en celulares grandes: en uno de 16 cm de ancho
  sus centros quedan a 80 mm y las lentes no llegan, se ve doble.
  - Rueda de **distancia entre lentes**: ponerla cerca del mínimo (unos 60 mm). Rueda de **enfoque**: hasta ver nítidas
    las letras de las cartelas.
  - Los celulares de las gafas son del stand: con giroscopio, brillo y volumen al máximo, cargados y con batería externa.
- **Curvatura de las lentes (Android):** en la galería, la deformación de lente la pone **Chrome** según el
  *perfil del visor*; sin perfil usa "Cardboard v1" (curvatura 0,441 y 0,156), que con las gafas Shinecon se ve
  "barrigona". En `E:\OneDrive\Revista aumentada\gafas\` hay tres QR de perfil, iguales a Cardboard v1 salvo la
  curvatura: **1 - suave** (0,33 y 0,12), **2 - más suave** (0,24 y 0,09) y **3 - original** (para volver atrás).
  Se escanean una vez por celular desde el **engranaje** del modo gafas de Chrome. Los genera
  `.claude/herramientas/perfil_visor.py`. La cámara AR no depende de esto: su curvatura la dibuja la página
  (`LENTE` en `js/ar-gafas.js`).
- **Nitidez:** en modo gafas se pide a Chrome la resolución completa de la pantalla (antes dibujaba a una resolución
  menor y se veía más borroso dentro de las gafas que fuera). La portada ampliada y la ficha están cerca porque lo
  cercano se ve nítido en las gafas, como el lector de la revista.
- **Borroso al girar la cabeza:** la pantalla del celular deja cada imagen encendida hasta la siguiente y, al mover la
  cabeza, se "arrastra" (las gafas VR dedicadas apagan la imagen entre cuadros; un celular no puede). Menos se nota
  cuantos más cuadros por segundo, pero en Chrome Android la página no puede elegirlos: los decide el celular.
  En el Samsung: Ajustes → Pantalla → **Fluidez de movimiento → Adaptable** (hasta 120 Hz) y **sin Ahorro de energía**.
- **iPhone:** Safari no tiene modo gafas propio y A-Frame usa un reemplazo que no conocía los iPhone del 12 en adelante:
  suponía una pantalla de 10,4 cm y se veía doble. `js/pantalla.js` calcula el tamaño real de cada iPhone (por la
  densidad de su pantalla) y lo corrige. Para usarlo:
  1. En Safari, tocar **Compartir → «Agregar a inicio»** en la galería y abrirla desde ese ícono: se abre a pantalla
     completa, sin la barra de Safari (con la barra, las imágenes quedan corridas).
  2. Quitar el **bloqueo de rotación** (Centro de control). La página no puede girar la pantalla en iPhone: después de
     «Entrar con gafas» hay que acostar el celular (sale un aviso en español mientras esté vertical).
  3. Si pide permiso para los sensores de movimiento, tocar **«Permitir»** (si no, la vista no sigue la cabeza).
  4. Ajustes → Pantalla y brillo → Bloqueo automático → **Nunca**, para que la pantalla no se apague dentro de las gafas.
  5. Apagar el **Modo de bajo consumo** (con él Safari va a 30 cuadros por segundo y la imagen va a saltos) y dejar el
     **Zoom de pantalla** en «Predeterminado» (con zoom el cálculo del tamaño falla y se ve doble). En el iPhone 12/13 mini
     las imágenes quedan unos 4 mm más juntas: poner la rueda de las lentes al mínimo.
- Para que suene: volumen alto del celular o audífonos bluetooth. Toallitas para limpiar entre visitantes y sesiones de 1–2 minutos.
- Probado con las gafas reales en el S25 Ultra (se ve bien) y en un iPhone 13 y un iPhone 16 (se veía doble, corregido
  el 19 de octubre; falta volver a probar en iPhone).

### Revista completa en la galería

Cada revista puede llevar sus páginas para hojearla dentro de las gafas:

1. Abre `herramientas/paginas.html` en el computador, elige la revista y su **PDF completo** y toca **Convertir**.
   Sirve el PDF exportado de Canva/Word o la revista impresa **escaneada con el celular** (Adobe Scan). Si viene en
   pliegos (la revista abierta, dos páginas por hoja), la casilla «Partir los pliegos» los corta por el lomo.
   Se descarga `<id>-paginas.zip`.
2. Descomprímelo dentro de `revistas\<id>\`: queda la carpeta `paginas` con `1.jpg`, `2.jpg`… (la 1 es la portada).
3. En `revistas.json` agrega a esa revista `"paginas": 12` (el número que indica la herramienta, sin comillas) y publica.

En la galería, la cartela del cuadro dice "revista de N páginas" y junto al video sale **«Leer revista»**:
- La revista se abre **a doble página**, como en papel: la portada sola, luego 2–3, 4–5…
- Las páginas se ven en tamaño normal y se pueden leer mirándolas sin que se muevan. Abajo: **«Volver»**,
  **«Acercar»** y **«Ver video»**. **«Acercar»** pone la página grande, casi de piso a techo, y se lee **moviendo la
  cabeza**; ahí las flechas pasan de a una página y **«Alejar»** vuelve a la doble página.
- Las **flechas amarillas** pasan la página (o la doble página). **«Ver video»** salta al video del equipo.

Las dos revistas de ejemplo tenían sus páginas (escaneadas); se quitaron de la galería el 23-oct, al cargar las 16 elegidas,
y siguen en el historial de git (commit `697a849`). Las 16 elegidas tienen sus páginas desde el 23-oct, sacadas de sus
PDF para imprimir (la página 1 es la portada final, con su QR). En la galería, la doble página mide 1,6 m de alto
(antes 1,4 m; elegido con las gafas el 23-oct: 1,8 m quedaba encima). Si se ve doble, revisar que el celular
esté derecho dentro del visor y «Acercar» sigue en 2,3 m. Se publican con los créditos tal cual: el docente tiene autorización
escrita de los padres para el manejo de datos.

Peso: unas 200–450 KB por página en calidad normal; una revista de 12 páginas ≈ 3,5 MB. Si es muy larga, usa la calidad «Liviana».

### Cámara con las gafas puestas (`ar.html` → «Modo gafas»)

La cámara también funciona dentro de las gafas: el visitante mira la revista impresa **a través de la cámara del
celular** y ve el video encima de la portada, como en la galería. Las gafas deben dejar descubierta la cámara del
celular (la mayoría de VR Box tienen una tapa frontal que se abre o se quita).

1. Abrir la cámara, tocar **Modo gafas** (arriba a la derecha): la pantalla se pone horizontal y muestra dos visores juntos al centro, como en la galería.
   Ese toque también habilita el sonido. **No usar** el botón «VR» de otras páginas: muestra la pantalla negra porque
   no incluye la imagen de la cámara.
2. Meter el celular en las gafas y mirar la portada impresa (a 30–50 cm). El video aparece encima.
   Los visores tienen la forma y el tamaño de los de la galería, con una deformación de lente más suave (la de Cardboard
   se veía como ojo de pez). La imagen de la cámara ocupa el 80 % del visor, un poco más grande que la realidad:
   mucho más grande marearía, porque se movería más rápido que la cabeza. Con las gafas, el video se agranda 1,3 veces
   sobre la portada y las páginas 1,5 veces, para alcanzar a leerlas.
   Al entrar, la cámara se reinicia unos segundos ("Ajustando la cámara…") para pasar a alta resolución y a la
   pantalla acostada; sin eso el video sale torcido sobre la portada.
3. Debajo de la portada aparece **«Leer revista»**: se elige poniendo el punto amarillo encima **2 segundos**.
   La página se ve encima de la portada impresa; las **flechas amarillas** a los lados pasan la página y
   **«Ver video»** (abajo) vuelve al video.
4. Para salir: sacar el celular y tocar la pantalla → **Salir del modo gafas**.

Sin gafas, la tarjeta de la revista detectada trae el botón **Leer revista**, que abre la revista en pantalla:
se desliza para pasar de página y se toca una página para acercarla. `ver.html` (la página de los QR) tiene el mismo botón.

### Videos 360°

Si un equipo graba su video con una **cámara 360°**, el visitante queda *dentro* del video y puede mirar
alrededor, como en los videos VR de YouTube. Al mirar el cuadro, la galería desaparece y el visitante queda en el
centro del video; el "frente" del video queda hacia el cuadro elegido y los botones «Volver» y «Repetir» quedan
abajo, a la altura del pecho.

1. Exportar el video desde la app de la cámara como **360 equirectangular** (imagen 2:1, por ejemplo 5760×2880), sin reencuadrar.
2. Comprimirlo con `-Video360` (queda en 2880×1440, ~38 MB por minuto):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\herramientas\comprimir-videos.ps1 -Entrada "E:\ruta\11B - Los Newtonianos" -Salida .\revistas\11B-01 -Nombre video -Video360
   ```
3. En `revistas.json` agregar a esa revista `"video360": true`.

Los videos 360° pesan mucho más: mejor de **30 a 60 segundos**. La cámara AR y `ver.html` muestran ese mismo video
plano y deformado, así que un video 360° conviene para una revista que se vea sobre todo en la galería.

#### Cómo grabar un video 360° (guía para los estudiantes)

Los videos que ya tenemos son planos: se ven en la pantalla gigante, pero no se pueden convertir en 360° porque la
cámara solo grabó lo que tenía al frente. Para el efecto VR hay que grabarlos así desde el principio:

- **Cámara:** una cámara 360° de dos lentes (Insta360 X3/X4, Ricoh Theta, Kandao QooCam o similar). Un celular solo no graba 360°.
- **La cámara es la cabeza del visitante:** en trípode o monopié, a la altura de los ojos (1,5–1,6 m) y **quieta**.
  Nada de caminar con la cámara ni moverla: en las gafas eso marea.
- **La acción alrededor:** el equipo se para a **1–2 m** de la cámara (más cerca se deforma y se nota la unión de las
  dos lentes). Quien explica mira a uno de los lentes: ese será el **frente**. El experimento puede pasar a los lados
  o por encima (un balón en tiro parabólico que vuela sobre el visitante, ondas en un charco a sus pies).
- **Nadie escondido detrás del trípode** si no es parte de la escena: el visitante va a mirar para atrás.
- **Luz pareja** (de día o con todas las luces): la cámara ve también las lámparas y las ventanas.
- **Sonido:** micrófono de solapa o grabar la voz aparte; el micrófono de la cámara capta todo el lugar.
- **Planos largos y pocos cortes** (de 10 a 20 s cada uno). Los textos o títulos, grandes y en el frente.
- Duración total de 30 a 60 s. Exportar en la máxima resolución de la cámara como equirectangular.

Sin cámara 360°, el efecto se puede probar con escenas hechas en computador (Blender exporta video 360°).

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
| No reconoce la portada | Más luz y sin reflejos, portada completa en pantalla, 30 cm. Si una portada nunca se reconoce, tiene poco detalle o es muy pequeña (paso 2). |
| Reconoce la revista equivocada | El orden de `revistas.json` no coincide con el `.mind`: recompila (paso 5). O dos portadas se parecen demasiado. |
| Sale "La cámara todavía no está lista" | Falta `targets/11.mind` o no se publicó. |
| Sale "Aviso para el docente" | El `.mind` tiene otro número de portadas que el JSON: recompila. |
| "Este navegador no puede usar la cámara" | Se abrió dentro de una app (lector de QR, Facebook, WhatsApp). Abrir en Chrome o Safari. |
| La cámara se ve negra o pide permiso otra vez | Candado junto a la dirección → Permisos → Cámara → Permitir, y recargar. |
| El video empieza sin sonido | Revisar el botón de volumen y el modo silencio. Si sigue mudo, tocar la pantalla. |
| El video no carga | Revisa que exista `revistas/<id>/video.mp4` con ese nombre exacto. |
| El video tarda en empezar | Red lenta: el video pesa hasta 8 MB. El botón "Ver video" o el QR son iguales de pesados; ayuda un wifi mejor o datos móviles. |
| La página no muestra un cambio | `sw.js` hace que el celular pida siempre la última versión. Un celular que abrió el sitio antes del 18 de octubre puede tardar hasta 10 minutos la primera vez; si no, borrar los datos del sitio (candado → Configuración del sitio → Borrar). |
