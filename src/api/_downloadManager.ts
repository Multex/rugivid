import { randomUUID } from 'node:crypto';
import { rm, stat, readdir, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { runYtDlp } from '../../server/ytdlp.js';
import { appConfig } from '../../server/config.js';

const TEMP_DIR = appConfig.download.tempDir;
const CLEANUP_INTERVAL_MS = appConfig.download.cleanupIntervalMs;
const TTL_MS = appConfig.download.ttlMs;

type DownloadStatus = 'pending' | 'in_progress' | 'completed' | 'error';
type FormatOption = 'mp4' | 'webm' | 'mp3';
type QualityOption = 'best' | '1080p' | '720p' | '480p' | 'audio';

interface DownloadRecord {
  token: string;
  url: string;
  format: FormatOption;
  quality: QualityOption;
  status: DownloadStatus;
  progress: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  filePath?: string;
  filename?: string;
  downloadName?: string;
  fileSize?: number;
  error?: string;
  processClosed?: boolean;
}

const downloads = new Map<string, DownloadRecord>();

async function ensureTempDir() {
  await mkdir(TEMP_DIR, { recursive: true });
}

function buildArgs(format: FormatOption, quality: QualityOption, token: string) {
  const safeQuality =
    quality === 'audio' && format !== 'mp3' ? 'best' : quality;
  const args: string[] = [
    '--no-call-home',
    '--no-part',
    '--restrict-filenames',
    '-o',
    path.join(TEMP_DIR, `${token}-%(title)s.%(ext)s`)
  ];

  if (format === 'mp3') {
    args.push(
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0'
    );
  }

  const videoQuality = (() => {
    switch (safeQuality) {
      case '1080p':
        return 1080;
      case '720p':
        return 720;
      case '480p':
        return 480;
      default:
        return undefined;
    }
  })();

  if (format === 'mp3') {
    args.push('-f', 'bestaudio/best');
  } else {
    const container = format === 'mp4' ? 'mp4' : 'webm';
    const heightConstraint = videoQuality
      ? `[height<=${videoQuality}]`
      : '';
    const formatSelector = [
      `bestvideo[ext=${container}]${heightConstraint}+bestaudio`,
      `best[ext=${container}]${heightConstraint}`,
      'best'
    ].join('/');
    args.push('-f', formatSelector);
    args.push('--merge-output-format', container);
  }

  return args;
}

async function resolveFile(token: string) {
  const entries = await readdir(TEMP_DIR);
  const match = entries.find((file) => file.startsWith(`${token}-`));
  if (!match) {
    return undefined;
  }
  const fullPath = path.join(TEMP_DIR, match);
  const info = await stat(fullPath);
  return {
    filePath: fullPath,
    filename: match,
    downloadName: match.replace(`${token}-`, ''),
    fileSize: info.size
  };
}

async function cleanupRecord(token: string) {
  const record = downloads.get(token);
  if (!record) return;

  if (record.filePath) {
    try {
      await rm(record.filePath, { force: true });
    } catch {
      // ignore
    }
  }

  downloads.delete(token);
}

function cleanupExpired() {
  const now = Date.now();
  for (const [token, record] of downloads.entries()) {
    if (
      (record.status === 'completed' || record.status === 'error') &&
      record.expiresAt <= now
    ) {
      void cleanupRecord(token);
    }
  }
}

setInterval(cleanupExpired, CLEANUP_INTERVAL_MS).unref();

export async function startDownload(url: string, format: FormatOption, quality: QualityOption) {
  await ensureTempDir();
  const token = randomUUID();
  const createdAt = Date.now();
  const record: DownloadRecord = {
    token,
    url,
    format,
    quality,
    status: 'in_progress',
    progress: 0,
    createdAt,
    updatedAt: createdAt,
    expiresAt: createdAt + TTL_MS
  };

  downloads.set(token, record);

  const args = buildArgs(format, quality, token);
  const { events } = runYtDlp({
    url,
    args,
    maxFileSizeMb: appConfig.download.maxFileSizeMb
  });

  events.on('progress', (value) => {
    const current = downloads.get(token);
    if (!current) return;
    current.progress = Math.max(current.progress, Math.min(100, value));
    current.updatedAt = Date.now();
  });

  const handleLine = (line: string) => {
    const current = downloads.get(token);
    if (!current) return;

    if (line.includes('Destination:')) {
      const destination = line.split('Destination:')[1]?.trim();
      if (destination) {
        const normalized = path.isAbsolute(destination)
          ? destination
          : path.resolve(destination);
        current.filePath = normalized;
        current.filename = path.basename(normalized);
        current.downloadName = current.filename.replace(`${token}-`, '');
        current.updatedAt = Date.now();
      }
    }

    const mergeMatch = line.match(/Merging formats into "(.*)"/);
    if (mergeMatch && mergeMatch[1]) {
      const destination = mergeMatch[1];
      const normalized = path.isAbsolute(destination)
        ? destination
        : path.resolve(destination);
      current.filePath = normalized;
      current.filename = path.basename(normalized);
      current.downloadName = current.filename.replace(`${token}-`, '');
      current.updatedAt = Date.now();
    }

    if (line.toLowerCase().includes('error')) {
      current.error = line;
      current.updatedAt = Date.now();
    }
  };

  events.on('stdout', handleLine);
  events.on('stderr', handleLine);

  events.on('error', (error) => {
    const current = downloads.get(token);
    if (!current) return;
    current.status = 'error';
    current.error = error.message;
    current.updatedAt = Date.now();
    current.expiresAt = Date.now();
  });

  events.on('close', async (code) => {
    const current = downloads.get(token);
    if (!current) return;
    current.processClosed = true;
    current.updatedAt = Date.now();

    if (code !== 0) {
      current.status = 'error';
      current.error =
        current.error ??
        `yt-dlp exited with code ${code ?? 'unknown'}`;
      current.expiresAt = Date.now();
      return;
    }

    try {
      const info =
        current.filePath && current.filename && current.downloadName
          ? {
              filePath: current.filePath,
              filename: current.filename,
              downloadName: current.downloadName,
              fileSize: current.fileSize
            }
          : await resolveFile(token);

      if (!info) {
        current.status = 'error';
        current.error = 'Archivo no disponible tras la descarga.';
        current.expiresAt = Date.now();
        return;
      }

      current.filePath = info.filePath;
      current.filename = info.filename;
      current.downloadName =
        info.downloadName ?? info.filename.replace(`${token}-`, '');
      if (!info.fileSize) {
        const stats = await stat(info.filePath);
        current.fileSize = stats.size;
      } else {
        current.fileSize = info.fileSize;
      }

      current.status = 'completed';
      current.progress = 100;
      current.expiresAt = Date.now() + TTL_MS;
    } catch (error) {
      current.status = 'error';
      current.error =
        error instanceof Error ? error.message : 'Fallo al preparar el archivo.';
      current.expiresAt = Date.now();
    }
  });

  return { token };
}

export function getDownload(token: string) {
  return downloads.get(token);
}

export function getDownloadStatus(token: string) {
  const record = downloads.get(token);
  if (!record) return undefined;

  return {
    token: record.token,
    status: record.status,
    progress: Math.round(record.progress),
    error: record.error,
    expiresAt: record.expiresAt,
    downloadName: record.downloadName,
    fileSize: record.fileSize
  };
}

export async function markDownloaded(token: string) {
  const record = downloads.get(token);
  if (!record) return;
  record.expiresAt = Date.now();
  await cleanupRecord(token);
}

export function createDownloadStream(token: string) {
  const record = downloads.get(token);
  if (!record || record.status !== 'completed' || !record.filePath) {
    return undefined;
  }

  const stream = createReadStream(record.filePath);
  stream.on('close', () => {
    void markDownloaded(token);
  });

  return {
    stream,
    filename: record.downloadName ?? record.filename ?? `${token}.bin`,
    size: record.fileSize
  };
}
