import mysql from 'mysql2/promise';

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'blizzcms';
const DB_PASS = process.env.DB_PASSWORD || process.env.DB_PASS || '';

const globalForDb = globalThis as unknown as {
  pool: mysql.Pool | undefined;
  authPool: mysql.Pool | undefined;
  cmsPool: mysql.Pool | undefined;
};

// Pool por defecto para datos del juego (acore_characters)
const pool = globalForDb.pool ?? mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: process.env.DB_CHARACTERS || 'acore_characters',
  socketPath: undefined,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 10,
  idleTimeout: 60000,
});

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

// Pool para autenticación (acore_auth)
export const authPool = globalForDb.authPool ?? mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: process.env.DB_AUTH || 'acore_auth',
  socketPath: undefined,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 10,
  idleTimeout: 60000,
});

if (process.env.NODE_ENV !== 'production') globalForDb.authPool = authPool;

// Pool para la base de datos del CMS (blizzcms - tablas internas: users, shop, etc.)
export const cmsPool = globalForDb.cmsPool ?? mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: process.env.DB_CMS || 'blizzcms',
  socketPath: undefined,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 10,
  idleTimeout: 60000,
});

if (process.env.NODE_ENV !== 'production') globalForDb.cmsPool = cmsPool;

export default pool;
