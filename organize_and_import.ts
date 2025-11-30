import { readFileSync, writeFileSync } from 'fs';
import Papa from 'papaparse';
import { fetch } from 'node-fetch';

const dominio = readFileSync('./attached_assets/DOMINIO - Página1_1764539978645.csv', 'utf-8');

Papa.parse(dominio, {
  header: true,
  skipEmptyLines: true,
  complete: async (results: any) => {
    const organized = results.data
      .filter((row: any) => row['RAZÃO SOCIAL']?.trim())
      .map((row: any) => {
        const tel1 = row['Telefone 1']?.trim() || '';
        const tel2 = row['Telefone 2']?.trim() || '';
        const celularCombinado = [tel1, tel2].filter(t => t).join(' / ');
        
        return {
          'Nome': row['RAZÃO SOCIAL']?.trim() || '',
          'CNPJ': row['cnpj']?.trim() || '',
          'Email': row['E-mail do Gestor']?.trim() || '',
          'Celular': celularCombinado || '',
          'Status': 'ativo',
          'Cidade': row['Cidade']?.trim() || '',
          'UF': row['Estado']?.trim() || '',
          'Contato Principal': row['Nome do Gestor']?.trim() || '',
          'Nome Gestor': row['Nome do Gestor']?.trim() || '',
          'Email Gestor': row['E-mail do Gestor']?.trim() || '',
          'CPF Gestor': row['CPF do Gestor']?.trim() || '',
          'Endereço': row['Endereço']?.trim() || '',
          'Número': row['Número']?.trim() || '',
          'Bairro': row['Bairro']?.trim() || '',
          'CEP': row['CEP']?.trim() || '',
          'Data de Criação': row['Data do último pedido']?.trim() || '',
          'Tags': '',
          'Parceiro': 'DOMINIO'
        };
      });

    const csv = Papa.unparse(organized);
    writeFileSync('./attached_assets/DOMINIO_PRONTO.csv', csv);
    console.log(`✅ ${organized.length} registros organizados!`);
    console.log('📁 Arquivo: DOMINIO_PRONTO.csv');
    console.log('🚀 Importando no banco...');

    // Prepare import payload
    const payload = {
      clients: organized
    };

    try {
      const response = await fetch('http://localhost:5000/api/admin/import-clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log('📊 Resultado:', data);
    } catch (err) {
      console.error('❌ Erro ao importar:', err);
    }
  }
});
