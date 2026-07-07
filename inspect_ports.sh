#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== Perfiles de puertos en port_audit.py ==="
grep -n "profile\|PORTS\|--top-ports\|-p " scripts/port_audit.py | head -30

echo ""
echo "=== Definicion completa de 'quick' si existe como lista ==="
grep -n "quick" scripts/port_audit.py -A 10

echo ""
echo "=== Puertos conocidos/catalogados en server.ts (para el 'unknownRecommendation') ==="
grep -n "445\|139\|631\|9100\|515\|3389\|22\b\|1433\|3306" server.ts | head -20
