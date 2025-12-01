import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { clients } from '../shared/schema';

const db = drizzle(process.env.DATABASE_URL!);

async function recalculateClientStatus(clientId: string): Promise<string> {
  // Buscar todas as oportunidades do cliente
  const clientOpportunities = await db.execute(
    sql`SELECT etapa FROM opportunities WHERE client_id = ${clientId}`
  );

  const opps = clientOpportunities.rows || [];
  
  if (opps.length === 0) {
    return "base_frio"; // No opportunities
  }

  // Check for FECHADO opportunities
  const hasFechado = opps.some((o: any) => o.etapa === "FECHADO");
  if (hasFechado) {
    return "ativo"; // Has closed deal
  }

  // Check for PERDIDO opportunities
  const hasPerdido = opps.some((o: any) => o.etapa === "PERDIDO");
  
  // Check for active opportunities (not FECHADO or PERDIDO)
  const activeOpps = opps.filter((o: any) => o.etapa !== "FECHADO" && o.etapa !== "PERDIDO");
  
  if (activeOpps.length === 0 && hasPerdido) {
    return "perdido"; // All opportunities are PERDIDO
  }

  // If has both lost history and active opportunities, it's remarketing
  if (hasPerdido && activeOpps.length > 0) {
    return "remarketing";
  }

  // Categorize by active opportunity stages
  const stages = activeOpps.map((o: any) => o.etapa);
  
  if (stages.some((s: string) => s === "CONTATO" || s === "AUTOMÁTICA")) {
    return "engajado";
  }
  
  if (stages.some((s: string) => s === "PROPOSTA" || s === "PROPOSTA ENVIADA")) {
    return "em_negociacao";
  }
  
  if (stages.some((s: string) => s === "AGUARDANDO CONTRATO" || s === "CONTRATO ENVIADO" || s === "AGUARDANDO ACEITE" || s === "AGUARDANDO ATENÇÃO")) {
    return "em_fechamento";
  }

  // Default: has opportunities but none categorized
  return "lead_quente";
}

async function fixClientStatus() {
  console.log("🔍 Buscando clientes com status 'ativo' para verificar...\n");

  // Buscar todos os clientes com status 'ativo'
  const ativos = await db.execute(
    sql`SELECT id, nome FROM clients WHERE status = 'ativo' ORDER BY nome`
  );

  const ativosClientes = ativos.rows || [];
  console.log(`📊 Total de clientes com status 'ativo': ${ativosClientes.length}\n`);

  let updated = 0;
  let skipped = 0;

  for (const cliente of ativosClientes) {
    const calculatedStatus = await recalculateClientStatus(cliente.id);

    if (calculatedStatus !== 'ativo') {
      // Update client status
      await db.execute(
        sql`UPDATE clients SET status = ${calculatedStatus} WHERE id = ${cliente.id}`
      );
      updated++;
      console.log(`✅ ${cliente.nome}: 'ativo' → '${calculatedStatus}'`);
    } else {
      skipped++;
      console.log(`⏭️  ${cliente.nome}: mantém 'ativo' (tem oportunidade FECHADO recente)`);
    }
  }

  console.log(`\n📈 RESUMO:\n   Atualizados: ${updated}\n   Mantidos: ${skipped}\n   Total: ${ativosClientes.length}`);
}

fixClientStatus()
  .then(() => {
    console.log("\n✅ Script finalizado com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
