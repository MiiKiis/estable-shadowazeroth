const mysql = require('mysql2/promise');
const { Client } = require('ssh2');
const net = require('net');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function run() {
  const ssh = new Client();
  ssh.on('ready', () => {
    const server = net.createServer((sock) => {
      ssh.forwardOut('127.0.0.1', 0, '127.0.0.1', 3306, (err, stream) => {
        sock.pipe(stream).pipe(sock);
      });
    });
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      const conn = await mysql.createConnection({
        host: '127.0.0.1', port, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'auth'
      });
      console.log('Connected to DB');
      try {
        await conn.query('ALTER TABLE `account` ADD COLUMN `dp` INT UNSIGNED NOT NULL DEFAULT 0;');
        console.log('Added dp column');
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log('dp already exists');
        else console.error(e);
      }
      try {
        await conn.query('ALTER TABLE `account` ADD COLUMN `vp` INT UNSIGNED NOT NULL DEFAULT 0;');
        console.log('Added vp column');
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log('vp already exists');
        else console.error(e);
      }
      try {
        await conn.query("INSERT IGNORE INTO `account` (`id`, `username`, `salt`, `verifier`, `email`, `dp`, `vp`) VALUES (999999, 'MARKET_HOLD_ACCOUNT', 0x00, 0x00, 'market@shadow-azeroth.com', 0, 0);");
        console.log('Hold account inserted');
      } catch (e) { console.error('Insert error', e); }
      
      const sql2 = `CREATE TABLE IF NOT EXISTS marketplace_listings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seller_account INT UNSIGNED NOT NULL,
        char_guid INT UNSIGNED NOT NULL,
        char_snapshot LONGTEXT NOT NULL,
        price_dp INT UNSIGNED NOT NULL,
        status ENUM('active','sold','cancelled') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sold_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_status (status),
        INDEX idx_seller (seller_account)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
      await conn.query(sql2);
      
      const sql3 = `CREATE TABLE IF NOT EXISTS marketplace_sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        listing_id INT NOT NULL,
        seller_id INT UNSIGNED NOT NULL,
        buyer_id INT UNSIGNED NOT NULL,
        char_guid INT UNSIGNED NOT NULL,
        price_dp INT UNSIGNED NOT NULL,
        sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_buyer (buyer_id),
        INDEX idx_seller_sales (seller_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
      await conn.query(sql3);
      
      console.log('Marketplace tables created successfully.');
      process.exit(0);
    });
  });
  ssh.connect({ host: process.env.SSH_HOST, port: 22, username: process.env.SSH_USER, password: process.env.SSH_PASSWORD });
}
run();
