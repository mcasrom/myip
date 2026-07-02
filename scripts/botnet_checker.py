import requests
import socket
import sys

# ================== TU CLAVE ==================
import os
from dotenv import load_dotenv
load_dotenv()

ABUSEIPDB_API_KEY = os.getenv("ABUSEIPDB_API_KEY", "")
VT_API_KEY = os.getenv("VT_API_KEY", "")
# =============================================

def get_public_ip():
    try:
        return requests.get("https://api.ipify.org?format=json", timeout=5).json()['ip']
    except:
        try:
            return requests.get("https://ifconfig.me/ip", timeout=5).text.strip()
        except:
            print("❌ No se pudo obtener tu IP")
            sys.exit(1)

def check_abuseipdb(ip):
    url = "https://api.abuseipdb.com/api/v2/check"
    params = {'ipAddress': ip, 'maxAgeInDays': 90}
    headers = {'Key': ABUSEIPDB_API_KEY, 'Accept': 'application/json'}
    
    try:
        r = requests.get(url, params=params, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()['data']
            score = data['abuseConfidenceScore']
            print(f"\n📊 AbuseIPDB → Score: {score}/100")
            print(f"   Reportes totales: {data['totalReports']}")
            if score >= 60:
                print("   🚨 ¡ALTA PROBABILIDAD de botnet o compromiso!")
            elif score >= 30:
                print("   ⚠️  IP con actividad sospechosa")
            else:
                print("   ✅ Buena reputación")
        else:
            print(f"   Error API: {r.status_code}")
    except Exception as e:
        print(f"   Error en la consulta: {e}")

def main():
    print("🔍 Botnet & Threat Checker")
    print("="*55)
    ip = get_public_ip()
    print(f"🌐 Tu IP pública: {ip}\n")
    check_abuseipdb(ip)
    print("\n" + "="*55)

if __name__ == "__main__":
    main()
