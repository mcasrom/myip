#!/usr/bin/env python3
"""
Deep SSL/TLS certificate analysis.
Usage: python3 ssl_check.py <hostname> [--port 443]
Output: JSON with certificate details, chain info, vulnerabilities.
"""
import subprocess
import json
import sys
import ssl
import socket
import datetime

def check_ssl(hostname: str, port: int = 443) -> dict:
    result = {
        "hostname": hostname,
        "port": port,
        "valid": False,
        "issuer": "",
        "subject": "",
        "validFrom": "",
        "validTo": "",
        "daysToExpiry": 0,
        "serialNumber": "",
        "version": "",
        "signatureAlgorithm": "",
        "san": [],
        "keySize": 0,
        "protocol": "",
        "cipher": "",
        "vulnerabilities": [],
        "chainLength": 0,
        "error": None,
    }

    try:
        # Get certificate via openssl s_client
        cmd = f"openssl s_client -connect {hostname}:{port} -servername {hostname} </dev/null 2>/dev/null | openssl x509 -noout -text"
        proc = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
        cert_text = proc.stdout

        # Extract issuer
        issuer_match = subprocess.run(
            f"openssl s_client -connect {hostname}:{port} -servername {hostname} </dev/null 2>/dev/null | openssl x509 -noout -issuer",
            shell=True, capture_output=True, text=True, timeout=10
        )
        result["issuer"] = issuer_match.stdout.strip().replace("issuer=", "").strip()

        # Extract subject
        subject_match = subprocess.run(
            f"openssl s_client -connect {hostname}:{port} -servername {hostname} </dev/null 2>/dev/null | openssl x509 -noout -subject",
            shell=True, capture_output=True, text=True, timeout=10
        )
        result["subject"] = subject_match.stdout.strip().replace("subject=", "").strip()

        # Extract validity dates
        dates_match = subprocess.run(
            f"openssl s_client -connect {hostname}:{port} -servername {hostname} </dev/null 2>/dev/null | openssl x509 -noout -dates",
            shell=True, capture_output=True, text=True, timeout=10
        )
        for line in dates_match.stdout.strip().split("\n"):
            if line.startswith("notBefore="):
                result["validFrom"] = line.replace("notBefore=", "")
            elif line.startswith("notAfter="):
                result["validTo"] = line.replace("notAfter=", "")
                # Calculate days to expiry
                try:
                    expiry = datetime.datetime.strptime(result["validTo"], "%b %d %H:%M:%S %Y %Z")
                    delta = expiry - datetime.datetime.utcnow()
                    result["daysToExpiry"] = delta.days
                except:
                    pass

        # Check for vulnerabilities
        if "MD5" in cert_text or "md5" in cert_text.lower():
            result["vulnerabilities"].append("Certificate may use weak MD5 signature algorithm")
        if "SHA1" in cert_text and "sha1" in cert_text.lower():
            result["vulnerabilities"].append("Certificate uses deprecated SHA-1 signature algorithm")
        if result["daysToExpiry"] < 0:
            result["vulnerabilities"].append("Certificate has EXPIRED")
        elif result["daysToExpiry"] < 30:
            result["vulnerabilities"].append(f"Certificate expires in {result['daysToExpiry']} days")

        # Get protocol and cipher via TLS connection
        context = ssl.create_default_context()
        with socket.create_connection((hostname, port), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                result["protocol"] = ssock.version()
                cipher = ssock.cipher()
                result["cipher"] = f"{cipher[0]} ({cipher[1]})" if cipher else "Unknown"
                result["valid"] = True

    except subprocess.TimeoutExpired:
        result["error"] = "Connection timeout"
    except Exception as e:
        result["error"] = str(e)

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 ssl_check.py <hostname> [--port PORT]"}))
        sys.exit(1)

    hostname = sys.argv[1]
    port = 443

    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            port = int(sys.argv[idx + 1])

    result = check_ssl(hostname, port)
    print(json.dumps(result, indent=2))
