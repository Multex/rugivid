# Contributing to Amia

Thank you for your interest in contributing! This project aims to be simple, secure, and easy to deploy. Contributions are welcome as long as they maintain this spirit.

## Getting Started

- Use Node 20+ and pnpm 8+
- Clone the repo and run:
  ```bash
  pnpm install
  cp .env.example .env
  pnpm dev
  ```
- For download testing in development, you need `yt-dlp` and `ffmpeg` installed on your system.

## Suggested Workflow

1. Open an issue describing the bug/improvement (if applicable).
2. Create a branch with a descriptive name.
3. Keep your changes focused and avoid unrelated large refactors.
4. Verify that the project builds and works in dev/production:
   ```bash
   pnpm dev
   pnpm build && pnpm start
   ```
5. Open a Pull Request explaining:
   - What changes and why
   - How you tested the change
   - Impact on configuration/infrastructure (if applicable)

## Style and Conventions

- TypeScript/ESM, Node 20.
- Concise and readable code; small utilities over large frameworks.
- Avoid unnecessary dependencies.
- No database (in-memory + temporary filesystem by design).
- Keep endpoints and UI simple; validate input with zod.

## Relevant Structure

- `src/pages/*`: Astro pages and API adapters
- `src/api/*`: endpoint logic and helpers
- `server/*`: yt-dlp wrapper, i18n, and centralized configuration
- `Dockerfile` and `docker-compose.yml`: packaging and deployment

## Security

- Do not expose sensitive data in responses or logs.
- Respect file size limits and rate limiting per IP.
- Keep temporary file cleanup (TTL) working properly.

## Updating yt-dlp

**Important**: We don't use `pip` for yt-dlp. We use the official binary from GitHub.

- **In Docker**: The Dockerfile automatically downloads the latest version from GitHub releases on each build
- **Local development**: Update manually with:
  ```bash
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  chmod a+rx /usr/local/bin/yt-dlp
  ```

## Basic Manual Testing

### Local testing (development)
- POST `/api/download` with URLs from various platforms (YouTube, Twitter/X, TikTok, etc.)
- GET `/api/status/:token` until `completed`
- GET `/api/download/:token` and verify behavior according to `DOWNLOAD_MAX_DOWNLOADS_PER_FILE`:
  - With value `1`: Download works once, then returns 404
  - With value `3`: Allows 3 downloads, 4th fails
  - With value `0`: Unlimited downloads (only deleted by TTL)
- Verify rate limiting (429) by attempting multiple downloads from the same IP
- Verify maximum size limit with large videos

### Testing with Docker
```bash
# Build and test in Docker
docker compose build
docker compose up -d
docker compose logs -f

# Test at http://localhost:8085
# Verify that .env changes apply with: docker compose restart
```

## Documentation

If your change adds new configuration options, update:
- **`.env.example`**: Add the variable with descriptive comments explaining what it does, valid values, and default
- **`server/config.js`**: Add the variable to the `appConfig` object with appropriate validation
- **`README.md`**: Update the configuration table with the new variable, description, default, and valid values
- **`CONTRIBUTING.md`**: If applicable, update manual tests to include test cases for the new feature

## Conduct

- Be respectful, clear, and collaborative.
- Keep the focus on quality and simplicity of the project.

Thank you for helping improve Amia!
