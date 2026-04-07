require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function fixShopTables() {
  console.log('--- Iniciando Reparación de Tablas de Tienda ---');
  const authPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME_AUTH || 'acore_auth'
  });

  const cmsPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME_CMS || 'blizzcms'
  });

  try {
    // 1. Crear shop_items en acore_auth
    await authPool.query(`
      CREATE TABLE IF NOT EXISTS shop_items (
        id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
        item_id         INT UNSIGNED  NOT NULL DEFAULT 0,
        name            VARCHAR(120)  NOT NULL DEFAULT '',
        image           VARCHAR(120)  NULL,
        price           INT UNSIGNED  NOT NULL DEFAULT 0,
        currency        ENUM('vp','dp') NOT NULL DEFAULT 'dp',
        quality         ENUM('pobre','comun','poco_comun','raro','epico','legendario') NOT NULL DEFAULT 'comun',
        category        VARCHAR(60)   NOT NULL DEFAULT 'misc',
        tier            TINYINT UNSIGNED NOT NULL DEFAULT 0,
        class_mask      INT UNSIGNED  NOT NULL DEFAULT 0,
        soap_item_entry INT UNSIGNED  NULL,
        soap_item_count INT UNSIGNED  NOT NULL DEFAULT 1,
        service_type    ENUM('none','name_change','race_change','faction_change','level_boost','gold_pack','profession','character_transfer','bundle') NOT NULL DEFAULT 'none',
        service_data    TEXT          NULL,
        active          TINYINT(1)    NOT NULL DEFAULT 1,
        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_category_tier (category, tier)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ acore_auth.shop_items creada/verificada.');

    // 2. Crear shop_purchases en acore_auth
    await authPool.query(`
      CREATE TABLE IF NOT EXISTS shop_purchases (
        id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
        account_id     INT UNSIGNED NOT NULL,
        item_id        INT UNSIGNED NOT NULL,
        item_name      VARCHAR(120) NOT NULL DEFAULT '',
        currency       ENUM('vp','dp') NOT NULL,
        price          INT UNSIGNED NOT NULL,
        character_guid INT UNSIGNED NULL,
        character_name VARCHAR(60)  NOT NULL DEFAULT '',
        is_gift        TINYINT(1)   NOT NULL DEFAULT 0,
        created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_account_created (account_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ acore_auth.shop_purchases creada/verificada.');

    // 3. Importar datos de blizzcms.shop_items a acore_auth.shop_items
    try {
      console.log('Intentando recuperar items guardados en blizzcms.shop_items...');
      const [oldItems] = await cmsPool.query('SELECT * FROM shop_items');
      if (oldItems && oldItems.length > 0) {
        for (const item of oldItems) {
          try {
            await authPool.query(`
              INSERT IGNORE INTO shop_items (id, item_id, name, image, price, currency, quality, category, tier, class_mask, soap_item_entry, soap_item_count, service_type, service_data, active, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              item.id, item.item_id, item.name, item.image, item.price, item.currency, item.quality, item.category, item.tier, item.class_mask, item.soap_item_entry, item.soap_item_count, item.service_type, item.service_data, item.active, item.created_at
            ]);
          } catch(e) {
            console.log(`Advertencia al importar item ${item.name}: ${e.message}`);
          }
        }
        console.log(`✅ Migrados ${oldItems.length} items desde blizzcms a acore_auth.`);
      }
      
      // Borrar la tabla vieja para evitar confusiones
      await cmsPool.query('DROP TABLE IF EXISTS shop_items');
      console.log('✅ Tabla blizzcms.shop_items antigua eliminada.');
    } catch (e) {
      console.log('No había tabla shop_items en blizzcms o no se pudo mover: ', e.message);
    }

    console.log('--- Reparación finalizada con éxito ---');
  } catch (error) {
    console.error('ERROR SQL:', error);
  } finally {
    await authPool.end();
    await cmsPool.end();
  }
}

fixShopTables();
