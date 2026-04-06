import { authPool, getSoapUrl } from '../src/lib/db';

async function verify() {
  console.log('🔍 Iniciando verificación de infraestructura...');
  
  try {
    console.log('📡 1. Probando Túnel SSH y Base de Datos...');
    // Realizamos una consulta simple para despertar al proxy
    const [rows]: any = await authPool.query('SELECT count(*) as count FROM account');
    console.log(`✅ Conexión DB Exitosa. Cuentas encontradas: ${rows[0].count}`);
    
    console.log('📨 2. Probando Endpoint SOAP...');
    const soapUrl = await getSoapUrl();
    console.log(`✅ URL SOAP Tunelizada: ${soapUrl}`);
    
    console.log('\n✨ [AUDITORÍA FINAL COMPLETA] — El sistema está listo.');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Error de Verificación:');
    if (err.message.includes('Authentication failed')) {
      console.error('   -> La conexión SSH falló. Revisa que SSH_PASSWORD en .env.local sea correcta.');
    } else {
      console.error(`   -> ${err.message}`);
    }
    process.exit(1);
  }
}

verify();
