import { registerAs } from '@nestjs/config';

export const birdeyeConfig = registerAs('birdeye', () => ({
  birdeyeApiKey: process.env.BIRDEYE_API_KEY,
}));

export const alchemyConfig = registerAs('alchemy', () => ({
  alchemyApiKey: process.env.ALCHEMY_API_KEY,
}));

export const postgresConfig = registerAs('postgres_ai', () => ({
  postgresUrl: process.env.POSTGRES_URL,
}));

export const dodoConfig = registerAs('dodo', () => ({
  apiKey: process.env.DODO_API_KEY,
}));

export const binkConfig = registerAs('bink', () => ({
  apiKey: process.env.BINK_API_KEY || '',
  baseUrl: process.env.BINK_API_URL || '',
  imageApiUrl: process.env.IMAGE_API_URL || '',
}));
