@echo off
echo [MyIP] Iniciando diagnostico de red local...
echo [MyIP] Esto puede tardar unos segundos.
echo.

echo [1/3] Obteniendo configuracion de red...
ipconfig /all > myip_raw_data.txt

echo [2/3] Escaneando dispositivos conectados (ARP)...
arp -a >> myip_raw_data.txt

echo [3/3] Verificando puertos abiertos...
netstat -an >> myip_raw_data.txt

echo.
echo [MyIP] Reporte generado: myip_raw_data.txt
echo [MyIP] Sube este archivo en la seccion 'Herramientas Avanzadas' de la web.
pause
