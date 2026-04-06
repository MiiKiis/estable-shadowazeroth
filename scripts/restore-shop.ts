import * as dotenv from 'dotenv';
import * as path from 'path';

export {};

// CARGAR ENV DE FORMA SÍNCRONA AL PRINCIPIO
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  console.log('🚀 Iniciando restauración de base de datos (Fixing Env)...');
  
  // Importar dinámicamente para asegurar que process.env ya esté poblado
  const { authPool } = await import('../src/lib/db');

  try {
    console.log('⏳ Verificando columnas en tabla account...');
    try { await authPool.query('ALTER TABLE account ADD COLUMN vp INT UNSIGNED NOT NULL DEFAULT 0'); } catch (e) {}
    try { await authPool.query('ALTER TABLE account ADD COLUMN dp INT UNSIGNED NOT NULL DEFAULT 0'); } catch (e) {}

    console.log('⏳ Recreando tabla shop_items...');
    await authPool.query('DROP TABLE IF EXISTS shop_items');
    
    await authPool.query(`
      CREATE TABLE shop_items (
        id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
        item_id          INT UNSIGNED     NOT NULL DEFAULT 0,
        name             VARCHAR(100)     NOT NULL DEFAULT '',
        description      TEXT             DEFAULT NULL,
        image            VARCHAR(100)     DEFAULT 'inv_misc_questionmark',
        price            INT UNSIGNED     NOT NULL DEFAULT 0,
        currency         VARCHAR(10)      NOT NULL DEFAULT 'dp',
        price_dp         INT UNSIGNED     NOT NULL DEFAULT 0,
        price_vp         INT UNSIGNED     NOT NULL DEFAULT 0,
        quality          VARCHAR(20)      NOT NULL DEFAULT 'comun',
        category         VARCHAR(50)      NOT NULL DEFAULT 'misc',
        tier             INT UNSIGNED     NOT NULL DEFAULT 0,
        class_mask       INT UNSIGNED     NOT NULL DEFAULT 0,
        soap_item_entry  INT UNSIGNED     DEFAULT NULL,
        soap_item_count  INT UNSIGNED     NOT NULL DEFAULT 1,
        service_type     VARCHAR(50)      NOT NULL DEFAULT 'none',
        service_data     TEXT             DEFAULT NULL,
        faction          VARCHAR(10)      NOT NULL DEFAULT 'all',
        item_level       INT UNSIGNED     NOT NULL DEFAULT 0,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('⏳ Insertando items de prueba...');
    await authPool.query("INSERT INTO shop_items (name, item_id, price_dp, price_vp, quality, category, image) VALUES ('Alquimia (Servicio)', 171, 0, 50, 'raro', 'professions', 'trade_alchemy')");

    console.log('✨ ÉXITO: La base de datos ha sido restaurada.');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR FATAL:', err);
    process.exit(1);
  }
}

run();
