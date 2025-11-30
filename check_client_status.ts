import { drizzle } from 'drizzle-orm/neon-http';
import { clients } from './shared/schema';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

async function checkStatus() {
  const result = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM clients
    GROUP BY status
    ORDER BY count DESC
  `);

  console.log("📊 STATUS DE CLIENTES NO BANCO:");
  console.log("================================");
  
  if (result.rows && result.rows.length > 0) {
    for (const row of result.rows) {
      console.log(`  ${row.status}: ${row.count} clientes`);
    }
  }

  // Checando DOMINIO especificamente
  console.log("\n📋 STATUS DOMINIO (importados):");
  console.log("================================");
  
  const dominio = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM clients
    WHERE parceiro = 'DOMINIO'
    GROUP BY status
    ORDER BY count DESC
  `);

  if (dominio.rows && dominio.rows.length > 0) {
    for (const row of dominio.rows) {
      console.log(`  ${row.status}: ${row.count} clientes`);
    }
  }
}

checkStatus();
