import { readFileSync, writeFileSync } from 'fs';
import Papa from 'papaparse';

const dominio = readFileSync('./attached_assets/DOMINIO_1764539237867.csv', 'utf-8');

Papa.parse(dominio, {
  header: true,
  skipEmptyLines: true,
  complete: (results: any) => {
    const organized = results.data
      .filter((row: any) => row['RAZÃO SOCIAL']?.trim())
      .map((row: any) => ({
        'Nome': row['RAZÃO SOCIAL']?.trim() || '',
        'CNPJ': row['CNPJ/CPF do grupo econômico']?.trim() || '',
        'Email': row['E-mail do Gestor']?.trim() || '',
        'Celular': row['Telefone 1']?.trim() || '',
        'Status': 'ativo',
        'Tipo Cliente': row['Tipo de cliente']?.trim() || '',
        'Carteira': row['Carteira']?.trim() || '',
        'Cidade': row['Cidade']?.trim() || '',
        'UF': row['Estado']?.trim() || '',
        'Data de Criação': row['Data do último pedido']?.trim() || '',
        'Tags': '',
        'Parceiro': 'DOMINIO'
      }));

    const csv = Papa.unparse(organized);
    writeFileSync('./attached_assets/DOMINIO_ORGANIZADO.csv', csv);
    console.log(`✅ ${organized.length} registros organizados!`);
  }
});
