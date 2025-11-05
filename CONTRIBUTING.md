# Contribuir a Rugivid

¡Gracias por tu interés en contribuir! Este proyecto busca ser simple, seguro y fácil de desplegar. Las contribuciones son bienvenidas siempre que mantengan este espíritu.

## Cómo empezar

- Usa Node 20+ y pnpm 8+
- Clona el repo y ejecuta:
  ```bash
  pnpm install
  cp .env.example .env
  pnpm dev
  ```
- Para pruebas de descargas en desarrollo necesitas `yt-dlp` y `ffmpeg` instalados en tu sistema.

## Flujo de trabajo sugerido

1. Abre un issue describiendo bug/mejora (si aplica).
2. Crea una rama con un nombre descriptivo.
3. Mantén tus cambios enfocados y evita refactors grandes no relacionados.
4. Verifica que el proyecto construye y funciona en dev/producción:
   ```bash
   pnpm dev
   pnpm build && pnpm start
   ```
5. Abre un Pull Request explicando:
   - Qué cambia y por qué
   - Cómo probaste el cambio
   - Impacto en configuración/infra (si aplica)

## Estilo y convenciones

- TypeScript/ESM, Node 20.
- Código conciso y legible; utilitarios pequeños antes que grandes frameworks.
- Evita dependencias innecesarias.
- No introducir base de datos (in‑memory + filesystem temporal por diseño).
- Mantén los endpoints y la UI simples; valida entrada con zod.

## Estructura relevante

- `src/pages/*`: páginas Astro y adaptadores de API
- `src/api/*`: lógica de endpoints y helpers
- `server/*`: yt-dlp wrapper, i18n y configuración centralizada
- `Dockerfile` y `docker-compose.yml`: empaquetado y despliegue

## Seguridad

- No expongas datos sensibles en respuestas o logs.
- Respeta el límite de tamaño y rate limit por IP.
- Mantén la limpieza de archivos temporales (TTL) funcionando.

## Pruebas manuales básicas

- POST `/api/download` con URLs de varias plataformas
- GET `/api/status/:token` hasta `completed`
- GET `/api/download/:token` y verifica que se elimina después
- Verifica límites (429) y tamaño máximo

## Documentación

- Si tu cambio agrega opciones nuevas de configuración, actualiza `.env.example` y el `README.md`.

## Conducta

- Sé respetuoso, claro y colaborativo.
- Mantén el enfoque en la calidad y la simplicidad del proyecto.

¡Gracias por ayudar a mejorar Rugivid!
