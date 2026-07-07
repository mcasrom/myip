#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== Estructura completa de PWAInstallBanner.tsx ==="
cat src/components/PWAInstallBanner.tsx

echo ""
echo "=== Como se usa en App.tsx ==="
grep -n "PWAInstallBanner" src/App.tsx
