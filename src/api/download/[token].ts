import type { APIRoute } from 'astro';
import path from 'node:path';
import { createDownloadStream, getDownload } from '../_downloadManager';
import { json, methodNotAllowed } from '../_utils';
import { appConfig } from '../../../server/config.js';
import { getTranslations } from '../../../server/i18n.js';

const t = getTranslations(appConfig.language);

const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  opus: 'audio/ogg'
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

export const GET: APIRoute = async ({ params }) => {
  const token = params.token;

  if (!token) {
    return json({ error: 'Token requerido.' }, { status: 400 });
  }

  const record = getDownload(token);

  if (!record) {
    return json({ error: t.apiNotFound }, { status: 404 });
  }

  if (record.status === 'error') {
    return json(
      {
        error: t.apiInternalError,
        details: record.error
      },
      { status: 410 }
    );
  }

  if (record.status !== 'completed') {
    return json(
      { error: t.apiFileNotReady },
      { status: 409 }
    );
  }

  const download = createDownloadStream(token);

  if (!download) {
    return json({ error: t.apiNotFound }, { status: 404 });
  }

  const ext = path.extname(download.filename).replace('.', '').toLowerCase();
  const contentType = MIME_MAP[ext] ?? 'application/octet-stream';
  const filename = sanitizeFilename(download.filename);

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Cache-Control', 'no-store');
  if (download.size) {
    headers.set('Content-Length', download.size.toString());
  }

  return new Response(download.stream as any, {
    status: 200,
    headers
  });
};

export const POST: APIRoute = () => methodNotAllowed(['GET']);
