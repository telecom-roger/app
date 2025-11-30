import { readFileSync } from 'fs';
import Papa from 'papaparse';

const dominio = readFileSync('./attached_assets/DOMINIO_PRONTO.csv', 'utf-8');

Papa.parse(dominio, {
  header: true,
  skipEmptyLines: true,
  complete: async (results: any) => {
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

    console.log(`📦 ${clients.length} registros preparados para importar`);

    try {
      const response = await fetch('http://localhost:5000/api/admin/import-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview: clients,
          parceiro: 'DOMINIO',
          duplicatas: []
        }),
        credentials: 'include'
      });

      const result = await response.json();
      console.log('✅ Import Response:', result);
    } catch (error) {
      console.error('❌ Erro:', error);
      console.log('💡 App pode não estar rodando. Arquivo pronto em: DOMINIO_PRONTO.csv');
    }
  }
});
