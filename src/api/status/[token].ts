import type { APIRoute } from 'astro';
import { getDownloadStatus } from '../_downloadManager';
import { json, methodNotAllowed } from '../_utils';
import { appConfig } from '../../../server/config.js';
import { getTranslations } from '../../../server/i18n.js';

const t = getTranslations(appConfig.language);

export const GET: APIRoute = ({ params }) => {
  const token = params.token;

  if (!token) {
    return json({ error: t.apiInvalidData }, { status: 400 });
  }

  const status = getDownloadStatus(token);

  if (!status) {
    return json({ error: t.apiNotFound }, { status: 404 });
  }

  return json(status, { status: 200 });
};

export const POST: APIRoute = () => methodNotAllowed(['GET']);
