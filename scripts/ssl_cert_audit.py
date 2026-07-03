#!/usr/bin/env python3
import socket
import ssl
import json
from datetime import datetime


# ----------------------------
# GET CERT
# ----------------------------

def get_cert(domain):
    ctx = ssl.create_default_context()

    with socket.create_connection((domain, 443), timeout=5) as sock:
        with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
            cert = ssock.getpeercert()

    return cert


# ----------------------------
# PARSE CERT
# ----------------------------

def parse_cert(cert):
    not_after = cert.get("notAfter")
    issuer = dict(x[0] for x in cert.get("issuer", []))
    subject = dict(x[0] for x in cert.get("subject", []))

    expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
    days_left = (expiry - datetime.utcnow()).days

    return {
        "issuer": issuer.get("organizationName", "UNKNOWN"),
        "subject": subject.get("commonName", "UNKNOWN"),
        "expires_at": not_after,
        "days_left": days_left
    }


# ----------------------------
# SCORE
# ----------------------------

def risk(days_left):
    if days_left < 0:
        return 100, "EXPIRED"
    if days_left < 7:
        return 90, "CRITICAL"
    if days_left < 30:
        return 70, "WARNING"
    if days_left < 90:
        return 40, "OK"
    return 10, "HEALTHY"


# ----------------------------
# MAIN
# ----------------------------

def analyze(domain):
    try:
        cert = get_cert(domain)
        data = parse_cert(cert)

        score, status = risk(data["days_left"])

        return {
            "domain": domain,
            "issuer": data["issuer"],
            "subject": data["subject"],
            "expires_at": data["expires_at"],
            "days_left": data["days_left"],
            "risk_score": score,
            "status": status
        }

    except Exception as e:
        return {
            "domain": domain,
            "error": str(e),
            "status": "NO_SSL_OR_UNREACHABLE"
        }


# ----------------------------
# RUN
# ----------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 ssl_cert_audit.py <domain>")
        exit(1)

    print(json.dumps(analyze(sys.argv[1]), indent=2))
