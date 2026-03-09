param(
    [ValidateSet("tier1", "tier2")]
    [string]$Tier = "tier1",
    [string]$StatePath = "$env:APPDATA\com.mattharrington.kordatools\sophon_runtime_state.json",
    [string]$CanonicalPython = "C:\code\ai-tool-hub\.sophon-py\Scripts\python.exe",
    [string]$OutputJson = "internal/evaluation/artifacts/sophon_next_use_verify.latest.json",
    [switch]$RequireAppRunning
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$checks = [System.Collections.Generic.List[object]]::new()

function Add-Check {
    param(
        [string]$Id,
        [ValidateSet("pass", "warn", "fail")]
        [string]$Status,
        [string]$Message,
        [hashtable]$Details = @{}
    )

    $checks.Add([PSCustomObject]@{
        id      = $Id
        status  = $Status
        message = $Message
        details = $Details
    })
}

function Get-DependencyFailures {
    param(
        [object]$Payload,
        [string[]]$Groups
    )

    $failures = [System.Collections.Generic.List[string]]::new()
    foreach ($group in $Groups) {
        $rows = $Payload.$group
        if ($null -eq $rows) {
            continue
        }
        foreach ($row in $rows) {
            $status = [string]($row.status)
            $normalizedStatus = $status.ToLowerInvariant()
            if ($normalizedStatus -in @("healthy", "ok", "pass", "ready")) {
                continue
            }
            $service = [string]($row.service)
            if ([string]::IsNullOrWhiteSpace($service)) {
                $service = $group
            }
            $reason = [string]($row.error)
            if ([string]::IsNullOrWhiteSpace($reason)) {
                $reason = [string]($row.message)
            }
            if ([string]::IsNullOrWhiteSpace($reason)) {
                $reason = $status
            }
            $failures.Add("${service}: $reason")
        }
    }
    return $failures
}

function Invoke-HealthCheck {
    param(
        [string]$Id,
        [string]$Url,
        [string[]]$Groups,
        [switch]$AllowReflectionWarning
    )

    try {
        $payload = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 10
        $failures = Get-DependencyFailures -Payload $payload -Groups $Groups
        if ($AllowReflectionWarning) {
            $requiredFailures = @()
            $optionalFailures = @()
            foreach ($failure in $failures) {
                if ($failure -like "Reflection LLM:*") {
                    $optionalFailures += $failure
                } else {
                    $requiredFailures += $failure
                }
            }
            if ($requiredFailures.Count -gt 0) {
                Add-Check -Id $Id -Status "fail" -Message "Required backend dependencies are unhealthy." -Details @{
                    url      = $Url
                    failures = $requiredFailures
                }
            } elseif ($optionalFailures.Count -gt 0) {
                Add-Check -Id $Id -Status "warn" -Message "Optional reflection dependency is degraded." -Details @{
                    url      = $Url
                    warnings = $optionalFailures
                }
            } else {
                Add-Check -Id $Id -Status "pass" -Message "Backend dependencies are healthy." -Details @{ url = $Url }
            }
            return
        }

        if ($failures.Count -gt 0) {
            Add-Check -Id $Id -Status "fail" -Message "Backend dependencies are unhealthy." -Details @{
                url      = $Url
                failures = $failures
            }
        } else {
            Add-Check -Id $Id -Status "pass" -Message "Backend dependencies are healthy." -Details @{ url = $Url }
        }
    } catch {
        Add-Check -Id $Id -Status "fail" -Message "Health endpoint failed: $($_.Exception.Message)" -Details @{ url = $Url }
    }
}

function Invoke-PythonCheck {
    param(
        [string]$PythonPath,
        [string]$Code
    )

    $output = & $PythonPath -c $Code 2>&1
    return [PSCustomObject]@{
        exitCode = $LASTEXITCODE
        output   = [string]($output -join "`n")
    }
}

$expectedStatePrefix = Join-Path $env:APPDATA "com.mattharrington.kordatools"
$userPythonPolicy = [Environment]::GetEnvironmentVariable("SOPHON_PYTHON_BIN", "User")

if (-not (Test-Path $CanonicalPython)) {
    Add-Check -Id "runtime_policy_python_path" -Status "fail" -Message "Canonical Sophon Python path does not exist." -Details @{
        canonicalPython = $CanonicalPython
    }
} else {
    Add-Check -Id "runtime_policy_python_path" -Status "pass" -Message "Canonical Sophon Python path exists." -Details @{
        canonicalPython = $CanonicalPython
    }
}

if ([string]::IsNullOrWhiteSpace($userPythonPolicy)) {
    Add-Check -Id "runtime_policy_env" -Status "fail" -Message "SOPHON_PYTHON_BIN (User) is not set." -Details @{
        expected = $CanonicalPython
        actual   = $userPythonPolicy
    }
} elseif ($userPythonPolicy -ine $CanonicalPython) {
    Add-Check -Id "runtime_policy_env" -Status "fail" -Message "SOPHON_PYTHON_BIN does not match canonical interpreter policy." -Details @{
        expected = $CanonicalPython
        actual   = $userPythonPolicy
    }
} else {
    Add-Check -Id "runtime_policy_env" -Status "pass" -Message "SOPHON_PYTHON_BIN matches canonical interpreter policy." -Details @{
        expected = $CanonicalPython
    }
}

if (Test-Path $CanonicalPython) {
    $importCode = "import importlib.util; mods=['nvidia_rag','nv_ingest_client','nv_ingest_api','opentelemetry.instrumentation.fastapi','opentelemetry.instrumentation.milvus']; missing=[m for m in mods if importlib.util.find_spec(m) is None]; print('OK' if not missing else 'MISSING:' + ','.join(missing))"
    $importCheck = Invoke-PythonCheck -PythonPath $CanonicalPython -Code $importCode
    if ($importCheck.exitCode -ne 0) {
        Add-Check -Id "runtime_dependency_imports" -Status "fail" -Message "Bridge dependency import check failed." -Details @{
            output = $importCheck.output
        }
    } elseif ($importCheck.output -like "MISSING:*") {
        Add-Check -Id "runtime_dependency_imports" -Status "fail" -Message "Bridge dependencies missing in canonical venv." -Details @{
            output = $importCheck.output
        }
    } else {
        Add-Check -Id "runtime_dependency_imports" -Status "pass" -Message "Bridge dependencies are importable from canonical venv." -Details @{
            output = $importCheck.output
        }
    }
}

$workerProcesses = @()
try {
    $workerProcesses = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.CommandLine -match "sophon_runtime_worker.py" } |
        Select-Object ProcessId, ExecutablePath, CommandLine
} catch {
    Add-Check -Id "runtime_worker_process_scan" -Status "warn" -Message "Unable to inspect worker processes in this shell context." -Details @{
        error = $_.Exception.Message
    }
}

