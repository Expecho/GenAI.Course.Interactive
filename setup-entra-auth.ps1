#Requires -Version 7.0
<#
.SYNOPSIS
    Creates a Microsoft Entra ID app registration for the GenAI Workshop.
.DESCRIPTION
    Logs in to the specified tenant, creates an app registration with the correct
    redirect URIs and optional claims, and outputs the .env.local block to copy.
    Does not require an Azure subscription — only Entra ID tenant access.
.EXAMPLE
    .\setup-entra-auth.ps1 -TenantId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -AppName "GenAI Workshop"
.EXAMPLE
    .\setup-entra-auth.ps1 -TenantId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -AppName "GenAI Workshop" `
        -ProductionUrl "https://myapp.azurewebsites.net" -SecretExpiryYears 2
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$TenantId,

    [Parameter(Mandatory = $true)]
    [string]$AppName,

    [string]$ProductionUrl = "",

    [int]$SecretExpiryYears = 1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Login ──────────────────────────────────────────────────────────────────────
Write-Host "Logging in to tenant $TenantId..." -ForegroundColor Cyan
az login --tenant $TenantId --allow-no-subscriptions
if ($LASTEXITCODE -ne 0) { throw "az login failed" }

# ── Create app registration ────────────────────────────────────────────────────
Write-Host "Creating app registration '$AppName'..." -ForegroundColor Cyan
$app = az ad app create `
    --display-name $AppName `
    --sign-in-audience AzureADMyOrg `
    | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Failed to create app registration" }

$clientId = $app.appId
Write-Host "  App ID: $clientId" -ForegroundColor Green

# ── Redirect URIs ──────────────────────────────────────────────────────────────
$callbackPath = "/api/auth/callback/microsoft-entra-id"
$redirectUris = @("http://localhost:3000$callbackPath")
if ($ProductionUrl) {
    $productionUri = $ProductionUrl.TrimEnd("/") + $callbackPath
    $redirectUris += $productionUri
    Write-Host "  Adding production redirect: $productionUri" -ForegroundColor Cyan
}

Write-Host "Setting redirect URIs..." -ForegroundColor Cyan
az ad app update --id $clientId --web-redirect-uris @redirectUris
if ($LASTEXITCODE -ne 0) { throw "Failed to set redirect URIs" }

# ── Optional claims (email + name on ID token) ─────────────────────────────────
Write-Host "Adding optional claims (email, given_name, family_name)..." -ForegroundColor Cyan
$claimsFile = [System.IO.Path]::GetTempFileName()
@{
    accessToken = @()
    saml2Token  = @()
    idToken     = @(
        @{ name = "email";       essential = $false }
        @{ name = "given_name";  essential = $false }
        @{ name = "family_name"; essential = $false }
    )
} | ConvertTo-Json -Depth 5 | Set-Content -Path $claimsFile -Encoding UTF8

az ad app update --id $clientId --optional-claims "@$claimsFile"
if ($LASTEXITCODE -ne 0) {
    Remove-Item $claimsFile -Force
    throw "Failed to set optional claims"
}
Remove-Item $claimsFile -Force

# ── Service principal ──────────────────────────────────────────────────────────
Write-Host "Creating service principal..." -ForegroundColor Cyan
az ad sp create --id $clientId | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to create service principal" }

# ── Client secret ──────────────────────────────────────────────────────────────
$endDate = (Get-Date).AddYears($SecretExpiryYears).ToString("yyyy-MM-dd")
Write-Host "Creating client secret (expires $endDate)..." -ForegroundColor Cyan
$secretResult = az ad app credential reset `
    --id $clientId `
    --append `
    --end-date $endDate `
    | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Failed to create client secret" }

$clientSecret = $secretResult.password

# ── Output ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " App registration complete. Copy this into your .env.local:" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/$TenantId/v2.0/"
Write-Host "AUTH_MICROSOFT_ENTRA_ID_ID=$clientId"
Write-Host "AUTH_MICROSOFT_ENTRA_ID_SECRET=$clientSecret"
Write-Host "AUTH_SECRET=  # generate with: npx auth secret"
Write-Host ""
Write-Host "WARNING: The client secret above will not be shown again. Copy it now." -ForegroundColor Yellow
