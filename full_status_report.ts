import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

async function fullReport() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║        STATUS DOS CLIENTES - AUTOMAÇÕES DO SISTEMA          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Total de clientes
  const total = await db.execute(sql`SELECT COUNT(*) as count FROM clients`);
  console.log(`📊 TOTAL DE CLIENTES: ${total.rows?.[0]?.count} clientes`);
  console.log("");

  // Status por distribuição
  const statuses = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM clients
    GROUP BY status
    ORDER BY count DESC
  `);

  console.log("📋 DISTRIBUIÇÃO DE STATUS:");
  console.log("──────────────────────────────────────────");

  if (statuses.rows) {
    for (const row of statuses.rows) {
      const pct = ((row.count / (total.rows?.[0]?.count || 1)) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(pct as any / 2));
      console.log(`  ${row.status.padEnd(20)} │ ${bar.padEnd(50)} ${row.count} (${pct}%)`);
    }
  }

  console.log("");
  console.log("🔄 COMO OS STATUS SÃO CALCULADOS AUTOMATICAMENTE:");
  console.log("──────────────────────────────────────────");
  
  const mapping = [
    ["ativo", "✅ Cliente com oportunidade em FECHADO (venda concretizada)"],
    ["lead_quente", "🔥 Sem oportunidades criadas ainda (novo lead)"],
    ["engajado", "💬 Oportunidade em CONTATO ou AUTOMÁTICA (conversando)"],
    ["em_negociacao", "💼 Oportunidade em PROPOSTA ou PROPOSTA ENVIADA"],
    ["em_fechamento", "🤝 Oportunidade em AGUARDANDO CONTRATO/ACEITE/etc"],
    ["perdido", "❌ Todas as oportunidades em PERDIDO (sem interesse)"],
    ["", ""],
    ["DOMINIO", "📦 Clientes importados (todos com status 'ativo' inicialmente)"],
  ];

  for (const [status, desc] of mapping) {
    if (status === "") {
      console.log("");
    } else {
      console.log(`  ${desc}`);
    }
  }

  console.log("");
  console.log("⚙️  LÓGICA DE AUTOMAÇÃO:");
  console.log("──────────────────────────────────────────");
  console.log(`  • Status é RECALCULADO automaticamente quando:");
  console.log(`    - Uma oportunidade é criada`);
  console.log(`    - Uma oportunidade muda de etapa (manual ou IA)`);
  console.log(`    - Uma oportunidade é deletada`);
  console.log(`  • IA analisa mensagens e move oportunidades`);
  console.log(`  • Jobs agendados enviam lembretes para PROPOSTA ENVIADA`);
  console.log("");

  // Detalhes DOMINIO
  console.log("📦 SITUAÇÃO DOMINIO (Importados):");
  console.log("──────────────────────────────────────────");
  const dominio = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM clients
    WHERE parceiro = 'DOMINIO'
    GROUP BY status
  `);

  if (dominio.rows) {
    for (const row of dominio.rows) {
      console.log(`  ${row.status}: ${row.count} clientes`);
    }
  }
  
  console.log("");
}

fullReport();
