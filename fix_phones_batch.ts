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
    const updates = results.data
      .filter((row: any) => row.Nome?.trim() && row.CNPJ?.trim())
      .map((row: any) => ({
        cnpj: row.CNPJ?.trim(),
        tel1: row['Telefone 1']?.trim() || null,
        tel2: row['Telefone 2']?.trim() || null,
      }));

    console.log(`📱 Processando ${updates.length} clientes...`);

    let updated = 0;
    const chunkSize = 50;

    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      
      for (const update of chunk) {
        try {
          const result = await db
            .update(clients)
            .set({ celular: update.tel1, telefone2: update.tel2 })
            .where(eq(clients.cnpj, update.cnpj));
          updated++;
        } catch (e) {}
      }
      console.log(`✅ ${Math.min(updated, i + chunkSize)}/${updates.length}`);
    }

    console.log(`\n✅ ${updated} clientes com telefones separados!`);
  }
});
