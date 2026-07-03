#!/usr/bin/env python3
import re
import math
import json
import sys
import os
import pickle


# ----------------------------
# LOAD DICTIONARY EXTERNO
# ----------------------------

def load_dict(path=None):
    """Devuelve (set_de_palabras, loaded_ok). Cachea en pickle junto al .txt
    para evitar re-parsear millones de lineas en cada invocacion."""
    if not path:
        return set(), False

    cache_path = path + ".pkl"
    try:
        if os.path.isfile(cache_path) and os.path.getmtime(cache_path) >= os.path.getmtime(path):
            with open(cache_path, "rb") as f:
                return pickle.load(f), True
    except (OSError, pickle.PickleError, EOFError) as e:
        print(f"WARN: cache de diccionario inválida ({e}), reparseando...", file=sys.stderr)

    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            words = set(line.strip().lower() for line in f if line.strip())
    except OSError as e:
        print(f"WARN: no se pudo abrir el diccionario '{path}': {e}", file=sys.stderr)
        return set(), False

    try:
        with open(cache_path, "wb") as f:
            pickle.dump(words, f, protocol=pickle.HIGHEST_PROTOCOL)
    except OSError as e:
        print(f"WARN: no se pudo escribir cache de diccionario ({e})", file=sys.stderr)

    return words, True


# ----------------------------
# ENTROPÍA
# ----------------------------

def entropy(pw):
    pool = 0

    if re.search(r"[a-z]", pw): pool += 26
    if re.search(r"[A-Z]", pw): pool += 26
    if re.search(r"[0-9]", pw): pool += 10
    if re.search(r"[^a-zA-Z0-9]", pw): pool += 32

    if pool == 0:
        return 0

    return round(len(pw) * math.log2(pool), 2)


# ----------------------------
# PATTERNS
# ----------------------------

def patterns(pw):
    p = []

    if re.search(r"(1234|qwerty|abcd)", pw.lower()):
        p.append("SEQUENCE")

    if re.search(r"(.)\1{2,}", pw):
        p.append("REPEATED")

    if re.search(r"(19|20)\d{2}", pw):
        p.append("YEAR")

    return p


# ----------------------------
# SCORING
# ----------------------------

def score(pw, dictionary):
    score = 0
    pw_low = pw.lower()

    # longitud
    score += min(len(pw) * 5, 40)

    # complejidad
    if re.search(r"[a-z]", pw): score += 10
    if re.search(r"[A-Z]", pw): score += 10
    if re.search(r"[0-9]", pw): score += 10
    if re.search(r"[^a-zA-Z0-9]", pw): score += 15

    # diccionario REAL
    dict_hit = pw_low in dictionary
    if dict_hit:
        score -= 50

    # patrones
    pat = patterns(pw)
    score -= len(pat) * 15

    score = max(0, min(100, score))

    if score >= 80:
        level = "EXCELLENT"
    elif score >= 60:
        level = "GOOD"
    elif score >= 40:
        level = "MEDIUM"
    else:
        level = "WEAK"

    return score, level, pat, dict_hit


# ----------------------------
# CRACK TIME
# ----------------------------

def crack_time(ent):
    if ent < 20: return "INSTANT"
    if ent < 40: return "MINUTES"
    if ent < 60: return "HOURS"
    if ent < 80: return "YEARS"
    return "CENTURIES"


# ----------------------------
# MAIN
# ----------------------------

def analyze(pw, dict_path=None):
    d, loaded = load_dict(dict_path)

    ent = entropy(pw)
    sc, lvl, pat, hit = score(pw, d)

    return {
        "length": len(pw),
        "entropy": ent,
        "score": sc,
        "strength": lvl,
        "dictionary_loaded": loaded,
        "dictionary_match": hit,
        "patterns": pat,
        "crack_time": crack_time(ent)
    }


if __name__ == "__main__":
    import argparse
    import getpass

    parser = argparse.ArgumentParser(
        description="Analiza fortaleza de password. NUNCA via argv (queda expuesto en ps aux / history)."
    )
    parser.add_argument("--dict", dest="dict_path", default=None,
                        help="Ruta al diccionario (default: rockyou.txt junto al script)")
    parser.add_argument("--stdin", action="store_true",
                        help="Lee el password de stdin en vez de pedirlo oculto (para pipes/automatizacion)")
    args = parser.parse_args()

    default_dict = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rockyou.txt")
    dict_path = args.dict_path or (default_dict if os.path.isfile(default_dict) else None)

    if args.stdin:
        pw = sys.stdin.readline().rstrip("\n")
    else:
        pw = getpass.getpass("Password a analizar (oculto, no se muestra): ")

    result = analyze(pw, dict_path)
    pw = "0" * len(pw)
    del pw

    print(json.dumps(result, indent=2))
