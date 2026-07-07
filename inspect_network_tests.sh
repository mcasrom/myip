#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== Que mide LocalNetworkDiagnostic.tsx (el 'casi 100/100') ==="
grep -n "measuredLatency\|measuredJitter\|measuredSpeed\|dnsLatency\|fetch(" src/components/LocalNetworkDiagnostic.tsx | head -20

echo ""
echo "=== Endpoints internos que llama (server.ts) ==="
grep -n "app.get.*speedtest\|app.get.*ping\|app.get.*dns" server.ts

echo ""
echo "=== Que mide el escaneo PRINCIPAL (TrafficLight/scoreNumeric) - IP objetivo ==="
grep -n "const ip = \|req.ip\|clientIp\|x-real-ip\|x-forwarded-for" server.ts | head -10

echo ""
echo "=== Como se decide que puertos escanear (nmap target) ==="
grep -n "nmap\|port_audit" server.ts | head -10
