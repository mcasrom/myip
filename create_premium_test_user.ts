/**
 * Crea (o actualiza) un usuario premium real para testear el cron de alertas
 * recurrentes con un email de verdad (Resend no entrega a direcciones ficticias).
 *
 * La password se lee de la variable de entorno TEST_PREMIUM_USER_PASSWORD
 * (definirla en .env, que está en .gitignore, nunca hardcodear aqui).
 *
 * Uso:
 *   TEST_PREMIUM_USER_PASSWORD='...' npx tsx create_premium_test_user.ts
 *   (o si ya esta en .env, tsx la carga automaticamente via dotenv/dotenvx)
 */
import { createUserWithPassword, updateUserFields, getUserByEmail } from './db';

const EMAIL = 'threatradar-osint@viajeinteligencia.com';
const PASSWORD = process.env.TEST_PREMIUM_USER_PASSWORD;
const TEST_IP = '1.146.112.212';

async function main() {
  if (!PASSWORD) {
    console.error('ERROR: falta TEST_PREMIUM_USER_PASSWORD en .env o en el entorno.');
    process.exit(1);
  }

  let user = getUserByEmail(EMAIL);

  if (!user) {
    user = await createUserWithPassword(EMAIL, PASSWORD, TEST_IP);
    console.log(`Usuario creado: ${EMAIL}`);
  } else {
    console.log(`Usuario ya existia: ${EMAIL} (actualizando campos)`);
  }

  updateUserFields(EMAIL, {
    isPremium: true,
    ipAddress: TEST_IP,
    scanCount: user.scanCount ?? 0,
  });

  const final = getUserByEmail(EMAIL);
  console.log('Estado final:', {
    email: final?.email,
    isPremium: final?.isPremium,
    ipAddress: final?.ipAddress,
    verified: final?.verified,
  });
}

main().catch((e) => {
  console.error('Error creando usuario premium de prueba:', e);
  process.exit(1);
});
