import Papa from 'papaparse';
import fs from 'fs';
import fetch from 'node-fetch';

const csv = fs.readFileSync('./attached_assets/SINGULAR_1764390449227.csv', 'utf-8');
const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

const grouped = new Map();
data.forEach(row => {
  const cnpj = row.cnpj.trim();
  if (!grouped.has(cnpj)) grouped.set(cnpj, []);
  grouped.get(cnpj).push(row);
});

let clientes = [];
for (const [cnpj, rows] of grouped) {
  const first = rows[0];
  const contatos = rows.map((r, i) => {
    let cel = r.Celular.replace(/\D/g, '');
    if (!cel.startsWith('55')) cel = '55' + cel;
    return { celular: cel, preferencial: i === 0 };
  }).filter(c => c.celular.length >= 12);
  
  clientes.push({
    cpfCnpj: cnpj.padStart(14, '0'),
    nome: first['razão social'].trim(),
    uf: first.Estado.trim(),
    cidade: first.cidade.trim(),
    cep: first.cep.padStart(8, '0'),
    endereco: first.endereço.trim(),
    contatos,
    quantidadeLinhas: parseInt(first['quantidade de linhas']) || 0
  });
}

console.log(`📊 ${clientes.length} clientes únicos`);

// Enviar em chunks para /api/import-singular
let totalAdicionados = 0;
let totalContatos = 0;

for (let i = 0; i < clientes.length; i += 100) {
  const chunk = clientes.slice(i, i + 100);
  
  try {
    const res = await fetch('http://localhost:5000/api/import-singular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientes: chunk })
    });
    const result = await res.json();
    if (result.clientesAdicionados) {
      totalAdicionados += result.clientesAdicionados;
      totalContatos += result.contatosAdicionados;
    }
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

console.log(`✅ Importados: ${totalAdicionados} clientes, ${totalContatos} contatos`);
