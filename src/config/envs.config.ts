/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  JWT_SECRET: string;
  SYSTEM_CLIENT_ID: string;
}

const envsSchema = joi
  .object({
    PORT: joi.number().required(),
    JWT_SECRET: joi.string().required(),
    SYSTEM_CLIENT_ID: joi.string().required(),
  })
  .unknown();

const { error, value } = envsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: \${error.message}`);
}

const envVars: EnvVars = value as EnvVars;

export const envs = {
  port: envVars.PORT,
  jwtSecret: envVars.JWT_SECRET,
  systemClientId: envVars.SYSTEM_CLIENT_ID,
};
