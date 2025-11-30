import { readFileSync } from 'fs';
import Papa from 'papaparse';
import { drizzle } from 'drizzle-orm/neon-http';
import { clients } from './shared/schema';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

const dominio = readFileSync('./attached_assets/DOMINIO_PRONTO.csv', 'utf-8');

Papa.parse(dominio, {
  header: true,
  skipEmptyLines: true,
  complete: async (results: any) => {
    const clientsToInsert = results.data
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

    console.log(`📦 Importando ${clientsToInsert.length} clientes DOMINIO...`);

    try {
      const inserted = await db.insert(clients).values(clientsToInsert).returning();
      console.log(`✅ ${inserted.length} clientes inseridos com sucesso!`);
      console.log('🎉 DOMINIO importado para o banco!');
    } catch (error: any) {
      console.error('❌ Erro ao importar:', error.message);
    }
  }
});
