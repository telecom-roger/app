import { drizzle } from 'drizzle-orm/neon-http';
import { clients } from './shared/schema';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

async function deleteDominio() {
  const result = await db
    .delete(clients)
    .where(eq(clients.parceiro, 'DOMINIO'))
    .returning();

  console.log(`🗑️  ${result.length} clientes DOMINIO deletados!`);
}

deleteDominio();