if ($workerProcesses.Count -eq 0) {
    if ($RequireAppRunning) {
        Add-Check -Id "runtime_worker_process" -Status "fail" -Message "Sophon runtime worker process not found while app-running was required."
    } else {
        Add-Check -Id "runtime_worker_process" -Status "warn" -Message "Sophon runtime worker process not found. Launch KORDA TOOLS before this check."
    }
} else {
    $nonCanonical = @($workerProcesses | Where-Object { $_.ExecutablePath -ine $CanonicalPython })
    if ($nonCanonical.Count -gt 0) {
        Add-Check -Id "runtime_worker_process" -Status "fail" -Message "Detected non-canonical Sophon worker interpreter(s)." -Details @{
            canonical = $CanonicalPython
            workers   = @($workerProcesses)
        }
    } else {
        Add-Check -Id "runtime_worker_process" -Status "pass" -Message "All Sophon runtime workers use canonical interpreter." -Details @{
            workers = @($workerProcesses)
        }
    }
}

if (-not (Test-Path $StatePath)) {
    Add-Check -Id "state_file_path" -Status "fail" -Message "Runtime state file not found." -Details @{ statePath = $StatePath }
    $state = $null
} else {
    $state = Get-Content $StatePath -Raw | ConvertFrom-Json
    if ($StatePath -notlike "$expectedStatePrefix*") {
        Add-Check -Id "state_file_path" -Status "warn" -Message "State path does not match canonical APPDATA location." -Details @{
            expectedPrefix = $expectedStatePrefix
            statePath      = $StatePath
        }
    } else {
        Add-Check -Id "state_file_path" -Status "pass" -Message "Using canonical APPDATA Sophon state file." -Details @{ statePath = $StatePath }
    }
}

