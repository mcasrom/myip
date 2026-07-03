// scripts/build-bloom-filter.js
//
// Construye un Bloom filter a partir de scripts/rockyou.txt y lo serializa
// a scripts/rockyou-bloom.json. Se ejecuta UNA VEZ (o cada vez que cambie
// el diccionario base). El JSON resultante es lo que carga el servidor en
// runtime — nunca el .txt de 133MB ni un .pkl de Python.
//
// Uso: node scripts/build-bloom-filter.js
//
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { BloomFilter } = require('bloom-filters');

const INPUT = path.join(__dirname, 'rockyou.txt');
const OUTPUT = path.join(__dirname, 'rockyou-bloom.json');

// ~14M entradas esperadas en rockyou.txt. Ajusta si tu conteo real difiere
// mucho (ver log de "líneas procesadas" al final).
const EXPECTED_ITEMS = 14_400_000;
const ERROR_RATE = 0.001; // 0.1% falsos positivos, 0% falsos negativos

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`No se encuentra ${INPUT}. Verifica que rockyou.txt esté en scripts/.`);
    process.exit(1);
  }

  console.log(`Creando Bloom filter para ~${EXPECTED_ITEMS.toLocaleString()} items, error rate ${ERROR_RATE}...`);
  const filter = BloomFilter.create(EXPECTED_ITEMS, ERROR_RATE);

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let count = 0;
  const start = Date.now();

  for await (const line of rl) {
    const pw = line.trim();
    if (pw.length > 0) {
      filter.add(pw);
      count++;
      if (count % 1_000_000 === 0) {
        console.log(`  ${count.toLocaleString()} líneas procesadas...`);
      }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Total: ${count.toLocaleString()} líneas procesadas en ${elapsed}s.`);

  const json = filter.saveAsJSON();
  fs.writeFileSync(OUTPUT, JSON.stringify(json));

  const sizeMB = (fs.statSync(OUTPUT).size / (1024 * 1024)).toFixed(1);
  console.log(`Bloom filter guardado en ${OUTPUT} (${sizeMB} MB).`);
  console.log('Este es el único archivo que necesita el servidor en runtime.');
}

main().catch((err) => {
  console.error('Error construyendo el Bloom filter:', err);
  process.exit(1);
});
