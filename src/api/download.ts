import type { APIRoute } from 'astro';
import { z } from 'zod';
import { startDownload } from './_downloadManager';
import { checkRateLimit } from './_rateLimiter';
import { getClientIp, json, methodNotAllowed } from './_utils';
import { appConfig } from '../../server/config.js';
import { getTranslations } from '../../server/i18n.js';

const t = getTranslations(appConfig.language);

const PayloadSchema = z
  .object({
    url: z.string().url(),
    format: z.enum(['mp4', 'webm', 'mp3']).default('mp4'),
    quality: z
      .enum(['best', '1080p', '720p', '480p', 'audio'])
      .default('best')
  })
  .transform((value) => {
    let quality = value.quality;

    if (value.format === 'mp3') {
      quality = 'audio';
    } else if (quality === 'audio') {
      quality = 'best';
    }

    return {
      url: value.url,
      format: value.format,
      quality
    };
  });

function formatWindow(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    if (hours === 1) return t.timeHour;
    return `${hours} ${t.timeHours}`;
  }
  return `${minutes} ${t.timeMinutes}`;
}

const RATE_LIMIT_MESSAGE = t.apiRateLimitExceeded(appConfig.rateLimit.maxRequests, formatWindow(appConfig.rateLimit.windowMinutes));

function isValidUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    // Solo permitir http y https
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  let payload: z.infer<typeof PayloadSchema>;

  try {
    payload = PayloadSchema.parse(await request.json());
  } catch (error) {
    return json(
      {
        error: t.apiInvalidData,
        details:
          error instanceof z.ZodError ? error.issues : t.apiInvalidDataDetails
      },
      { status: 400 }
    );
  }

  if (!isValidUrl(payload.url)) {
    return json(
      { error: t.apiInvalidUrl },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const allowed = checkRateLimit(ip);

  if (!allowed) {
    return json(
      {
        error: RATE_LIMIT_MESSAGE
      },
      { status: 429 }
    );
  }

  try {
    const { token } = await startDownload(payload.url, payload.format, payload.quality);
    return json(
      {
        token,
        status: 'in_progress'
      },
      { status: 202 }
    );
  } catch (error) {
    return json(
      {
        error: t.apiCouldNotStart,
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};

export const GET: APIRoute = () => methodNotAllowed(['POST']);
