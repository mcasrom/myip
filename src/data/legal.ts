// Generado desde docs/legal/*.md — no editar a mano, editar el .md fuente
export const tosContent = `# Términos de Servicio — myip

**Última actualización:** 3 de julio de 2026

## 1. Identificación del titular

myip es un servicio operado por SIEG, con domicilio de contacto en Murcia, España. Para cualquier consulta legal, técnica o comercial: [threatradar-myip@viajeinteligencia.com](mailto:threatradar-myip@viajeinteligencia.com).

## 2. Objeto del servicio

myip ofrece diagnóstico de red y monitorización de seguridad sobre la IP pública del propio usuario. El servicio detecta automáticamente la IP del visitante y restringe cualquier auditoría activa (escaneo de puertos, análisis WiFi) exclusivamente a esa IP. No se ofrece ni se permite el escaneo de terceros.

## 3. Planes y precios

MyIP es **completamente gratuito**. No existen planes de pago, suscripciones ni precios. Los costes de servidor, dominio e IA se cubren mediante **donaciones voluntarias** de los usuarios (Ko-fi: https://ko-fi.com/m_castillo). No se realiza ningún cobro ni procesamiento de tarjetas.

## 4. Facturación

Al no existir planes de pago ni suscripciones, MyIP no realiza facturación, no almacena datos de tarjetas ni procesa pagos. Las donaciones vía Ko-fi se gestionan por la propia plataforma Ko-fi y son voluntarias.

## 5. Cancelación y reembolsos

Al no existir suscripciones ni pagos, no hay cancelaciones ni reembolsos que gestionar. Todo el servicio es gratuito.

## 6. Uso aceptable

El usuario se compromete a:
- Utilizar el servicio únicamente sobre su propia infraestructura/IP.
- No intentar eludir las restricciones técnicas que limitan el escaneo a la IP propia.
- No usar el servicio con fines ilícitos, de reventa no autorizada, o de forma que sobrecargue deliberadamente la infraestructura.

El incumplimiento puede conllevar la suspensión inmediata de la cuenta sin derecho a reembolso.

## 7. Disponibilidad del servicio

Hacemos esfuerzos razonables para mantener el servicio disponible, pero no garantizamos un uptime del 100%. Puede haber interrupciones por mantenimiento, actualizaciones o causas de fuerza mayor. No se ofrecen compensaciones económicas por caídas puntuales del servicio.

## 8. Limitación de responsabilidad

myip es una herramienta de diagnóstico informativo. No garantizamos que la ausencia de alertas detectadas implique ausencia total de vulnerabilidades en la red del usuario, ni asumimos responsabilidad por decisiones de seguridad tomadas exclusivamente en base a los resultados del servicio. El servicio se ofrece "tal cual", sin garantías implícitas de idoneidad para un propósito particular.

En la medida permitida por la ley, la responsabilidad total de myip ante el usuario se limita al importe pagado por este en los últimos 12 meses.

## 9. Datos personales

El tratamiento de datos personales se rige por nuestra [Política de Privacidad], conforme al RGPD (Reglamento General de Protección de Datos de la UE) y la LOPDGDD (Ley Orgánica de Protección de Datos Personales y garantía de los Derechos Digitales de España).

## 10. Modificación de estos términos

Podemos actualizar estos Términos de Servicio. Los cambios sustanciales se notificarán por email a los usuarios registrados con al menos 15 días de antelación a su entrada en vigor.

## 11. Ley aplicable y jurisdicción

Estos términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan según la normativa de protección de consumidores aplicable.

## 12. Contacto

Para dudas sobre estos términos: [threatradar-myip@viajeinteligencia.com](mailto:threatradar-myip@viajeinteligencia.com)
`;

