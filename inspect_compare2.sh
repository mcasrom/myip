#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }

echo "=== compareScans() en alerts.ts ==="
grep -n "function compareScans" -A 40 alerts.ts

echo ""
echo "=== Quien llama a compareScans() ==="
grep -rn "compareScans(" server.ts alerts.ts

echo ""
echo "=== Endpoint que devuelve el historial al frontend ==="
grep -n "app.get.*history" server.ts

echo ""
echo "=== Donde se usa el historial en App.tsx (fetch) ==="
grep -n "history" src/App.tsx | head -20
