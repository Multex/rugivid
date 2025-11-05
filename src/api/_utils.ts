import type { APIRoute } from 'astro';
import { appConfig } from '../../server/config.js';
import { getTranslations } from '../../server/i18n.js';

const t = getTranslations(appConfig.language);

export function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  const remote = (request as any).ip ?? undefined;
  if (remote) return remote;

  const connection = (request as any).connection;
  if (connection?.remoteAddress) return connection.remoteAddress;

  return 'unknown';
}

export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    ...init
  });
}

export function methodNotAllowed(allowed: string[]): Response {
  return json(
    {
      error: t.apiMethodNotAllowed,
      allowed
    },
    { status: 405, headers: { Allow: allowed.join(', ') } }
  );
}

export type RouteHandler = APIRoute;
