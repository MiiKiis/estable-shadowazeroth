import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export const RAFFLE_MAX_TICKETS_PER_ACCOUNT = 1000;
export const RAFFLE_TICKET_COST_DP = 1;
export const RAFFLE_TICKET_COST_VP = 1;
export const RAFFLE_TICKET_COST_GOLD = 5000;
export const RAFFLE_TICKET_COST_GOLD_COPPER = RAFFLE_TICKET_COST_GOLD * 10000;

export type RaffleCurrency = 'dp' | 'vp' | 'gold';

export interface RaffleRow extends RowDataPacket {
  id: number;
  title: string;
  description: string | null;
  prize_text: string;
  prize_item_id: number | null;
  status: 'draft' | 'active' | 'closed' | 'drawn';
  starts_at: Date | string;
  ends_at: Date | string;
  winner_account_id: number | null;
  winner_note: string | null;
  drawn_at: Date | string | null;
  created_by: number;
  created_at: Date | string;
}

interface FinalizeCandidateRow extends RowDataPacket {
  id: number;
}

interface LockedRaffleRow extends RowDataPacket {
  id: number;
  status: 'draft' | 'active' | 'closed' | 'drawn';
  ends_at: Date | string;
}

interface TicketRangeRow extends RowDataPacket {
  account_id: number;
  ticket_count: number;
  reward_character_guid: number | null;
}

export async function ensureRaffleTables(connection: PoolConnection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS raffles (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(120) NOT NULL,
      description TEXT NULL,
      prize_text VARCHAR(255) NOT NULL,
      prize_item_id INT UNSIGNED NULL,
      status ENUM('draft','active','closed','drawn') NOT NULL DEFAULT 'draft',
      starts_at DATETIME NOT NULL,
      ends_at DATETIME NOT NULL,
      winner_account_id INT UNSIGNED NULL,
      winner_note VARCHAR(255) NULL,
      drawn_at DATETIME NULL,
      created_by INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_status_ends (status, ends_at),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try {
    await connection.query('ALTER TABLE raffles ADD COLUMN prize_item_id INT UNSIGNED NULL AFTER prize_text');
  } catch {
    // Already exists
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS raffle_ticket_totals (
      raffle_id INT UNSIGNED NOT NULL,
      account_id INT UNSIGNED NOT NULL,
      ticket_count INT UNSIGNED NOT NULL DEFAULT 0,
      reward_character_guid INT UNSIGNED NULL,
      spent_dp INT UNSIGNED NOT NULL DEFAULT 0,
      spent_vp INT UNSIGNED NOT NULL DEFAULT 0,
      spent_gold BIGINT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (raffle_id, account_id),
      KEY idx_account (account_id),
      CONSTRAINT fk_raffle_ticket_totals_raffle
        FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try {
    await connection.query('ALTER TABLE raffle_ticket_totals ADD COLUMN reward_character_guid INT UNSIGNED NULL AFTER ticket_count');
  } catch {
    // Already exists
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS raffle_ticket_purchases (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      raffle_id INT UNSIGNED NOT NULL,
      account_id INT UNSIGNED NOT NULL,
      character_guid INT UNSIGNED NULL,
      currency ENUM('dp','vp','gold') NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      total_cost BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_raffle_account (raffle_id, account_id),
      KEY idx_created_at (created_at),
      CONSTRAINT fk_raffle_ticket_purchases_raffle
        FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS raffle_winners (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      raffle_id INT UNSIGNED NOT NULL,
      account_id INT UNSIGNED NOT NULL,
      character_guid INT UNSIGNED NULL,
      ticket_number INT UNSIGNED NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_raffle_once (raffle_id),
      KEY idx_account (account_id),
      CONSTRAINT fk_raffle_winners_raffle
        FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try {
    await connection.query('ALTER TABLE raffle_winners ADD COLUMN character_guid INT UNSIGNED NULL AFTER account_id');
  } catch {
    // Already exists
  }
}

export function isValidRaffleCurrency(value: unknown): value is RaffleCurrency {
  return value === 'dp' || value === 'vp' || value === 'gold';
}

export function getTicketUnitCost(currency: RaffleCurrency) {
  if (currency === 'dp') return RAFFLE_TICKET_COST_DP;
  if (currency === 'vp') return RAFFLE_TICKET_COST_VP;
  return RAFFLE_TICKET_COST_GOLD_COPPER;
}

export async function autoFinalizeEndedRaffles(connection: PoolConnection) {
  const [candidates] = await connection.query<FinalizeCandidateRow[]>(
    `SELECT id FROM raffles WHERE status = 'active' AND ends_at <= NOW()`
  );

  for (const candidate of candidates) {
    await connection.beginTransaction();
    try {
      const [lockedRows] = await connection.query<LockedRaffleRow[]>(
        `SELECT id, status, ends_at
         FROM raffles
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [candidate.id]
      );

      if (lockedRows.length === 0) {
        await connection.rollback();
        continue;
      }

      const raffle = lockedRows[0];
      const ended = new Date(raffle.ends_at).getTime() <= Date.now();
      if (raffle.status !== 'active' || !ended) {
        await connection.rollback();
        continue;
      }

      const [entries] = await connection.query<TicketRangeRow[]>(
        `SELECT account_id, ticket_count, reward_character_guid
         FROM raffle_ticket_totals
         WHERE raffle_id = ? AND ticket_count > 0
         ORDER BY account_id ASC`,
        [candidate.id]
      );

      if (entries.length === 0) {
        await connection.query(
          `UPDATE raffles
           SET status = 'closed', winner_note = 'Sin participantes', drawn_at = NOW()
           WHERE id = ?
           LIMIT 1`,
          [candidate.id]
        );
        await connection.commit();
        continue;
      }

      const totalTickets = entries.reduce((acc, row) => acc + Number(row.ticket_count || 0), 0);
      const winningNumber = Math.floor(Math.random() * totalTickets) + 1;

      let cursor = 0;
      let winnerAccountId = 0;
      let winnerCharacterGuid: number | null = null;

      for (const entry of entries) {
        cursor += Number(entry.ticket_count || 0);
        if (winningNumber <= cursor) {
          winnerAccountId = Number(entry.account_id);
          winnerCharacterGuid = entry.reward_character_guid ? Number(entry.reward_character_guid) : null;
          break;
        }
      }

      const note = winnerCharacterGuid
        ? `Ganador cuenta #${winnerAccountId}, personaje GUID ${winnerCharacterGuid}, ticket #${winningNumber}`
        : `Ganador cuenta #${winnerAccountId}, ticket #${winningNumber}`;

      await connection.query(
        `UPDATE raffles
         SET status = 'drawn', winner_account_id = ?, winner_note = ?, drawn_at = NOW()
         WHERE id = ?
         LIMIT 1`,
        [winnerAccountId, note, candidate.id]
      );

      await connection.query(
        `INSERT INTO raffle_winners (raffle_id, account_id, character_guid, ticket_number, note)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           account_id = VALUES(account_id),
           character_guid = VALUES(character_guid),
           ticket_number = VALUES(ticket_number),
           note = VALUES(note)`,
        [candidate.id, winnerAccountId, winnerCharacterGuid, winningNumber, note]
      );

      await connection.commit();
    } catch {
      await connection.rollback();
    }
  }
}
