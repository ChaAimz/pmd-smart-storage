#!/usr/bin/env pwsh
# Script to check Model Bindings status via Web UI API

param(
    [string]$GatewayIP = "192.168.4.1"
)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Model Bindings Checker" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Fetching status from Gateway..." -ForegroundColor Yellow
Write-Host "URL: http://$GatewayIP/api/status" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://$GatewayIP/api/status" -Method Get -TimeoutSec 5
    
    Write-Host "✓ Response received!" -ForegroundColor Green
    Write-Host ""
    
    # Display BLE Mesh Status
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "  BLE Mesh Status" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "Provisioned: " -NoNewline
    if ($response.provisioned) {
        Write-Host "✅ YES" -ForegroundColor Green
    } else {
        Write-Host "❌ NO" -ForegroundColor Red
        Write-Host ""
        Write-Host "⚠️  Gateway is not provisioned yet!" -ForegroundColor Yellow
        Write-Host "Please provision the Gateway using nRF Mesh App first." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Node Address: 0x$($response.node_addr.ToString('X4'))" -ForegroundColor White
    Write-Host "Network Index: 0x$($response.net_idx.ToString('X4'))" -ForegroundColor White
    Write-Host "App Index: 0x$($response.app_idx.ToString('X4'))" -ForegroundColor White
    Write-Host "Network Key: $($response.net_key)" -ForegroundColor White
    Write-Host "App Key: $($response.app_key)" -ForegroundColor White
    Write-Host ""
    
    # Display Generic OnOff Client
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "  Generic OnOff Client" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "Bound: " -NoNewline
    if ($response.cli_bound) {
        Write-Host "✅ YES" -ForegroundColor Green
        Write-Host "App Index: 0x$($response.cli_app_idx.ToString('X4'))" -ForegroundColor White
    } else {
        Write-Host "❌ NO" -ForegroundColor Red
        Write-Host "App Index: -" -ForegroundColor Gray
    }
    Write-Host "Publication: $($response.cli_pub)" -ForegroundColor White
    Write-Host "Subscriptions: $($response.cli_sub)" -ForegroundColor White
    Write-Host ""
    
    # Display Generic OnOff Server
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "  Generic OnOff Server" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "Bound: " -NoNewline
    if ($response.srv_bound) {
        Write-Host "✅ YES" -ForegroundColor Green
        Write-Host "App Index: 0x$($response.srv_app_idx.ToString('X4'))" -ForegroundColor White
    } else {
        Write-Host "❌ NO" -ForegroundColor Red
        Write-Host "App Index: -" -ForegroundColor Gray
    }
    Write-Host "Publication: $($response.srv_pub)" -ForegroundColor White
    Write-Host "Subscriptions: $($response.srv_sub)" -ForegroundColor White
    Write-Host ""
    
    # Recommendations
    if (-not $response.cli_bound -or -not $response.srv_bound) {
        Write-Host "================================" -ForegroundColor Yellow
        Write-Host "  ⚠️  Action Required" -ForegroundColor Yellow
        Write-Host "================================" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Models are not bound to AppKey yet!" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Steps to bind models in nRF Mesh App:" -ForegroundColor White
        Write-Host "1. Open nRF Mesh App" -ForegroundColor Gray
        Write-Host "2. Select Gateway node (0x$($response.node_addr.ToString('X4')))" -ForegroundColor Gray
        
        if (-not $response.cli_bound) {
            Write-Host "3. Tap 'Generic OnOff Client' → 'Bind App Key' → Select App Key 1" -ForegroundColor Gray
        }
        
        if (-not $response.srv_bound) {
            Write-Host "4. Tap 'Generic OnOff Server' → 'Bind App Key' → Select App Key 1" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "After binding, run this script again to verify." -ForegroundColor Cyan
    } else {
        Write-Host "✓ All models are bound!" -ForegroundColor Green
    }
    
    Write-Host ""
    
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible causes:" -ForegroundColor Yellow
    Write-Host "1. Gateway is not powered on" -ForegroundColor Gray
    Write-Host "2. Not connected to Gateway's WiFi (ESP_MESH_AP)" -ForegroundColor Gray
    Write-Host "3. Gateway IP is different (try: .\check-model-bindings.ps1 -GatewayIP <IP>)" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

