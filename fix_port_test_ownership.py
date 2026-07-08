path = "server.ts"
with open(path, "r") as f:
    content = f.read()

anchor = """  const { port, targetIp } = req.body;
  if (!port) return res.status(400).json({ error: 'Puerto requerido.' });
  
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
  const ipToTest = targetIp || clientIp;"""

assert content.count(anchor) == 1, f"Anchor found {content.count(anchor)} times, expected 1"

replacement = """  const { port } = req.body;
  if (!port) return res.status(400).json({ error: 'Puerto requerido.' });
  
  // SECURITY: nunca aceptar un target IP externo del body (patron canyouseeme.org).
  // Solo se permite auto-escaneo del propio solicitante.
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
  const ipToTest = clientIp;"""

content = content.replace(anchor, replacement)

with open(path, "w") as f:
    f.write(content)

print("Parche aplicado: /api/tools/port-test ya no acepta targetIp externo.")
