#Requires -Version 7.0
<#
.SYNOPSIS
    One-time setup for the "finish the course" reminder emails.
.DESCRIPTION
    1. Grants the workshop's Entra app the Microsoft Graph application permission
       Mail.Send (and admin-consents it — needs a Global/Privileged Role Admin).
    2. Stores a random cron secret and the reminder settings on the Container App,
       with REMINDERS_ENABLED=false so nothing is sent yet.
    3. Creates a scheduled Container Apps Job that POSTs /api/reminders/run every
       weekday at 07:00 UTC.

    Mail.Send as an application permission can send as ANY mailbox in the tenant.
    Afterwards, have an Exchange admin restrict it to the sender mailbox — the
    exact command is printed at the end.

    Re-running resets REMINDERS_ENABLED to false and rotates the cron secret.
.EXAMPLE
    .\setup-reminders.ps1 -ClientId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -SenderMailbox "genai-workshop@aceve.com"
#>
param(
    # Application (client) id of the workshop's Entra app (AUTH_MICROSOFT_ENTRA_ID_ID).
    [Parameter(Mandatory = $true)]
    [string]$ClientId,

    # Mailbox the reminders are sent from. Must be an existing Exchange Online mailbox.
    [Parameter(Mandatory = $true)]
    [string]$SenderMailbox,

    # Cron expression in UTC. Default: weekdays at 07:00 UTC.
    [string]$Schedule = "0 7 * * 1-5"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Step { param([scriptblock]$Cmd) & $Cmd; if ($LASTEXITCODE -ne 0) { throw "Step failed (exit $LASTEXITCODE): $Cmd" } }

# Same targets as deploy.ps1.
$SUB = "e26b37c6-7697-4417-b17f-183e08589a9c" # Proof of Concept
$RG  = "rg-aiprodlab-course"
$APP = "ca-genai-workshop"
$JOB = "caj-genai-workshop-reminders"

$GRAPH_APP_ID = "00000003-0000-0000-c000-000000000000"
$MAIL_SEND_ROLE = "b633e1c5-b582-4048-a93e-9f11b44c7e96" # Mail.Send (application)

# ── 1. Graph permission ────────────────────────────────────────────────────────
Write-Host "==> Adding Microsoft Graph Mail.Send (application) to $ClientId" -ForegroundColor Cyan
Invoke-Step { az ad app permission add --id $ClientId --api $GRAPH_APP_ID --api-permissions "$MAIL_SEND_ROLE=Role" }

Write-Host "==> Granting admin consent" -ForegroundColor Cyan
Invoke-Step { az ad app permission admin-consent --id $ClientId }

# ── 2. App settings ────────────────────────────────────────────────────────────
$appJson = az containerapp show --name $APP --resource-group $RG --subscription $SUB | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Container App $APP not found" }
$appUrl = "https://" + $appJson.properties.configuration.ingress.fqdn
$envId = $appJson.properties.environmentId
$location = $appJson.location

$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$cronSecret = [Convert]::ToHexString($bytes).ToLower()

Write-Host "==> Storing reminder settings on $APP (sending stays OFF)" -ForegroundColor Cyan
Invoke-Step { az containerapp secret set --name $APP --resource-group $RG --subscription $SUB --secrets "reminder-cron-secret=$cronSecret" }
Invoke-Step {
    az containerapp update --name $APP --resource-group $RG --subscription $SUB --set-env-vars `
        "REMINDER_CRON_SECRET=secretref:reminder-cron-secret" `
        "REMINDER_SENDER_MAILBOX=$SenderMailbox" `
        "APP_BASE_URL=$appUrl" `
        "REMINDERS_ENABLED=false"
}

# ── 3. Scheduled job ───────────────────────────────────────────────────────────
# Defined as YAML because `az containerapp job create --args` can't take
# arguments that start with a dash.
$yaml = @"
location: $location
properties:
  environmentId: $envId
  configuration:
    triggerType: Schedule
    replicaTimeout: 600
    replicaRetryLimit: 0
    scheduleTriggerConfig:
      cronExpression: "$Schedule"
      parallelism: 1
      replicaCompletionCount: 1
    secrets:
      - name: cron-secret
        value: "$cronSecret"
  template:
    containers:
      - name: send-reminders
        image: docker.io/curlimages/curl:8.10.1
        command: ["/bin/sh", "-c"]
        args:
          - 'curl -fsS --max-time 300 -X POST -H "Authorization: Bearer `$CRON_SECRET" $appUrl/api/reminders/run'
        env:
          - name: CRON_SECRET
            secretRef: cron-secret
        resources:
          cpu: 0.25
          memory: 0.5Gi
"@
$yamlFile = [System.IO.Path]::GetTempFileName()
try {
    Set-Content -Path $yamlFile -Value $yaml -Encoding utf8
    $exists = az containerapp job show --name $JOB --resource-group $RG --subscription $SUB --query name -o tsv 2>$null
    if ($exists) {
        Write-Host "==> Updating job $JOB" -ForegroundColor Cyan
        Invoke-Step { az containerapp job update --name $JOB --resource-group $RG --subscription $SUB --yaml $yamlFile }
    } else {
        Write-Host "==> Creating job $JOB ($Schedule UTC)" -ForegroundColor Cyan
        Invoke-Step { az containerapp job create --name $JOB --resource-group $RG --subscription $SUB --yaml $yamlFile }
    }
} finally {
    Remove-Item $yamlFile -Force
}

Write-Host ""
Write-Host "Done. Sending is still OFF (REMINDERS_ENABLED=false). Next steps:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Restrict Mail.Send to the sender mailbox (Exchange Online PowerShell, as an Exchange admin):" -ForegroundColor Yellow
Write-Host "     New-DistributionGroup -Name 'GenAI Workshop Senders' -Type Security -Members $SenderMailbox"
Write-Host "     New-ApplicationAccessPolicy -AppId $ClientId -PolicyScopeGroupId 'GenAI Workshop Senders' -AccessRight RestrictAccess -Description 'GenAI workshop reminders'"
Write-Host ""
Write-Host "2. Preview who would be reminded (sends nothing):" -ForegroundColor Yellow
Write-Host "     curl -X POST -H 'Authorization: Bearer $cronSecret' '$appUrl/api/reminders/run?dryRun=1'"
Write-Host ""
Write-Host "3. When the list looks right, turn sending on:" -ForegroundColor Yellow
Write-Host "     az containerapp update -n $APP -g $RG --subscription $SUB --set-env-vars REMINDERS_ENABLED=true"
