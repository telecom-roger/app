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
      .map((row: any) => {
        // Sanitize fields
        const sanitize = (val: any, maxLen: number) => {
          if (!val) return null;
          return String(val).substring(0, maxLen).trim() || null;
        };

        // Separa telefone1 e telefone2 de "tel1 / tel2"
        const celularCombinado = row.Celular?.trim() || '';
        const parts = celularCombinado.split(' / ');
        const tel1 = parts[0]?.trim() || null;
        const tel2 = parts[1]?.trim() || null;

        const cpf = String(row['CPF Gestor'] || '').replace(/\D/g, '').substring(0, 11) || null;

        return {
          nome: sanitize(row.Nome, 500),
          cnpj: sanitize(row.CNPJ, 14),
          email: sanitize(row.Email, 255),
          celular: tel1,
          telefone2: tel2,
          status: sanitize(row.Status || 'ativo', 50),
          tipoCliente: sanitize(row['Tipo Cliente'], 100),
          carteira: 'DOMINIO',
          cidade: sanitize(row.Cidade, 100),
          uf: sanitize(row.UF, 2),
          nomeGestor: sanitize(row['Nome Gestor'], 255),
          emailGestor: sanitize(row['Email Gestor'], 255),
          cpfGestor: cpf,
          endereco: sanitize(row.Endereço, 500),
          numero: sanitize(row.Número, 20),
          bairro: sanitize(row.Bairro, 100),
          cep: sanitize(row.CEP, 8),
          dataUltimoPedido: sanitize(row['Data de Criação'], 20),
          parceiro: 'DOMINIO',
        };
      });

    const chunkSize = 100;
    let totalInserted = 0;

    console.log(`📦 Importando ${allClients.length} clientes com telefones separados...`);

    for (let i = 0; i < allClients.length; i += chunkSize) {
      const chunk = allClients.slice(i, i + chunkSize);
      try {
        const inserted = await db.insert(clients).values(chunk).returning();
        totalInserted += inserted.length;
        console.log(`✅ ${inserted.length} clientes (total: ${totalInserted}/${allClients.length})`);
      } catch (error: any) {
        console.error(`❌ Erro:`, error.message);
        break;
      }
    }

    console.log(`\n✅ ${totalInserted}/${allClients.length} clientes reimportados!`);
    console.log(`   ✓ celular = TELEFONE1`);
    console.log(`   ✓ telefone_2 = TELEFONE2`);
  }
});