export const faqContent = `# Preguntas Frecuentes — myip

### ¿myip puede escanear la red de otra persona o de mi empresa desde fuera?
No. El sistema detecta automáticamente tu IP pública a partir de la petición HTTP y restringe cualquier auditoría activa exclusivamente a esa IP. No existe forma de introducir manualmente una IP de terceros.

### ¿Es legal usar myip?
Sí. Solo audita tu propia IP pública mediante comprobaciones pasivas y activas de bajo impacto (equivalentes a un diagnóstico de salud de red), no accede a sistemas ajenos ni realiza explotación de vulnerabilidades. Más detalle en la pestaña "Marco Legal y Cumplimiento".

### ¿MyIP tiene versión de pago?
No. MyIP es **completamente gratuito**: todas las funcionalidades (diagnóstico, escaneo, alertas, reportes, historial) están disponibles sin coste. Si te resulta útil, puedes apoyar el proyecto con una donación voluntaria en Ko-fi (https://ko-fi.com/m_castillo).

### ¿Cómo cancelo mi suscripción?
No hay suscripciones que cancelar: MyIP es gratuito. Si quieres dejar de apoyarlo, simplemente deja de donar en Ko-fi.

### ¿Hacéis reembolsos?
No ofrecemos reembolsos de periodos ya cobrados. Puedes probar el plan gratuito antes de suscribirte para asegurarte de que el servicio encaja con lo que necesitas.

### ¿Qué datos guardáis sobre mí?
Email, contraseña (cifrada), historial de escaneos (incluye tu IP y resultados de las auditorías) y, para usuarios anónimos, un identificador técnico de sesión. Todo el detalle está en la Política de Privacidad.

### ¿Puedo pedir que borréis mis datos?
Sí, es tu derecho bajo RGPD. Mientras habilitamos el borrado automático desde el panel, puedes solicitarlo escribiendo a [threatradar-myip@viajeinteligencia.com](mailto:threatradar-myip@viajeinteligencia.com) y lo gestionamos manualmente en un plazo razonable.

### ¿Los escaneos afectan al rendimiento de mi red?
No de forma perceptible. Son comprobaciones puntuales y cortas, no monitorizacion continua invasiva.

### ¿Que son las vulnerabilidades CVE que muestra el escaneo?
Cuando el escaneo detecta la version de un servicio abierto (ej: OpenSSH 7.4, Apache 2.4.49), consulta automaticamente la base de datos nacional de vulnerabilidades (NVD/NIST) y muestra los CVEs conocidos asociados. Cada CVE incluye una puntuacion CVSS (0-10) que indica su severidad. Esto te permite priorizar que actualizar primero.

### ¿Como leo el grafico de evolucion de mi score?
En el tab de resultados, bajo los puertos escaneados, veras un grafico que muestra como ha cambiado tu puntuacion de seguridad a lo largo del tiempo. Una linea ascendente indica que tu seguridad mejora; una descendente que empeora. Tambien veras una comparativa entre tu ultimo y penultimo escaneo con la diferencia exacta en puntos y puertos.

### ¿Necesito instalar algo?
No, myip funciona íntegramente desde el navegador.

### ¿Con qué frecuencia se ejecutan las alertas del plan Pro?
Actualmente el sistema de alertas recurrentes se ejecuta según la configuración de producción (revisión diaria). El detalle exacto puede variar mientras seguimos afinando el servicio.
`;

