import { drizzle } from 'drizzle-orm/neon-http';
import { clients } from './shared/schema';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

async function setCarteiraToMirai() {
  const result = await db
    .update(clients)
    .set({ carteira: 'MIRAI' })
    .where(eq(clients.parceiro, 'DOMINIO'))
    .returning();

  console.log(`✅ ${result.length} clientes DOMINIO atualizado com carteira = MIRAI!`);
}

setCarteiraToMirai();
