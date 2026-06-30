import { SecurityGuide } from '../types';

export const guides: SecurityGuide[] = [
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
  }
];

export const castilloManifesto = {
  author: 'M. Castillo',
  role: 'Fundador de Privacy Tools & Educador de Seguridad',
  title: 'La Ciberseguridad es un Derecho, no un Privilegio',
  paragraphs: [
    'En la era de la hiperconectividad, cada usuario final es el guardián de su propia frontera digital. Sin embargo, la industria de la seguridad informática a menudo utiliza un lenguaje críptico, alarmista y plagado de tecnicismos para vender soluciones costosas, asustando al usuario común en lugar de empoderarlo.',
    'MyIP nació con una misión transparente: democratizar el conocimiento de la infraestructura de red. Creemos firmemente que comprender qué es una dirección IP, por qué un puerto SSH expuesto es un riesgo o qué significa que un certificado SSL esté por vencer, debe ser de acceso libre, comprensible y amigable.',
    'La seguridad no se logra comprando la caja de herramientas más compleja, sino entendiendo cómo cerrar las puertas de tu casa digital. Nuestra filosofía de "baja fricción" y diagnóstico local estricto previene que nuestro motor sea abusado como vector de ataque hacia terceros, reforzando un ecosistema de internet ético, seguro y centrado en la privacidad.',
    'Educar es proteger. Cada puerto que aprendes a cerrar es un paso firme hacia una soberanía digital plena, libre de fraudes y vigilancias no autorizadas. ¡Gracias por ser parte de este viaje por una red más segura!'
  ],
  quote: '“La verdadera seguridad no reside en la oscuridad tecnológica, sino en el faro del conocimiento compartido.”',
  contact: 'threatradar-myip@viajeinteligencia.com'
};
