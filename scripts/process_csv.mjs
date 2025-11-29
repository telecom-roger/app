import fs from 'fs';
import Papa from 'papaparse';

function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

function cleanCnpj(cnpj) {
    if (!cnpj) return '';
    const clean = String(cnpj).replace(/\D/g, '');
    return clean.padStart(14, '0');
}

function cleanCep(cep) {
    if (!cep) return '';
    const clean = String(cep).replace(/\D/g, '');
    return clean.padStart(8, '0');
}

function cleanCpf(cpf) {
    if (!cpf) return '';
    const clean = String(cpf).replace(/\D/g, '');
    return clean ? clean.padStart(11, '0') : '';
}

function processFile(filepath, parceiro) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const result = Papa.parse(content, { header: true, skipEmptyLines: true });
    
    const clients = [];
    for (const row of result.data) {
        const cnpj = row['CNPJ'] || '';
        
        // Skip se CNPJ inválido (vazio ou termina em 00000)
        if (!cnpj || String(cnpj).endsWith('00000')) continue;
        
        const cnpjClean = cleanCnpj(cnpj);
        if (!cnpjClean || cnpjClean === '00000000000000') continue;
        
        const nome = (row['Razão Social'] || '').trim();
        if (!nome) continue;
        
        clients.push({
            nome,
            cnpj: cnpjClean,
            email: (row['E-mail do Gestor'] || '').trim(),
            celular: cleanPhone(row['Telefone 1']),
            telefone_2: cleanPhone(row['Telefone 2']),
            endereco: (row['Endereço'] || '').trim(),
            numero: (row['Número'] || '').trim(),
            cep: cleanCep(row['CEP']),
            bairro: (row['Bairro'] || '').trim(),
            cidade: (row['Cidade'] || '').trim(),
            uf: (row['Estado'] || '').trim(),
            tipo_cliente: (row['Tipo de cliente'] || '').trim(),
            nome_gestor: (row['Nome do Gestor'] || '').trim(),
            email_gestor: (row['E-mail do Gestor'] || '').trim(),
            cpf_gestor: cleanCpf(row['CPF do Gestor']),
            data_ultimo_pedido: (row['Data do último pedido'] || '').trim(),
            carteira: (row['Carteira'] || '').trim(),
            parceiro,
            status: 'lead'
        });
    }
    return clients;
}

console.log("Processando MIRAI...");
const mirai = processFile('attached_assets/MIRAI_1764397117400.csv', 'MIRAI');
console.log(`  MIRAI: ${mirai.length} clientes válidos`);

console.log("Processando 3M...");
const m3m = processFile('attached_assets/3M_1764397117405.csv', '3M');
console.log(`  3M: ${m3m.length} clientes válidos`);

const allClients = [...mirai, ...m3m];
console.log(`Total combinado: ${allClients.length}`);

// Remover duplicatas por CNPJ
const seenCnpj = new Set();
const unique = [];
let duplicates = 0;
for (const c of allClients) {
    if (!seenCnpj.has(c.cnpj)) {
        seenCnpj.add(c.cnpj);
        unique.push(c);
    } else {
        duplicates++;
    }
}

console.log(`Duplicatas removidas: ${duplicates}`);
console.log(`Clientes únicos: ${unique.length}`);

fs.writeFileSync('/tmp/clients_clean.json', JSON.stringify(unique, null, 2));
console.log("✅ Salvo em /tmp/clients_clean.json");

console.log("\n📋 Amostra (primeiros 3):");
unique.slice(0, 3).forEach(c => {
    console.log(`  - ${c.nome.substring(0, 40)} | CNPJ: ${c.cnpj} | ${c.parceiro}`);
});
