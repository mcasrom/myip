#!/usr/bin/env python3
"""
Advanced port scanning with service detection using nmap.
Usage: python3 port_scan.py <target_ip> [--profile quick|standard|full]
Output: JSON array of open ports with service info.
"""
import subprocess
import json
import sys
import re

PROFILES = {
    "quick": "-F",           # Top 100 ports
    "standard": "--top-ports 1000",  # Top 1000 ports
    "full": "-p-",           # All 65535 ports
}

def scan_port(ip: str, profile: str = "quick") -> list:
    args = PROFILES.get(profile, PROFILES["quick"])
    cmd = f"nmap {args} -sV --open -oX - {ip}"
    
    try:
        result = subprocess.run(
            cmd.split(),
            capture_output=True,
            text=True,
            timeout=300 if profile == "full" else 60
        )
        
        ports = []
        # Parse XML output manually (lightweight, no extra deps)
        xml_output = result.stdout
        
        # Find port entries
        port_pattern = re.findall(
            r'<port protocol="(\w+)" portid="(\d+)">.*?'
            r'<state state="(\w+)".*?'
            r'<service name="([^"]*)"(?: product="([^"]*)")?(?: version="([^"]*)")?',
            xml_output,
            re.DOTALL
        )
        
        for proto, port_id, state, name, product, version in port_pattern:
            if state == "open":
                service = name
                if product:
                    service += f" ({product}"
                    if version:
                        service += f" {version}"
                    service += ")"
                
                ports.append({
                    "port": int(port_id),
                    "protocol": proto,
                    "service": service,
                    "status": "open",
                })
        
        return ports
        
    except subprocess.TimeoutExpired:
        print(json.dumps({"error": "Scan timeout"}))
        sys.exit(1)
    except FileNotFoundError:
        print(json.dumps({"error": "nmap not found. Install with: sudo apt install nmap"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 port_scan.py <target_ip> [--profile quick|standard|full]"}))
        sys.exit(1)
    
    target_ip = sys.argv[1]
    profile = "quick"
    
    if "--profile" in sys.argv:
        idx = sys.argv.index("--profile")
        if idx + 1 < len(sys.argv):
            profile = sys.argv[idx + 1]
    
    results = scan_port(target_ip, profile)
    print(json.dumps(results, indent=2))
