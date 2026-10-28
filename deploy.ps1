# Deploy to Azure Container Apps
# Target: acraiprodlabcourse.azurecr.io/genai-workshop:latest -> ca-genai-workshop

$ErrorActionPreference = "Stop"

# Native commands (docker, az) don't throw on failure, so check each exit code.
function Invoke-Step { param([scriptblock]$Cmd) & $Cmd; if ($LASTEXITCODE -ne 0) { throw "Step failed (exit $LASTEXITCODE): $Cmd" } }

# Pinned so the deploy doesn't depend on the az CLI's current default subscription.
$SUB        = "e26b37c6-7697-4417-b17f-183e08589a9c" # Proof of Concept

$RG         = "rg-aiprodlab-course"
$ACR        = "acraiprodlabcourse"
$ACR_SERVER = "$ACR.azurecr.io"
$IMAGE      = "$ACR_SERVER/genai-workshop"
$APP        = "ca-genai-workshop"
$AI         = "appi-genai-workshop"

# Generate BUILD_ID from git short hash + timestamp
$gitHash = (git rev-parse --short HEAD 2>$null)
if (-not $gitHash) { $gitHash = "local" }
$timestamp = (Get-Date -Format "yyyyMMddHHmm")
$BUILD_ID = "$gitHash-$timestamp"

Write-Host "==> Building image (BUILD_ID: $BUILD_ID)" -ForegroundColor Cyan
Invoke-Step { docker build -t "${IMAGE}:latest" -t "${IMAGE}:$BUILD_ID" . }

Write-Host "==> Logging into ACR" -ForegroundColor Cyan
Invoke-Step { az acr login --name $ACR --subscription $SUB }

Write-Host "==> Pushing image" -ForegroundColor Cyan
Invoke-Step { docker push "${IMAGE}:latest" }
Invoke-Step { docker push "${IMAGE}:$BUILD_ID" }



# --set-env-vars merges, so the config set out-of-band (API keys, AUTH_*) survives.
Write-Host "==> Updating Container App" -ForegroundColor Cyan
Invoke-Step {
    az containerapp update `
        --name $APP `
        --resource-group $RG `
        --subscription $SUB `
        --image "${IMAGE}:$BUILD_ID"
}

Write-Host "==> Done. App: https://ca-genai-workshop.livelysand-079a57d2.northeurope.azurecontainerapps.io" -ForegroundColor Green
