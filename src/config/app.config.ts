import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const port = process.env.PORT;
  const environment = process.env.NODE_ENV || 'development';

  if (!port) {
    throw new Error('PORT environment variable is required');
  }

  return {
    port: parseInt(port, 10),
    environment,
  };
}); 