import { drizzle } from 'drizzle-orm/neon-http';
import { users, clients } from './shared/schema';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

async function assignClientsToUser() {
  // Pega o primeiro usuário (assumindo que você está logado)
  const [user] = await db.select().from(users).limit(1);
  
  if (!user) {
    console.error('❌ Nenhum usuário encontrado no banco!');
    return;
  }

  console.log(`👤 Usuário encontrado: ${user.email} (${user.id})`);

  // Atualiza todos os clientes DOMINIO para ter createdBy = user.id
  const result = await db
    .update(clients)
    .set({ createdBy: user.id })
    .where(eq(clients.parceiro, 'DOMINIO'))
    .returning();

  console.log(`✅ ${result.length} clientes DOMINIO atrelados ao usuário ${user.email}!`);
}

assignClientsToUser();
