import { readFileSync } from 'fs';
import Papa from 'papaparse';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';

const db = drizzle(process.env.DATABASE_URL!);

const dominio = readFileSync('./attached_assets/DOMINIO_PRONTO.csv', 'utf-8');

Papa.parse(dominio, {
  header: true,
  skipEmptyLines: true,
  complete: async (results: any) => {
    const updates: Array<{ cnpj: string; tel1: string | null; tel2: string | null }> = [];

    for (const row of results.data) {
      if (!row.CNPJ?.trim()) continue;
      
      const celularCombinado = row.Celular?.trim();
      let tel1 = null;
      let tel2 = null;

      if (celularCombinado) {
        const parts = celularCombinado.split(' / ');
        tel1 = parts[0]?.trim() || null;
        tel2 = parts[1]?.trim() || null;
      }

      updates.push({
        cnpj: row.CNPJ.trim(),
        tel1,
        tel2,
      });
    }

    console.log(`📱 Atualizando ${updates.length} clientes...`);
    let count = 0;

    for (const upd of updates) {
      await db.execute(sql`
        UPDATE clients 
        SET celular = ${upd.tel1}, telefone_2 = ${upd.tel2}
        WHERE cnpj = ${upd.cnpj}
      `);
      count++;
      if (count % 500 === 0) console.log(`  ${count}/${updates.length}`);
    }

    console.log(`✅ ${count} clientes com telefones separados!`);
    console.log(`   ✓ celular = TELEFONE1`);
    console.log(`   ✓ telefone_2 = TELEFONE2`);
  }
});
