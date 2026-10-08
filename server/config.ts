export const CONFIG = {
  PORT: Number(process.env.PORT || 3001),
  ANDREY_BASE: (process.env.ANDREY_BASE || '').replace(/\/+$/, ''),
  ANDREY_TOKEN: process.env.ANDREY_TOKEN || '',
  MAX_VIDEO_SECONDS: 18,
  MAX_UPLOAD_MB: 40,
  REQUEST_TIMEOUT_MS: 130000,
};
