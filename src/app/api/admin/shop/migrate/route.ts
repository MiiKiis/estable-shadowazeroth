import { NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    console.log('🚀 Iniciando migración de base de datos via API...');
    
    const sqlPath = path.join(process.cwd(), 'scripts', 'migrations', 'shop_robust_migration.sql');
    if (!fs.existsSync(sqlPath)) {
      return NextResponse.json({ error: 'Migration SQL file not found' }, { status: 404 });
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // El pool de db.ts ya tiene configurado el túnel SSH y la autenticación correcta
    // Usamos multipleStatements: true si fuera necesario, pero por defecto authPool es un pool normal.
    // Para ejecutar múltiples sentencias, las dividiremos manualmente o usaremos una conexión que las soporte.
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`⏳ Ejecutando: ${statement.substring(0, 50)}...`);
      await authPool.query(statement);
    }

    return NextResponse.json({ success: true, message: 'Migración completada con éxito' });
  } catch (error: any) {
    console.error('❌ Error en migración API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