export const privacyContent = `# Política de Privacidad — myip

**Última actualización:** 10 de julio de 2026

## 1. Responsable del tratamiento

SIEG, con domicilio de contacto en Murcia, España. Email: [threatradar-myip@viajeinteligencia.com](mailto:threatradar-myip@viajeinteligencia.com). Delegado de Protección de Datos (DPO): mismo canal de contacto.

## 2. Datos que recogemos

### 2.1 Datos de registro
- **Email**: necesario para crear tu cuenta y enviar alertas/reportes.
- **Contraseña**: almacenada como hash bcrypt, nunca en texto plano.
- **IP pública**: detectada automáticamente durante el escaneo, almacenada junto al historial.

### 2.2 Datos de navegación
- **Cookies de sesión**: token opaco generado al iniciar sesión, con expiración automática. No usamos cookies de tracking ni de terceros.
- **Datos técnicos del navegador**: user-agent, resolución de pantalla (solo para mejorar la experiencia de usuario).

### 2.3 Datos de escaneo
- **Historial de escaneos**: resultados de auditorías de puertos, reputación de IP y análisis de red. Se almacenan exclusivamente para usuarios registrados.

### 2.4 Datos anonimizados para estadísticas
- **Datos agregados**: tras cada escaneo, se genera una versión anonimizada (sin email, sin IP exacta) que se utiliza exclusivamente para estadísticas de comunidad: puntuación media, distribución de scores, puertos más expuestos, tasa de blacklists.
- **Base legal**: Art. 89 RGPD — procesamiento estadístico con datos anonimizados no requiere consentimiento explícito.
- **Qué NO hacemos**: nunca vinculamos estadísticas a tu identidad, nunca vendemos datos, nunca compartimos información identificable con terceros.

## 3. Finalidad del tratamiento

- Prestación del servicio de diagnóstico de red.
- Envío de alertas de seguridad (plan Pro).
- Cumplimiento de obligaciones legales (consentimiento de escaneo).
- Mejora continua del servicio mediante **datos agregados y anónimos** (estadísticas de comunidad, puertos más expuestos, tendencias de seguridad). Estos datos nunca se vinculan a tu identidad.

## 4. Base legal

- **Consentimiento explícito**: al marcar la casilla de consentimiento antes de escanear.
- **Ejecución de contrato**: para usuarios registrados con plan activo.
- **Interés legítimo**: para la seguridad y estabilidad del servicio.

## 5. Conservación de datos

- **Cuentas activas**: mientras la cuenta permanezca activa.
- **Cuentas eliminadas**: los datos se borran en un plazo de 30 días tras la solicitud.
- **Historial de escaneos**: se conserva mientras la cuenta esté activa.
- **Datos anonimizados**: las estadísticas agregadas (sin PII) se conservan indefinidamente para análisis de tendencias, ya que no son datos personales según el Art. 89 RGPD.
- **Logs de servidor**: 90 días máximo, luego se eliminan automáticamente.

## 6. Destinatarios

No compartimos datos personales con terceros, excepto:
- **Ko-fi**: para donaciones voluntarias (sujeto a su propia política de privacidad).
- **Resend**: para envío de emails de alerta (sujeto a su propia política de privacidad).
- **Obligación legal**: si somos requeridos por autoridad competente.

## 7. Derechos del usuario

Conforme al RGPD y LOPDGDD, tienes derecho a:
- **Acceso**: saber qué datos tenemos sobre ti.
- **Rectificación**: corregir datos inexactos.
- **Supresión**: solicitar el borrado de tus datos ("derecho al olvido").
- **Portabilidad**: recibir tus datos en formato estructurado.
- **Limitación**: restringir el tratamiento de tus datos.
- **Oposición**: oponerte al tratamiento por motivos legítimos.

Para ejercer estos derechos, escribe a [threatradar-myip@viajeinteligencia.com](mailto:threatradar-myip@viajeinteligencia.com).

## 8. Seguridad

- Contraseñas cifradas con bcrypt.
- Sesiones con tokens opacos (no JWT), borradas al logout.
- Conexiones HTTPS obligatorias.
- Sin cookies de tracking ni analytics de terceros.
- **Anonimización de estadísticas**: los datos de escaneo se agregan sin email ni IP para estadísticas de comunidad. Nunca se publican datos identificables.

## 9. Transferencias internacionales

Todos los datos se almacenan en servidores ubicados en la Unión Europea (Hetzner, Alemania). No realizamos transferencias a terceros países fuera del EEE.

## 10. Contacto

Para cualquier consulta sobre privacidad o para ejercer tus derechos: [threatradar-myip@viajeinteligencia.com](mailto:threatradar-myip@viajeinteligencia.com)
`;

export const cookieContent = `# Política de Cookies — myip

**Última actualización:** 10 de julio de 2026

## 1. Qué son las cookies

Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web.

## 2. Cookies que usamos

### 2.1 Cookies de sesión (técnicas, necesarias)
- **Nombre**: \`session\`
- **Finalidad**: mantener tu sesión iniciada de forma segura.
- **Duración**: expira automáticamente tras 30 días de inactividad o al cerrar sesión.
- **Tipo**: propia, técnica, necesaria.

### 2.2 Cookies de preferencias (opcionales)
- **Nombre**: \`myip_welcome_dismissed\`
- **Finalidad**: recordar si has cerrado el modal de bienvenida.
- **Duración**: persistente hasta que borres los datos del navegador.
- **Tipo**: propia, funcional.

## 3. Cookies que NO usamos

- ❌ Cookies de tracking o analytics (Google Analytics, etc.)
- ❌ Cookies de publicidad o remarketing
- ❌ Cookies de terceros
- ❌ Cookies de fingerprinting

## 4. Cómo gestionar las cookies

Puedes configurar tu navegador para bloquear o eliminar cookies. Ten en cuenta que bloquear las cookies de sesión impedirá que puedas iniciar sesión en MyIP.

## 5. Base legal

Las cookies técnicas y necesarias se instalan sin consentimiento previo (art. 6.1.f RGPD). Las cookies de preferencias se instalan con tu consentimiento implícito al usar el servicio.

## 6. Contacto

Para cualquier duda sobre cookies: [threatradar-myip@viajeinteligencia.com](mailto:threatradar-myip@viajeinteligencia.com)
`;
