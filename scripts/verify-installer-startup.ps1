$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SkillWorkbenchNativeWindow {
  [DllImport("user32.dll")]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool IsWindowVisible(IntPtr hWnd);
}
'@

$projectRoot = Split-Path -Parent $PSScriptRoot
$packagedDirectory = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'out') -Directory | Where-Object {
  Test-Path -LiteralPath (Join-Path $_.FullName 'SkillWorkbench.exe')
} | Select-Object -First 1
if (-not $packagedDirectory) {
  throw 'Packaged SkillWorkbench.exe was not found. Run npm.cmd run build first.'
}

$executablePath = Join-Path $packagedDirectory.FullName 'SkillWorkbench.exe'
$localesPath = Join-Path $packagedDirectory.FullName 'locales'
$localeNames = @(Get-ChildItem -LiteralPath $localesPath -File | Select-Object -ExpandProperty Name | Sort-Object)
$expectedLocales = @('en-US.pak', 'zh-CN.pak', 'zh-TW.pak')
if (Compare-Object -ReferenceObject $expectedLocales -DifferenceObject $localeNames) {
  throw "Unexpected packaged locales: $($localeNames -join ', ')"
}

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$userDataPath = [IO.Path]::GetFullPath((Join-Path $tempBase ("skill-workbench-squirrel-test-" + [Guid]::NewGuid().ToString('N'))))
if (-not $userDataPath.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to use a lifecycle-test directory outside the system temp directory.'
}

New-Item -ItemType Directory -Path $userDataPath | Out-Null
$previousUserData = $env:SKILL_WORKBENCH_USER_DATA
$env:SKILL_WORKBENCH_USER_DATA = $userDataPath
$process = $null
$windowWasShown = $false
$timer = [Diagnostics.Stopwatch]::StartNew()

try {
  $process = Start-Process -FilePath $executablePath -ArgumentList '--squirrel-obsolete' -PassThru -WindowStyle Hidden
  while (-not $process.HasExited -and $timer.ElapsedMilliseconds -lt 3000) {
    Start-Sleep -Milliseconds 50
    $process.Refresh()
    if ($process.HasExited) { break }
    $windowHandle = $process.MainWindowHandle
    if ($windowHandle -ne [IntPtr]::Zero -and [SkillWorkbenchNativeWindow]::IsWindowVisible($windowHandle)) {
      $windowWasShown = $true
    }
  }
  $timer.Stop()

  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw 'Squirrel maintenance launch did not exit within 3 seconds.'
  }
  if ($windowWasShown) {
    throw 'Squirrel maintenance launch displayed the normal application window.'
  }
  if (Test-Path -LiteralPath (Join-Path $userDataPath 'skill-workbench.sqlite3')) {
    throw 'Squirrel maintenance launch initialized the application database.'
  }

  [PSCustomObject]@{
    MaintenanceExitMs = $timer.ElapsedMilliseconds
    WindowShown = $windowWasShown
    DatabaseOpened = $false
    PackagedLocales = $localeNames
  } | ConvertTo-Json
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
  if ($null -eq $previousUserData) {
    Remove-Item Env:SKILL_WORKBENCH_USER_DATA -ErrorAction SilentlyContinue
  } else {
    $env:SKILL_WORKBENCH_USER_DATA = $previousUserData
  }
  if (Test-Path -LiteralPath $userDataPath) {
    Remove-Item -LiteralPath $userDataPath -Recurse -Force
  }
}
