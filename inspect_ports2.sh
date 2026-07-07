#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== TODOS los puertos catalogados en server.ts (objeto completo) ==="
sed -n '930,1000p' server.ts

echo ""
echo "=== Perfil 'quick' en port_audit.py: que puertos cubre nmap de verdad ==="
cat scripts/port_audit.py | grep -n "profile\|quick\|top-ports\|-p " 

echo ""
echo "=== Rango de puertos real que nmap ejecuta segun el perfil ==="
grep -n "def \|PROFILES\|profiles = " scripts/port_audit.py
