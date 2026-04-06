import mysql from 'mysql2/promise';
import { Client } from 'ssh2';
import net from 'net';

// ── Configuración base ────────────────────────────────────────────────────────
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT_INITIAL = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASSWORD || process.env.DB_PASS || '';

interface TunnelConfig {
  dbPort: number;
  soapPort: number;
}

const globalForDb = globalThis as unknown as {
  pool: mysql.Pool | undefined;
  authPool: mysql.Pool | undefined;
  worldPool: mysql.Pool | undefined;
  sshTunnel: Promise<TunnelConfig> | undefined;
};

/**
 * Crea un servidor proxy local que tuneliza tráfico hacia el VPS remoto.
 */
function createProxy(ssh: Client, remoteHost: string, remotePort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((sock) => {
      ssh.forwardOut(
        '127.0.0.1', 0,
        remoteHost, remotePort,
        (err, stream) => {
          if (err) {
            console.error(`❌ [SSH] Error en forwardOut (${remotePort}):`, err);
            sock.end();
            return;
          }
          sock.pipe(stream).pipe(sock);
        }
      );
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      resolve(port);
    });

    server.on('error', reject);
  });
}

/**
 * Gestiona el túnel SSH y devuelve los puertos locales asignados.
 */
async function getSshTunnel(): Promise<TunnelConfig> {
  if (process.env.SSH_ENABLED !== 'true') {
    return { dbPort: DB_PORT_INITIAL, soapPort: 7878 };
  }
  if (globalForDb.sshTunnel) return globalForDb.sshTunnel;

  globalForDb.sshTunnel = new Promise((resolve, reject) => {
    const ssh = new Client();

    ssh.on('ready', async () => {
      console.log('🚀 [SSH] Conectado al VPS.');

      try {
        const [dbPort, soapPort] = await Promise.all([
          createProxy(ssh, '127.0.0.1', 3306),
          createProxy(ssh, '127.0.0.1', 7878),
        ]);

        console.log(`📡 [SSH] DB Mapeada: localhost:${dbPort} -> VPS:3306`);
        console.log(`📡 [SSH] SOAP Mapeado: localhost:${soapPort} -> VPS:7878`);

        resolve({ dbPort, soapPort });
      } catch (err) {
        console.error('❌ [SSH] Error creando proxies locales:', err);
        globalForDb.sshTunnel = undefined;
        reject(err);
      }
    });

    ssh.on('error', (err) => {
      console.error('❌ [SSH] Error de conexión SSH:', err.message);
      globalForDb.sshTunnel = undefined;
      reject(err);
    });

    ssh.connect({
      host: process.env.SSH_HOST,
      port: Number(process.env.SSH_PORT || 22),
      username: process.env.SSH_USER,
      password: process.env.SSH_PASSWORD,
      keepaliveInterval: 10000,
      readyTimeout: 30000,
    });
  });

  return globalForDb.sshTunnel;
}

/**
 * Crea un Proxy para el Pool de MySQL que asegura que el túnel esté listo
 * antes de crear el pool real.
 */
function createSshProxiedPool(database: string) {
  let poolPromise: Promise<mysql.Pool> | null = null;

  async function getTargetPool() {
    if (!poolPromise) {
      poolPromise = (async () => {
        const tunnel = await getSshTunnel();
        return mysql.createPool({
          host: process.env.SSH_ENABLED === 'true' ? '127.0.0.1' : DB_HOST,
          port: process.env.SSH_ENABLED === 'true' ? tunnel.dbPort : DB_PORT_INITIAL,
          user: DB_USER,
          password: DB_PASS,
          database: database,
          waitForConnections: true,
          connectionLimit: process.env.SSH_ENABLED === 'true' ? 5 : 10,
          queueLimit: 0,
          connectTimeout: 15000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
        });
      })();
    }
    return poolPromise;
  }

  return new Proxy({} as mysql.Pool, {
    get(target, prop) {
      if (['query', 'execute', 'getConnection'].includes(prop as string)) {
        return async (...args: any[]) => {
          const pool = await getTargetPool();
          return (pool as any)[prop](...args);
        };
      }
      return undefined;
    },
  });
}

/**
 * Helper para obtener la URL de SOAP tunelizada si es necesario.
 */
export async function getSoapUrl() {
  const tunnel = await getSshTunnel();
  if (process.env.SSH_ENABLED === 'true') {
    return `http://127.0.0.1:${tunnel.soapPort}`;
  }
  return process.env.ACORE_SOAP_URL || 'http://127.0.0.1:7878';
}

// ── Pools de conexión (Pure Next.js — sin BlizzCMS) ───────────────────────────
// pool       → acore_characters (personajes, inventario, skills, etc.)
// authPool   → acore_auth       (cuentas, marketplace_listings, shop_items, etc.)
// worldPool  → acore_world      (item_template, creature_template, etc.)
export const pool      = createSshProxiedPool(process.env.DB_CHARACTERS || 'characters');
export const authPool  = createSshProxiedPool(process.env.DB_AUTH       || 'auth');
export const worldPool = createSshProxiedPool(process.env.DB_WORLD      || 'world');

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool      = pool;
  globalForDb.authPool  = authPool;
  globalForDb.worldPool = worldPool;
}

export default pool;
