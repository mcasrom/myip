#!/bin/bash
cd ~/myip || { echo "No se encuentra ~/myip"; exit 1; }
echo "=== saveScanRecord + getScanHistory en db.ts ==="
sed -n '210,250p' db.ts
echo ""
echo "=== Formato de created_at (columna SQLite) ==="
grep -n "created_at" db.ts
