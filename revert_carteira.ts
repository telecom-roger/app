import { drizzle } from 'drizzle-orm/neon-http';
import { clients } from './shared/schema';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

async function revert() {
  const result = await db
    .update(clients)
    .set({ carteira: 'DOMINIO' })
    .where(eq(clients.parceiro, 'DOMINIO'))
    .returning();

  console.log(`✅ Revertido! ${result.length} clientes com carteira = DOMINIO!`);
}

revert();
