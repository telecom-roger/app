import { readFileSync } from 'fs';
import Papa from 'papaparse';
import { drizzle } from 'drizzle-orm/neon-http';
import { clients } from './shared/schema';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

const dominio = readFileSync('./attached_assets/DOMINIO_PRONTO.csv', 'utf-8');

Papa.parse(dominio, {
  header: true,
  skipEmptyLines: true,
  complete: async (results: any) => {
    let updated = 0;

    for (const row of results.data) {
      if (!row.Nome?.trim()) continue;

      const tel1 = row['Telefone 1']?.trim() || null;
      const tel2 = row['Telefone 2']?.trim() || null;

      // Busca cliente por CNPJ ou nome
      const [existing] = await db
        .select()
        .from(clients)
        .where(eq(clients.cnpj, row.CNPJ))
        .limit(1);

      if (existing) {
        await db
          .update(clients)
          .set({
            celular: tel1,
            telefone2: tel2,
          })
          .where(eq(clients.id, existing.id));

        updated++;
        if (updated % 100 === 0) console.log(`📱 ${updated} clientes atualizados...`);
      }
    }

    console.log(`\n✅ ${updated} clientes DOMINIO com telefones separados!`);
    console.log(`   ✓ celular = TELEFONE1`);
    console.log(`   ✓ telefone2 = TELEFONE2`);
  }
});
