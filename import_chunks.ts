import { readFileSync } from 'fs';
import Papa from 'papaparse';
import { drizzle } from 'drizzle-orm/neon-http';
import { clients } from './shared/schema';

const db = drizzle(process.env.DATABASE_URL!);

const dominio = readFileSync('./attached_assets/DOMINIO_PRONTO.csv', 'utf-8');

Papa.parse(dominio, {
  header: true,
  skipEmptyLines: true,
  complete: async (results: any) => {
    const allClients = results.data
      .filter((row: any) => row.Nome?.trim())
      .map((row: any) => ({
        nome: row.Nome,
        cnpj: row.CNPJ || null,
        email: row.Email || null,
        celular: row.Celular || null,
        status: row.Status || 'ativo',
        tipoCliente: row['Tipo Cliente'] || null,
        carteira: row.Carteira || null,
        cidade: row.Cidade || null,
        uf: row.UF || null,
        nomeGestor: row['Nome Gestor'] || null,
        emailGestor: row['Email Gestor'] || null,
        cpfGestor: row['CPF Gestor'] || null,
        endereco: row.Endereço || null,
        numero: row.Número || null,
        bairro: row.Bairro || null,
        cep: row.CEP || null,
        createdAt: new Date(),
        parceiro: row.Parceiro || 'DOMINIO',
      }));

    const chunkSize = 100;
    let totalInserted = 0;

    console.log(`📦 Importando ${allClients.length} clientes em chunks de ${chunkSize}...`);

    for (let i = 0; i < allClients.length; i += chunkSize) {
      const chunk = allClients.slice(i, i + chunkSize);
      try {
        const inserted = await db.insert(clients).values(chunk).returning();
        totalInserted += inserted.length;
        console.log(`✅ Chunk ${Math.floor(i / chunkSize) + 1}: ${inserted.length} clientes inseridos (total: ${totalInserted})`);
      } catch (error: any) {
        console.error(`❌ Erro no chunk ${Math.floor(i / chunkSize) + 1}:`, error.message);
        break;
      }
    }

    console.log(`\n🎉 DOMINIO importado! ${totalInserted}/${allClients.length} clientes no banco!`);
  }
});
