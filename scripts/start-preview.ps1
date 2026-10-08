$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logs = Join-Path $project 'logs'
$runtimePath = Join-Path $logs 'runtime.json'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

if (Test-Path -LiteralPath $runtimePath) {
    try {
        $runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
        if ($runtime.task -eq 'woven-life-tree' -and $runtime.url -match '^http://127\.0\.0\.1:[0-9]{1,5}$' -and [IO.Path]::GetFullPath($runtime.cwd).TrimEnd('\') -eq $project.TrimEnd('\')) {
            $process = Get-Process -Id $runtime.pid -ErrorAction Stop
            $health = Invoke-RestMethod -Uri ($runtime.url + '/__studio/health') -TimeoutSec 2
            if ($process.ProcessName -eq 'node' -and $health.task -eq 'woven-life-tree' -and $health.pid -eq $runtime.pid) {
                Write-Output "已复用本项目服务：$($runtime.url)（PID $($runtime.pid)）"
                exit 0
            }
        }
    } catch { Write-Verbose '记录中的服务不可复用，将启动独立进程。' }
}

$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $project 'scripts\dev-server.mjs'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $logs "preview-$stamp.stdout.log"
$stderr = Join-Path $logs "preview-$stamp.stderr.log"
$process = Start-Process -FilePath $node -ArgumentList @(('"' + $script + '"')) -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru

for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    $process.Refresh()
    if ($process.HasExited) {
        if (Test-Path -LiteralPath $stderr) { Get-Content -LiteralPath $stderr }
        throw "预览进程启动失败，退出码：$($process.ExitCode)"
    }
    if (Test-Path -LiteralPath $runtimePath) {
        $runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
        if ($runtime.pid -eq $process.Id) {
            $health = Invoke-RestMethod -Uri ($runtime.url + '/__studio/health') -TimeoutSec 3
            if ($health.pid -eq $process.Id) {
                Write-Output "已后台启动：$($runtime.url)（PID $($process.Id)）"
                Write-Output "标准输出：$stdout"
                Write-Output "错误输出：$stderr"
                exit 0
            }
        }
    }
}
# 仅清理本脚本刚创建且未通过启动检查的进程。
Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
throw '等待预览服务就绪超时，请检查本任务日志。'
