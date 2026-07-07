#!/bin/bash
echo "[MyIP] Iniciando diagnostico de red local..."
echo "[MyIP] Esto puede tardar unos segundos."
echo ""

echo "[1/3] Obteniendo configuracion de red..."
if command -v ip &> /dev/null; then
    ip addr show > myip_raw_data.txt
else
    ifconfig > myip_raw_data.txt
fi

echo "[2/3] Escaneando dispositivos conectados (ARP)..."
if command -v ip &> /dev/null; then
    ip neigh show >> myip_raw_data.txt
else
    arp -n >> myip_raw_data.txt
fi

echo "[3/3] Verificando puertos abiertos..."
if command -v ss &> /dev/null; then
    ss -tuln >> myip_raw_data.txt
else
    netstat -an >> myip_raw_data.txt
fi

echo ""
echo "[MyIP] Reporte generado: myip_raw_data.txt"
echo "[MyIP] Sube este archivo en la seccion 'Herramientas Avanzadas' de la web."
