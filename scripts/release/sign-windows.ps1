param(
  [Parameter(Mandatory = $true)]
  [string]$BinaryPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BinaryPath)) {
  throw "Signing target does not exist: $BinaryPath"
}

$certPath = $env:WINDOWS_CERTIFICATE_PATH
$certPassword = $env:WINDOWS_CERTIFICATE_PASSWORD

if ([string]::IsNullOrWhiteSpace($certPath) -or [string]::IsNullOrWhiteSpace($certPassword)) {
  throw "WINDOWS_CERTIFICATE_PATH and WINDOWS_CERTIFICATE_PASSWORD are required for Windows code signing."
}

if (-not (Test-Path $certPath)) {
  throw "Windows code signing certificate not found: $certPath"
}

$signtoolPath = $env:WINDOWS_SIGNTOOL_PATH
if ([string]::IsNullOrWhiteSpace($signtoolPath)) {
  $signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($null -eq $signtool) {
    throw "signtool.exe is not available. Install the Windows SDK or set WINDOWS_SIGNTOOL_PATH."
  }
  $signtoolPath = $signtool.Source
}

$arguments = @(
  "sign",
  "/fd", "SHA256",
  "/f", $certPath,
  "/p", $certPassword
)

if (-not [string]::IsNullOrWhiteSpace($env:WINDOWS_TIMESTAMP_URL)) {
  $arguments += @("/tr", $env:WINDOWS_TIMESTAMP_URL, "/td", "SHA256")
}

$arguments += $BinaryPath

& $signtoolPath @arguments
if ($LASTEXITCODE -ne 0) {
  throw "signtool.exe failed with exit code $LASTEXITCODE for $BinaryPath"
}
