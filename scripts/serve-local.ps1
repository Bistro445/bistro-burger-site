# Serveur de test local, sans Node.js : sert pages/ puis public/ sur http://localhost:8099/
# Usage : powershell -ExecutionPolicy Bypass -File scripts/serve-local.ps1
# Les routes /api/* n'existent pas dans ce mode (elles répondent 404) : c'est normal.
$base = Split-Path -Parent $PSScriptRoot
$pages = Join-Path $base "pages"
$root = Join-Path $base "public"
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:8099/")
$l.Start()
Write-Host "Site de test sur http://localhost:8099/  (Ctrl+C pour arrêter)"
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript; charset=utf-8"; ".css"="text/css"; ".png"="image/png"; ".jpg"="image/jpeg"; ".webp"="image/webp"; ".svg"="image/svg+xml"; ".json"="application/json"; ".ico"="image/x-icon"; ".webmanifest"="application/manifest+json" }
while ($l.IsListening) {
  $c = $l.GetContext()
  $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath)
  if ($p -eq "/") { $p = "/index.html" }
  $rel = ($p.TrimStart("/") -replace "/", "\")
  $f = Join-Path $pages $rel
  if (-not (Test-Path $f -PathType Leaf)) { $f = Join-Path $root $rel }
  if (Test-Path $f -PathType Container) { $f = Join-Path $f "index.html" }
  if (-not (Test-Path $f -PathType Leaf) -and (Test-Path ($f + ".html") -PathType Leaf)) { $f = $f + ".html" }
  if (Test-Path $f -PathType Leaf) {
    $b = [IO.File]::ReadAllBytes($f)
    $ext = [IO.Path]::GetExtension($f).ToLower()
    $c.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" })
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else {
    $c.Response.StatusCode = 404
  }
  $c.Response.Close()
}
