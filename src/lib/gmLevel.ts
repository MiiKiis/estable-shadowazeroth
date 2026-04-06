import { authPool } from './db';
import { RowDataPacket } from 'mysql2';

let accountAccessSchema: { idCol: string, gmCol: string } | null = null;
let schemaPromise: Promise<void> | null = null;

export async function getAccountAccessSchema() {
  if (accountAccessSchema) return accountAccessSchema;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      let idCol = 'id';
      let gmCol = 'gmlevel';
      
      if (!authPool) {
        accountAccessSchema = { idCol, gmCol };
        return;
      }

      try {
        const [cols] = await authPool.query<RowDataPacket[]>(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_access'`
        );
        const colNames = cols.map((c) => (c.COLUMN_NAME as string).toLowerCase());
        
        if (colNames.includes('accountid')) idCol = 'AccountID';
        if (colNames.includes('securitylevel')) gmCol = 'SecurityLevel';
      } catch(e: unknown) {
        console.error('getAccountAccessSchema error:', e);
      }
      accountAccessSchema = { idCol, gmCol };
    })();
  }
  await schemaPromise;
  return accountAccessSchema!;
}

export async function getGMLevel(userId: number): Promise<number> {
  const schema = await getAccountAccessSchema();
  const [rows] = await authPool.query<RowDataPacket[]>(
    `SELECT MAX(\`${schema.gmCol}\`) AS lv FROM account_access WHERE \`${schema.idCol}\` = ?`,
    [userId]
  );
  return Number(rows?.[0]?.lv ?? 0);
}
