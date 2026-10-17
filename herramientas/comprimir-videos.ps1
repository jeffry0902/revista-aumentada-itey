<#
  Comprime en lote los videos de los estudiantes para la web:
  MP4 H.264, lado corto de 720 px (horizontal 1280x720, vertical 720x1280),
  maximo 30 cuadros por segundo, audio AAC mono y un tope de ~7,5 MB para 90 s.

  Tambien borra los metadatos del celular (ubicacion GPS, modelo del equipo)
  y normaliza el nombre del archivo: minusculas, sin tildes ni espacios.

  Uso para una revista (desde la carpeta del proyecto): la carpeta que entrego
  el equipo, con un solo video adentro, queda como revistas\<id>\video.mp4
    powershell -ExecutionPolicy Bypass -File .\herramientas\comprimir-videos.ps1 -Entrada "E:\ruta\11B - Los Newtonianos" -Salida .\revistas\11B-01 -Nombre video

  Uso en lote (sin -Nombre): comprime todos los videos de una carpeta y conserva sus nombres.
    powershell -ExecutionPolicy Bypass -File .\herramientas\comprimir-videos.ps1 -Entrada "E:\ruta\originales" -Salida "E:\ruta\comprimidos"

  Videos 360 (exportados de la app de la camara 360 como "equirectangular", 2:1):
  agrega -Video360. Quedan de 2880x1440 a ~5 Mbit/s (~38 MB por minuto): en las
  gafas cada ojo ve solo un pedazo del video, asi que necesita mas pixeles.
#>
param(
  [Parameter(Mandatory = $true)] [string]$Entrada,
  [Parameter(Mandatory = $true)] [string]$Salida,
  # Nombre fijo para el archivo de salida (sin extension). Exige un solo video en -Entrada.
  [string]$Nombre = '',
  # 600 kbit/s de video + 64 kbit/s de audio = ~7,5 MB en 90 s.
  [int]$KbpsVideo = 600,
  # Video 360 equirectangular: conserva la proporcion 2:1 a 2880x1440 y sube la calidad.
  [switch]$Video360
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host 'No se encontro ffmpeg. Instalalo con:  scoop install ffmpeg' -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $Entrada)) {
  Write-Host "No existe la carpeta de entrada: $Entrada" -ForegroundColor Red
  exit 1
}
New-Item -ItemType Directory -Force -Path $Salida | Out-Null

function Limpiar-Nombre([string]$nombre) {
  $sinTildes = -join ($nombre.Normalize([Text.NormalizationForm]::FormD).ToCharArray() |
    Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' })
  $limpio = ($sinTildes.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
  if ($limpio) { $limpio } else { 'video' }
}

$extensiones = '.mp4', '.mov', '.m4v', '.avi', '.mkv', '.3gp', '.webm', '.wmv'
$videos = Get-ChildItem -Path $Entrada -File | Where-Object { $extensiones -contains $_.Extension.ToLower() }
if (-not $videos) {
  Write-Host "No hay videos en $Entrada" -ForegroundColor Yellow
  exit 0
}
if ($Nombre -and @($videos).Count -gt 1) {
  Write-Host "Con -Nombre la carpeta debe tener un solo video, y $Entrada tiene $(@($videos).Count)." -ForegroundColor Red
  exit 1
}

# Lado corto a 720 px sin agrandar videos mas pequenos; -2 mantiene la proporcion con ancho/alto par.
$escala = "scale='if(gt(iw,ih),-2,trunc(min(720,iw)/2)*2)':'if(gt(iw,ih),trunc(min(720,ih)/2)*2,-2)'"
$audio = '64k'
$canales = 1
$topeMB = 8
if ($Video360) {
  # Ancho maximo 2880 (alto 1440) sin agrandar; el audio queda en estereo.
  $escala = "scale='min(2880,iw)':-2"
  if (-not $PSBoundParameters.ContainsKey('KbpsVideo')) { $KbpsVideo = 5000 }
  $audio = '128k'
  $canales = 2
  $topeMB = 45
}
$maxrate = "$($KbpsVideo)k"
$bufsize = "$($KbpsVideo * 2)k"

$resumen = @()
foreach ($v in $videos) {
  $base = if ($Nombre) { $Nombre } else { Limpiar-Nombre $v.BaseName }
  $destino = Join-Path $Salida ($base + '.mp4')
  Write-Host "`n>> $($v.Name)  ->  $destino" -ForegroundColor Cyan

  & ffmpeg -hide_banner -loglevel error -stats -y -i $v.FullName `
    -map 0:v:0 -map '0:a:0?' -map_metadata -1 -map_chapters -1 `
    -vf $escala -fpsmax 30 `
    -c:v libx264 -preset slow -crf 26 -maxrate $maxrate -bufsize $bufsize `
    -profile:v high -pix_fmt yuv420p -g 60 `
    -c:a aac -b:a $audio -ac $canales -ar 44100 `
    -movflags +faststart $destino

  if ($LASTEXITCODE -ne 0) {
    $resumen += [pscustomobject]@{ Archivo = Split-Path $destino -Leaf; Segundos = '-'; MB = '-'; Aviso = 'ERROR al convertir' }
    continue
  }

  $segundos = [math]::Round([double](& ffprobe -v error -show_entries format=duration -of csv=p=0 $destino), 1)
  $mb = [math]::Round((Get-Item $destino).Length / 1MB, 2)
  $avisos = @()
  if ($segundos -gt 95) { $avisos += 'dura mas de 90 s' }
  if ($segundos -lt 30) { $avisos += 'muy corto' }
  if ($mb -gt $topeMB) { $avisos += "pesa mas de $topeMB MB (baja -KbpsVideo)" }
  $resumen += [pscustomobject]@{ Archivo = Split-Path $destino -Leaf; Segundos = $segundos; MB = $mb; Aviso = ($avisos -join ', ') }
}

Write-Host "`nResumen:" -ForegroundColor Green
$resumen | Format-Table -AutoSize
$total = (Get-ChildItem -Path $Salida -Filter *.mp4 | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("Total en {0}: {1:N1} MB" -f $Salida, $total)
