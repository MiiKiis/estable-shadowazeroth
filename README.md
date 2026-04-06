# 🐺 Shadow Azeroth - Portal Web Moderno

Infraestructura web premium para AzerothCore 3.3.5a, construida con Next.js y protegida por un túnel SSH transparente.

## 🛠️ Flujo de Trabajo (VS Code -> VPS)

Este proyecto está configurado para que puedas desarrollar localmente en tu ordenador mientras usas los datos reales de tu servidor.

### 🏠 1. Desarrollo Local (Modo Túnel)
Mientras trabajas en VS Code:
- En tu archivo `.env.local`, asegúrate de que `SSH_ENABLED=true`.
- Completa tus datos de `SSH_HOST`, `SSH_USER` y `SSH_PASSWORD`.
- Ejecuta `npm run dev`. El sistema creará un túnel **multipuerto** para:
  - **MySQL (3306)**: Para personajes, foro y cuentas.
  - **SOAP (7878)**: Para enviar ítems y comandos al juego.

### 🌐 2. Producción (Despliegue Final en VPS)
Cuando lleves la carpeta al VPS para que los jugadores la usen:
- Edita el archivo `.env` del servidor y pon `SSH_ENABLED=false`.
- La web se conectará directamente a `127.0.0.1` sin necesidad de túneles, aprovechando el rendimiento máximo local.
- Ejecuta `npm run build` y luego `npm start`.

---

## 🔍 Verificación del Sistema
Para confirmar que tu PC local puede hablar con la base de datos de tu VPS, ejecuta:
```bash
npx ts-node scripts/verify-connection.ts
```

## 📦 Características Principales
- **Dashboard Premium**: Con visualización de personajes y facción integrada.
- **Tienda Avanzada**: Soporta envío de ítems vía SOAP y pagos automáticos por PayPal.
- **Seguridad**: reCAPTCHA v3 y detección de IP real para proteger el registro.
- **Foro Integrado**: Sistema de categorías y perfiles sincronizados.

## 🚀 Instalación Inicial
1. Instalar dependencias: `npm install`
2. Configurar entorno: `.env.local`
3. Preparar DB: Ejecutar el script `acore-auth-web-schema.sql` en tu base de datos `acore_auth`.

---
© 2026 Admin Miikiis — Shadow Azeroth World.
