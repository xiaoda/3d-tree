$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logs = Join-Path $project 'logs'
$runtimePath = Join-Path $logs 'video-export-runtime.json'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $project 'dist\export.html'))) { throw '请先运行 npm run build' }
if (Test-Path -LiteralPath $runtimePath) {
    try {
        $runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
        if ($runtime.task -eq 'woven-mobile-video' -and $runtime.status -in @('ready','rendering','encoding') -and $runtime.url -match '^http://127\.0\.0\.1:[0-9]{1,5}$' -and [IO.Path]::GetFullPath($runtime.cwd).TrimEnd('\') -eq $project.TrimEnd('\')) {
            $existing = Get-Process -Id $runtime.pid -ErrorAction Stop
            $health = Invoke-RestMethod -Uri ($runtime.url + '/__video/health') -TimeoutSec 2
            if ($existing.ProcessName -eq 'node' -and $health.pid -eq $runtime.pid -and $health.runId -eq $runtime.runId) {
                Write-Output "已复用本任务导出服务：$($runtime.url)（PID $($runtime.pid)）"
                Write-Output '一次性导出凭据：video-export-session.local（不要提交或分享此文件）'
                exit 0
            }
        }
    } catch { Write-Verbose '已有记录不可复用。' }
}
$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $project 'scripts\video-export-server.mjs'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $logs "video-export-$stamp.stdout.log"
$stderr = Join-Path $logs "video-export-$stamp.stderr.log"
$process = Start-Process -FilePath $node -ArgumentList @(('"' + $script + '"')) -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
for ($i=0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 250
    $process.Refresh()
    if ($process.HasExited) { Get-Content -LiteralPath $stderr; throw "导出服务启动失败：$($process.ExitCode)" }
    if (Test-Path -LiteralPath $runtimePath) {
        $runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
        if ($runtime.pid -eq $process.Id -and (Test-Path -LiteralPath (Join-Path $project 'video-export-session.local'))) {
            $session = Get-Content -LiteralPath (Join-Path $project 'video-export-session.local') -Raw | ConvertFrom-Json
            $health = Invoke-RestMethod -Uri ($runtime.url + '/__video/health') -TimeoutSec 2
            if ($health.pid -eq $process.Id -and $session.runId -eq $runtime.runId) {
                Write-Output "已后台启动导出服务：$($runtime.url)（PID $($process.Id)）"
                Write-Output "输出目录：$([IO.Path]::GetDirectoryName($runtime.output))"
                Write-Output "日志：$stdout / $stderr"
                Write-Output '一次性导出凭据：video-export-session.local（不要提交或分享此文件）'
                exit 0
            }
        }
    }
}
Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
throw '导出服务启动超时，请查看本任务日志。'
