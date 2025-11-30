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
        'ID': '',
        'Nome': row['RAZÃO SOCIAL']?.trim() || '',
        'CNPJ': row['CNPJ/CPF do grupo econômico']?.trim() || '',
        'Email': row['E-mail do Gestor']?.trim() || '',
        'Celular': row['Telefone 1']?.trim() || '',
        'Telefone 2': row['Telefone 2']?.trim() || '',
        'Segmento': '',
        'Status': 'ativo',
        'Tipo Cliente': row['Tipo de cliente']?.trim() || '',
        'Carteira': row['Carteira']?.trim() || '',
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
        'Data do último pedido': row['Data do último pedido']?.trim() || '',
        'Observações': '',
        'Data de Criação': row['Data do último pedido']?.trim() || '',
        'Tags': '',
        'Parceiro': 'DOMINIO'
      }));

    const csv = Papa.unparse(organized);
    writeFileSync('./attached_assets/DOMINIO_ORGANIZADO.csv', csv);
    console.log(`✅ ${organized.length} registros com TODOS os campos!`);
    console.log('Campos: Nome, CNPJ, Email, Celular, Telefone 2, Status, Tipo Cliente, Carteira, Cidade, UF, Nome Gestor, Email Gestor, CPF Gestor, Endereço, Número, Bairro, CEP, Parceiro');
  }
});