if ($null -ne $state) {
    if ($null -eq $state.runtimeReadiness) {
        Add-Check -Id "readiness_presence" -Status "fail" -Message "runtimeReadiness is missing from state file."
    } else {
        Add-Check -Id "readiness_presence" -Status "pass" -Message "runtimeReadiness is present."

        $readinessMap = @{}
        foreach ($check in $state.runtimeReadiness.checks) {
            $readinessMap[[string]$check.id] = $check
        }

        foreach ($requiredId in @("python_runtime", "torch_runtime", "bridge_init")) {
            if (-not $readinessMap.ContainsKey($requiredId)) {
                Add-Check -Id "readiness_$requiredId" -Status "fail" -Message "Missing readiness check: $requiredId"
                continue
            }
            $status = [string]$readinessMap[$requiredId].status
            if ($status -eq "pass") {
                Add-Check -Id "readiness_$requiredId" -Status "pass" -Message "$requiredId=pass"
            } else {
                Add-Check -Id "readiness_$requiredId" -Status "fail" -Message "$requiredId=$status : $($readinessMap[$requiredId].message)"
            }
        }

        if (-not $readinessMap.ContainsKey("api_key")) {
            Add-Check -Id "readiness_api_key" -Status "warn" -Message "Missing readiness check: api_key"
        } else {
            $apiStatus = [string]$readinessMap["api_key"].status
            $egressBlocked = [bool]$state.egressBlocked
            if (-not $egressBlocked -and $apiStatus -ne "pass") {
                Add-Check -Id "readiness_api_key" -Status "fail" -Message "api_key must pass when egress is enabled."
            } elseif ($egressBlocked -and $apiStatus -eq "fail") {
                Add-Check -Id "readiness_api_key" -Status "warn" -Message "api_key failed but egress is blocked (strict offline mode)."
            } else {
                Add-Check -Id "readiness_api_key" -Status "pass" -Message "api_key readiness is acceptable for current egress mode."
            }
        }
    }
}

if ($Tier -eq "tier2") {
    Invoke-HealthCheck -Id "backend_ingestor_health" -Url "http://localhost:8082/v1/health?check_dependencies=true" -Groups @("databases", "object_storage", "processing", "task_management")
    Invoke-HealthCheck -Id "backend_rag_health" -Url "http://localhost:8081/v1/health?check_dependencies=true" -Groups @("databases", "object_storage", "nim") -AllowReflectionWarning

    if (Test-Path $CanonicalPython) {
        $globCode = "import importlib.util; from pathlib import Path; spec=importlib.util.spec_from_file_location('worker', str(Path(r'C:\code\ai-tool-hub\src-tauri\scripts\sophon_runtime_worker.py'))); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); assert mod.match_glob_pattern('root.pdf','**/*.pdf'); assert mod.match_glob_pattern('nested/root.pdf','**/*.pdf'); print('OK')"
        $globCheck = Invoke-PythonCheck -PythonPath $CanonicalPython -Code $globCode
        if ($globCheck.exitCode -eq 0 -and $globCheck.output -eq "OK") {
            Add-Check -Id "intake_glob_edge_case" -Status "pass" -Message "Root-level and nested PDF glob matching is valid."
        } else {
            Add-Check -Id "intake_glob_edge_case" -Status "fail" -Message "Glob matching validation failed." -Details @{
                output = $globCheck.output
            }
        }
    }

    if ($null -ne $state) {
        if (($state.sources | Measure-Object).Count -lt 1) {
            Add-Check -Id "state_sources_present" -Status "warn" -Message "No sources configured. Add at least one source for ingestion verification."
        } else {
            Add-Check -Id "state_sources_present" -Status "pass" -Message "At least one source is configured."
        }

        if (($state.index.snapshots | Measure-Object).Count -lt 1) {
            Add-Check -Id "state_snapshot_present" -Status "warn" -Message "No index snapshots present. Snapshot/restore path not yet verified this session."
        } else {
            Add-Check -Id "state_snapshot_present" -Status "pass" -Message "Index snapshots present."
        }
    }
}

$failCount = @($checks | Where-Object { $_.status -eq "fail" }).Count
$warnCount = @($checks | Where-Object { $_.status -eq "warn" }).Count
$overall = if ($failCount -gt 0) { "blocked" } elseif ($warnCount -gt 0) { "warning" } else { "ready" }

$summary = [PSCustomObject]@{
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    tier           = $Tier
    overallStatus  = $overall
    failCount      = $failCount
    warningCount   = $warnCount
    canonicalPython = $CanonicalPython
    statePath      = $StatePath
    checks         = $checks
}

$outputPath = Resolve-Path (Split-Path -Parent $OutputJson) -ErrorAction SilentlyContinue
if (-not $outputPath) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputJson) | Out-Null
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputJson

Write-Host ""
Write-Host "Sophon Next-Use Verification ($Tier) => $overall"
Write-Host "Fails: $failCount | Warnings: $warnCount"
Write-Host "Report: $OutputJson"
Write-Host ""
($checks | Select-Object id, status, message) | Format-Table -AutoSize
