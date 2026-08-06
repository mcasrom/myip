import { SecurityGuide } from '../types';

export const guides: SecurityGuide[] = [
  {
    id: 'pwa-guide',
    title: '¿Cómo instalar MyIP como App (PWA) en tu Smartphone o Tablet?',
    category: 'Soberanía y Portabilidad',
    description: 'Instala MyIP en tu pantalla de inicio sin usar tiendas de aplicaciones (App Store o Google Play). Se ejecuta en un contenedor ligero, consume menos datos y te da acceso de un solo toque.',
    steps: [
      '**En Dispositivos Android (Chrome, Edge):** Cuando entres a la web, aparecerá un banner sugiriendo "Instalar App". Haz clic en él o presiona el menú de tres puntos arriba a la derecha en Chrome y selecciona **"Instalar aplicación"** o **"Añadir a la pantalla de inicio"**.',
      '**En iPhone o iPad (Safari):** Abre la página en Safari. Pulsa el botón **"Compartir"** (el icono del cuadrado con una flecha hacia arriba) en la barra de navegación inferior, desplázate por el menú y selecciona **"Añadir a la pantalla de inicio"**.',
      '**Acceso Directo Sin Fricción:** Aparecerá un icono de alta definición con el escudo de MyIP en tu escritorio o cajón de aplicaciones. Ábrela desde ahí para disfrutar del modo Standalone a pantalla completa.',
      '**Ahorro de Memoria y Batería:** A diferencia de las pesadas aplicaciones tradicionales de 100MB, esta PWA pesa menos de 1MB, no ejecuta procesos en segundo plano innecesarios y respeta la vida útil de tu batería.'
    ],
    recommendation: 'Instalar la PWA te permite llevar tus herramientas de diagnóstico siempre contigo, ideal para cuando realizas auditorías rápidas en la red Wi-Fi de tu oficina o de un café.',
    difficulty: 'Fácil'
  },
  {
    id: 'ssh-guide',
    title: '¿Cómo proteger o cerrar tu puerto SSH (22)?',
    category: 'Administración de Servidores',
    description: 'El puerto 22 se utiliza para acceder de forma remota a servidores Linux. Al ser tan común, los bots de atacantes lo buscan constantemente mediante fuerza bruta.',
    steps: [
      '**Usa llaves SSH en lugar de contraseñas:** Genera un par de llaves en tu computadora con `ssh-keygen -t ed25519` y sube la llave pública al archivo `~/.ssh/authorized_keys` de tu servidor.',
      '**Desactiva el inicio de sesión por contraseña:** Edita el archivo `/etc/ssh/sshd_config` y cambia `PasswordAuthentication yes` a `PasswordAuthentication no`.',
      '**Cambia el puerto por defecto:** En el mismo archivo `/etc/ssh/sshd_config`, modifica la línea `Port 22` por otro número alto no utilizado (ej. `Port 2204`).',
      '**Reinicia el servicio SSH:** Aplica los cambios ejecutando `sudo systemctl restart ssh` o `sudo service ssh restart`. ¡No cierres tu sesión actual hasta verificar que puedes entrar por el nuevo puerto!',
      '**Añade un Firewall:** Configura reglas para permitir la conexión al nuevo puerto SSH únicamente desde tu dirección IP pública de confianza.'
    ],
    recommendation: 'Al desactivar las contraseñas, evitas el 99.9% de los hackeos automáticos basados en contraseñas fáciles o filtradas.',
    difficulty: 'Medio'
  },
  {
    id: 'cloudflare-guide',
    title: '¿Cómo ocultar tu IP real detrás de Cloudflare?',
    category: 'Protección Web',
    description: 'Cloudflare actúa como un escudo protector (Proxy) entre tus visitantes y tu servidor, evitando que atacantes descubran tu IP pública real para dirigir ataques DDoS.',
    steps: [
      '**Regístrate en Cloudflare:** Crea una cuenta gratuita en su sitio web oficial.',
      '**Agrega tu dominio:** Escribe el nombre de tu sitio web y selecciona el plan gratuito ($0/mes), el cual incluye mitigación DDoS ilimitada.',
      '**Cambia los Servidores de Nombres (DNS):** Cloudflare te dará dos direcciones de servidores de nombres. Ve al registrador donde compraste tu dominio (GoDaddy, Namecheap, etc.) y reemplaza los DNS actuales por los de Cloudflare.',
      '**Activa el Proxy (Nube Naranja):** En el panel DNS de Cloudflare, asegúrate de que el registro tipo A de tu dominio tenga activada la nube naranja ("Proxied").',
      '**Configura SSL Flexible o Estricto:** En el apartado de SSL/TLS, activa el modo "Full" o "Flexible" para garantizar que las conexiones entre tus usuarios y Cloudflare estén totalmente encriptadas.'
    ],
    recommendation: 'Al usar Cloudflare, tu IP de origen queda totalmente enmascarada y protegida contra intentos directos de escaneo de puertos.',
    difficulty: 'Fácil'
  },
  {
    id: 'http-to-https-guide',
    title: 'Migración del Puerto 80 (HTTP) al Puerto Seguro 443 (HTTPS)',
    category: 'Cifrado de Datos',
    description: 'El puerto 80 transmite datos en texto plano. Si un usuario introduce una contraseña o tarjeta de crédito en tu web, cualquiera en la misma red Wi-Fi podría leerla.',
    steps: [
      '**Obtén un certificado SSL:** Puedes conseguir uno gratuito y automático de por vida usando Let\'s Encrypt a través de herramientas como Certbot.',
      '**Configura la redirección en Nginx:** Abre la configuración de tu sitio web y añade una regla que envíe todo el tráfico del puerto 80 al 443 de forma permanente (Redirección 301): \n`return 301 https://$host$request_uri;`',
      '**O configúralo en Apache:** Usa la directiva `Redirect permanent / https://tudominio.com/` en tu archivo `.htaccess` o configuración virtual.',
      '**Activa HSTS (HTTP Strict Transport Security):** Añade un encabezado de seguridad para indicarle a los navegadores que solo se comuniquen contigo mediante HTTPS en el futuro.'
    ],
    recommendation: 'Hoy en día, los navegadores marcan las webs HTTP como "No seguras". Cambiar a HTTPS mejora el posicionamiento SEO y la confianza de tus clientes.',
    difficulty: 'Fácil'
  },
  {
    id: 'ufw-firewall-guide',
    title: 'Configura un Firewall Básico con UFW en Linux',
    category: 'Seguridad del Sistema',
    description: 'UFW (Uncomplicated Firewall) es la forma más fácil y rápida de cerrar todos los puertos vulnerables de tu servidor de manera predeterminada.',
    steps: [
      '**Verifica el estado:** Consulta si está activo con `sudo ufw status`. Por defecto suele venir desactivado.',
      '**Establece reglas por defecto:** Bloquea todas las entradas y permite las salidas: \n`sudo ufw default deny incoming` \n`sudo ufw default allow outgoing`',
      '**Permite el puerto SSH de inmediato:** ¡MUY IMPORTANTE! Si no haces esto antes de activarlo, perderás el acceso a tu servidor. \n`sudo ufw allow 22` (o el puerto SSH personalizado que tengas).',
      '**Permite puertos web estándar:** Si tienes un sitio web, abre HTTP y HTTPS: \n`sudo ufw allow 80` \n`sudo ufw allow 443`',
      '**Activa el Firewall:** Enciende las reglas ejecutando `sudo ufw enable` y confirma con "y".',
      '**Revisa las reglas activas:** Escribe `sudo ufw status verbose` para comprobar que solo están permitidos los puertos que necesitas.'
    ],
    recommendation: 'Un firewall configurado por defecto como "denegar todo lo entrante" neutraliza instantáneamente los riesgos de cualquier puerto de base de datos o servicio expuesto accidentalmente.',
    difficulty: 'Medio'
  },

  {
    id: 'router-security-guide',
    title: '¿Cómo asegurar tu Router Doméstico y tu Red WiFi?',
    category: 'Seguridad del Hogar',
    description: 'El router es la puerta de entrada de tu red doméstica. Si sus credenciales siguen siendo las de fábrica o usa WPS, cualquier vecino o atacante cercano puede acceder a todos tus dispositivos conectados.',
    steps: [
      '**Accede al panel de administración:** Abre tu navegador y escribe la IP de tu router (comúnmente `192.168.1.1` o `192.168.0.1`). Usa las credenciales que vienen en la etiqueta del equipo.',
      '**Cambia la contraseña de administrador:** Ve a la sección de administración o sistema y modifica la contraseña por defecto. Usa una combinación de al menos 12 caracteres con letras, números y símbolos.',
      '**Desactiva WPS (Wi-Fi Protected Setup):** WPS es vulnerable a ataques de fuerza bruta. Desactívalo en la configuración WiFi de tu router. Es la vulnerabilidad doméstica más común.',
      '**Usa encriptación WPA2/WPA3:** Asegúrate de que tu red WiFi use WPA2-PSK (AES) o WPA3. Nunca uses WEP ni WPA-TKIP, que están obsoletos y se rompen en minutos.',
      '**Actualiza el firmware del router:** Los fabricantes publican parches de seguridad. Busca la sección de "Actualización de Firmware" o "Firmware Update" y aplica la última versión disponible.',
      '**Cambia el nombre de tu red (SSID):** No uses nombres que revelen tu identidad o dirección (ej. "Casa de María en Calle 5"). Usa un nombre genérico que no te identifique.'
    ],
    recommendation: 'Un router con credenciales de fábrica es como dejar la llave puesta en la puerta de tu casa. Cambiar la contraseña de administración y desactivar WPS elimina el 90% de los riesgos domésticos.',
    difficulty: 'Fácil'
  },
  {
    id: 'dns-security-guide',
    title: '¿Qué es DNS y Cómo Proteger tu Navegación con DNS Seguro?',
    category: 'Privacidad de Red',
    description: 'Cada vez que escribes una dirección web (ej. google.com), tu dispositivo consulta a un servidor DNS para traducir ese nombre a una dirección IP. Si usas el DNS por defecto de tu ISP, este puede registrar y vender tu historial de navegación.',
    steps: [
      '**Entiende el problema:** Tu proveedor de internet (ISP) ve cada dominio que visitas a través de su DNS. Sin cifrado DNS, cualquiera en tu red puede interceptar estas consultas.',
      '**Elige un DNS privado y seguro:** Opciones gratuitas recomendadas: Cloudflare (`1.1.1.1` / `1.0.0.1`), Google (`8.8.8.8` / `8.8.4.4`), o Quad9 (`9.9.9.9`). Todos ofrecen DoH (DNS over HTTPS) que cifra tus consultas.',
      '**Configura DoH en tu navegador:** En Firefox: Configuración → Privacidad → DNS sobre HTTPS → "Protección aumentada". En Chrome: Configuración → Privacidad → Seguridad → "Usar DNS seguro" → Elige Cloudflare o Google.',
      '**Configura DoH en tu sistema operativo:** En Windows 11: Configuración → Red e Internet → WiFi/Ethernet → Propiedades → Asignación de servidores DNS → Manual → activa "DNS sobre HTTPS". En macOS: Preferencias del Sistema → Red → Avanzado → DNS → añade `1.1.1.1` y `1.0.0.1`.',
      '**Verifica que funciona:** Visita https://1.1.1.1/help para confirmar que tu navegador está usando DNS cifrado.'
    ],
    recommendation: 'DNS cifrado (DoH/DoT) es la mejora de privacidad más subestimada que puedes hacer en 5 minutos. Tu ISP deja de ver qué webs visitas y se bloquean muchos intentos de phishing y malware a nivel DNS.',
    difficulty: 'Fácil'
  },
  {
    id: 'ip-reputation-guide',
    title: '¿Qué es la Reputación de IP y Por Qué Importa?',
    category: 'Conceptos de Seguridad',
    description: 'Tu dirección IP pública tiene una "reputación" digital, similar a un historial crediticio. Si tu IP aparece en listas negras (DNSBL), tus emails pueden ir a spam y algunos servicios pueden bloquearte automáticamente.',
    steps: [
      '**¿Cómo se "ensucia" una IP?** Malware en tu red que envía spam sin que lo sepas, un dispositivo IoT comprometido que participa en ataques DDoS, o haber tenido una IP dinámica que antes usó un spammer.',
      '**Verifica tu reputación:** Usa herramientas como MXToolbox (mxtoolbox.com/blacklists.aspx), AbuseIPDB, o el propio escaneo de MyIP para consultar si tu IP está en listas negras.',
      '**Si tu IP está en una lista negra:** Primero, escanea todos tus dispositivos con un antivirus actualizado. Luego, solicita la eliminación (delisting) en cada lista negra donde aparezcas. La mayoría tiene un formulario web gratuito.',
      '**Prevención:** Mantén tu router actualizado, usa contraseñas fuertes en todos los dispositivos conectados, y evita descargar software de fuentes desconocidas. Un firewall activo bloquea intentos de infección antes de que ocurran.',
      '**IPs dinámicas:** Si tu ISP te asigna IPs dinámicas y la tuya está "sucia", simplemente reiniciar el router puede darte una IP nueva. Pero si la causa es malware en tu red, volverá a ensuciarse.'
    ],
    recommendation: 'Una IP con mala reputación no solo afecta tu capacidad de enviar emails. Algunos bancos, servicios de streaming y plataformas de trabajo remoto bloquean automáticamente IPs listadas. Revisar tu reputación periódicamente es como revisar tu historial crediticio digital.',
    difficulty: 'Fácil'
  },
  {
    id: 'password-basics-guide',
    title: '¿Cómo Crear Contraseñas Seguras y Gestionarlas sin Perder la Cordura?',
    category: 'Higiene Digital',
    description: 'El 81% de las brechas de seguridad involucran contraseñas débiles o robadas. Una contraseña como "MiGato2024" se descifra en menos de 1 segundo con herramientas modernas. Aquí aprendes a crear contraseñas que realmente protegen.',
    steps: [
      '**La regla de oro: longitud > complejidad.** Una contraseña de 16 caracteres es exponencialmente más segura que una de 8 con símbolos. "caballo-grapa-correcto-batería" es más fuerte que "P@ssw0rd!".',
      '**Nunca reutilices contraseñas.** Si un servicio sufre una filtración y usas la misma contraseña en tu email, banco y redes sociales, un atacante tiene acceso a todo. Usa una contraseña única por servicio.',
      '**Usa un gestor de contraseñas:** Herramientas gratuitas como Bitwarden o KeePass generan y almacenan contraseñas únicas por sitio. Solo necesitas recordar una contraseña maestra.',
      '**Activa la verificación en dos pasos (2FA):** Incluso si alguien roba tu contraseña, necesita un segundo factor (código SMS, app autenticadora, llave física) para entrar. Actívalo en email, banco y redes sociales.',
      '**Verifica si tus contraseñas fueron filtradas:** MyIP incluye un comprobador que consulta Have I Been Pwned (k-anonymity) sin enviar tu contraseña completa. También puedes visitar haveibeenpwned.com/Passwords.'
    ],
    recommendation: 'El paso mas impactante que puedes hacer hoy: activa 2FA en tu cuenta de email principal. Es la llave maestra de tu vida digital — si la pierdes, pierdes acceso a todo lo vinculado a ese correo.',
    difficulty: 'Fácil'
  },
  {
    id: 'cve-guide',
    title: '¿Que son los CVE y Como Interpretar las Vulnerabilidades de tus Puertos?',
    category: 'Conceptos de Seguridad',
    description: 'Cada vez que MyIP detecta un servicio con version especifica en un puerto abierto (ej: OpenSSH 7.4), consulta automaticamente la base de datos NVD/NIST para mostrarte vulnerabilidades conocidas (CVEs). Aprender a leer estas alertas es clave para priorizar actualizaciones.',
    steps: [
      '**¿Que es un CVE?** Common Vulnerabilities and Exposures es un identificador estandar para vulnerabilidades de seguridad. Ejemplo: CVE-2021-41773 es una vulnerabilidad critica en Apache 2.4.49.',
      '**¿Que es el CVSS?** Common Vulnerability Scoring System puntuacion de 0 a 10. 0-3.9: Baja, 4.0-6.9: Media, 7.0-8.9: Alta, 9.0-10.0: Critica. Prioriza siempre las criticas y altas.',
      '**¿Como se detectan en MyIP?** El escaneo nmap con perfil standard (-sV) detecta la version del software. Luego se consulta la API del NIST NVD buscando CVEs asociados a esa version exacta.',
      '**¿Que hacer si encuentras CVEs?** Actualiza el software afectado a la version mas reciente. Si no es posible, considera cerrar ese puerto o restringir el acceso por firewall. Los CVEs con CVSS >= 9.0 requieren accion inmediata.',
      '**¿Los CVEs significan que estoy hackeado?** No. Significa que tu software tiene una vulnerabilidad conocida que *podria* ser explotada. Es una alerta preventiva para que actualices antes de que sea tarde.'
    ],
    recommendation: 'Mantener tu software actualizado es la defensa mas efectiva contra CVEs. La mayoria de exploits atacan versiones antiguas con parches disponibles. Actualizar regularmente elimina el 95% de los riesgos conocidos.',
    difficulty: 'Fácil'
  },
  {
    id: 'top-ports-guide',
    title: 'Los 7 puertos más atacados y cómo protegerlos',
    category: 'Conceptos de Seguridad',
    description: 'Cada día, bots y escáneres automáticos recorren internet buscando puertos abiertos para explotar. Conocer los puertos más atacados y cómo cerrarlos es la base de una conexión segura.',
    steps: [
      '**22 (SSH):** Blanco de fuerza bruta constante. Usa llaves SSH y desactiva el login por contraseña.',
      '**3389 (RDP):** El escritorio remoto de Windows es uno de los más atacados del mundo. Nunca lo expongas a internet sin VPN.',
      '**445 (SMB):** Responsable de gusanos como WannaCry. Debe estar cerrado a internet siempre.',
      '**23 (Telnet):** Transmite credenciales en texto plano. Desactívalo y usa SSH.',
      '**3306 (MySQL) y 5432 (PostgreSQL):** Si tu base de datos está abierta, cualquiera puede intentar conectarse. Vincúlala a 127.0.0.1.',
      '**6379 (Redis) y 27017 (MongoDB):** Suelen ejecutarse sin autenticación; son objetivo frecuente de ransomware. Cierra estos puertos en el firewall.',
      '**Comprueba con MyIP:** Ejecuta un escaneo y verás qué puertos están expuestos, su nivel de riesgo y la recomendación exacta.'
    ],
    recommendation: 'Regla de oro: si no usas un servicio desde fuera de tu red, ese puerto no debería estar abierto a internet. El firewall de tu router es tu primera línea de defensa.',
    difficulty: 'Fácil'
  },
  {
    id: 'blacklist-guide',
    title: 'Cómo saber si tu IP está en una lista negra (DNSBL)',
    category: 'Reputación',
    description: 'Si tu dirección IP aparece en una lista negra (DNSBL), tus correos pueden caer en spam y algunos servicios pueden bloquearte. Descubre cómo comprobarlo y cómo salir.',
    steps: [
      '**¿Qué es una DNSBL?** Las listas negras de DNS (Spamhaus, Barracuda, AbuseIPDB) recopilan IPs con actividad maliciosa o mala reputación.',
      '**¿Por qué podrías estar listado?** Un equipo infectado enviando spam, un servidor de correo mal configurado o una IP de rango previamente usado por atacantes.',
      '**Compruébalo con MyIP:** La pestaña de reputación consulta varias listas en tiempo real y te dice si tu IP está limpia o listada.',
      '**Si estás listado:** Escanea tu equipo en busca de malware, reinicia el router para solicitar una IP nueva (si es dinámica) y sigue el proceso de deslistado de cada lista.',
      '**Prevención:** No expongas servicios innecesarios, usa contraseñas fuertes y mantén todo actualizado.'
    ],
    recommendation: 'Un correo que llega a spam pierde hasta el 90% de su efectividad. Revisa tu reputación periódicamente si gestionas un dominio o servidor de correo.',
    difficulty: 'Fácil'
  },
  {
    id: 'port-scan-guide',
    title: 'Qué es un escaneo de puertos y cómo interpretar sus resultados',
    category: 'Conceptos de Seguridad',
    description: 'Un escaneo de puertos comprueba qué servicios de tu conexión están abiertos a internet. Aprende qué significan los estados ABIERTO, CERRADO y FILTRADO para interpretar tu informe.',
    steps: [
      '**¿Qué es un puerto?** Una "puerta" lógica por la que un servicio recibe conexiones (SSH en el 22, web en el 80/443). Cada puerto es un posible punto de entrada.',
      '**Estados:** ABIERTO significa que un servicio responde (posible superficie de ataque); CERRADO que no hay servicio; FILTRADO que un firewall lo está ocultando.',
      '**Cómo se escanea:** Herramientas como nmap envían paquetes de prueba y observan la respuesta. MyIP usa fuentes pasivas y nmap para auditar únicamente TU propia IP.',
      '**Por qué importa:** Cada puerto abierto es una puerta que un atacante podría intentar forzar. Menos puertos abiertos = menor superficie de ataque.',
      '**Acción:** Con el informe de MyIP, cierra los puertos que no uses, actualiza los servicios expuestos y protege los imprescindibles con autenticación fuerte.'
    ],
    recommendation: 'El escaneo solo analiza tu propia IP pública: es tu derecho conocer qué expones. Hazlo con regularidad, sobre todo tras cambios en tu router o red.',
    difficulty: 'Medio'
  }
];

