#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== Modales/popups existentes en el proyecto (para seguir el mismo patron) ==="
grep -rln "Modal\|Popup" src/components/ src/App.tsx

echo ""
echo "=== Estado (useState) relacionado a modales en App.tsx ==="
grep -n "useState.*[Mm]odal\|useState.*[Pp]opup\|useState.*[Ss]how" src/App.tsx
