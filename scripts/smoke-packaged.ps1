$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$packagedDirectory = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'out') -Directory | Where-Object {
  Test-Path -LiteralPath (Join-Path $_.FullName 'SkillsManagerPro.exe')
} | Select-Object -First 1
if (-not $packagedDirectory) {
  throw 'Packaged SkillsManagerPro.exe was not found. Run npm.cmd run build first.'
}
$executablePath = Join-Path $packagedDirectory.FullName 'SkillsManagerPro.exe'
$nativeModulePath = Join-Path $packagedDirectory.FullName 'resources\app.asar.unpacked\.webpack\main\native_modules\prebuilds\win32-x64.node'
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$userDataPath = Join-Path $tempBase ("skill-workbench-packaged-smoke-" + [Guid]::NewGuid().ToString('N'))
$userDataPath = [IO.Path]::GetFullPath($userDataPath)

if (-not $userDataPath.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to use a smoke-test directory outside the system temp directory.'
}

New-Item -ItemType Directory -Path $userDataPath | Out-Null
$env:SKILL_WORKBENCH_USER_DATA = $userDataPath
$env:SKILL_WORKBENCH_DISABLE_DEFAULT_ROOTS = '1'
$process = $null

try {
  $process = Start-Process -FilePath $executablePath -PassThru -WindowStyle Hidden
  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  $databasePath = Join-Path $userDataPath 'skill-workbench.sqlite3'
  $databaseReady = $false
  $rendererReady = $false

  do {
    Start-Sleep -Milliseconds 200
    $databaseReady = Test-Path -LiteralPath $databasePath
    $rendererReady = @(
      Get-CimInstance Win32_Process | Where-Object {
        $_.ExecutablePath -eq $executablePath -and
        $_.CommandLine -like '*--type=renderer*' -and
        $_.CommandLine.Contains($userDataPath)
      }
    ).Count -gt 0
  } while ((-not $databaseReady -or -not $rendererReady) -and [DateTime]::UtcNow -lt $deadline -and -not $process.HasExited)

  $result = [PSCustomObject]@{
    MainProcessAlive = -not $process.HasExited
    RendererProcessReady = $rendererReady
    DatabaseReady = $databaseReady
    NativeSqliteReady = Test-Path -LiteralPath $nativeModulePath
  }
  $result | ConvertTo-Json
  if ($process.HasExited -or -not $rendererReady -or -not $databaseReady -or -not (Test-Path -LiteralPath $nativeModulePath)) {
    exit 1
  }
} finally {
  $mainProcessId = if ($process) { $process.Id } else { -1 }
  $testProcesses = @(
    Get-CimInstance Win32_Process | Where-Object {
      $_.ExecutablePath -eq $executablePath -and
      ($_.ProcessId -eq $mainProcessId -or ($_.CommandLine -and $_.CommandLine.Contains($userDataPath)))
    }
  )
  foreach ($testProcess in $testProcesses) {
    Stop-Process -Id $testProcess.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 250
  if (Test-Path -LiteralPath $userDataPath) {
    Remove-Item -LiteralPath $userDataPath -Recurse -Force
  }
}
