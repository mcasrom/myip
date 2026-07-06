#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }
echo "=== Contexto completo alrededor de setScanResult(data) ==="
sed -n '260,285p' src/App.tsx
echo ""
echo "=== Cuantas veces aparece 'setScanResult(data)' ==="
grep -c "setScanResult(data)" src/App.tsx
