import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { authPool } from './src/lib/db';

export {};

async function checkPendingGifts() {
  try {
    const [rows] = await authPool.query(
      "SELECT id, donor_account, recipient_account, character_name, item_name, status, created_at FROM pending_gifts ORDER BY created_at DESC LIMIT 10"
    );
    console.log('--- Pending Gifts ---');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkPendingGifts();
