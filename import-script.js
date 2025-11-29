const Papa = require('papaparse');
const fs = require('fs');

async function importData() {
  const csv = fs.readFileSync('./attached_assets/SINGULAR_1764390449227.csv', 'utf-8');
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  
  const grouped = new Map();
  data.forEach(row => {
    const cnpj = row.cnpj.trim();
    if (!grouped.has(cnpj)) grouped.set(cnpj, []);
    grouped.get(cnpj).push(row);
  });
  
  console.log(`📊 Clientes: ${grouped.size}, Registros: ${data.length}`);
  
  let clientData = [];
  for (const [cnpj, rows] of grouped) {
    const first = rows[0];
    const contacts = rows.map((r, i) => ({
      celular: r.Celular.replace(/\D/g, ''),
      preferencial: i === 0
    })).filter(c => c.celular.length >= 10);
    
    clientData.push({
      cnpj: cnpj.padStart(14, '0'),
      nome: first['razão social'].trim(),
      uf: first.Estado.trim(),
      cidade: first.cidade.trim(),
      cep: first.cep.padStart(8, '0'),
      endereco: first.endereço.trim(),
      contatos: contacts,
      quantidadeLinhas: first['quantidade de linhas']
    });
  }
  
  // Enviar via POST
  const resp = await fetch('http://localhost:5000/api/import-singular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientes: clientData })
  });
  
  const result = await resp.json();
  console.log(result);
}

importData().catch(console.error);