export const founderManifesto = {
  author: 'M.Castillo',
  role: 'Founder & Lead Developer',
  title: 'La Ciberseguridad es un Derecho, no un Privilegio',
  paragraphs: [
    'En la era de la hiperconectividad, cada usuario final es el guardián de su propia frontera digital. Sin embargo, la industria de la seguridad informática a menudo utiliza un lenguaje críptico, alarmista y plagado de tecnicismos para vender soluciones costosas, asustando al usuario común en lugar de empoderarlo.',
    'MyIP nació con una misión transparente: democratizar el conocimiento de la infraestructura de red. Creemos firmemente que comprender qué es una dirección IP, por qué un puerto SSH expuesto es un riesgo o qué significa que un certificado SSL esté por vencer, debe ser de acceso libre, comprensible y amigable.',
    'La seguridad no se logra comprando la caja de herramientas más compleja, sino entendiendo cómo cerrar las puertas de tu casa digital. Con una filosofía de "baja fricción" y diagnóstico local estricto se previene que el motor sea abusado como vector de ataque hacia terceros, reforzando un ecosistema de internet ético, seguro y centrado en la privacidad.',
    'Educar es proteger. Cada puerto que aprendes a cerrar es un paso firme hacia una soberanía digital plena, libre de fraudes y vigilancias no autorizadas. ¡Gracias por ser parte de este viaje por una red más segura!'
  ],
  quote: '"La verdadera seguridad no reside en la oscuridad tecnológica, sino en el faro del conocimiento compartido."',
  contact: 'threatradar-myip@viajeinteligencia.com',
  signature: 'M.Castillo @2026 Australia'
};
