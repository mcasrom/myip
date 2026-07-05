// Generado desde docs/legal/*.md — no editar a mano, editar el .md fuente
export const tosContent = `# Términos de Servicio — myip

**Última actualización:** 3 de julio de 2026

## 1. Identificación del titular

myip es un servicio operado por SIEG, con domicilio de contacto en Murcia, España. Para cualquier consulta legal, técnica o comercial: **threatradar-myip@viajeinteligencia.com**.

## 2. Objeto del servicio

myip ofrece diagnóstico de red y monitorización de seguridad sobre la IP pública del propio usuario. El servicio detecta automáticamente la IP del visitante y restringe cualquier auditoría activa (escaneo de puertos, análisis WiFi) exclusivamente a esa IP. No se ofrece ni se permite el escaneo de terceros.

## 3. Planes y precios

- **Plan Gratuito**: funcionalidades básicas de diagnóstico, sin coste.
- **Plan SysAdmin Pro**: 4,99€/mes, renovación automática.
- **Plan Hogar**: 9,99€, pago único (acceso de por vida, sin renovación).
- **Plan Consultores (Marca Blanca)**: próximamente disponible.

Los precios se muestran en dólares estadounidenses (USD), impuestos incluidos cuando aplique. Nos reservamos el derecho de modificar precios para nuevos periodos de facturación; los cambios se notificarán con al menos 15 días de antelación a suscriptores activos y nunca afectarán a un periodo ya cobrado.

## 4. Facturación y renovación

Las suscripciones del Plan SysAdmin Pro se cobran de forma recurrente mensual a través de Stripe, con renovación automática al final de cada periodo salvo cancelación previa por parte del usuario. El Plan Hogar es un pago único sin renovación ni cobros recurrentes.

## 5. Cancelación y reembolsos

El usuario puede cancelar su suscripción del Plan SysAdmin Pro en cualquier momento desde su panel de cuenta. La cancelación surte efecto **al final del periodo de facturación en curso**: el usuario conserva el acceso Pro hasta esa fecha y no se realizan cargos posteriores.

**No se realizan reembolsos** de periodos ya iniciados o cobrados, incluidos casos de cancelación anticipada dentro de un periodo mensual ya pagado. El Plan Hogar, al ser un pago único, no es reembolsable una vez completada la compra. Recomendamos probar el plan gratuito antes de suscribirse.

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

El tratamiento de datos personales se rige por nuestra [Política de Privacidad], conforme al RGPD y la LOPDGDD.

## 10. Modificación de estos términos

Podemos actualizar estos Términos de Servicio. Los cambios sustanciales se notificarán por email a los usuarios registrados con al menos 15 días de antelación a su entrada en vigor.

## 11. Ley aplicable y jurisdicción

Estos términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan según la normativa de protección de consumidores aplicable.

## 12. Contacto

Para dudas sobre estos términos: **threatradar-myip@viajeinteligencia.com**
`;

export const faqContent = `# Preguntas Frecuentes — myip

### ¿myip puede escanear la red de otra persona o de mi empresa desde fuera?
No. El sistema detecta automáticamente tu IP pública a partir de la petición HTTP y restringe cualquier auditoría activa exclusivamente a esa IP. No existe forma de introducir manualmente una IP de terceros.

### ¿Es legal usar myip?
Sí. Solo audita tu propia IP pública mediante comprobaciones pasivas y activas de bajo impacto (equivalentes a un diagnóstico de salud de red), no accede a sistemas ajenos ni realiza explotación de vulnerabilidades. Más detalle en la pestaña "Marco Legal y Cumplimiento".

### ¿Qué diferencia hay entre el plan Gratuito y SysAdmin Pro?
El plan gratuito incluye diagnóstico básico bajo demanda. SysAdmin Pro (4,99€/mes) añade monitorización recurrente, alertas por email cuando se detectan cambios o exposiciones nuevas, e historial de escaneos. También está disponible el plan Hogar (9,99€, pago único de por vida).

### ¿Cómo cancelo mi suscripción?
Desde tu panel de cuenta, en cualquier momento. El acceso Pro se mantiene hasta el final del periodo ya pagado; no se realizan cargos adicionales tras la cancelación.

### ¿Hacéis reembolsos?
No ofrecemos reembolsos de periodos ya cobrados. Puedes probar el plan gratuito antes de suscribirte para asegurarte de que el servicio encaja con lo que necesitas.

### ¿Qué datos guardáis sobre mí?
Email, contraseña (cifrada), historial de escaneos (incluye tu IP y resultados de las auditorías) y, para usuarios anónimos, un identificador técnico de sesión. Todo el detalle está en la Política de Privacidad.

### ¿Puedo pedir que borréis mis datos?
Sí, es tu derecho bajo RGPD. Mientras habilitamos el borrado automático desde el panel, puedes solicitarlo escribiendo a **threatradar-myip@viajeinteligencia.com** y lo gestionamos manualmente en un plazo razonable.

### ¿Los escaneos afectan al rendimiento de mi red?
No de forma perceptible. Son comprobaciones puntuales y cortas, no monitorización continua invasiva.

### ¿Necesito instalar algo?
No, myip funciona íntegramente desde el navegador.

### ¿Con qué frecuencia se ejecutan las alertas del plan Pro?
Actualmente el sistema de alertas recurrentes se ejecuta según la configuración de producción (revisión diaria). El detalle exacto puede variar mientras seguimos afinando el servicio.
`;
