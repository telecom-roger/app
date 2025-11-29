import Papa from 'papaparse';
import fs from 'fs';
import { db } from './server/db';
import { clients, contacts } from './shared/schema';
import { sql } from 'drizzle-orm';

interface CSVRow {
  cnpj: string;
  'razão social': string;
  'Celular': string;
  'Estado': string;
  'quantidade de linhas': string;
  'cidade': string;
  'cep': string;
  'endereço': string;
}

async function importSingular() {
  try {
    console.log('🚀 Iniciando importação SINGULAR...');
    
    const csvPath = './attached_assets/SINGULAR_1764390449227.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const { data: rows } = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    }) as { data: CSVRow[] };
    
    console.log(`📊 Total de linhas: ${rows.length}`);
    
    // Agrupar por CNPJ
    const grouped = new Map<string, CSVRow[]>();
    for (const row of rows) {
      const cnpj = row.cnpj.trim();
      if (!grouped.has(cnpj)) {
        grouped.set(cnpj, []);
      }
      grouped.get(cnpj)!.push(row);
    }
    
    console.log(`👥 Clientes únicos: ${grouped.size}`);
    
    let clientsCreated = 0;
    let contactsCreated = 0;
    let duplicates = 0;
    let errors = 0;
    
    // Processar cada cliente
    const clientIds = new Map<string, string>();
    
    for (const [cnpj, rowsGroup] of grouped) {
      try {
        const firstRow = rowsGroup[0];
        const cepFormatado = firstRow.cep.padStart(8, '0');
        const cnpjFormatado = cnpj.padStart(14, '0');
        
        // Verificar se já existe
        const existing = await db.query.clients.findFirst({
          where: sql`cpf_cnpj = ${cnpjFormatado}`,
        });
        
        let clientId: string;
        if (existing) {
          clientId = existing.id;
          duplicates++;
        } else {
          // Inserir cliente
          await db.insert(clients).values({
            nome: firstRow['razão social'].trim(),
            razaoSocial: firstRow['razão social'].trim(),
            cpfCnpj: cnpjFormatado,
            uf: firstRow['Estado'].trim(),
            cidade: firstRow['cidade'].trim(),
            cep: cepFormatado,
            endereco: firstRow['endereço'].trim(),
            status: 'lead',
            camposCustom: {
              quantidadeLinhas: firstRow['quantidade de linhas'],
              origem: 'SINGULAR',
            },
          });
          
          const inserted = await db.query.clients.findFirst({
            where: sql`cpf_cnpj = ${cnpjFormatado}`,
          });
          clientId = inserted!.id;
          clientsCreated++;
        }
        
        clientIds.set(cnpj, clientId);
        
        // Inserir contatos
        for (let i = 0; i < rowsGroup.length; i++) {
          const row = rowsGroup[i];
          let celular = row['Celular'].replace(/\D/g, '');
          
          if (celular.length >= 10) {
            if (!celular.startsWith('55')) {
              celular = '55' + celular;
            }
            
            const existing = await db.query.contacts.findFirst({
              where: sql`client_id = ${clientId} AND valor = ${celular}`,
            });
            
            if (!existing) {
              await db.insert(contacts).values({
                clientId,
                tipo: 'telefone',
                valor: celular,
                preferencial: i === 0,
                verified: false,
              });
              contactsCreated++;
            }
          }
        }
      } catch (err) {
        console.error(`❌ Erro CNPJ ${cnpj}:`, err);
        errors++;
      }
    }
    
    console.log(`\n✅ IMPORTAÇÃO CONCLUÍDA:`);
    console.log(`   Clientes criados: ${clientsCreated}`);
    console.log(`   Clientes duplicados: ${duplicates}`);
    console.log(`   Contatos criados: ${contactsCreated}`);
    console.log(`   Erros: ${errors}`);
    
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

importSingular();
