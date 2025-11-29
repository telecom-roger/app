import fs from 'fs';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function importClients() {
  const data = JSON.parse(fs.readFileSync('/tmp/clients_clean.json', 'utf-8'));
  console.log(`📋 Preparando para importar ${data.length} clientes...`);
  
  const batchSize = 100;
  let imported = 0;
  let errors = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    for (const client of batch) {
      try {
        await pool.query(`
          INSERT INTO clients (
            nome, cnpj, email, celular, telefone_2, endereco, numero, cep, bairro, cidade, uf,
            tipo_cliente, nome_gestor, email_gestor, cpf_gestor, data_ultimo_pedido, carteira, parceiro, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        `, [
          client.nome,
          client.cnpj,
          client.email || null,
          client.celular || null,
          client.telefone_2 || null,
          client.endereco || null,
          client.numero || null,
          client.cep || null,
          client.bairro || null,
          client.cidade || null,
          client.uf || null,
          client.tipo_cliente || null,
          client.nome_gestor || null,
          client.email_gestor || null,
          client.cpf_gestor || null,
          client.data_ultimo_pedido || null,
          client.carteira || null,
          client.parceiro,
          client.status
        ]);
        imported++;
      } catch (err) {
        console.error(`❌ Erro ao importar ${client.nome}:`, err.message);
        errors++;
      }
    }
    
    const progress = ((i + batch.length) / data.length * 100).toFixed(1);
    console.log(`⏳ Progresso: ${progress}% (${imported} importados, ${errors} erros)`);
  }
  
  console.log(`\n✅ Importação concluída!`);
  console.log(`   - Total processados: ${data.length}`);
  console.log(`   - Importados com sucesso: ${imported}`);
  console.log(`   - Erros: ${errors}`);
  
  await pool.end();
}

importClients().catch(console.error);
