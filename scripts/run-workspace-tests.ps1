param(
  [switch]$Scrape,
  [string[]]$Retailers = @("colruyt", "delhaize"),
  [switch]$RenderSmoke,
  [int]$RenderTimeoutSeconds = 90,
  [switch]$FailFast
)

$ErrorActionPreference = "Stop"

$repos = @(
  "C:\Users\prova\Documents\Projects\Superpromobelgiebram",
  "C:\Users\prova\Documents\Projects\BeautySuperPromoBeneluxBram",
  "C:\Users\prova\Documents\Projects\PetSuperPromoBelgiumBram",
  "C:\Users\prova\Documents\Projects\ElectroSuperPromoBeneluxBram",
  "C:\Users\prova\Documents\Projects\FashionSuperPromoBeneluxBram",
  "C:\Users\prova\Documents\Projects\HomeGardenSuperPromoBeneluxBram",
  "C:\Users\prova\Documents\Projects\DIYSuperpromoBelgiumBram"
)

function Invoke-RepoCommand {
  param(
    [Parameter(Mandatory = $true)][string]$RepoPath,
    [Parameter(Mandatory = $true)][string]$Command
  )

  Write-Host ""
  Write-Host "=== $RepoPath ==="

  if (!(Test-Path -Path $RepoPath -PathType Container)) {
    throw "Repo path not found: $RepoPath"
  }

  Push-Location $RepoPath
  try {
    & cmd /c $Command
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed (exit $LASTEXITCODE): $Command"
    }
  }
  finally {
    Pop-Location
  }
}

function Get-FolderSlugsFromRepo {
  param(
    [Parameter(Mandatory = $true)][string]$RepoPath
  )

  $dataDir = Join-Path $RepoPath "data\folders"
  if (!(Test-Path -Path $dataDir -PathType Container)) {
    return @()
  }

  $files = Get-ChildItem -Path $dataDir -Filter "*.json" -File -ErrorAction SilentlyContinue
  return $files | ForEach-Object { $_.BaseName }
}

function Wait-ForPort {
  param(
    [Parameter(Mandatory = $true)][string]$Hostname,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $iar = $client.BeginConnect($Hostname, $Port, $null, $null)
      if ($iar.AsyncWaitHandle.WaitOne(1000, $false)) {
        $client.EndConnect($iar)
        $client.Close()
        return
      }
      $client.Close()
    } catch {
      # ignore
    }

    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for port ${Hostname}:${Port}"
}

function Stop-ProcessTree {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId
  )

  try {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
    foreach ($c in @($children)) {
      Stop-ProcessTree -ProcessId $c.ProcessId
    }
  } catch {
    # ignore
  }

  try {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  } catch {
    # ignore
  }
}

function Get-FreeTcpPort {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = ($listener.LocalEndpoint).Port
  $listener.Stop()
  return $port
}

function Http-GetBody {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 30
  )

  try {
    $resp = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSeconds
    if ($null -ne $resp.Content) { return [string]$resp.Content }
    return ""
  } catch {
    $ex = $_.Exception
    try {
      if ($ex -and $ex.Response) {
        $stream = $ex.Response.GetResponseStream()
        if ($stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $text = $reader.ReadToEnd()
          $reader.Close()
          $stream.Close()
          return [string]$text
        }
      }
    } catch {
      # ignore
    }
    throw
  }
}

function Invoke-RenderSmoke {
  param(
    [Parameter(Mandatory = $true)][string]$RepoPath,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  $offlineNeedles = @(
    "deze publicatie is offline",
    "this publication is offline"
  )

  $slugs = Get-FolderSlugsFromRepo -RepoPath $RepoPath
  if ($slugs.Count -eq 0) {
    Write-Host "No data/folders/*.json found; skipping render smoke" -ForegroundColor Yellow
    return
  }

  $lockPath = Join-Path $RepoPath ".next\dev\lock"
  if (Test-Path -Path $lockPath -PathType Leaf) {
    Write-Host "Skipping render smoke: next dev lock exists at $lockPath" -ForegroundColor Yellow
    Write-Host "Stop any running 'next dev' for this repo (or delete the lock after stopping) and re-run." -ForegroundColor Yellow
    return
  }

  Write-Host "Starting dev server on port $Port..."

  $dev = Start-Process -FilePath "cmd.exe" -WorkingDirectory $RepoPath -PassThru -NoNewWindow -ArgumentList @(
    "/c",
    "set PORT=$Port&& npm run dev"
  )

  try {
    Wait-ForPort -Hostname "localhost" -Port $Port -TimeoutSeconds $TimeoutSeconds

    foreach ($slug in $slugs) {
      $url = "http://localhost:$Port/folders/$slug"
      Write-Host "GET $url"

      $body = Http-GetBody -Url $url -TimeoutSeconds 30
      $lower = ([string]$body).ToLowerInvariant()

      foreach ($needle in $offlineNeedles) {
        if ($lower.Contains($needle)) {
          throw "Offline publication text detected while rendering '$slug'"
        }
      }
    }
  }
  finally {
    Stop-ProcessTree -ProcessId $dev.Id
  }
}

$results = @()

foreach ($repo in $repos) {
  $repoResult = [PSCustomObject]@{
    Repo = $repo
    Tests = "not_run"
    Scrape = "not_run"
    Render = "not_run"
    Error = $null
  }

  try {
    Invoke-RepoCommand -RepoPath $repo -Command "npm run test"
    $repoResult.Tests = "ok"

    if ($Scrape) {
      foreach ($r in $Retailers) {
        Invoke-RepoCommand -RepoPath $repo -Command "npm run scrape $r"
      }
      $repoResult.Scrape = "ok"
    }

    if ($RenderSmoke) {
      $port = Get-FreeTcpPort
      Invoke-RenderSmoke -RepoPath $repo -Port $port -TimeoutSeconds $RenderTimeoutSeconds
      $repoResult.Render = "ok"
    }
  }
  catch {
    $repoResult.Tests = "failed"
    $repoResult.Scrape = if ($Scrape) { "failed" } else { "not_run" }
    $repoResult.Render = if ($RenderSmoke) { "failed" } else { "not_run" }
    $repoResult.Error = $_.Exception.Message

    Write-Host "FAILED: $($repoResult.Error)" -ForegroundColor Red

    if ($FailFast) {
      $results += $repoResult
      break
    }
  }

  $results += $repoResult
}

Write-Host ""
Write-Host "=== Summary ==="
$results | Format-Table -AutoSize

$failed = $results | Where-Object {
  $_.Tests -ne "ok" -or $_.Scrape -eq "failed" -or $_.Render -eq "failed"
}
if (@($failed).Count -gt 0) {
  exit 1
}

exit 0
