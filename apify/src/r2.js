// Cloudflare R2 uploader (S3-compatible). Uploads folder page-images and
// returns their public URLs, so the site can render them via next/image
// (next.config images.remotePatterns already allows any https host).
//
// Credentials come from Apify secrets / env — never hard-coded:
//   R2_ACCOUNT_ID         Cloudflare account id (the {id} in {id}.r2.cloudflarestorage.com)
//   R2_ACCESS_KEY_ID      R2 API token access key
//   R2_SECRET_ACCESS_KEY  R2 API token secret
//   R2_BUCKET             bucket name (default: superpromo-folders)
//   R2_PUBLIC_BASE        public base URL, e.g. https://pub-xxxx.r2.dev (from r2.dev public access)

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export function makeR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET || 'superpromo-folders';
  const publicBase = (process.env.R2_PUBLIC_BASE || '').replace(/\/$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !publicBase) {
    return null; // R2 not configured — caller falls back to source image URLs
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    bucket,
    publicBase,
    /** Upload a buffer; returns the public URL. Idempotent by key. */
    async put(key, body, contentType = 'image/webp') {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=604800',
        }),
      );
      return `${publicBase}/${key}`;
    },
  };
}
