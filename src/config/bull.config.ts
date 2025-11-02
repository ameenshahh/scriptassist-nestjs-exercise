import { registerAs } from '@nestjs/config';

export default registerAs('bull', () => {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;

  if (!host || !port) {
    throw new Error(
      'Redis configuration incomplete. Required: REDIS_HOST, REDIS_PORT',
    );
  }

  return {
    connection: {
      host,
      port: parseInt(port, 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
  };
}); 