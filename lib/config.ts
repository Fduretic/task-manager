import { appOrigin, digest } from './auth';
export function validateRuntime() {
  const keys = [
    'APP_ORIGIN',
    'AUTH_SECRET',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'MAIL_FROM',
    'POSTGRES_PASSWORD',
  ] as const;
  for (const key of keys)
    if (!process.env[key]) throw new Error(`Missing required runtime configuration: ${key}`);
  appOrigin();
  digest('readiness');
  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP port');
}
