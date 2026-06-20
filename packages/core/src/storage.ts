import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadConfig } from './env.js';

let client: S3Client | undefined;

function getClient(): S3Client {
  if (client) return client;
  const cfg = loadConfig();
  if (!cfg.storageEnabled) {
    throw new Error(
      'Object storage is not configured. Set S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY.',
    );
  }
  client = new S3Client({
    endpoint: cfg.S3_ENDPOINT,
    region: cfg.S3_REGION,
    forcePathStyle: cfg.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: cfg.S3_ACCESS_KEY_ID!,
      secretAccessKey: cfg.S3_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

export function isStorageEnabled(): boolean {
  return loadConfig().storageEnabled;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string,
): Promise<void> {
  const cfg = loadConfig();
  await getClient().send(
    new PutObjectCommand({
      Bucket: cfg.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Read an object's raw bytes (used by the worker to send attachments outbound). */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const cfg = loadConfig();
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: cfg.S3_BUCKET!, Key: key }),
  );
  const body = res.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
  if (!body?.transformToByteArray) throw new Error('Empty S3 object body');
  return body.transformToByteArray();
}

/**
 * Presigned GET URL. Railway Storage Buckets have no public object URLs, so the
 * UI always serves attachments through short-lived presigned links.
 */
export async function getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const cfg = loadConfig();
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: cfg.S3_BUCKET!, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deleteObject(key: string): Promise<void> {
  const cfg = loadConfig();
  await getClient().send(new DeleteObjectCommand({ Bucket: cfg.S3_BUCKET!, Key: key }));
}
