[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Invoke-Compose {
    param(
        [Parameter(Mandatory)]
        [string]$Step,
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    Write-Host "[release-stack] $Step"
    & docker compose @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Step 단계가 종료 코드 $LASTEXITCODE 로 끝났습니다."
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker 명령을 찾을 수 없습니다.'
}

if ([string]::IsNullOrWhiteSpace($env:DB_PASSWORD)) {
    throw 'DB_PASSWORD가 empty입니다. secret 값은 출력하지 않았습니다.'
}
Write-Host '[release-stack] DB_PASSWORD=set'

$cookieSecure = if ([string]::IsNullOrWhiteSpace($env:SESSION_COOKIE_SECURE)) {
    throw 'SESSION_COOKIE_SECURE가 empty입니다. 로컬 HTTP는 false, HTTPS release는 true로 명시하십시오.'
} else {
    $env:SESSION_COOKIE_SECURE.ToLowerInvariant()
}
if ($cookieSecure -notin @('true', 'false')) {
    throw 'SESSION_COOKIE_SECURE는 true 또는 false여야 합니다.'
}
Write-Host "[release-stack] SESSION_COOKIE_SECURE=$cookieSecure"

$appPort = if ([string]::IsNullOrWhiteSpace($env:APP_PORT)) { 8080 } else { $env:APP_PORT }
$parsedPort = 0
if (-not [int]::TryParse("$appPort", [ref]$parsedPort) -or $parsedPort -lt 1 -or $parsedPort -gt 65535) {
    throw 'APP_PORT는 1..65535 범위의 정수여야 합니다.'
}
$baseUrl = "http://127.0.0.1:$parsedPort"

Invoke-Compose -Step 'Compose 설정 검증' -Arguments @('config', '--quiet')
Invoke-Compose -Step 'backend/frontend image build' -Arguments @('build')
Invoke-Compose -Step 'stack start와 container health 대기' -Arguments @('up', '--detach', '--wait', '--wait-timeout', '120')

Write-Host '[release-stack] same-origin health와 사용자 흐름 smoke'
$health = Invoke-RestMethod -Uri "$baseUrl/actuator/health" -Method Get -TimeoutSec 10
if ($health.status -ne 'UP') {
    throw 'same-origin health 응답이 UP이 아닙니다.'
}

$webSession = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$sessionResponse = Invoke-WebRequest -Uri "$baseUrl/api/v1/session" -Method Post -WebSession $webSession -TimeoutSec 10
if ($sessionResponse.StatusCode -notin @(200, 201)) {
    throw '익명 session 생성/복원 응답이 200 또는 201이 아닙니다.'
}

$commandId = [guid]::NewGuid().ToString()
$createBody = @{
    goalType = 'JOB_SEARCH'
    energyLevel = 'LOW'
    availableMinutes = 5
    commandId = $commandId
} | ConvertTo-Json -Compress
$createResponse = Invoke-WebRequest `
    -Uri "$baseUrl/api/v1/journey" `
    -Method Post `
    -WebSession $webSession `
    -ContentType 'application/json' `
    -Body $createBody `
    -TimeoutSec 10
if ($createResponse.StatusCode -ne 201) {
    throw 'journey 생성 응답이 201이 아닙니다.'
}

$journey = Invoke-RestMethod -Uri "$baseUrl/api/v1/journey" -Method Get -WebSession $webSession -TimeoutSec 10
if (-not $journey.journeyId -or -not $journey.currentQuest.id) {
    throw 'journey 조회 응답에 journeyId 또는 currentQuest.id가 없습니다.'
}

$routeResponse = Invoke-WebRequest -Uri "$baseUrl/quest" -Method Get -TimeoutSec 10
if ($routeResponse.StatusCode -ne 200 -or $routeResponse.Content -notmatch '<div id="root"></div>') {
    throw 'frontend /quest 직접 진입 smoke가 index shell을 반환하지 않았습니다.'
}

Write-Host '[release-stack] PASS: health, session, journey 생성/조회, frontend route'
