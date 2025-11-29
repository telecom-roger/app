import fs from 'fs';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getExistingCnpjs() {
  const result = await pool.query('SELECT cnpj FROM clients WHERE cnpj IS NOT NULL');
  return new Set(result.rows.map(r => r.cnpj));
}

async function importRemaining() {
  const data = JSON.parse(fs.readFileSync('/tmp/clients_clean.json', 'utf-8'));
  
  console.log(`📋 Total de clientes no arquivo: ${data.length}`);
  
  const existingCnpjs = await getExistingCnpjs();
  console.log(`✅ Já importados: ${existingCnpjs.size}`);
  
  const toImport = data.filter(c => !existingCnpjs.has(c.cnpj));
  console.log(`📝 Restantes para importar: ${toImport.length}`);
  
  if (toImport.length === 0) {
    console.log('✅ Todos os clientes já foram importados!');
    await pool.end();
    return;
  }
  
  const batchSize = 500;
  let imported = 0;
  let errors = 0;
  
  for (let i = 0; i < toImport.length; i += batchSize) {
    const batch = toImport.slice(i, i + batchSize);
    
    const values = [];
    const params = [];
    let paramIndex = 1;
    
    for (const client of batch) {
      const row = [
        client.nome?.substring(0, 255) || '',
        client.cnpj?.substring(0, 14) || null,
        client.email?.substring(0, 255) || null,
        client.celular?.substring(0, 20) || null,
        client.telefone_2?.substring(0, 20) || null,
        client.endereco || null,
        client.numero?.substring(0, 20) || null,
        client.cep?.substring(0, 8) || null,
        client.bairro?.substring(0, 100) || null,
        client.cidade?.substring(0, 100) || null,
        client.uf?.substring(0, 2) || null,
        client.tipo_cliente?.substring(0, 100) || null,
        client.nome_gestor?.substring(0, 255) || null,
        client.email_gestor?.substring(0, 255) || null,
        client.cpf_gestor?.substring(0, 11) || null,
        client.data_ultimo_pedido?.substring(0, 20) || null,
        client.carteira?.substring(0, 100) || null,
        client.parceiro?.substring(0, 50) || null,
        client.status?.substring(0, 50) || 'lead'
      ];
      
      const placeholders = row.map(() => `$${paramIndex++}`).join(', ');
      values.push(`(${placeholders})`);
      params.push(...row);
    }
    
    try {
      await pool.query(`
        INSERT INTO clients (
          nome, cnpj, email, celular, telefone_2, endereco, numero, cep, bairro, cidade, uf,
          tipo_cliente, nome_gestor, email_gestor, cpf_gestor, data_ultimo_pedido, carteira, parceiro, status
        ) VALUES ${values.join(', ')}
      `, params);
      imported += batch.length;
    } catch (err) {
      console.error(`❌ Erro no batch:`, err.message);
      errors += batch.length;
    }
    
    const progress = ((i + batch.length) / toImport.length * 100).toFixed(1);
    console.log(`⏳ ${progress}% (${imported}/${toImport.length})`);
  }
  
  console.log(`\n✅ Importação concluída! ${imported} clientes importados, ${errors} erros`);
  
  const finalCount = await pool.query('SELECT COUNT(*) as total FROM clients');
  console.log(`📊 Total no banco: ${finalCount.rows[0].total}`);
  
  await pool.end();
}

importRemaining().catch(console.error);
