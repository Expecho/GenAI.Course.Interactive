# Deploy to Azure Container Apps
# Target: acraiprodlabcourse.azurecr.io/genai-workshop:latest -> ca-genai-workshop

$ErrorActionPreference = "Stop"

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
docker build -t "${IMAGE}:latest" -t "${IMAGE}:$BUILD_ID" .

Write-Host "==> Logging into ACR" -ForegroundColor Cyan
az acr login --name $ACR

Write-Host "==> Pushing image" -ForegroundColor Cyan
docker push "${IMAGE}:latest"
docker push "${IMAGE}:$BUILD_ID"



# --set-env-vars merges, so the config set out-of-band (API keys, AUTH_*) survives.
Write-Host "==> Updating Container App" -ForegroundColor Cyan
az containerapp update `
    --name $APP `
    --resource-group $RG `
    --image "${IMAGE}:latest" 

Write-Host "==> Done. App: https://ca-genai-workshop.livelysand-079a57d2.northeurope.azurecontainerapps.io" -ForegroundColor Green
