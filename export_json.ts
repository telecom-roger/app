import { readFileSync, writeFileSync } from 'fs';
import Papa from 'papaparse';

const dominio = readFileSync('./attached_assets/DOMINIO_PRONTO.csv', 'utf-8');

Papa.parse(dominio, {
  header: true,
  skipEmptyLines: true,
  complete: (results: any) => {
    const clients = results.data
      .filter((row: any) => row.Nome?.trim())
      .map((row: any) => ({
        nome: row.Nome,
        cnpj: row.CNPJ,
        email: row.Email,
        celular: row.Celular,
        status: row.Status,
        tipoCliente: row['Tipo Cliente'],
        carteira: row.Carteira,
        cidade: row.Cidade,
        uf: row.UF,
        nomeGestor: row['Nome Gestor'],
        emailGestor: row['Email Gestor'],
        cpfGestor: row['CPF Gestor'],
        endereco: row.Endereço,
        numero: row.Número,
        bairro: row.Bairro,
        cep: row.CEP,
        dataUltimoPedido: row['Data de Criação'],
      }));

    writeFileSync('./DOMINIO_IMPORT.json', JSON.stringify(clients, null, 2));
    console.log(`✅ ${clients.length} registros em JSON`);
    console.log('📁 Arquivo: DOMINIO_IMPORT.json');
  }
});
