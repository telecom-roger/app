import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { z } from "zod";
import { eq, and, or, ilike, desc, sql, lte, inArray, isNull, gte, between } from "drizzle-orm";
import cron from "node-cron";
import { insertClientSchema, insertOpportunitySchema, insertCampaignSchema, insertTemplateSchema, insertClientSharingSchema, whatsappSessions, clients, interactions, conversations, messages, campaigns as campaignsTable, templates as templatesTable, tags, clientSharing, notifications, users, campaignSendings, campaignGroups, opportunities, automationTasks, automationConfigs } from "@shared/schema";
import * as storage from "./storage";
import * as whatsappService from "./whatsappService";
import { setupAuth, isAuthenticated } from "./localAuth";
import { db } from "./db";
import { simulateClientResponse, getAllAutomationTasks, getAllFollowUps, getAllClientScores, createTestFollowUps, createTestKanbanMovement, processBatchResponses } from "./testAutomation";
import { checkPropostaEnviadaTimeouts } from "./automationService";
import { analyzeClientMessage, validateOpportunityCreation } from "./aiService";

// ======================== CONSTANTES DE ETAPAS (AUTOMAÇÃO) ========================
// 🔥 REGRAS CRÍTICAS DE MOVIMENTO DA IA:
// LEAD → Pode ir para: CONTATO, PROPOSTA, AUTOMÁTICA, PERDIDO
// CONTATO → Pode ir para: PROPOSTA ou PERDIDO
// PROPOSTA → BLOQUEADO (IA não mexe)
// PROPOSTA ENVIADA, AGUARDANDO CONTRATO, CONTRATO ENVIADO, AGUARDANDO ACEITE, AGUARDANDO ATENÇÃO, FECHADO → BLOQUEADO
// PERDIDO → Pode voltar para: CONTATO, PROPOSTA (se cliente enviar interesse)
// AUTOMÁTICA → Pode voltar para: CONTATO, PROPOSTA (se cliente enviar interesse)

const ETAPAS_MANUAIS_BLOQUEADAS = [
  "PROPOSTA", 
  "PROPOSTA ENVIADA", 
  "AGUARDANDO CONTRATO", 
  "CONTRATO ENVIADO", 
  "AGUARDANDO ACEITE",
  "AGUARDANDO ATENÇÃO",
  "FECHADO"
];
const TODAS_ETAPAS = ["LEAD", "CONTATO", "PROPOSTA", "AUTOMÁTICA", "PERDIDO", "PROPOSTA ENVIADA", "AGUARDANDO CONTRATO", "CONTRATO ENVIADO", "AGUARDANDO ACEITE", "AGUARDANDO ATENÇÃO", "FECHADO"];

// ✅ WEBSOCKET CLIENTS - Broadcast quando mensagens chegam (cron jobs)
export let wsClients = new Set<any>();

// Track campaigns in progress
export const campanhasEmProgresso = new Map<string, {
  id: string;
  userId: string;
  total: number;
  enviadas: number;
  erros: number;
  status: "em_progresso" | "concluida" | "cancelada";
  criadoEm: Date;
  parar: boolean;
}>();

// Environment check
const isDev = process.env.REPLIT_DEPLOYMENT !== "1";

// Admin middleware
function requireAdmin(req: Request, res: Response, next: Function) {
  const user = (req.user as any);
  if (!user || !user.dbUser || user.dbUser.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// Test endpoints only in dev
function onlyInDev(req: Request, res: Response, next: Function) {
  if (!isDev) {
    return res.status(404).json({ error: "Not found" });
  }
  next();
}

export async function registerRoutes(app: Express, server: Server): Promise<void> {
  // ⚠️ NO setupAuth() here - moved to runApp() after server.listen()
  // This prevents blocking the server startup for health checks

  // Block all test endpoints in production
  if (!isDev) {
    app.use("/api/test/", (req: Request, res: Response) => {
      res.status(404).json({ error: "Not found" });
    });
  }

  // ==================== BOOTSTRAP: RELOAD WHATSAPP SESSIONS ====================
  // MOVED TO BACKGROUND - Called after server starts listening
  // See bootstrapWhatsAppSessions() function below

  // ==================== SCHEDULER: CAMPANHAS AGENDADAS ====================
  // MOVED TO BACKGROUND - Initialized with delay to avoid blocking health checks
  // See startCampaignScheduler() function below

  // ==================== AUTH ROUTES ====================
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    res.json(req.user);
  });

  // ==================== CLIENT ROUTES ====================
  app.get("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { search, status, tagName, tipo, carteira, page = "1", limit = "10000" } = req.query;
      // Adicionar userId para filtrar apenas clientes do usuário
      const result = await storage.getClients({
        userId: user.id,
        search: search as string,
        status: status as string,
        tagName: tagName as string,
        tipo: tipo as string,
        carteira: carteira as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        isAdmin: user.role === 'admin',
      });
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para listar todos os tipos únicos
  app.get("/api/clients/tipos", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const whereCondition = user.role === 'admin' ? undefined : or(
        eq(clients.createdBy, user.id),
        sql`${clients.id} IN (SELECT ${clientSharing.clientId} FROM ${clientSharing} WHERE ${clientSharing.sharedWithUserId} = ${user.id})`
      );
      
      const tiposResult = await db
        .selectDistinct({ tipo: clients.tipoCliente })
        .from(clients)
        .where(whereCondition);
      
      const tipos = tiposResult
        .map(r => r.tipo)
        .filter((t): t is string => t !== null && t !== undefined && t !== '')
        .sort();
      
      res.json(tipos);
    } catch (error: any) {
      console.error("Error fetching tipos:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para listar todas as carteiras únicas
  app.get("/api/clients/carteiras", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const whereCondition = user.role === 'admin' ? undefined : or(
        eq(clients.createdBy, user.id),
        sql`${clients.id} IN (SELECT ${clientSharing.clientId} FROM ${clientSharing} WHERE ${clientSharing.sharedWithUserId} = ${user.id})`
      );
      
      const carteirasResult = await db
        .selectDistinct({ carteira: clients.carteira })
        .from(clients)
        .where(whereCondition);
      
      const carteiras = carteirasResult
        .map(r => r.carteira)
        .filter((c): c is string => c !== null && c !== undefined && c !== '')
        .sort();
      
      res.json(carteiras);
    } catch (error: any) {
      console.error("Error fetching carteiras:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para listar todas as cidades únicas
  app.get("/api/clients/cidades", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const whereCondition = user.role === 'admin' ? undefined : or(
        eq(clients.createdBy, user.id),
        sql`${clients.id} IN (SELECT ${clientSharing.clientId} FROM ${clientSharing} WHERE ${clientSharing.sharedWithUserId} = ${user.id})`
      );
      
      const cidadesResult = await db
        .selectDistinct({ cidade: clients.cidade })
        .from(clients)
        .where(whereCondition);
      
      const cidades = cidadesResult
        .map(r => r.cidade)
        .filter((c): c is string => c !== null && c !== undefined && c !== '')
        .sort();
      
      res.json(cidades);
    } catch (error: any) {
      console.error("Error fetching cidades:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para listar clientes com WhatsApp (MUST be before :id route)
  // ✅ OTIMIZADO: Paginação + Filtros server-side
  app.get("/api/clients/whatsapp-list", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { 
        tipos, carteiras, cidades, 
        search, status, sendStatus: sendStatusFilter, campaignId,
        engajamento: engajamentoFilter, etiqueta: etiquetaFilter,
        page = "1", limit = "50" 
      } = req.query;
      
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(99999, Math.max(10, parseInt(limit as string) || 50)); // ✅ Permitir até 99999 para "Todos"
      const offset = (pageNum - 1) * limitNum;
      
      // Parse query params
      const tiposArray = typeof tipos === 'string' ? tipos.split(',').filter(Boolean) : [];
      const carteirasArray = typeof carteiras === 'string' ? carteiras.split(',').filter(Boolean) : [];
      const cidadesArray = typeof cidades === 'string' ? cidades.split(',').filter(Boolean) : [];
      const searchTerm = typeof search === 'string' ? search.trim() : '';
      const statusFilter = typeof status === 'string' && status !== 'todos' ? status : '';
      const sendStatusArray = typeof sendStatusFilter === 'string' ? sendStatusFilter.split(',').filter(Boolean) : [];
      const engajamentoArray = typeof engajamentoFilter === 'string' ? engajamentoFilter.split(',').filter(Boolean) : [];
      const etiquetaArray = typeof etiquetaFilter === 'string' ? etiquetaFilter.split(',').filter(Boolean) : [];
      
      // ✅ PRÉ-FILTRO: Se há filtros de engajamento/etiqueta/sendStatus/campanha, buscar IDs elegíveis primeiro
      let preFilteredClientIds: string[] | null = null;
      
      if (sendStatusArray.length > 0 || engajamentoArray.length > 0 || etiquetaArray.length > 0 || campaignId) {
        const sendingsConditions = [eq(campaignSendings.userId, user.id)];
        if (campaignId && typeof campaignId === 'string') {
          sendingsConditions.push(eq(campaignSendings.campaignId, campaignId));
        }
        
        const allSendings = await db
          .select({
            clientId: campaignSendings.clientId,
            status: campaignSendings.status,
            estadoDerivado: campaignSendings.estadoDerivado,
            totalRespostas: campaignSendings.totalRespostas,
            dataEntrega: campaignSendings.dataEntrega,
            dataVisualizacao: campaignSendings.dataVisualizacao,
            dataSending: campaignSendings.dataSending,
          })
          .from(campaignSendings)
          .where(and(...sendingsConditions))
          .orderBy(desc(campaignSendings.dataSending)); // ✅ Ordenar por data DESC para pegar mais recentes primeiro
        
        // Calcular sendStatus, etiqueta e engajamento para cada sending
        const sendingsWithMeta = allSendings.map(s => {
          let sendStatusValue = "nao_enviado";
          if (s.status === "erro") {
            sendStatusValue = "erro";
          } else if (s.dataVisualizacao) {
            sendStatusValue = "lido";
          } else if (s.dataEntrega) {
            sendStatusValue = "entregue";
          } else if (s.status === "enviado") {
            sendStatusValue = "enviado";
          }
          
          let etiqueta = "Sem envio";
          if (s.status === "erro") {
            etiqueta = "Erro no envio";
          } else if (s.totalRespostas && s.totalRespostas > 0) {
            etiqueta = "Respondeu";
          } else if (s.dataVisualizacao) {
            etiqueta = "Visualizado";
          } else if (s.dataEntrega) {
            etiqueta = "Entregue";
          } else if (s.status === "enviado") {
            etiqueta = "Enviado";
          }
          
          const engajamento = s.estadoDerivado || "nenhum";
          
          return { clientId: s.clientId, sendStatus: sendStatusValue, etiqueta, engajamento };
        });
        
        // Agrupar por clientId (pegar o mais recente)
        const clientMap = new Map<string, typeof sendingsWithMeta[0]>();
        for (const s of sendingsWithMeta) {
          if (!clientMap.has(s.clientId)) {
            clientMap.set(s.clientId, s);
          }
        }
        
        // Filtrar baseado nos critérios
        let filteredIds = Array.from(clientMap.entries());
        
        if (sendStatusArray.length > 0) {
          filteredIds = filteredIds.filter(([_, meta]) => sendStatusArray.includes(meta.sendStatus));
        }
        if (engajamentoArray.length > 0) {
          filteredIds = filteredIds.filter(([_, meta]) => engajamentoArray.includes(meta.engajamento));
        }
        if (etiquetaArray.length > 0) {
          filteredIds = filteredIds.filter(([_, meta]) => etiquetaArray.includes(meta.etiqueta));
        }
        
        preFilteredClientIds = filteredIds.map(([id]) => id);
        
        // Se nenhum cliente passou nos filtros, retornar vazio
        if (preFilteredClientIds.length === 0) {
          return res.json({
            data: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
          });
        }
      }
      
      // Build where conditions
      let conditions: any[] = [
        user.role === 'admin' ? undefined : or(
          eq(clients.createdBy, user.id),
          sql`${clients.id} IN (SELECT ${clientSharing.clientId} FROM ${clientSharing} WHERE ${clientSharing.sharedWithUserId} = ${user.id})`
        ),
        sql`${clients.celular} IS NOT NULL AND ${clients.celular} != ''`
      ].filter(Boolean);
      
      // ✅ Adicionar condição de pré-filtro se houver
      if (preFilteredClientIds !== null) {
        conditions.push(inArray(clients.id, preFilteredClientIds));
      }
      
      // Apply filters if provided
      if (tiposArray.length > 0) {
        conditions.push(inArray(clients.tipoCliente, tiposArray));
      }
      if (carteirasArray.length > 0) {
        conditions.push(inArray(clients.carteira, carteirasArray));
      }
      if (cidadesArray.length > 0) {
        conditions.push(inArray(clients.cidade, cidadesArray));
      }
      if (statusFilter) {
        conditions.push(ilike(clients.status, statusFilter));
      }
      // ✅ Search por nome ou telefone (server-side)
      if (searchTerm && searchTerm.length >= 2) {
        conditions.push(or(
          ilike(clients.nome, `%${searchTerm}%`),
          ilike(clients.celular, `%${searchTerm}%`)
        ));
      }
      
      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
      
      // ✅ Buscar total para paginação (count query otimizada)
      const [{ count: totalCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(clients)
        .where(whereCondition);
      
      // ✅ Buscar clientes paginados
      const allClients = await db
        .select({
          id: clients.id,
          nome: clients.nome,
          telefone: clients.celular,
          telefone2: clients.telefone2,
          email: clients.email,
          status: clients.status,
          tagNames: clients.tags,
          carteira: clients.carteira,
          tipo: clients.tipoCliente,
        })
        .from(clients)
        .where(whereCondition)
        .orderBy(clients.nome)
        .limit(limitNum)
        .offset(offset);

      // Fetch all available tags (cacheable)
      const allTags = await db.select().from(tags);
      
      // ✅ Buscar sendings apenas para os clientes da página atual (otimizado)
      const clientIds = allClients.map(c => c.id);
      let recentSendings: any[] = [];
      if (clientIds.length > 0) {
        try {
          // ✅ Se campaignId especificado, filtra por campanha específica
          const sendingsConditions = [
            eq(campaignSendings.userId, user.id),
            inArray(campaignSendings.clientId, clientIds)
          ];
          
          if (campaignId && typeof campaignId === 'string') {
            sendingsConditions.push(eq(campaignSendings.campaignId, campaignId));
          }
          
          recentSendings = await db
            .select({
              clientId: campaignSendings.clientId,
              status: campaignSendings.status,
              dataSending: campaignSendings.dataSending,
              campaignId: campaignSendings.campaignId,
              campaignName: campaignSendings.campaignName,
              estadoDerivado: campaignSendings.estadoDerivado,
              totalRespostas: campaignSendings.totalRespostas,
              dataEntrega: campaignSendings.dataEntrega,
              dataVisualizacao: campaignSendings.dataVisualizacao,
            })
            .from(campaignSendings)
            .where(and(...sendingsConditions))
            .orderBy(sql`${campaignSendings.dataSending} DESC`);
        } catch (err) {
          console.warn("Warning: could not fetch campaign sendings:", err);
        }
      }

      // Create map of most recent sending per client
      const clientSendingMap = new Map<string, any>();
      for (const sending of recentSendings) {
        if (!clientSendingMap.has(sending.clientId)) {
          clientSendingMap.set(sending.clientId, sending);
        }
      }
      
      let result = allClients.map((client) => {
        const clientTags = (client.tagNames || []).map((tagName: string) => {
          const tag = allTags.find(t => t.nome === tagName);
          return tag ? { id: tag.id, nome: tag.nome, cor: tag.cor } : null;
        }).filter(Boolean);

        const sendingHistory = clientSendingMap.get(client.id);
        
        // Determinar sendStatus (enviado/entregue/lido/erro)
        let sendStatusValue = "nao_enviado";
        if (sendingHistory) {
          if (sendingHistory.status === "erro") {
            sendStatusValue = "erro";
          } else if (sendingHistory.dataVisualizacao) {
            sendStatusValue = "lido";
          } else if (sendingHistory.dataEntrega) {
            sendStatusValue = "entregue";
          } else if (sendingHistory.status === "enviado") {
            sendStatusValue = "enviado";
          }
        }
        
        // Determinar etiqueta (Respondeu/Visualizado/Entregue/Enviado/Erro)
        let etiqueta = "Sem envio";
        if (sendingHistory) {
          if (sendingHistory.status === "erro") {
            etiqueta = "Erro no envio";
          } else if (sendingHistory.totalRespostas && sendingHistory.totalRespostas > 0) {
            etiqueta = "Respondeu";
          } else if (sendingHistory.dataVisualizacao) {
            etiqueta = "Visualizado";
          } else if (sendingHistory.dataEntrega) {
            etiqueta = "Entregue";
          } else if (sendingHistory.status === "enviado") {
            etiqueta = "Enviado";
          }
        }
        
        // Determinar engajamento (baseado em estadoDerivado)
        let engajamento = "nenhum";
        if (sendingHistory?.estadoDerivado) {
          engajamento = sendingHistory.estadoDerivado;
        }

        return {
          id: client.id,
          nome: client.nome,
          telefone: client.telefone,
          telefone2: client.telefone2,
          celular: client.telefone,
          email: client.email,
          status: client.status,
          carteira: client.carteira,
          tipo: client.tipo,
          tags: clientTags,
          sendStatus: sendStatusValue,
          etiqueta,
          engajamento,
          lastSendDate: sendingHistory?.dataSending ? new Date(sendingHistory.dataSending).toLocaleDateString("pt-BR") : undefined,
        };
      });
      
      // ✅ Filtros já aplicados no PRÉ-FILTRO (antes da paginação)

      res.json({
        data: result,
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      });
    } catch (error: any) {
      console.error("Error fetching WhatsApp client list:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para atualizar status em massa de clientes (para campanhas WhatsApp)
  app.post("/api/clients/bulk-status", isAuthenticated, async (req, res) => {
    try {
      const { clientIds, status } = req.body;
      
      if (!Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({ error: "clientIds array is required" });
      }
      
      if (!status || typeof status !== "string") {
        return res.status(400).json({ error: "status is required" });
      }

      // Update all clients in parallel
      const updated = await Promise.all(
        clientIds.map((clientId) =>
          storage.updateClient(clientId, { status })
        )
      );

      res.json({ 
        success: true, 
        updated: updated.length,
        message: `${updated.length} clientes marcados como ${status}` 
      });
    } catch (error: any) {
      console.error("Error updating client status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const client = await storage.getClientById(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      console.error("Error fetching client:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse({
        ...req.body,
        createdBy: (req.user as any).id,
      });
      
      // Verificar se celular já existe (unicidade)
      if (validatedData.celular) {
        const celularNormalizado = validatedData.celular.replace(/\D/g, "").trim();
        if (celularNormalizado) {
          const [existente] = await db
            .select({ id: clients.id, nome: clients.nome })
            .from(clients)
            .where(eq(clients.celular, celularNormalizado))
            .limit(1);
          
          if (existente) {
            return res.status(400).json({ 
              error: `Este celular já está cadastrado para o cliente: ${existente.nome}` 
            });
          }
          // Normalizar celular antes de salvar
          validatedData.celular = celularNormalizado;
        }
      }
      
      const client = await storage.createClient(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "criar",
        entidade: "client",
        entidadeId: client.id,
        dadosNovos: client as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(client);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating client:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const oldClient = await storage.getClientById(req.params.id);
      if (!oldClient) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Verificar permissão ao cliente compartilhado
      const user = req.user as any;
      const access = await storage.checkClientAccess(req.params.id, user.id);
      if (!access.canAccess) {
        return res.status(403).json({ error: "Você não tem acesso a este cliente" });
      }
      // Se tiver permissão "visualizar", não pode editar
      if (access.permissao === "visualizar") {
        return res.status(403).json({ error: "Você só pode visualizar este cliente, não pode editá-lo" });
      }

      const validatedData = insertClientSchema.partial().parse(req.body);
      
      // Verificar se celular já existe (unicidade) - exceto para o próprio cliente
      if (validatedData.celular) {
        const celularNormalizado = validatedData.celular.replace(/\D/g, "").trim();
        if (celularNormalizado) {
          const [existente] = await db
            .select({ id: clients.id, nome: clients.nome })
            .from(clients)
            .where(and(
              eq(clients.celular, celularNormalizado),
              sql`${clients.id} != ${req.params.id}`
            ))
            .limit(1);
          
          if (existente) {
            return res.status(400).json({ 
              error: `Este celular já está cadastrado para o cliente: ${existente.nome}` 
            });
          }
          // Normalizar celular antes de salvar
          validatedData.celular = celularNormalizado;
        }
      }
      
      const client = await storage.updateClient(req.params.id, validatedData);

      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "editar",
        entidade: "client",
        entidadeId: req.params.id,
        dadosAntigos: oldClient as any,
        dadosNovos: client as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(client);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating client:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const client = await storage.getClientById(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      await storage.deleteClient(req.params.id);

      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "excluir",
        entidade: "client",
        entidadeId: req.params.id,
        dadosAntigos: client as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting client:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== MANUAL FOLLOW-UP ====================
  app.post("/api/clients/:id/manual-follow-up", isAuthenticated, async (req, res) => {
    try {
      const client = await storage.getClientById(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const user = req.user as any;
      const access = await storage.checkClientAccess(req.params.id, user.id);
      if (!access.canAccess) {
        return res.status(403).json({ error: "Você não tem acesso a este cliente" });
      }

      // Altera status do cliente para "em_fechamento"
      const updatedClient = await storage.updateClient(req.params.id, { status: "em_fechamento" });

      // Registra na timeline
      await storage.createInteraction({
        clientId: req.params.id,
        tipo: "aguardando_atencao",
        origem: "user",
        titulo: "Aguardando Atenção",
        texto: `${user.firstName || user.email} marcou este cliente como "Aguardando Atenção"`,
        meta: { user: user.email },
        createdBy: user.id,
      });

      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        acao: "criar",
        entidade: "aguardando_atencao",
        entidadeId: req.params.id,
        dadosNovos: { tipo: "aguardando_atencao", status: "em_fechamento", etapa: "AGUARDANDO ATENÇÃO" } as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(updatedClient);
    } catch (error: any) {
      console.error("Error creating manual follow-up:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== OPPORTUNITY ROUTES ====================
  app.get("/api/opportunities", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { etapa } = req.query;
      const opportunities = await storage.getOpportunities({
        userId: user.id, // Filtrar por usuário + clientes compartilhados
        etapa: etapa as string,
      });
      res.json(opportunities);
    } catch (error: any) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/opportunities", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertOpportunitySchema.parse(req.body);
      const user = req.user as any;

      // Verificar permissão ao cliente antes de criar oportunidade
      if (validatedData.clientId) {
        const access = await storage.checkClientAccess(validatedData.clientId, user.id);
        if (!access.canAccess) {
          return res.status(403).json({ error: "Você não tem acesso a este cliente" });
        }
        // Se tiver permissão "visualizar", não pode criar oportunidade
        if (access.permissao === "visualizar") {
          return res.status(403).json({ error: "Você só pode visualizar este cliente, não pode criar oportunidades" });
        }
      }

      // Garantir que responsavelId é o usuário autenticado
      const opportunityData = {
        ...validatedData,
        responsavelId: user.id,
        etapa: validatedData.etapa ? validatedData.etapa.toUpperCase() : "LEAD" // Normalizar etapa para MAIÚSCULA
      };

      const opportunity = await storage.createOpportunity(opportunityData);

      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        acao: "criar",
        entidade: "opportunity",
        entidadeId: opportunity.id,
        dadosNovos: opportunity as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // 📝 REGISTRAR CRIAÇÃO NO TIMELINE
      if (opportunity.clientId) {
        const client = await storage.getClientById(opportunity.clientId);
        await storage.createInteraction({
          clientId: opportunity.clientId,
          tipo: "oportunidade_criada",
          origem: "manual",
          titulo: `Oportunidade de Negócio - ${opportunity.etapa}`,
          texto: `Etapa: ${opportunity.etapa} | Valor: R$ ${opportunity.valorEstimado ? ((opportunity.valorEstimado as number) / 100).toFixed(2) : 'N/A'}`,
          createdBy: user.id,
          meta: { etapa: opportunity.etapa, valor: opportunity.valorEstimado },
        });
      }

      // 🔄 RECALCULATE CLIENT STATUS
      if (opportunity.clientId) {
        const newStatus = await storage.recalculateClientStatus(opportunity.clientId);
        await storage.updateClient(opportunity.clientId, { status: newStatus });
      }

      res.status(201).json(opportunity);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/opportunities/:id/move", isAuthenticated, async (req, res) => {
    try {
      const { etapa } = req.body;
      if (!etapa) {
        return res.status(400).json({ error: "etapa is required" });
      }

      const oldOpportunity = await storage.getOpportunityById(req.params.id);
      if (!oldOpportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }

      // Verificar permissão ao cliente da oportunidade
      const user = req.user as any;
      if (oldOpportunity.clientId) {
        const access = await storage.checkClientAccess(oldOpportunity.clientId, user.id);
        if (!access.canAccess) {
          return res.status(403).json({ error: "Você não tem acesso a este cliente" });
        }
        // Se tiver permissão "visualizar", não pode mover oportunidade
        if (access.permissao === "visualizar") {
          return res.status(403).json({ error: "Você só pode visualizar este cliente, não pode mover oportunidades" });
        }
      }

      // Normalizar etapa para MAIÚSCULA
      const etapaNormalizada = etapa.toUpperCase();
      const opportunity = await storage.updateOpportunity(req.params.id, { etapa: etapaNormalizada });

      // 📝 REGISTRAR MUDANÇA NA TIMELINE (Manual - usuário)
      if (oldOpportunity.etapa !== etapaNormalizada) {
        await storage.recordEtapaChange(
          req.params.id,
          oldOpportunity.clientId || "",
          oldOpportunity.etapa,
          etapaNormalizada,
          "manual",
          (req.user as any).id
        );
      }

      // 🔄 RECALCULATE CLIENT STATUS
      if (oldOpportunity.clientId) {
        const newStatus = await storage.recalculateClientStatus(oldOpportunity.clientId);
        await storage.updateClient(oldOpportunity.clientId, { status: newStatus });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "editar",
        entidade: "opportunity",
        entidadeId: req.params.id,
        dadosAntigos: oldOpportunity as any,
        dadosNovos: opportunity as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // 🚀 TRIGGER: Se moveu para AGUARDANDO ACEITE, dispara automação de lembretes
      if (opportunity && etapaNormalizada === "AGUARDANDO ACEITE" && oldOpportunity.etapa !== "AGUARDANDO ACEITE") {
        console.log(`🚀 Disparando automação de Aguardando Aceite para ${opportunity.id}`);
        try {
          await db.insert(automationTasks).values({
            userId: (req.user as any).id,
            clientId: opportunity.clientId,
            opportunityId: opportunity.id,  // ✅ CORRIGIDO: adicionar opportunityId no campo correto
            tipo: "aguardando_aceite_reminder",
            proximaExecucao: new Date(),
            dados: { 
              opportunityId: opportunity.id, 
              lembrete: 1,
              contractSentAt: new Date(),
            },
          });
        } catch (error) {
          console.error(`❌ Erro ao disparar automação de Aguardando Aceite:`, error);
        }
      }

      // 🚀 TRIGGER: Se moveu para CONTRATO ENVIADO, dispara automação
      if (opportunity && etapaNormalizada === "CONTRATO ENVIADO" && oldOpportunity.etapa !== "CONTRATO ENVIADO") {
        console.log(`🚀 Disparando automação de Contrato Enviado para ${opportunity.id}`);
        try {
          await db.insert(automationTasks).values({
            userId: (req.user as any).id,
            clientId: opportunity.clientId,
            opportunityId: opportunity.id,  // ✅ CORRIGIDO: adicionar opportunityId para evitar duplicação
            tipo: "contrato_enviado_message",
            proximaExecucao: new Date(), // Executar imediatamente
            dados: { opportunityId: opportunity.id },
          });
          console.log(`✅ Task de Contrato Enviado criada`);
        } catch (error) {
          console.error(`❌ Erro ao criar task de contrato enviado:`, error);
        }
      }

      // 🚀 TRIGGER: Se moveu para FECHADO manualmente, envia mensagem automática
      if (opportunity && etapaNormalizada === "FECHADO" && oldOpportunity.etapa !== "FECHADO") {
        console.log(`🚀 Enviando mensagem de fechamento para ${opportunity.id}`);
        try {
          // Buscar config de automação e cliente
          const [config] = await db.select().from(automationConfigs).where(eq(automationConfigs.jobType, "ia_resposta_positiva")).limit(1);
          const client = await storage.getClientById(opportunity.clientId || "");
          
          if (config?.mensagemFechado && client?.celular) {
            // ⏱️ Delay randomico entre 20-40 segundos
            const delayMs = (Math.random() * 20 + 20) * 1000; // 20-40 segundos
            console.log(`⏱️ Aguardando ${Math.round(delayMs / 1000)}s antes de enviar mensagem de fechamento...`);
            
            // Fire-and-forget: não espera o timeout
            setTimeout(async () => {
              try {
                if (whatsappService.isSessionAlive(user.id)) {
                  const sock = whatsappService.getActiveSession(user.id);
                  if (sock) {
                    const telefoneFormatado = client.celular?.replace(/\D/g, '').replace(/^55/, '');
                    if (telefoneFormatado) {
                      await sock.sendMessage(`${telefoneFormatado}@c.us`, { text: config.mensagemFechado });
                      console.log(`✅ Mensagem de fechamento enviada via WhatsApp (após delay): ${telefoneFormatado}`);
                    }
                  }
                }
              } catch (err) {
                console.warn(`⚠️ Erro ao enviar mensagem de fechamento (ignorado):`, err);
              }
            }, delayMs);
          }
        } catch (error) {
          console.warn(`⚠️ Erro ao processar mensagem de fechamento (ignorado):`, error);
        }
      }

      res.json(opportunity);
    } catch (error: any) {
      console.error("Error moving opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/opportunities/:id", isAuthenticated, async (req, res) => {
    try {
      const oldOpportunity = await storage.getOpportunityById(req.params.id);
      if (!oldOpportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }

      // Verificar permissão ao cliente da oportunidade
      const user = req.user as any;
      if (oldOpportunity.clientId) {
        const access = await storage.checkClientAccess(oldOpportunity.clientId, user.id);
        if (!access.canAccess) {
          return res.status(403).json({ error: "Você não tem acesso a este cliente" });
        }
        // Se tiver permissão "visualizar", não pode editar oportunidade
        if (access.permissao === "visualizar") {
          return res.status(403).json({ error: "Você só pode visualizar este cliente, não pode editá-lo" });
        }
      }

      const validatedData = insertOpportunitySchema.partial().parse(req.body);
      const opportunity = await storage.updateOpportunity(req.params.id, validatedData);

      // 📝 REGISTRAR MUDANÇA NA TIMELINE se etapa mudou (Manual - usuário)
      if (validatedData.etapa && oldOpportunity.etapa !== validatedData.etapa) {
        await storage.recordEtapaChange(
          req.params.id,
          oldOpportunity.clientId || "",
          oldOpportunity.etapa,
          validatedData.etapa,
          "manual",
          (req.user as any).id
        );
      }

      // 🔄 RECALCULATE CLIENT STATUS if etapa changed
      if (oldOpportunity.clientId && validatedData.etapa) {
        const newStatus = await storage.recalculateClientStatus(oldOpportunity.clientId);
        await storage.updateClient(oldOpportunity.clientId, { status: newStatus });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "editar",
        entidade: "opportunity",
        entidadeId: req.params.id,
        dadosAntigos: oldOpportunity as any,
        dadosNovos: opportunity as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(opportunity);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/opportunities/:id", isAuthenticated, async (req, res) => {
    try {
      const opportunity = await storage.getOpportunityById(req.params.id);
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }

      await storage.deleteOpportunity(req.params.id);

      // 🔄 RECALCULATE CLIENT STATUS after delete
      if (opportunity.clientId) {
        const newStatus = await storage.recalculateClientStatus(opportunity.clientId);
        await storage.updateClient(opportunity.clientId, { status: newStatus });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "excluir",
        entidade: "opportunity",
        entidadeId: req.params.id,
        dadosAntigos: opportunity as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting opportunity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CAMPAIGN ROUTES ====================
  app.get("/api/campaigns", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      const campaigns = await db
        .select()
        .from(campaignsTable)
        .where(
          user.role === 'admin'
            ? undefined
            : eq(campaignsTable.createdBy, user.id)
        );
      res.json(campaigns || []);
    } catch (error: any) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/campaigns", isAuthenticated, async (req, res) => {
    try {
      // ✅ Calcular totalRecipients a partir de filtros.clientIds
      const clientIds = (req.body.filtros?.clientIds as string[]) || [];
      
      // ✅ Extrair tempos customizados do request, permitir override
      const tempoFixoSegundos = req.body.tempoFixoSegundos !== undefined ? req.body.tempoFixoSegundos : 70;
      const tempoAleatorioMin = req.body.tempoAleatorioMin !== undefined ? req.body.tempoAleatorioMin : 30;
      const tempoAleatorioMax = req.body.tempoAleatorioMax !== undefined ? req.body.tempoAleatorioMax : 60;
      
      const validatedData = insertCampaignSchema.parse({
        ...req.body,
        totalRecipients: clientIds.length || 0,
        createdBy: (req.user as any).id,
        tempoFixoSegundos,
        tempoAleatorioMin,
        tempoAleatorioMax,
      });
      const campaign = await storage.createCampaign(validatedData);

      // ✅ Criar registros em campaign_sendings para cada cliente
      if (clientIds && clientIds.length > 0) {
        const sendingsToCreate = clientIds.map(clientId => ({
          campaignId: campaign.id,
          clientId,
          status: 'pendente' as const,
          dataSending: new Date(),
        }));
        
        // Insert all at once
        await db.insert(campaignSendings).values(sendingsToCreate);
        console.log(`✅ Criados ${sendingsToCreate.length} registros de envio para campanha ${campaign.id}`);
      }

      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "criar",
        entidade: "campaign",
        entidadeId: campaign.id,
        dadosNovos: campaign as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(campaign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Scheduled campaigns
  app.get("/api/campaigns/scheduled", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      const scheduled = await db
        .select()
        .from(campaignsTable)
        .where(
          user.role === 'admin'
            ? eq(campaignsTable.status, 'agendada')
            : and(eq(campaignsTable.status, 'agendada'), eq(campaignsTable.createdBy, user.id))
        );
      res.json(scheduled || []);
    } catch (error: any) {
      console.error("Error fetching scheduled campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para buscar campanhas concluídas (para filtro de seleção de clientes)
  app.get("/api/campaigns/for-filter", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      const completed = await db
        .select({
          id: campaignsTable.id,
          nome: campaignsTable.nome,
        })
        .from(campaignsTable)
        .where(
          user.role === 'admin'
            ? eq(campaignsTable.status, 'concluida')
            : and(eq(campaignsTable.status, 'concluida'), eq(campaignsTable.createdBy, user.id))
        )
        .orderBy(desc(campaignsTable.createdAt))
        .limit(50);
      
      res.json(completed || []);
    } catch (error: any) {
      console.error("Error fetching campaigns for filter:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/campaigns/schedule", isAuthenticated, async (req, res) => {
    try {
      const { nome, templateId, agendadaPara, filtros, totalRecipients, tempoFixoSegundos, tempoAleatorioMin, tempoAleatorioMax } = req.body;
      if (!nome || !templateId || !agendadaPara) {
        return res.status(400).json({ error: "Nome, templateId e agendadaPara são obrigatórios" });
      }

      // ✅ Extrair tempos customizados, usar defaults se não informados
      const tempo_fixo = tempoFixoSegundos !== undefined ? tempoFixoSegundos : 70;
      const tempo_min = tempoAleatorioMin !== undefined ? tempoAleatorioMin : 30;
      const tempo_max = tempoAleatorioMax !== undefined ? tempoAleatorioMax : 60;

      // ✅ Salvar origemDisparo nos filtros para exibição correta no histórico
      const validatedData = insertCampaignSchema.parse({
        nome,
        tipo: "whatsapp",
        templateId,
        status: "agendada",
        agendadaPara: new Date(agendadaPara),
        filtros: { ...(filtros || {}), origemDisparo: "agendamento" },
        totalRecipients: totalRecipients || 0,
        createdBy: (req.user as any).id,
        tempoFixoSegundos: tempo_fixo,
        tempoAleatorioMin: tempo_min,
        tempoAleatorioMax: tempo_max,
      });

      const campaign = await storage.createCampaign(validatedData);

      // ✅ Criar registros em campaign_sendings para cada cliente
      const clientIds: string[] = (filtros as any)?.clientIds || [];
      const userId = (req.user as any).id;
      if (clientIds && clientIds.length > 0) {
        const sendingsToCreate = clientIds.map(clientId => ({
          campaignId: campaign.id,
          clientId,
          userId,
          campaignName: nome,
          status: 'pendente' as const,
          origemDisparo: 'agendamento' as const,
        }));
        
        // Insert all at once
        await db.insert(campaignSendings).values(sendingsToCreate);
        console.log(`✅ Criados ${sendingsToCreate.length} registros de envio para campanha agendada ${campaign.id}`);
      }

      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "criar",
        entidade: "campaign_scheduled",
        entidadeId: campaign.id,
        dadosNovos: campaign as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(campaign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error scheduling campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get campaign details with recipients - EXPANDED with full tracking
  app.get("/api/campaigns/:id/details", isAuthenticated, async (req, res) => {
    try {
      const campaign = await storage.getCampaignById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campanha não encontrada" });
      }

      const user = req.user as any;
      if (campaign.createdBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: "Não autorizado" });
      }

      // Get the client IDs from the campaign filter (it's a JSONB object)
      const clientIds: string[] = (campaign.filtros as any)?.clientIds || [];
      
      // ✅ NOVO: Buscar todos os registros de envio com campos detalhados
      const sendingsData = await db
        .select({
          id: campaignSendings.id,
          clientId: campaignSendings.clientId,
          clientNome: clients.nome,
          clientTelefone: clients.celular,
          clientEmail: clients.email,
          status: campaignSendings.status,
          statusWhatsapp: campaignSendings.statusWhatsapp,
          estadoDerivado: campaignSendings.estadoDerivado,
          erroMensagem: campaignSendings.erroMensagem,
          dataSending: campaignSendings.dataSending,
          dataEntrega: campaignSendings.dataEntrega,
          dataVisualizacao: campaignSendings.dataVisualizacao,
          dataPrimeiraResposta: campaignSendings.dataPrimeiraResposta,
          dataUltimaResposta: campaignSendings.dataUltimaResposta,
          totalRespostas: campaignSendings.totalRespostas,
          ultimaInteracao: campaignSendings.ultimaInteracao,
          mensagemUsada: campaignSendings.mensagemUsada,
        })
        .from(campaignSendings)
        .innerJoin(clients, eq(clients.id, campaignSendings.clientId))
        .where(eq(campaignSendings.campaignId, req.params.id))
        .orderBy(desc(campaignSendings.dataSending));

      // ✅ CALCULAR RESUMO
      const resumo = {
        total: sendingsData.length,
        enviados: sendingsData.filter(s => s.status === 'enviado' || s.status === 'entregue' || s.status === 'lido').length,
        entregues: sendingsData.filter(s => s.status === 'entregue' || s.status === 'lido').length,
        visualizados: sendingsData.filter(s => s.status === 'lido').length,
        respondidos: sendingsData.filter(s => s.totalRespostas && s.totalRespostas > 0).length,
        erros: sendingsData.filter(s => s.status === 'erro').length,
        pendentes: clientIds.length - sendingsData.length,
        // Engajamento - calculado no mesmo padrão que clientesDetalhados
        engajamentoAlto: sendingsData.filter(s => {
          if (s.totalRespostas && s.totalRespostas > 0 && s.dataPrimeiraResposta && s.dataSending) {
            const tempo = new Date(s.dataPrimeiraResposta).getTime() - new Date(s.dataSending).getTime();
            return tempo < 3600000;
          }
          return false;
        }).length,
        engajamentoMedio: sendingsData.filter(s => {
          if (s.totalRespostas && s.totalRespostas > 0) {
            if (s.dataPrimeiraResposta && s.dataSending) {
              const tempo = new Date(s.dataPrimeiraResposta).getTime() - new Date(s.dataSending).getTime();
              return tempo >= 3600000 && tempo < 86400000;
            }
            return true;
          }
          return false;
        }).length,
        engajamentoBaixo: sendingsData.filter(s => {
          if (s.status === 'erro') return false;
          if (s.totalRespostas && s.totalRespostas > 0) {
            if (s.dataPrimeiraResposta && s.dataSending) {
              const tempo = new Date(s.dataPrimeiraResposta).getTime() - new Date(s.dataSending).getTime();
              return tempo >= 86400000;
            }
            return false;
          }
          return s.status === 'lido' || s.status === 'entregue';
        }).length,
        semEngajamento: sendingsData.filter(s => s.status === 'enviado' || s.status === 'erro').length,
      };

      // ✅ FORMATAR CLIENTES COM STATUS DETALHADO
      const clientesDetalhados = sendingsData.map(s => {
        // Calcular etiqueta legível
        let etiqueta = 'Enviado';
        if (s.status === 'erro') etiqueta = 'Erro no envio';
        else if (s.totalRespostas && s.totalRespostas > 0) etiqueta = 'Respondeu';
        else if (s.status === 'lido') etiqueta = 'Visualizado';
        else if (s.status === 'entregue') etiqueta = 'Entregue';
        else if (s.status === 'enviado') etiqueta = 'Enviado';

        // Calcular engajamento (entregue = baixo, enviado = nenhum)
        let engajamento = 'nenhum';
        if (s.status === 'erro') {
          engajamento = 'nenhum';
        } else if (s.totalRespostas && s.totalRespostas > 0) {
          if (s.dataPrimeiraResposta && s.dataSending) {
            const tempoResposta = new Date(s.dataPrimeiraResposta).getTime() - new Date(s.dataSending).getTime();
            if (tempoResposta < 3600000) engajamento = 'alto'; // < 1h
            else if (tempoResposta < 86400000) engajamento = 'medio'; // < 24h
            else engajamento = 'baixo';
          } else {
            engajamento = 'medio';
          }
        } else if (s.status === 'lido') {
          engajamento = 'baixo';
        } else if (s.status === 'entregue') {
          engajamento = 'baixo'; // Entregue = baixo engajamento (não nenhum)
        } else if (s.status === 'enviado') {
          engajamento = 'nenhum'; // Apenas enviado = sem engajamento ainda
        }

        return {
          id: s.id,
          clientId: s.clientId,
          nome: s.clientNome,
          telefone: s.clientTelefone,
          email: s.clientEmail,
          status: s.status,
          etiqueta,
          engajamento,
          statusWhatsapp: s.statusWhatsapp,
          erroMensagem: s.erroMensagem,
          dataSending: s.dataSending,
          dataEntrega: s.dataEntrega,
          dataVisualizacao: s.dataVisualizacao,
          dataPrimeiraResposta: s.dataPrimeiraResposta,
          dataUltimaResposta: s.dataUltimaResposta,
          totalRespostas: s.totalRespostas || 0,
          ultimaInteracao: s.ultimaInteracao,
        };
      });

      // ✅ GERAR TIMELINE DA CAMPANHA
      const timeline: Array<{data: Date, tipo: string, descricao: string, clienteNome?: string}> = [];
      
      // Adicionar eventos de cada cliente
      for (const s of sendingsData) {
        if (s.dataSending) {
          timeline.push({ data: s.dataSending, tipo: 'envio', descricao: `Mensagem enviada para ${s.clientNome}`, clienteNome: s.clientNome || undefined });
        }
        if (s.dataEntrega) {
          timeline.push({ data: s.dataEntrega, tipo: 'entrega', descricao: `Mensagem entregue para ${s.clientNome}`, clienteNome: s.clientNome || undefined });
        }
        if (s.dataVisualizacao) {
          timeline.push({ data: s.dataVisualizacao, tipo: 'visualizacao', descricao: `${s.clientNome} visualizou a mensagem`, clienteNome: s.clientNome || undefined });
        }
        if (s.dataPrimeiraResposta) {
          timeline.push({ data: s.dataPrimeiraResposta, tipo: 'resposta', descricao: `${s.clientNome} respondeu`, clienteNome: s.clientNome || undefined });
        }
        if (s.status === 'erro') {
          timeline.push({ data: s.dataSending || new Date(), tipo: 'erro', descricao: `Erro ao enviar para ${s.clientNome}: ${s.erroMensagem || 'Falha desconhecida'}`, clienteNome: s.clientNome || undefined });
        }
      }

      // Ordenar timeline por data (mais recente primeiro)
      timeline.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      res.json({
        campaign,
        resumo,
        clientes: clientesDetalhados,
        timeline: timeline.slice(0, 100), // Limitar a 100 eventos mais recentes
      });
    } catch (error: any) {
      console.error("Error fetching campaign details:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const campaign = await storage.getCampaignById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campanha não encontrada" });
      }

      // Verify ownership
      const user = req.user as any;
      if (campaign.createdBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: "Não autorizado" });
      }

      await storage.deleteCampaign(req.params.id);

      await storage.createAuditLog({
        userId: user.id,
        acao: "excluir",
        entidade: "campaign",
        entidadeId: req.params.id,
        dadosAntigos: campaign as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const validatedData = insertTemplateSchema.partial().parse(req.body);
      const updated = await storage.updateTemplate(req.params.id, validatedData);

      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "editar",
        entidade: "template",
        entidadeId: req.params.id,
        dadosAntigos: template as any,
        dadosNovos: updated as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      await storage.deleteTemplate(req.params.id);

      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "excluir",
        entidade: "template",
        entidadeId: req.params.id,
        dadosAntigos: template as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== TEMPLATE ROUTES ====================
  app.get("/api/templates", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      const templates = await db
        .select()
        .from(templatesTable)
        .where(eq(templatesTable.createdBy, user.id));
      res.json(templates || []);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("Error fetching template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/templates", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertTemplateSchema.parse({
        ...req.body,
        createdBy: (req.user as any).id,
      });
      const template = await storage.createTemplate(validatedData);

      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "criar",
        entidade: "template",
        entidadeId: template.id,
        dadosNovos: template as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      await storage.deleteTemplate(req.params.id);

      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "excluir",
        entidade: "template",
        entidadeId: req.params.id,
        dadosAntigos: template as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== TIMELINE/INTERACTION ROUTES ====================
  app.get("/api/timeline/:clientId", isAuthenticated, async (req, res) => {
    try {
      const timeline = await storage.getTimelineByClientId(req.params.clientId);
      res.json(timeline);
    } catch (error: any) {
      console.error("Error fetching timeline:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/interactions", isAuthenticated, async (req, res) => {
    try {
      const { clientId, tipo, origem, titulo, texto, meta, createdBy } = req.body;
      
      if (!clientId || !tipo) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const interaction = await storage.createInteraction({
        clientId,
        tipo,
        origem: origem || "user",
        titulo,
        texto,
        meta: meta || {},
        createdBy: createdBy || (req.user as any).id,
      });

      res.status(201).json(interaction);
    } catch (error: any) {
      console.error("Error creating interaction:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== KANBAN STAGES ROUTES ====================
  app.get("/api/kanban-stages", isAuthenticated, async (req, res) => {
    try {
      const stages = await storage.getAllKanbanStages();
      res.json(stages);
    } catch (error: any) {
      console.error("Error fetching kanban stages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/kanban-stages/:id", isAuthenticated, async (req, res) => {
    try {
      const { titulo, descricao, ordem } = req.body;
      const updated = await storage.updateKanbanStage(req.params.id, { titulo, descricao, ordem });
      if (!updated) {
        return res.status(404).json({ error: "Stage not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating kanban stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/kanban-stages", isAuthenticated, async (req, res) => {
    try {
      const { titulo, descricao, ordem } = req.body;
      const stage = await storage.createKanbanStage({ titulo, descricao, ordem: ordem || 0 });
      res.status(201).json(stage);
    } catch (error: any) {
      console.error("Error creating kanban stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/kanban-stages/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteKanbanStage(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting kanban stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== IMPORT ROUTES ====================
  app.post("/api/import/clients", isAuthenticated, async (req, res) => {
    try {
      const { data, mapping } = req.body; // data = array of rows, mapping = column mapping
      const user = (req.user as any);
      
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: "No data provided" });
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Helper to safely get row value
      const getRowValue = (row: any[], colIndex: number) => {
        if (colIndex < 0) return null;
        const val = row[colIndex];
        return val && val.toString().trim() !== "" ? val.toString().trim() : null;
      };

      // Process each row
      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i];
          const clientData = {
            nome: getRowValue(row, mapping.nome) || `Cliente ${i + 1}`,
            cnpj: getRowValue(row, mapping.cnpj) || getRowValue(row, mapping.cpfCnpj),
            status: getRowValue(row, mapping.status) || "lead",
            carteira: getRowValue(row, mapping.carteira),
            tipoCliente: getRowValue(row, mapping.tipo) || getRowValue(row, mapping.tipoCliente),
            parceiro: getRowValue(row, mapping.parceiro),
            celular: getRowValue(row, mapping.celular) || getRowValue(row, mapping.CELULAR_PRINCIPAL) || getRowValue(row, mapping.CELULAR) || getRowValue(row, mapping.telefone),
            telefone2: getRowValue(row, mapping.telefone2) || getRowValue(row, mapping.TELEFONE_COMERCIAL),
            email: getRowValue(row, mapping.email) || getRowValue(row, mapping.EMAIL_PRINCIPAL),
            nomeGestor: getRowValue(row, mapping.nomeGestor) || getRowValue(row, mapping.NOME_CONTATO),
            emailGestor: getRowValue(row, mapping.emailGestor),
            cpfGestor: getRowValue(row, mapping.cpfGestor),
            endereco: getRowValue(row, mapping.endereco),
            numero: getRowValue(row, mapping.numero),
            bairro: getRowValue(row, mapping.bairro),
            cep: getRowValue(row, mapping.cep),
            cidade: getRowValue(row, mapping.cidade),
            uf: getRowValue(row, mapping.uf),
            dataUltimoPedido: getRowValue(row, mapping.dataUltimoPedido),
            observacoes: getRowValue(row, mapping.observacoes),
            createdBy: user.id,
          };

          const validated = insertClientSchema.parse(clientData);
          await storage.createClient(validated);
          successCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(`Linha ${i + 1}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        successCount,
        errorCount,
        errors: errors.slice(0, 10), // Return first 10 errors only
      });
    } catch (error: any) {
      console.error("Error importing clients:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== ADOPT OLD CLIENTS ====================
  app.post("/api/import/adopt-old-clients", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      
      // Update all clients without a creator to be owned by this user
      const result = await db
        .update(clients)
        .set({ createdBy: user.id })
        .where(isNull(clients.createdBy))
        .returning();

      res.json({
        success: true,
        adoptedCount: result.length,
        message: `${result.length} clientes adotados com sucesso`,
      });
    } catch (error: any) {
      console.error("Error adopting old clients:", error);
      res.status(500).json({ error: "Erro ao adotar clientes" });
    }
  });

  // ==================== IMPORT PARTNERS ====================
  app.post("/api/admin/import-partners", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const { preview, parceiro, duplicatas } = req.body;
      
      if (!preview || !Array.isArray(preview)) {
        return res.status(400).json({ error: "Dados inválidos" });
      }

      // Get existing clients for duplicate checking
      const existingClients = await storage.getClients({
        userId: user.dbUser?.id || user.id,
        limit: 100000,
        isAdmin: false,
      });

      const existing = existingClients.clientes || [];
      const existingCNPJs = new Set(existing.map(c => c.cnpj).filter(Boolean));
      const existingEmails = new Set(existing.map(c => c.email).filter(Boolean));
      const existingPhones = new Set(existing.map(c => c.celular).filter(Boolean));

      let inserted = 0;
      let duplicados = 0;
      const errors: string[] = [];

      for (let i = 0; i < preview.length; i++) {
        try {
          const row = preview[i];
          
          // Skip empty rows
          if (!row.nome || (!row.cnpj && !row.email && !row.celular)) {
            duplicados++;
            continue;
          }

          // Check for duplicates
          if (row.cnpj && existingCNPJs.has(row.cnpj)) {
            duplicados++;
            continue;
          }
          if (row.email && existingEmails.has(row.email)) {
            duplicados++;
            continue;
          }
          if (row.celular && existingPhones.has(row.celular)) {
            duplicados++;
            continue;
          }

          // Map columns to schema
          const clientData = {
            nome: row.nome,
            cnpj: row.cnpj || row.CNPJ || null,
            email: row.email || row.Email || null,
            celular: row.celular || row.Celular || row.CELULAR || null,
            telefone2: row.telefone_2 || row.telefone2 || row.Telefone2 || null,
            status: row.status || "ativo",
            parceiro: parceiro,
            tipoCliente: row.tipo_cliente || row.tipoCliente || row.tipo || null,
            carteira: row.carteira || row.Carteira || null,
            nomeGestor: row.nome_gestor || row.nomeGestor || null,
            emailGestor: row.email_gestor || row.emailGestor || null,
            cpfGestor: row.cpf_gestor || row.cpfGestor || null,
            endereco: row.endereco || row.Endereco || null,
            numero: row.numero || row.Numero || null,
            bairro: row.bairro || row.Bairro || null,
            cep: row.cep || row.CEP || null,
            cidade: row.cidade || row.Cidade || null,
            uf: row.uf || row.UF || null,
            dataUltimoPedido: row.data_ultimo_pedido || null,
            observacoes: row.observacoes || row.Observacoes || null,
            createdBy: user.dbUser?.id || user.id,
          };

          const validated = insertClientSchema.parse(clientData);
          await storage.createClient(validated);
          
          // Add to existing sets to prevent duplicates in batch
          if (validated.cnpj) existingCNPJs.add(validated.cnpj);
          if (validated.email) existingEmails.add(validated.email);
          if (validated.celular) existingPhones.add(validated.celular);
          
          inserted++;
        } catch (error: any) {
          duplicados++;
          errors.push(`Linha ${i + 1}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        inserted,
        duplicados,
        errors: errors.slice(0, 5),
      });
    } catch (error: any) {
      console.error("Error importing partners:", error);
      res.status(500).json({ error: "Erro ao importar parceiros" });
    }
  });

  // ==================== STATS ROUTES ====================
  app.get("/api/stats/dashboard", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats((req.user as any).id);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/stats/funnel", isAuthenticated, async (req, res) => {
    try {
      const funnelData = await storage.getFunnelData((req.user as any).id);
      res.json(funnelData);
    } catch (error: any) {
      console.error("Error fetching funnel data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/stats/status-distribution", isAuthenticated, async (req, res) => {
    try {
      const distribution = await storage.getStatusDistribution((req.user as any).id);
      res.json(distribution);
    } catch (error: any) {
      console.error("Error fetching status distribution:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CAMPAIGN STATS ====================
  app.get("/api/stats/campaigns", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Campanhas concluídas hoje
      const completedToday = await db
        .select({ count: sql`count(*)` })
        .from(campaignsTable)
        .where(
          and(
            eq(campaignsTable.createdBy, user.id),
            eq(campaignsTable.status, "concluida"),
            sql`DATE(${campaignsTable.updatedAt}) = DATE(${new Date().toISOString()})`
          )
        );

      // Total enviado hoje
      const sentToday = await db
        .select({ total: sql`COALESCE(SUM(${campaignsTable.totalEnviados}), 0)` })
        .from(campaignsTable)
        .where(
          and(
            eq(campaignsTable.createdBy, user.id),
            sql`DATE(${campaignsTable.updatedAt}) = DATE(${new Date().toISOString()})`
          )
        );

      // Total enviado no mês
      const sentThisMonth = await db
        .select({ total: sql`COALESCE(SUM(${campaignsTable.totalEnviados}), 0)` })
        .from(campaignsTable)
        .where(
          and(
            eq(campaignsTable.createdBy, user.id),
            sql`DATE(${campaignsTable.updatedAt}) >= ${monthStart.toISOString()}`
          )
        );

      // Taxa de falha
      const failureStats = await db
        .select({
          totalEnviados: sql`COALESCE(SUM(${campaignsTable.totalEnviados}), 0)`,
          totalErros: sql`COALESCE(SUM(${campaignsTable.totalErros}), 0)`,
        })
        .from(campaignsTable)
        .where(eq(campaignsTable.createdBy, user.id));

      const totalSent = (failureStats[0]?.totalEnviados as number) || 0;
      const totalErrors = (failureStats[0]?.totalErros as number) || 0;
      const failureRate = totalSent > 0 ? Math.round((totalErrors / totalSent) * 100) : 0;

      res.json({
        campanhasCompletadasHoje: (completedToday[0]?.count as number) || 0,
        mensagensEnviadasHoje: (sentToday[0]?.total as number) || 0,
        mensagensEnviadasMes: (sentThisMonth[0]?.total as number) || 0,
        taxaFalha: failureRate,
        totalEnviados: totalSent,
        totalErros: totalErrors,
      });
    } catch (error: any) {
      console.error("Error fetching campaign stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== WHATSAPP ROUTES ====================
  app.get("/api/whatsapp/sessions", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      // Admin sees all sessions, non-admin sees only their own
      const userIdFilter = user.role === 'admin' ? undefined : user.id;
      const sessions = await storage.getAllWhatsappSessions(userIdFilter);
      
      // Sync status from memory to database (non-blocking)
      try {
        for (const session of sessions) {
          // Get live status from memory (connection state)
          let liveStatus = whatsappService.getSessionStatus(session.sessionId);
          
          // If status is "conectada", verify the connection is actually alive
          if (liveStatus === "conectada") {
            const isAlive = await whatsappService.isSessionAlive(session.sessionId);
            if (!isAlive) {
              liveStatus = "desconectada";
              console.log(`💀 Conexão morta detectada para ${session.sessionId} - marcando como desconectada`);
            }
          }
          
          // Status from memory is the source of truth
          // Don't automatically mark as "conectada" just because credentials exist
          // That would hide real disconnections from the user
          
          if (liveStatus !== session.status) {
            console.log(`🔄 Sincronizando status da sessão ${session.sessionId}: ${session.status} → ${liveStatus}`);
            await storage.updateWhatsappSession(session.id, { status: liveStatus });
          }
        }
      } catch (syncError: any) {
        console.warn("⚠️ Erro ao sincronizar status (continuando anyway):", syncError.message);
      }
      
      // Fetch updated sessions (with same filter)
      const updatedSessions = await storage.getAllWhatsappSessions(userIdFilter);
      res.json(updatedSessions);
    } catch (error: any) {
      console.error("Error fetching WhatsApp sessions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Check WhatsApp connection status
  app.get("/api/whatsapp/status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const sessions = await storage.getAllWhatsappSessions(user.id);
      const connectedSession = sessions.find((s: any) => s.status === "conectada");
      
      res.json({
        connected: !!connectedSession,
        sessionId: connectedSession?.sessionId || null,
        message: connectedSession ? "WhatsApp conectado" : "WhatsApp não conectado. Por favor, conecte antes de enviar campanhas.",
      });
    } catch (error: any) {
      console.error("Error checking WhatsApp status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/whatsapp/connect", isAuthenticated, async (req, res) => {
    try {
      const { nome } = req.body;
      if (!nome) {
        return res.status(400).json({ error: "Nome da sessão é obrigatório" });
      }

      const sessionId = `session_${Date.now()}`;
      const session = await storage.createWhatsappSession({
        nome,
        sessionId,
        status: "desconectada",
        userId: (req.user as any).id,
      });

      // Initialize WhatsApp connection and get QR code
      let qrCodeUrl = "";
      try {
        console.log("🔄 Iniciando conexão Baileys para sessão:", sessionId);
        await whatsappService.initializeWhatsAppSession(sessionId, (req.user as any).id);
        
        // Wait for QR code to be generated (Baileys needs time)
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          qrCodeUrl = whatsappService.getQRCode(sessionId) || "";
          if (qrCodeUrl) {
            console.log("✅ QR code obtido com sucesso para sessão:", sessionId, "após", i * 500, "ms");
            break;
          }
        }
        
        if (!qrCodeUrl) {
          console.warn("⚠️ QR code não foi gerado para sessão:", sessionId);
        }
      } catch (err) {
        console.error("Erro ao gerar QR code via Baileys:", err);
        qrCodeUrl = "";
      }

      res.json({ 
        session, 
        sessionId, 
        qrCode: qrCodeUrl,
        success: true
      });
    } catch (error: any) {
      console.error("Error creating WhatsApp session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/whatsapp/sessions/:id/reconnect", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.getWhatsappSessionById(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Sessão não encontrada" });
      }

      // Verify ownership - only owner can reconnect
      if (session.userId !== (req.user as any).id) {
        return res.status(403).json({ error: "Não autorizado - essa sessão não é sua" });
      }

      // Close old session
      if (session.sessionId) {
        whatsappService.closeSession(session.sessionId);
      }

      // Reset session status and generate new QR code
      const newSessionId = `session_${Date.now()}`;
      let qrCodeUrl = "";
      
      try {
        console.log("🔄 Reconectando sessão com novo ID:", newSessionId);
        await whatsappService.initializeWhatsAppSession(newSessionId, session.userId || undefined);
        
        // Wait for QR code to be generated (Baileys needs time)
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          qrCodeUrl = whatsappService.getQRCode(newSessionId) || "";
          if (qrCodeUrl) {
            console.log("✅ QR code reconectado com sucesso para sessão:", newSessionId, "após", i * 500, "ms");
            break;
          }
        }
        
        if (!qrCodeUrl) {
          console.warn("⚠️ QR code não foi gerado para reconectar:", newSessionId);
        }
      } catch (err) {
        console.error("Erro ao reconectar sessão:", err);
      }

      // Update session with new ID and reset status
      const updatedSession = await storage.updateWhatsappSession(req.params.id, {
        sessionId: newSessionId,
        status: "desconectada",
        qrCode: qrCodeUrl || null,
      });

      res.json({ 
        session: updatedSession, 
        sessionId: newSessionId, 
        qrCode: qrCodeUrl,
        success: true
      });
    } catch (error: any) {
      console.error("Error reconnecting WhatsApp session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/whatsapp/sessions/:id", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.getWhatsappSessionById(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Sessão não encontrada" });
      }

      // Verify ownership - only owner can delete
      if (session.userId !== (req.user as any).id) {
        return res.status(403).json({ error: "Não autorizado - essa sessão não é sua" });
      }

      // Close WhatsApp connection
      if (session.sessionId) {
        whatsappService.closeSession(session.sessionId);
      }

      const [deleted] = await db
        .delete(whatsappSessions)
        .where(eq(whatsappSessions.id, req.params.id))
        .returning();

      res.json({ success: true, deleted });
    } catch (error: any) {
      console.error("Error deleting WhatsApp session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== WHATSAPP BROADCAST ROUTES ====================
  app.post("/api/whatsapp/broadcast/preview", isAuthenticated, async (req, res) => {
    try {
      const { sessionId, filtros } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId é obrigatório" });
      }

      // Verify session ownership - only owner can use
      const session = await storage.getWhatsappSessionBySessionId(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Sessão não encontrada" });
      }

      if (session.userId !== (req.user as any).id) {
        return res.status(403).json({ error: "Não autorizado - essa sessão não é sua" });
      }

      // Get stats
      const stats = await storage.getBroadcastStats(filtros);
      
      res.json(stats);
    } catch (error: any) {
      console.error("Error getting broadcast preview:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/whatsapp/broadcast/send", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const { 
        sessionId, 
        mensagem, 
        filtros,
        // ✅ Novos parâmetros para unificação com agendamentos
        campanhaNome = "Envio Imediato",
        origemDisparo = "envio_imediato",
        dataAgendada,
        tempoFixoSegundos = 21,
        tempoAleatorioMin = 10,
        tempoAleatorioMax = 60,
      } = req.body;
      
      if (!sessionId || !mensagem) {
        return res.status(400).json({ error: "sessionId e mensagem são obrigatórios" });
      }

      // Verify session ownership - only owner can use
      const session = await storage.getWhatsappSessionBySessionId(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Sessão não encontrada" });
      }

      if (session.userId !== user.id) {
        return res.status(403).json({ error: "Não autorizado - essa sessão não é sua" });
      }

      // ✅ Converter "NOW" para data atual (segundos à frente)
      let agendadaPara = new Date(dataAgendada || new Date());
      agendadaPara.setSeconds(agendadaPara.getSeconds() + 3); // 3 segundos de delay
      
      // ✅ Criar campanha com schema validado (consistente com /api/campaigns/schedule)
      // ✅ Salvar origemDisparo nos filtros para exibição no histórico
      const validatedData = insertCampaignSchema.parse({
        nome: campanhaNome,
        tipo: "whatsapp",
        templateId: null, // Broadcasts não usam templates - só mensagem direta
        status: "agendada",
        filtros: { ...(filtros || {}), origemDisparo },
        totalRecipients: 0,
        agendadaPara,
        tempoFixoSegundos,
        tempoAleatorioMin,
        tempoAleatorioMax,
        createdBy: user.id,
      });

      const [campaign] = await db.insert(campaignsTable).values(validatedData).returning();

      console.log(`✅ BROADCAST UNIFICADO: Campanha ${campaign.id} agendada para ${agendadaPara.toISOString()} (origem: ${origemDisparo})`);

      // Get clients to send to (for response info)
      const clientes = await storage.getClientsForBroadcast(filtros);
      
      // ✅ CRÍTICO: Adicionar clientIds e conteudo ao filtros para que o cron job execute corretamente
      // ✅ CORRIGIDO: Manter origemDisparo nos filtros (não sobrescrever!)
      const clientIds = clientes.map(c => c.id);
      if (clientIds.length > 0) {
        await db.update(campaignsTable)
          .set({ 
            filtros: { ...(filtros || {}), clientIds, conteudo: mensagem, origemDisparo },
            totalRecipients: clientIds.length 
          })
          .where(eq(campaignsTable.id, campaign.id));
        console.log(`✅ Campanha ${campaign.id} atualizada com ${clientIds.length} clientes, conteúdo e origem: ${origemDisparo}`);
      }
      
      res.json({ 
        success: true,
        campanhaId: campaign.id,
        total: clientes.length,
        agendadaPara: agendadaPara.toISOString(),
        mensagem: `Campanha de ${origemDisparo} agendada para envio imediato`,
      });
    } catch (error: any) {
      console.error("Error sending broadcast:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para enviar campanha em background (retorna imediatamente)
  app.post("/api/whatsapp/enviar-campanha-background", isAuthenticated, async (req, res) => {
    try {
      const { contatos, template, tempoDelay } = req.body;
      
      if (!contatos || !Array.isArray(contatos) || contatos.length === 0) {
        return res.status(400).json({ error: "contatos é obrigatório" });
      }
      
      if (!template) {
        return res.status(400).json({ error: "template é obrigatório" });
      }

      const user = (req.user as any);
      // ✅ INDIVIDUAL: Sempre usa a sessão do próprio usuário (não importa se admin)
      const sessaoConectada = await storage.getConnectedSessionByUserId(user.id);
      
      if (!sessaoConectada) {
        return res.status(400).json({ error: "Você não tem sessão WhatsApp conectada. Conecte seu WhatsApp primeiro." });
      }

      // Create campaign tracking ID
      const campanhaId = `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      campanhasEmProgresso.set(campanhaId, {
        userId: user.id,
        id: campanhaId,
        total: contatos.length,
        enviadas: 0,
        erros: 0,
        status: "em_progresso",
        criadoEm: new Date(),
        parar: false,
      });

      // Return immediately with campaign ID
      res.json({ 
        success: true,
        campanhaId,
        mensagem: "Campanha iniciada em background",
        total: contatos.length
      });

      // Process messages in background (don't wait for response)
      (async () => {
        let enviadas = 0;
        let erros = 0;
        
        for (let i = 0; i < contatos.length; i++) {
          // Check if campaign was cancelled
          const campanhaCurrent = campanhasEmProgresso.get(campanhaId);
          if (campanhaCurrent && campanhaCurrent.parar) {
            console.log(`⏹️ Campanha ${campanhaId} foi cancelada. Parando envio.`);
            break;
          }

          try {
            const contato = contatos[i];
            const telefone = contato.celular || "";
            const clientId = contato.id || "";
            
            if (!telefone) continue;

            // Replace variables in template
            let mensagem = template;
            for (const [chave, valor] of Object.entries(contato)) {
              const regex = new RegExp(`\\{${chave}\\}`, "g");
              mensagem = mensagem.replace(regex, String(valor || ""));
            }

            // Send message
            try {
              const isAlive = await whatsappService.isSessionAlive(sessaoConectada.sessionId);
              if (!isAlive) {
                console.error("Sessão WhatsApp não está mais conectada");
                break;
              }

              const result = await whatsappService.sendMessage(sessaoConectada.sessionId, telefone, mensagem);
              if (!result.success) {
                console.warn(`⚠️ Falha ao enviar para ${telefone}`);
                erros++;
                continue;
              }
              enviadas++;
              
              // Update client status to "enviado"
              if (clientId) {
                try {
                  await storage.updateClient(clientId, { status: "Enviado" });
                  console.log(`✅ Status do cliente ${clientId} atualizado para "Enviado"`);
                } catch (err) {
                  console.warn("Erro ao atualizar status do cliente:", err);
                }
              }
              
              // Record interaction in timeline
              if (clientId) {
                try {
                  await storage.createInteraction({
                    clientId,
                    tipo: "whatsapp_enviado",
                    origem: "system",
                    titulo: "Mensagem WhatsApp enviada",
                    texto: mensagem.substring(0, 200),
                    meta: {
                      telefone,
                      sessionId: sessaoConectada.sessionId,
                      timestamp: new Date().toISOString(),
                    } as any,
                    createdBy: user.id,
                  });
                } catch (err) {
                  console.warn("Erro ao registrar interação:", err);
                }
              }
            } catch (err) {
              console.error(`Erro ao enviar para ${telefone}:`, err);
              erros++;
            }

            // Update tracking
            const campanha = campanhasEmProgresso.get(campanhaId);
            if (campanha) {
              campanha.enviadas = enviadas;
              campanha.erros = erros;
            }

            // Wait before next message
            if (i < contatos.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, (tempoDelay || 40) * 1000));
            }
          } catch (err) {
            console.error("Erro processando contato:", err);
            erros++;
          }
        }
        
        // Mark as completed
        const campanha = campanhasEmProgresso.get(campanhaId);
        if (campanha) {
          campanha.status = "concluida";
        }
        
        console.log(`Campanha ${campanhaId} concluída: ${enviadas} enviadas, ${erros} erros`);
        
        // Also update in database to persist status
        try {
          const { campaigns: campaignsTable } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          
          await db.update(campaignsTable)
            .set({ status: "concluida" })
            .where(eq(campaignsTable.id, campanhaId));
          
          console.log(`✅ Status da campanha atualizado no BD: ${campanhaId}`);
        } catch (err) {
          console.warn(`⚠️ Erro ao atualizar status da campanha no BD:`, err);
        }
        
        // Clean up after 1 hour
        setTimeout(() => campanhasEmProgresso.delete(campanhaId), 3600000);
      })().catch((err) => console.error("Erro na campanha de background:", err));
    } catch (error: any) {
      console.error("Error in background campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para obter status de campanhas em progresso
  app.get("/api/whatsapp/campanhas-em-progresso", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const campanhas = Array.from(campanhasEmProgresso.values())
        .filter(c => c.userId === user.id)
        .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
      
      res.json(campanhas);
    } catch (error: any) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Pausar campanha em execução
  app.post("/api/campaigns/:id/pause", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Tenta pausar em memory primeiro
      const campanha = campanhasEmProgresso.get(id);
      if (campanha) {
        campanha.status = "cancelada";
      }

      // Também atualiza no banco de dados
      const { campaigns: campaignsTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      await db.update(campaignsTable)
        .set({ status: "cancelada" })
        .where(eq(campaignsTable.id, id));
      
      console.log(`⏸️  Campanha ${id} pausada`);
      res.json({ success: true, message: "Campanha pausada", campaignId: id });
    } catch (error: any) {
      console.error("Error pausing campaign:", error);
      res.status(500).json({ error: "Erro ao pausar campanha" });
    }
  });

  // Deletar/Cancelar campanha em execução
  app.post("/api/campaigns/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Marca para parar
      const campanha = campanhasEmProgresso.get(id);
      if (campanha) {
        campanha.parar = true;
      }
      
      // Remove do memory após um pequeno delay para garantir que parou
      setTimeout(() => campanhasEmProgresso.delete(id), 1000);

      // Também deleta do banco de dados
      const { campaigns: campaignsTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      await db.delete(campaignsTable)
        .where(eq(campaignsTable.id, id));
      
      console.log(`❌ Campanha ${id} cancelada e removida`);
      res.json({ success: true, message: "Campanha cancelada", campaignId: id });
    } catch (error: any) {
      console.error("Error canceling campaign:", error);
      res.status(500).json({ error: "Erro ao cancelar campanha" });
    }
  });

  // Cancelar TODAS as campanhas em execução
  app.post("/api/campaigns/cancel-all", isAuthenticated, async (req, res) => {
    try {
      const { campaigns: campaignsTable } = await import("@shared/schema");
      
      // Marcar todas as campanhas em memory como canceladas
      const canceledIds: string[] = [];
      for (const [id, campanha] of campanhasEmProgresso.entries()) {
        campanha.parar = true;
        canceledIds.push(id);
        setTimeout(() => campanhasEmProgresso.delete(id), 1000);
      }
      
      // Deletar todas as campanhas do banco de dados
      if (canceledIds.length > 0) {
        await db.delete(campaignsTable);
      }
      
      console.log(`❌ TODAS as ${canceledIds.length} campanhas foram canceladas`);
      res.json({ 
        success: true, 
        message: `${canceledIds.length} campanha(s) cancelada(s)`, 
        canceledCount: canceledIds.length,
        canceledIds 
      });
    } catch (error: any) {
      console.error("Error canceling all campaigns:", error);
      res.status(500).json({ error: "Erro ao cancelar campanhas" });
    }
  });

  // Reprocessar campanha com erro
  app.post("/api/campaigns/:id/retry", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      const { campaigns: campaignsTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Buscar campanha no banco
      const [campaign] = await db
        .select()
        .from(campaignsTable)
        .where(eq(campaignsTable.id, id));
      
      if (!campaign) {
        return res.status(404).json({ error: "Campanha não encontrada" });
      }
      
      // Verificar se a campanha pertence ao usuário (ou se é admin)
      if (user.role !== 'admin' && campaign.createdBy !== user.id) {
        return res.status(403).json({ error: "Sem permissão para reprocessar esta campanha" });
      }
      
      // Verificar se a campanha está com status "erro"
      if (campaign.status !== 'erro') {
        return res.status(400).json({ error: "Apenas campanhas com erro podem ser reprocessadas" });
      }
      
      // ✅ GUARD: Verificar se campanha já está em progresso
      const emProgressoValues = Array.from(campanhasEmProgresso.values());
      const jaEmProgresso = emProgressoValues.some(c => c.id === id);
      if (jaEmProgresso) {
        return res.status(409).json({ 
          error: "Campanha já está sendo processada" 
        });
      }
      
      // Verificar se o usuário tem sessão WhatsApp conectada
      const ownerId = campaign.createdBy || user.id;
      const userSession = await storage.getConnectedSessionByUserId(ownerId);
      if (!userSession) {
        return res.status(400).json({ 
          error: "Conecte seu WhatsApp antes de reprocessar a campanha" 
        });
      }
      
      // Reagendar campanha para execução imediata
      const now = new Date();
      await db.update(campaignsTable)
        .set({ 
          status: 'agendada',
          agendadaPara: now,
          totalErros: 0,  // Reset erros
        })
        .where(eq(campaignsTable.id, id));
      
      console.log(`🔄 Campanha ${id} reagendada para reprocessamento (manual)`);
      res.json({ 
        success: true, 
        message: "Campanha reagendada para execução", 
        campaignId: id 
      });
    } catch (error: any) {
      console.error("Error retrying campaign:", error);
      res.status(500).json({ error: "Erro ao reprocessar campanha" });
    }
  });

  // New endpoint for single message sending from campaigns page
  app.post("/api/whatsapp/enviar-broadcast", isAuthenticated, async (req, res) => {
    try {
      const { telefone, mensagem, clientId } = req.body;
      
      if (!telefone || !mensagem) {
        return res.status(400).json({ error: "telefone e mensagem são obrigatórios" });
      }

      // ✅ INDIVIDUAL: Sempre usa a sessão do próprio usuário (não importa se admin)
      const user = (req.user as any);
      const sessaoConectada = await storage.getConnectedSessionByUserId(user.id);
      
      if (!sessaoConectada) {
        return res.status(400).json({ error: "Você não tem sessão WhatsApp conectada. Conecte seu WhatsApp primeiro." });
      }

      // Verify the session is actually alive
      const isAlive = await whatsappService.isSessionAlive(sessaoConectada.sessionId);
      if (!isAlive) {
        return res.status(400).json({ error: "Sessão WhatsApp não está mais conectada" });
      }

      // Send the message
      try {
        const result = await whatsappService.sendMessage(sessaoConectada.sessionId, telefone, mensagem);
        
        if (!result.success) {
          return res.status(500).json({ error: "Falha ao enviar mensagem via WhatsApp" });
        }
        
        // Update client status to "Enviado" if clientId is provided
        if (clientId) {
          try {
            await storage.updateClient(clientId, { status: "Enviado" });
            console.log(`✅ Status do cliente ${clientId} atualizado para "Enviado"`);
          } catch (err) {
            console.warn("Erro ao atualizar status do cliente:", err);
          }
        }
        
        // Record interaction in timeline if clientId is provided
        if (clientId) {
          try {
            await storage.createInteraction({
              clientId,
              tipo: "whatsapp_enviado",
              origem: "system",
              titulo: "Mensagem WhatsApp enviada",
              texto: mensagem.substring(0, 200),
              meta: {
                telefone,
                sessionId: sessaoConectada.sessionId,
                timestamp: new Date().toISOString(),
              } as any,
              createdBy: user.id,
            });
          } catch (err) {
            console.warn("Erro ao registrar interação:", err);
            // Don't fail the whole request if interaction logging fails
          }
        }
        
        res.json({ 
          success: true,
          mensagem: "Mensagem enviada com sucesso"
        });
      } catch (sendError: any) {
        console.error("Erro ao enviar mensagem:", sendError);
        res.status(400).json({ 
          error: sendError.message || "Erro ao enviar mensagem"
        });
      }
    } catch (error: any) {
      console.error("Error in whatsapp broadcast:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para listar histórico de campanhas de um cliente
  app.get("/api/clients/:clientId/campaign-history", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.params;

      const history = await db
        .select({
          id: interactions.id,
          titulo: interactions.titulo,
          texto: interactions.texto,
          createdAt: interactions.createdAt,
          meta: interactions.meta,
        })
        .from(interactions)
        .where(eq(interactions.clientId, clientId));

      res.json(history);
    } catch (error: any) {
      console.error("Error fetching campaign history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CHAT ROUTES ====================
  app.get("/api/chat/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      // Parâmetro para mostrar conversas ocultas (default: false)
      const showHidden = req.query.showHidden === 'true';
      const conversas = await storage.getConversations(user.id, showHidden);
      res.json(conversas);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle conversation hidden status (database + WebSocket broadcast)
  app.patch("/api/chat/conversations/:conversationId/toggle-hidden", isAuthenticated, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { oculta } = req.body;
      const user = (req.user as any);

      if (typeof oculta !== 'boolean') {
        return res.status(400).json({ error: "Campo 'oculta' deve ser boolean" });
      }

      const updated = await storage.toggleConversationHidden(conversationId, user.id, oculta);
      
      if (!updated) {
        return res.status(403).json({ error: "Conversa não encontrada ou acesso negado" });
      }

      // Broadcast via WebSocket to all clients
      const message = {
        type: "conversation_hidden_toggled",
        conversationId,
        oculta,
        userId: user.id,
      };
      
      // Send to WebSocket connections
      wsClients.forEach((client) => {
        try {
          client.send(JSON.stringify(message));
        } catch (err) {
          console.error("Erro ao enviar WebSocket message:", err);
        }
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error toggling conversation hidden:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle conversation unread status (marcar como não lida)
  app.patch("/api/chat/conversations/:conversationId/toggle-unread", isAuthenticated, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { naoLida } = req.body;
      const user = (req.user as any);

      if (typeof naoLida !== 'boolean') {
        return res.status(400).json({ error: "Campo 'naoLida' deve ser boolean" });
      }

      const [updated] = await db
        .update(conversations)
        .set({ naoLida })
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
        .returning();
      
      if (!updated) {
        return res.status(403).json({ error: "Conversa não encontrada ou acesso negado" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error toggling conversation unread:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/chat/messages/:conversationId", isAuthenticated, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const user = (req.user as any);

      // Verificar se a conversa pertence ao usuário
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
        .limit(1);

      if (!conversation) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const msgs = await storage.getMessages(conversationId);
      res.json(msgs);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/chat/messages/:conversationId", isAuthenticated, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { conteudo, tipo = "texto", arquivo, nomeArquivo, tamanho, mimeType } = req.body;
      const user = (req.user as any);

      if (!conteudo && tipo === "texto") {
        return res.status(400).json({ error: "Conteúdo obrigatório" });
      }

      // Verificar se a conversa pertence ao usuário
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
        .limit(1);

      if (!conversation) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      // Verificar permissão ao cliente compartilhado
      if (conversation.clientId) {
        const access = await storage.checkClientAccess(conversation.clientId, user.id);
        if (!access.canAccess) {
          return res.status(403).json({ error: "Você não tem acesso a este cliente" });
        }
        // Se tiver permissão "visualizar", não pode enviar mensagens
        if (access.permissao === "visualizar") {
          return res.status(403).json({ error: "Você só pode visualizar este cliente, não pode enviar mensagens" });
        }
      }

      const mensagem = await storage.createMessage({
        conversationId,
        sender: "user",
        tipo,
        conteudo,
        arquivo,
        nomeArquivo,
        tamanho,
        mimeType,
      });

      // 🤖 ANÁLISE IA - Background (fire-and-forget para resposta instantânea)
      if (tipo === "texto" && conteudo && conversation.clientId) {
        // Não aguarda análise - deixa rodar em background
        (async () => {
          try {
            const [client] = await db.select().from(clients).where(eq(clients.id, conversation.clientId)).limit(1);
            
            // ✅ BUSCAR OPORTUNIDADE ABERTA DO CLIENTE DESTE VENDEDOR (excluindo FECHADO/PERDIDO)
            const openOpp = await storage.getOpenOpportunityForClient(conversation.clientId, user.id);

            const analysis = await analyzeClientMessage(conteudo, {
              nome: client?.nome,
              etapaAtual: openOpp?.etapa,
            });

            console.log(`🤖 [Chat] "${conteudo}" → etapa: ${analysis.etapa}, deveAgir: ${analysis.deveAgir}, openOpp: ${openOpp?.etapa || "NENHUMA"}`);

            // ✅ REGRA SIMPLIFICADA:
            // - Se tem oportunidade ABERTA → ATUALIZA essa
            // - Se NÃO tem oportunidade aberta → CRIA nova
            
            if (openOpp) {
              // ✅ TEM NEGÓCIO ABERTO → ATUALIZAR (se etapa válida, diferente e pode agir)
              const etapaValida = analysis.etapa && analysis.etapa !== "" && analysis.etapa !== "AUTOMÁTICA";
              if (etapaValida && openOpp.etapa !== analysis.etapa && analysis.deveAgir) {
                await db.update(opportunities).set({ etapa: analysis.etapa }).where(eq(opportunities.id, openOpp.id));
                console.log(`✅ [Chat] Oportunidade ATUALIZADA de ${openOpp.etapa} para ${analysis.etapa}`);
              } else {
                console.log(`ℹ️ [Chat] Oportunidade mantida em ${openOpp.etapa} (etapaValida=${etapaValida}, deveAgir=${analysis.deveAgir})`);
              }
            } else {
              // ✅ NÃO TEM NEGÓCIO ABERTO → VALIDAR E CRIAR NOVO
              const isPropostaAction = analysis.intenção === "aprovacao_envio" || analysis.etapa === "PROPOSTA";
              const creationValidation = await validateOpportunityCreation(
                conversation.clientId,
                analysis,
                true, // isClientMessage = true (vem de webhook/chat)
                conversationId, // passa conversationId para validação de 30 min
                isPropostaAction // indica se é ação PROPOSTA (lista de aprovação)
              );

              if (creationValidation.podecriar) {
                const novaOpp = await storage.createOpportunity({
                  clientId: conversation.clientId,
                  titulo: `${client?.nome} - Novo Negócio`,
                  etapa: creationValidation.etapa,
                  userId: user.id,
                });
                console.log(`🆕 [Chat] NOVO negócio CRIADO em ${creationValidation.etapa}`);
              } else {
                console.log(`ℹ️ [Chat] Nenhum negócio criado - ${creationValidation.motivo}`);
              }
            }
          } catch (iaError) {
            console.error("⚠️ [Chat] Erro na análise IA:", iaError);
          }
        })();
      }

      // 🚀 ENVIAR MENSAGEM PARA WHATSAPP (ou marcar como pendente_offline)
      try {
        if (conversation && conversation.clientId) {
          // Pega a sessão do usuário
          const [session] = await db
            .select()
            .from(whatsappSessions)
            .where(and(eq(whatsappSessions.userId, user.id), eq(whatsappSessions.status, "conectada")))
            .limit(1);

          // Pega o cliente para obter o telefone
          const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, conversation.clientId))
            .limit(1);

          if (!session || !whatsappService.isSessionAlive(session.sessionId)) {
            // 📬 OFFLINE: Salvar na fila para enviar quando reconectar
            console.log(`📬 [OFFLINE] Sessão não conectada - salvando mensagem ${mensagem.id} na fila offline`);
            await db.update(messages)
              .set({ statusEntrega: 'pendente_offline' })
              .where(eq(messages.id, mensagem.id));
          } else if (client && client.celular) {
            // Formata o telefone para WhatsApp
            let telefone = client.celular.replace(/\D/g, "");
            if (!telefone.startsWith("55")) {
              telefone = "55" + telefone;
            }

            // Envia a mensagem e captura o messageId
            let sendResult: { success: boolean; messageId?: string } = { success: false };
            
            if (tipo === "texto") {
              sendResult = await whatsappService.sendMessage(session.sessionId, telefone, conteudo);
              if (sendResult.success) {
                console.log(`✅ Mensagem enviada para WhatsApp: ${telefone} (msgId: ${sendResult.messageId})`);
              }
            } else if (tipo === "imagem" && arquivo) {
              sendResult = await whatsappService.sendImage(session.sessionId, telefone, arquivo, conteudo);
              if (sendResult.success) console.log(`✅ Imagem enviada para WhatsApp: ${telefone} (msgId: ${sendResult.messageId})`);
            } else if (tipo === "audio" && arquivo) {
              sendResult = await whatsappService.sendAudio(session.sessionId, telefone, arquivo);
              if (sendResult.success) console.log(`✅ Áudio enviado para WhatsApp: ${telefone} (msgId: ${sendResult.messageId})`);
            } else if (tipo === "documento" && arquivo) {
              sendResult = await whatsappService.sendDocument(session.sessionId, telefone, arquivo, nomeArquivo);
              if (sendResult.success) console.log(`✅ Documento enviado para WhatsApp: ${telefone} (msgId: ${sendResult.messageId})`);
            }
            
            // Atualiza a mensagem com o whatsappMessageId e statusEntrega
            if (sendResult.success && sendResult.messageId) {
              try {
                await db.update(messages)
                  .set({ 
                    whatsappMessageId: sendResult.messageId,
                    statusEntrega: 'enviado'
                  })
                  .where(eq(messages.id, mensagem.id));
                console.log(`✅ Mensagem ${mensagem.id} atualizada com msgId ${sendResult.messageId}`);
              } catch (err) {
                console.warn("Erro ao atualizar mensagem com msgId:", err);
              }
            } else if (!sendResult.success) {
              // Falhou ao enviar - marcar como pendente_offline para retry
              console.log(`📬 [OFFLINE] Falha no envio - salvando mensagem ${mensagem.id} na fila offline`);
              await db.update(messages)
                .set({ statusEntrega: 'pendente_offline' })
                .where(eq(messages.id, mensagem.id));
            }
            
            // Update client status to "Enviado"
            if (sendResult.success && conversation.clientId) {
              try {
                await storage.updateClient(conversation.clientId, { status: "Enviado" });
                console.log(`✅ Status do cliente ${conversation.clientId} atualizado para "Enviado"`);
              } catch (err) {
                console.warn("Erro ao atualizar status do cliente:", err);
              }
            }
          }
        }
      } catch (whatsappError) {
        console.warn("⚠️ Mensagem salva mas não enviada para WhatsApp:", whatsappError);
        // Marcar como pendente_offline para retry automático
        try {
          await db.update(messages)
            .set({ statusEntrega: 'pendente_offline' })
            .where(eq(messages.id, mensagem.id));
        } catch (err) {
          console.warn("Erro ao marcar como pendente_offline:", err);
        }
      }

      res.json(mensagem);
    } catch (error: any) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete message for everyone (WhatsApp + DB)
  app.delete("/api/chat/messages/:messageId", isAuthenticated, async (req, res) => {
    try {
      const { messageId } = req.params;
      const user = (req.user as any);

      // Buscar a mensagem
      const [msg] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!msg) {
        return res.status(404).json({ error: "Mensagem não encontrada" });
      }

      // Buscar a conversa
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, msg.conversationId))
        .limit(1);

      if (!conversation || conversation.userId !== user.id) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      console.log(`🗑️ [DELETE ENDPOINT] Mensagem encontrada: id=${msg.id}, whatsappMessageId=${msg.whatsappMessageId}, clientId=${conversation.clientId}`);
      
      // Tentar deletar no WhatsApp se houver messageId
      if (msg.whatsappMessageId && conversation.clientId) {
        console.log(`🗑️ [DELETE ENDPOINT] Tem whatsappMessageId, buscando cliente...`);
        try {
          // Buscar telefone do cliente diretamente do banco
          const [cliente] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, conversation.clientId))
            .limit(1);
          const telefone = cliente?.celular || cliente?.telefone2;
          
          console.log(`🗑️ [DELETE ENDPOINT] Cliente: ${cliente?.nome}, telefone: ${telefone}`);
          
          if (telefone) {
            // Buscar sessão WhatsApp ativa do usuário
            const [session] = await db
              .select()
              .from(whatsappSessions)
              .where(and(
                eq(whatsappSessions.userId, user.id),
                eq(whatsappSessions.status, "conectada")
              ))
              .limit(1);

            console.log(`🗑️ [DELETE ENDPOINT] Sessão encontrada: ${session?.sessionId || 'NENHUMA'}`);

            if (session) {
              const deleted = await whatsappService.deleteMessageForEveryone(
                session.sessionId,
                telefone,
                msg.whatsappMessageId
              );
              if (deleted) {
                console.log(`✅ Mensagem deletada no WhatsApp para ${telefone}`);
              } else {
                console.warn(`⚠️ Não foi possível deletar no WhatsApp, mas será removida do sistema`);
              }
            } else {
              console.warn(`⚠️ [DELETE ENDPOINT] Nenhuma sessão WhatsApp conectada`);
            }
          } else {
            console.warn(`⚠️ [DELETE ENDPOINT] Cliente sem telefone`);
          }
        } catch (whatsappError) {
          console.warn("⚠️ Erro ao deletar no WhatsApp:", whatsappError);
        }
      } else {
        console.log(`⚠️ [DELETE ENDPOINT] Sem whatsappMessageId (${msg.whatsappMessageId}) ou clientId (${conversation.clientId})`);
      }

      // Marcar mensagem como deletada (ao invés de remover)
      await db.update(messages)
        .set({ 
          conteudo: "🚫 Mensagem apagada",
          tipo: "deletada",
          arquivo: null,
          nomeArquivo: null
        })
        .where(eq(messages.id, messageId));
      
      console.log(`✅ Mensagem ${messageId} marcada como deletada para todos`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Forward message to another client or phone number
  app.post("/api/chat/forward-message", isAuthenticated, async (req, res) => {
    try {
      const { 
        messageId, 
        targetClientId, 
        targetPhone, 
        messageContent, 
        messageType,
        arquivo,
        nomeArquivo,
        mimeType
      } = req.body;
      const user = (req.user as any);

      if (!targetPhone) {
        return res.status(400).json({ error: "Número de telefone é obrigatório" });
      }

      if (!messageContent && messageType === "texto") {
        return res.status(400).json({ error: "Conteúdo da mensagem é obrigatório" });
      }

      // Normalize phone number
      let normalizedPhone = targetPhone.replace(/\D/g, '');
      if (!normalizedPhone.startsWith('55')) {
        normalizedPhone = '55' + normalizedPhone;
      }

      console.log(`📤 [FORWARD] Encaminhando mensagem para ${normalizedPhone}`);

      // ✅ INDIVIDUAL: Busca a sessão do próprio usuário
      const session = await storage.getConnectedSessionByUserId(user.id);
      if (!session) {
        return res.status(400).json({ error: "Você não tem sessão WhatsApp conectada. Conecte seu WhatsApp primeiro." });
      }

      // Get or create conversation with target client
      let targetConversation;
      let targetClient;
      
      if (targetClientId) {
        // Use existing client
        targetClient = await storage.getClientById(targetClientId);
        
        // Find or create conversation with existing client
        const existingConv = await db.select().from(conversations)
          .where(and(
            eq(conversations.clientId, targetClientId),
            eq(conversations.userId, user.id)
          ))
          .limit(1);
        
        if (existingConv.length > 0) {
          targetConversation = existingConv[0];
        } else {
          // Create new conversation
          const [newConv] = await db.insert(conversations).values({
            clientId: targetClientId,
            userId: user.id,
            canal: "whatsapp",
            ativa: true,
            createdAt: new Date(),
          }).returning();
          targetConversation = newConv;
        }
      } else {
        // For custom phone numbers, find or create client first
        const existingClients = await db.select().from(clients)
          .where(eq(clients.celular, normalizedPhone))
          .limit(1);
        
        if (existingClients.length > 0) {
          targetClient = existingClients[0];
        } else {
          // Create new client for this phone number
          const [newClient] = await db.insert(clients).values({
            nome: `Contato ${normalizedPhone}`,
            celular: normalizedPhone,
            userId: user.id,
            status: "lead_quente",
            createdAt: new Date(),
          }).returning();
          targetClient = newClient;
          console.log(`📝 [FORWARD] Criado novo cliente para ${normalizedPhone}: ${newClient.id}`);
        }
        
        // Find or create conversation
        const existingConv = await db.select().from(conversations)
          .where(and(
            eq(conversations.clientId, targetClient.id),
            eq(conversations.userId, user.id)
          ))
          .limit(1);
        
        if (existingConv.length > 0) {
          targetConversation = existingConv[0];
        } else {
          const [newConv] = await db.insert(conversations).values({
            clientId: targetClient.id,
            userId: user.id,
            canal: "whatsapp",
            ativa: true,
            createdAt: new Date(),
          }).returning();
          targetConversation = newConv;
          console.log(`📝 [FORWARD] Criada nova conversa para cliente ${targetClient.id}: ${newConv.id}`);
        }
      }

      // Create message record first with pending status
      // Don't add prefix to content - use origem: "forward" for internal display
      // For media, if no content, use a placeholder description
      const displayContent = messageContent || (messageType === "imagem" ? "[Imagem]" : 
        messageType === "audio" ? "[Áudio]" : 
        messageType === "documento" ? `[${nomeArquivo || "Documento"}]` : "");
      
      const messageRecord: any = {
        conversationId: targetConversation.id,
        conteudo: displayContent,
        sender: "user",
        tipo: messageType || "texto",
        lido: false,
        createdAt: new Date(),
        statusEntrega: "pendente",
        origem: "forward",
      };

      if (arquivo) {
        messageRecord.arquivo = arquivo;
        messageRecord.nomeArquivo = nomeArquivo;
        messageRecord.mimeType = mimeType;
      }

      // Always save message (we always have a conversation now)
      const [savedMessage] = await db.insert(messages).values(messageRecord).returning();

      // Send via WhatsApp (send original content without prefix)
      let whatsappResult: any;
      try {
        if (messageType === "imagem" && arquivo) {
          whatsappResult = await whatsappService.sendImage(session.sessionId, normalizedPhone, arquivo, messageContent || "");
        } else if (messageType === "audio" && arquivo) {
          whatsappResult = await whatsappService.sendAudio(session.sessionId, normalizedPhone, arquivo);
        } else if (messageType === "documento" && arquivo) {
          whatsappResult = await whatsappService.sendDocument(session.sessionId, normalizedPhone, arquivo, nomeArquivo || "documento");
        } else {
          whatsappResult = await whatsappService.sendMessage(session.sessionId, normalizedPhone, messageContent);
        }

        console.log(`✅ [FORWARD] Mensagem encaminhada para ${normalizedPhone}:`, whatsappResult);

        // Update message with WhatsApp ID and delivery status
        // The sendMessage functions return { success: true, messageId: result.key.id }
        const whatsappMessageId = whatsappResult?.messageId;
        console.log(`📝 [FORWARD] WhatsApp Message ID capturado:`, whatsappMessageId);
        
        await db.update(messages)
          .set({ 
            whatsappMessageId: whatsappMessageId || null,
            statusEntrega: whatsappResult?.success !== false ? "enviado" : "erro"
          })
          .where(eq(messages.id, savedMessage.id));

        // Update conversation last message
        await db.update(conversations)
          .set({
            ultimaMensagem: displayContent?.substring(0, 100) || "[mídia]",
            ultimaMensagemEm: new Date(),
          })
          .where(eq(conversations.id, targetConversation.id));

        res.json({ 
          success: true, 
          messageId: savedMessage.id,
          conversationId: targetConversation.id,
          clientId: targetClient?.id,
          whatsappId: whatsappMessageId,
          phone: normalizedPhone
        });

      } catch (whatsappError: any) {
        console.error("❌ [FORWARD] Erro ao enviar via WhatsApp:", whatsappError);

        // Update message as failed
        await db.update(messages)
          .set({ statusEntrega: "erro" as any })
          .where(eq(messages.id, savedMessage.id));

        return res.status(500).json({ 
          error: "Erro ao enviar mensagem via WhatsApp",
          details: whatsappError.message 
        });
      }

    } catch (error: any) {
      console.error("Error forwarding message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark messages as read
  app.patch("/api/chat/messages/:conversationId/mark-read", isAuthenticated, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const user = (req.user as any);

      // Verificar se a conversa pertence ao usuário
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
        .limit(1);

      if (!conversation) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      await storage.markMessagesAsRead(conversationId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Upload file for chat
  app.post("/api/chat/upload", isAuthenticated, async (req, res) => {
    try {
      const { arquivo, nomeArquivo, tamanho, mimeType } = req.body;

      if (!arquivo || !nomeArquivo) {
        return res.status(400).json({ error: "Arquivo e nome obrigatórios" });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = nomeArquivo.split(".").pop() || "file";
      const uniqueName = `chat_${timestamp}_${Math.random().toString(36).substr(2, 9)}.${extension}`;

      // Return reference (arquivo é base64 ou URL)
      res.json({
        arquivo,
        nomeArquivo,
        tamanho,
        mimeType,
        uniqueName,
      });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Start conversation with a client
  app.post("/api/chat/start-conversation/:clientId", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.params;
      const user = (req.user as any);

      // Check if client exists
      const cliente = await storage.getClientById(clientId);
      if (!cliente) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const conversa = await storage.createOrGetConversation(clientId, user.id);
      res.json(conversa);
    } catch (error: any) {
      console.error("Error starting conversation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // TEST ENDPOINT: Simulate receiving a message from client + AI Analysis
  app.post("/api/chat/test/receive-message/:conversationId", isAuthenticated, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { conteudo = "Olá! Tudo bem?" } = req.body;
      const user = (req.user as any);

      // 1. Criar mensagem
      const mensagem = await storage.createMessage({
        conversationId,
        sender: "client",
        tipo: "texto",
        conteudo,
      });

      // 2. Analisar com IA e criar oportunidade
      try {
        const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
        if (conv && conv.clientId) {
          const client = await storage.getClientById(conv.clientId);
          if (client) {
            // Buscar oportunidade existente
            const existingOpp = await db.query.opportunities.findFirst({
              where: (o: any) => 
                and(
                  eq(o.clientId, conv.clientId),
                  sql`${o.etapa} NOT IN ('PERDIDO', 'FECHADO')`
                ),
              orderBy: (o: any) => desc(o.createdAt),
            });

            // ✅ Analisar mensagem
            const analysis = await analyzeClientMessage(conteudo, { nome: client.nome });
            const etapa = (analysis.etapa || "CONTATO").toUpperCase();
            console.log(`🤖 IA (CHAT): ${analysis.sentimento} (${analysis.confianca}%) → ${etapa} | deveAgir=${analysis.deveAgir}`);

            // 🚫 VALIDAÇÃO CRÍTICA #1: Se deveAgir=false → NUNCA FAZ NADA (neutro, indefinido, bloqueado)
            if (analysis.deveAgir === false) {
              console.log(`🛑 BLOQUEIO TOTAL: deveAgir=false (${analysis.motivo})`);
              res.json(mensagem);
              return;
            }

            // 🚫 VALIDAÇÃO CRÍTICA #2: Se mensagem neutra com intenção indefinida → NUNCA CRIA
            const ehMensagemNeutra = analysis.sentimento === "neutro" && analysis.intenção === "indefinida";
            if (ehMensagemNeutra) {
              console.log(`⚠️ MENSAGEM NEUTRA/INDEFINIDA: Não cria oportunidade`);
              res.json(mensagem);
              return;
            }

            // 🤖 DETECÇÃO: Se mensagem automática → MOVER PARA AUTOMÁTICA (apenas se etapa NÃO bloqueada)
            if (analysis.ehMensagemAutomatica) {
              console.log(`🤖 MENSAGEM AUTOMÁTICA DETECTADA`);
              // Verificar se etapa é bloqueada - se bloqueada, não faz nada
              if (existingOpp && ETAPAS_MANUAIS_BLOQUEADAS.includes(existingOpp.etapa)) {
                console.log(`🛑 BLOQUEADO: ${existingOpp.etapa} é etapa bloqueada - IA não pode mexer`);
              } else if (existingOpp) {
                // Move para AUTOMÁTICA (etapa não-bloqueada)
                const oldEtapa = existingOpp.etapa;
                await db.update(opportunities).set({ 
                  etapa: "AUTOMÁTICA",
                  titulo: `${client.nome} - Aguardando resposta (mensagem automática)`,
                  updatedAt: new Date()
                }).where(eq(opportunities.id, existingOpp.id));
                console.log(`✅ OPP MOVIDA (AUTOMÁTICO): ${oldEtapa} → AUTOMÁTICA`);
                // 📝 REGISTRAR NA TIMELINE (IA)
                await storage.recordEtapaChange(existingOpp.id, conv.clientId, oldEtapa, "AUTOMÁTICA", "ia", user.id);
                const newStatus1 = await storage.recalculateClientStatus(conv.clientId);
                await storage.updateClient(conv.clientId, { status: newStatus1 });
              } else {
                // Criar nova oportunidade em AUTOMÁTICA
                const [newOpp] = await db.insert(opportunities).values({
                  clientId: conv.clientId,
                  titulo: `${client.nome} - Aguardando resposta (mensagem automática)`,
                  etapa: "AUTOMÁTICA",
                  valorEstimado: "5000",
                  responsavelId: user.id || conv.userId,
                  ordem: 0,
                }).returning();
                console.log(`✅ OPP CRIADA (AUTOMÁTICO): AUTOMÁTICA`);
                const newStatus2 = await storage.recalculateClientStatus(conv.clientId);
                await storage.updateClient(conv.clientId, { status: newStatus2 });
              }
            }
            // 🛑 BLOQUEIO: Se etapa BLOQUEADA → IA NÃO ANALISA (exceto mensagem automática)
            else if (existingOpp && ETAPAS_MANUAIS_BLOQUEADAS.includes(existingOpp.etapa)) {
              console.log(`🛑 IA BLOQUEADA: ${existingOpp.etapa} - IA PROIBIDO`);
            }
            else {
              // ✅ Analisar movimento normal (já passou por validações críticas acima)
              if (existingOpp && existingOpp.etapa !== etapa) {
                // 🔥 EXCEÇÃO CRÍTICA: Se em CONTATO e cliente aprova → DEVE mover para PROPOSTA
                const ehTransicaoObrigatoriaCONTATOtoPROPOSTA = 
                  existingOpp.etapa === "CONTATO" && 
                  etapa === "PROPOSTA" && 
                  analysis.deveAgir === true &&
                  (analysis.sentimento === "positivo" || analysis.sentimento === "fornecedor");
                
                if (ehTransicaoObrigatoriaCONTATOtoPROPOSTA) {
                  // 🔥 MOVIMENTO OBRIGATÓRIO: CONTATO → PROPOSTA (aprovação clara)
                  const oldEtapa = existingOpp.etapa;
                  await db.update(opportunities).set({ 
                    etapa: "PROPOSTA",
                    titulo: `${client.nome} - ${analysis.motivo}`,
                    updatedAt: new Date()
                  }).where(eq(opportunities.id, existingOpp.id));
                  
                  console.log(`🔥 OPP MOVIDA (OBRIGATÓRIO): ${oldEtapa} → PROPOSTA (aprovação detectada)`);
                  // 📝 REGISTRAR NA TIMELINE (IA)
                  await storage.recordEtapaChange(existingOpp.id, conv.clientId, oldEtapa, "PROPOSTA", "ia", user.id);
                  const newStatus4 = await storage.recalculateClientStatus(conv.clientId);
                  await storage.updateClient(conv.clientId, { status: newStatus4 });
                } else {
                  // Validar movimento: só LEAD e CONTATO
                  if (existingOpp.etapa === "LEAD") {
                    // LEAD é livre
                    const oldEtapa = existingOpp.etapa;
                    await db.update(opportunities).set({ 
                      etapa: etapa,
                      titulo: `${client.nome} - ${analysis.motivo}`,
                      updatedAt: new Date()
                    }).where(eq(opportunities.id, existingOpp.id));
                    
                    console.log(`✅ OPP MOVIDA (CHAT): ${oldEtapa} → ${etapa}`);
                    // 📝 REGISTRAR NA TIMELINE (IA)
                    await storage.recordEtapaChange(existingOpp.id, conv.clientId, oldEtapa, etapa, "ia", user.id);
                    const newStatus5 = await storage.recalculateClientStatus(conv.clientId);
                    await storage.updateClient(conv.clientId, { status: newStatus5 });
                  } else if (existingOpp.etapa === "CONTATO" && (etapa === "PROPOSTA" || etapa === "PERDIDO")) {
                    // CONTATO → PROPOSTA ou PERDIDO
                    const oldEtapa = existingOpp.etapa;
                    await db.update(opportunities).set({ 
                      etapa: etapa,
                      titulo: `${client.nome} - ${analysis.motivo}`,
                      updatedAt: new Date()
                    }).where(eq(opportunities.id, existingOpp.id));
                    
                    console.log(`✅ OPP MOVIDA (CHAT): ${oldEtapa} → ${etapa}`);
                    // 📝 REGISTRAR NA TIMELINE (IA)
                    await storage.recordEtapaChange(existingOpp.id, conv.clientId, oldEtapa, etapa, "ia", user.id);
                    const newStatus6 = await storage.recalculateClientStatus(conv.clientId);
                    await storage.updateClient(conv.clientId, { status: newStatus6 });
                  } else {
                    console.log(`🛑 MOVIMENTO NÃO PERMITIDO: ${existingOpp.etapa} → ${etapa}`);
                  }
                }
              } else if (!existingOpp) {
                // 🚫 Só criar opp se houver intenção comercial real
                if (analysis.sentimento === "positivo" || analysis.intenção === "aprovacao_envio" || analysis.intenção === "solicitacao_info") {
                  // Criar na etapa sugerida pela IA (CONTATO ou PROPOSTA)
                  const etapaParaCriar = (analysis.etapa || "CONTATO").toUpperCase();
                  const [newOpp] = await db.insert(opportunities).values({
                    clientId: conv.clientId,
                    titulo: `${client.nome} - ${analysis.motivo}`,
                    etapa: etapaParaCriar,
                    valorEstimado: "5000",
                    responsavelId: user.id || conv.userId,
                    ordem: 0,
                  }).returning();
                  console.log(`✅ OPP CRIADA (${etapaParaCriar}): ${analysis.motivo}`);
                  const newStatus7 = await storage.recalculateClientStatus(conv.clientId);
                  await storage.updateClient(conv.clientId, { status: newStatus7 });
                } else {
                  console.log(`⚠️ NÃO CRIA OPP: Mensagem sem intenção comercial (${analysis.intenção})`);
                }
              }
            }
          }
        }
      } catch (aiError) {
        console.warn("⚠️ Erro ao processar IA:", aiError);
      }

      res.json(mensagem);
    } catch (error: any) {
      console.error("Error simulating message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // TEST ENDPOINT: Full send/receive test with logs
  app.post("/api/chat/test/send-receive", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { conversationId } = req.body;

      if (!conversationId) {
        return res.status(400).json({ error: "conversationId is required" });
      }

      const logs: any[] = [];

      // Step 1: Get conversation
      logs.push({ step: 1, action: "Fetching conversation", time: new Date().toISOString() });
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
      if (!conv) {
        logs.push({ step: 1, status: "ERROR", message: "Conversation not found" });
        return res.status(404).json({ error: "Conversation not found", logs });
      }
      logs.push({ step: 1, status: "OK", conversationId: conv.id, clientId: conv.clientId });

      // Step 2: Send message from agent
      logs.push({ step: 2, action: "Sending message from agent", time: new Date().toISOString() });
      const mensagemEnviada = await storage.createMessage({
        conversationId,
        sender: "agent",
        tipo: "texto",
        conteudo: "Teste de envio - Este é um teste automatizado",
      });
      logs.push({ 
        step: 2, 
        status: "OK", 
        messageId: mensagemEnviada.id,
        sender: mensagemEnviada.sender,
        content: mensagemEnviada.conteudo
      });

      // Step 3: Simulate client receiving
      logs.push({ step: 3, action: "Simulating client message", time: new Date().toISOString() });
      const mensagemRecebida = await storage.createMessage({
        conversationId,
        sender: "client",
        tipo: "texto",
        conteudo: "Resposta do cliente - Mensagem recebida com sucesso",
      });
      logs.push({ 
        step: 3, 
        status: "OK", 
        messageId: mensagemRecebida.id,
        sender: mensagemRecebida.sender,
        content: mensagemRecebida.conteudo
      });

      // Step 4: Fetch all messages to verify
      logs.push({ step: 4, action: "Fetching all messages", time: new Date().toISOString() });
      const allMessages = await db.select().from(messages).where(eq(messages.conversationId, conversationId));
      logs.push({ 
        step: 4, 
        status: "OK", 
        totalMessages: allMessages.length,
        lastMessages: allMessages.slice(-2).map(m => ({
          id: m.id,
          sender: m.sender,
          tipo: m.tipo,
          conteudo: m.conteudo?.substring(0, 50)
        }))
      });

      // Step 5: Check WebSocket status
      logs.push({ step: 5, action: "Checking WhatsApp sessions", time: new Date().toISOString() });
      const sessions = await db.select().from(whatsappSessions);
      logs.push({ 
        step: 5, 
        status: "OK", 
        totalSessions: sessions.length,
        sessions: sessions.map(s => ({ id: s.id, status: s.status }))
      });

      logs.push({ 
        status: "ALL_TESTS_PASSED", 
        completedAt: new Date().toISOString(),
        summary: "Send/receive test completed successfully"
      });

      console.log("[TEST] 🧪 Send/Receive test completed:", JSON.stringify(logs, null, 2));

      res.json({ success: true, logs, messages: { sent: mensagemEnviada, received: mensagemRecebida } });
    } catch (error: any) {
      console.error("[TEST] ❌ Send/Receive test error:", error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // Helper endpoint to get/create conversation by phone or name
  app.post("/api/chat/conversation-by-phone", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ error: "Phone number or name required" });
      }
      
      console.log(`[CHAT SEARCH] 🔍 Buscando: "${phone}"`);
      
      let normalizado = phone.replace(/\D/g, "");
      if (normalizado.startsWith("55")) {
        normalizado = normalizado.substring(2);
      }
      
      console.log(`[CHAT SEARCH] Normalizado: "${normalizado}"`);
      
      // Buscar por telefone, razão social ou nome do gestor
      let [client] = await db
        .select()
        .from(clients)
        .where(or(
          ilike(clients.celular, `%${normalizado}%`),
          ilike(clients.telefone2, `%${normalizado}%`),
          ilike(clients.nome, `%${phone}%`), // Razão social / Nome
          ilike(clients.nomeGestor, `%${phone}%`) // Nome do gestor
        ))
        .limit(1);
      
      console.log(`[CHAT SEARCH] Resultado: ${client ? `✅ ENCONTRADO ${client.nome}` : "❌ NÃO ENCONTRADO"}`);
      
      // Se não encontrar, criar novo cliente automaticamente
      if (!client) {
        console.log(`[CHAT] 🆕 Auto-criando cliente para telefone: ${phone}`);
        const newClient = await storage.createClient({
          nome: `Novo contato ${phone}`,
          celular: phone,
          status: "Lead",
          carteira: "Dominio",
          createdBy: userId,
        });
        client = newClient;
        console.log(`[CHAT] ✅ Cliente criado: ${client.id}`);
      }
      
      const conv = await storage.createOrGetConversation(client.id, userId);
      console.log(`[CHAT] ✨ Conversa criada/carregada: ${conv.id}`);
      
      // Retornar conversa COM dados do cliente (igual getConversationsByUserId)
      res.json({
        ...conv,
        client: {
          id: client.id,
          nome: client.nome,
          celular: client.celular,
          tags: client.tags,
        }
      });
    } catch (error: any) {
      console.error("Error getting conversation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== QUICK REPLIES ROUTES ====================
  app.get("/api/quick-replies", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const replies = await storage.getQuickRepliesByUserId(user.id);
      res.json(replies);
    } catch (error: any) {
      console.error("Error fetching quick replies:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/quick-replies", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { conteudo, ordem } = req.body;
      
      const reply = await storage.createQuickReply({
        userId: user.id,
        conteudo,
        ordem: ordem || 0,
      });
      res.json(reply);
    } catch (error: any) {
      console.error("Error creating quick reply:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.patch("/api/quick-replies/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const { conteudo, ordem } = req.body;
      
      const reply = await storage.updateQuickReply(id, { conteudo, ordem });
      if (!reply) return res.status(404).json({ error: "Quick reply not found" });
      res.json(reply);
    } catch (error: any) {
      console.error("Error updating quick reply:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/quick-replies/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteQuickReply(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting quick reply:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CLIENT NOTES ROUTES ====================
  app.get("/api/client-notes/:clientId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { clientId } = req.params;
      const notes = await storage.getClientNotesByUserId(user.id, clientId);
      res.json(notes);
    } catch (error: any) {
      console.error("Error fetching client notes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/client-notes/:clientId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { clientId } = req.params;
      const { conteudo, cor, tipo, dataPlanejada, anexos } = req.body;
      
      const note = await storage.createClientNote({
        userId: user.id,
        clientId,
        conteudo,
        tipo: tipo || "comentario",
        dataPlanejada: dataPlanejada ? new Date(dataPlanejada) : null,
        anexos: anexos || [],
        cor: cor || "bg-blue-500",
      });
      res.json(note);
    } catch (error: any) {
      console.error("Error creating client note:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Alias route for compatibility
  app.post("/api/clients/:clientId/notes", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { clientId } = req.params;
      const { conteudo, cor, tipo, dataPlanejada, anexos } = req.body;
      
      const note = await storage.createClientNote({
        userId: user.id,
        clientId,
        conteudo,
        tipo: tipo || "comentario",
        dataPlanejada: dataPlanejada ? new Date(dataPlanejada) : null,
        anexos: anexos || [],
        cor: cor || "bg-blue-500",
      });
      res.json(note);
    } catch (error: any) {
      console.error("Error creating client note:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.patch("/api/client-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { conteudo, cor, tipo, dataPlanejada, anexos } = req.body;
      
      const note = await storage.updateClientNote(id, { 
        conteudo, 
        cor,
        tipo,
        dataPlanejada: dataPlanejada ? new Date(dataPlanejada) : null,
        anexos,
      });
      if (!note) return res.status(404).json({ error: "Note not found" });
      res.json(note);
    } catch (error: any) {
      console.error("Error updating client note:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/client-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteClientNote(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting client note:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== TAGS ROUTES ====================
  app.get("/api/tags", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const allTags = await storage.getTags(user.id);
      res.json(allTags);
    } catch (error: any) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/tags", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { nome, cor } = req.body;
      
      const tag = await storage.createTag({
        nome,
        cor,
        createdBy: user.id,
      });
      res.json(tag);
    } catch (error: any) {
      console.error("Error creating tag:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.patch("/api/tags/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, cor } = req.body;
      
      const tag = await storage.updateTag(id, { nome, cor });
      if (!tag) return res.status(404).json({ error: "Tag not found" });
      res.json(tag);
    } catch (error: any) {
      console.error("Error updating tag:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/tags/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTag(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add tag to client
  app.post("/api/clients/:clientId/tags", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { tagName, valorEstimado } = req.body;
      
      console.log(`🏷️ Adicionando tag ao cliente:`, { clientId, tagName });
      
      // APENAS adicionar a tag - SEM criar oportunidades
      const client = await storage.addTagToClient(clientId, tagName);
      if (!client) return res.status(404).json({ error: "Client not found" });
      
      console.log(`✅ Cliente atualizado com tag: ${tagName}`);
      res.json(client);
    } catch (error: any) {
      console.error("Error adding tag to client:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Remove tag from client
  app.delete("/api/clients/:clientId/tags/:tagName", isAuthenticated, async (req, res) => {
    try {
      const { clientId, tagName } = req.params;
      
      console.log(`🏷️ Removendo tag do cliente:`, { clientId, tagName });
      
      // APENAS remover a tag - SEM deletar oportunidades
      const client = await storage.removeTagFromClient(clientId, tagName);
      if (!client) return res.status(404).json({ error: "Client not found" });
      
      console.log(`✅ Tag removida: ${tagName}`);
      res.json(client);
    } catch (error: any) {
      console.error("Error removing tag from client:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ==================== CLIENT SHARING ROUTES ====================
  // Share client with another user
  app.post("/api/clients/:clientId/share", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { sharedWithUserId, permissao = "editar" } = req.body;
      const user = req.user as any;

      // Verify client ownership
      const client = await storage.getClientById(clientId);
      if (!client) return res.status(404).json({ error: "Client not found" });
      if (client.createdBy !== user.id) {
        return res.status(403).json({ error: "Você só pode compartilhar seus próprios clientes" });
      }

      const sharing = await storage.shareClientWithUser({
        clientId,
        ownerId: user.id,
        sharedWithUserId,
        permissao,
      });

      // 📢 CREATE NOTIFICATION FOR RECIPIENT
      const [recipient] = await db.select().from(users).where(eq(users.id, sharedWithUserId)).limit(1);
      const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
      
      if (recipient) {
        await storage.createNotification({
          userId: sharedWithUserId,
          tipo: "client_shared",
          titulo: "Cliente compartilhado",
          descricao: `${senderName} compartilhou o cliente "${client.nome}" com você`,
          clientId,
          fromUserId: user.id,
          lida: false,
        });
      }

      res.json(sharing);
    } catch (error: any) {
      console.error("Error sharing client:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Unshare client from user
  app.delete("/api/clients/:clientId/share/:sharedWithUserId", isAuthenticated, async (req, res) => {
    try {
      const { clientId, sharedWithUserId } = req.params;
      const user = req.user as any;

      // Verify client ownership
      const client = await storage.getClientById(clientId);
      if (!client) return res.status(404).json({ error: "Client not found" });
      if (client.createdBy !== user.id) {
        return res.status(403).json({ error: "Você só pode desfazer compartilhamento dos seus clientes" });
      }

      await storage.unshareClientWithUser(clientId, sharedWithUserId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error unsharing client:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Share multiple clients with a user
  app.post("/api/clients/share-bulk", isAuthenticated, async (req, res) => {
    try {
      const { clientIds, sharedWithUserId } = req.body;
      const user = req.user as any;

      console.log(`📤 SHARE-BULK: Recebidos ${clientIds?.length} IDs para compartilhar`);

      if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({ error: "Selecione pelo menos um cliente" });
      }

      // Verify ownership of all clients
      const clientsToShare = await db
        .select()
        .from(clients)
        .where(inArray(clients.id, clientIds));

      console.log(`📤 SHARE-BULK: Encontrados ${clientsToShare.length} clientes no DB`);

      const allOwned = clientsToShare.every(c => c.createdBy === user.id);
      if (!allOwned) {
        return res.status(403).json({ error: "Você só pode compartilhar seus próprios clientes" });
      }

      const sharings = await storage.shareClientsWithUser(clientIds, sharedWithUserId, user.id);
      console.log(`📤 SHARE-BULK: ${sharings.length} compartilhamentos criados`);

      // Create notifications for recipient
      const [recipient] = await db.select().from(users).where(eq(users.id, sharedWithUserId)).limit(1);
      const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
      
      if (recipient) {
        for (const client of clientsToShare) {
          await storage.createNotification({
            userId: sharedWithUserId,
            tipo: "client_shared",
            titulo: "Cliente compartilhado",
            descricao: `${senderName} compartilhou o cliente "${client.nome}" com você`,
            clientId: client.id,
            fromUserId: user.id,
            lida: false,
          });
        }
      }

      res.json({ success: true, count: sharings.length });
    } catch (error: any) {
      console.error("Error sharing clients:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Unshare multiple clients with a user
  app.post("/api/clients/unshare-bulk", isAuthenticated, async (req, res) => {
    try {
      const { clientIds, sharedWithUserId } = req.body;
      const user = req.user as any;

      console.log(`📤 UNSHARE-BULK: Recebidos ${clientIds?.length} IDs do usuário ${user.id}`);

      if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({ error: "Selecione pelo menos um cliente" });
      }

      // Get all requested clients to check ownership
      const allClients = await db
        .select()
        .from(clients)
        .where(inArray(clients.id, clientIds));

      console.log(`📤 UNSHARE-BULK: Encontrados ${allClients.length} clientes no DB`);
      console.log(`📤 UNSHARE-BULK: Clientes do usuário: ${allClients.filter(c => c.createdBy === user.id).length}`);

      // Filter to only clients OWNED by the user
      const ownedClientIds = allClients
        .filter(c => c.createdBy === user.id)
        .map(c => c.id);
      
      if (ownedClientIds.length === 0) {
        console.warn(`📤 UNSHARE-BULK: Usuário ${user.id} não tem propriedade de nenhum cliente`);
        return res.status(403).json({ error: "Você só pode remover compartilhamento dos seus próprios clientes" });
      }

      // Delete all sharings for owned clients only
      for (const clientId of ownedClientIds) {
        await storage.unshareClientWithUser(clientId, sharedWithUserId);
      }

      console.log(`📤 UNSHARE-BULK: ${ownedClientIds.length} compartilhamentos removidos`);
      res.json({ success: true, count: ownedClientIds.length });
    } catch (error: any) {
      console.error("Error unsharing clients:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Get sharing info for a client
  app.get("/api/clients/:clientId/sharings", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.params;
      const user = req.user as any;

      // Verify ownership or admin
      const client = await storage.getClientById(clientId);
      if (!client) return res.status(404).json({ error: "Client not found" });
      if (client.createdBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const sharing = await storage.getClientSharings(clientId);
      
      // Get user details for each sharing
      const sharingWithDetails = await Promise.all(
        sharing.map(async (s) => ({
          ...s,
          sharedWithUser: await storage.getUserById(s.sharedWithUserId),
        }))
      );

      res.json(sharingWithDetails);
    } catch (error: any) {
      console.error("Error fetching sharing info:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Get all users (for sharing dropdown)
  app.get("/api/users-list", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Filter out current user
      const user = req.user as any;
      const filtered = users.filter(u => u.id !== user.id);
      res.json(filtered);
    } catch (error: any) {
      console.error("Error fetching users list:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ==================== NOTIFICATIONS ROUTES ====================
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const notifs = await storage.getNotificationsByUserId(user.id);
      res.json(notifs);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/notifications/:notifId/read", isAuthenticated, async (req, res) => {
    try {
      const { notifId } = req.params;
      const user = req.user as any;

      // Verify notification belongs to user
      const notif = await db.select().from(notifications).where(eq(notifications.id, notifId)).limit(1);
      if (!notif.length) return res.status(404).json({ error: "Notification not found" });
      if (notif[0].userId !== user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.markNotificationAsRead(notifId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      await storage.markAllNotificationsAsRead(user.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const count = await storage.countAllUnreadMessages(user.id);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread messages count:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== ADMIN ROUTES ====================
  app.post("/api/claim-all-clients", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const result = await db
        .update(clients)
        .set({ createdBy: user.id })
        .where(isNull(clients.createdBy))
        .returning({ id: clients.id });

      res.json({ 
        success: true, 
        updated: result.length,
        message: `${result.length} clientes associados ao seu usuário` 
      });
    } catch (error: any) {
      console.error("Error claiming clients:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== EXPORT CLIENTS ====================
  app.get("/api/admin/export-clients", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const result = await storage.getClients({
        userId: user.dbUser?.id || user.id,
        limit: 100000,
        isAdmin: false
      });
      
      const clientsList = result.clientes || [];
      
      // Formata dados para export
      const exportData = clientsList.map((client: any) => ({
        ID: client.id,
        Nome: client.nome,
        CNPJ: client.cnpj,
        Email: client.email,
        Celular: client.celular,
        "Telefone 2": client.telefone_2,
        Segmento: client.segmento,
        Status: client.status,
        "Tipo Cliente": client.tipoCliente,
        Carteira: client.carteira,
        Cidade: client.cidade,
        UF: client.uf,
        "Contato Principal": client.contatoPrincipal,
        "Data de Criação": client.createdAt ? new Date(client.createdAt).toLocaleDateString('pt-BR') : '',
        Tags: Array.isArray(client.tags) ? client.tags.join(', ') : '',
      }));
      
      res.json(exportData);
    } catch (error) {
      console.error('Erro ao exportar clientes:', error);
      res.status(500).json({ error: "Failed to export clients" });
    }
  });

  // ==================== CAMPAIGN SENDINGS ROUTES ====================
  app.post("/api/campaigns/record-sending", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const { clientId, campaignId, campaignName, status = "enviado", erroMensagem } = req.body;
      
      if (!clientId || !campaignName) {
        return res.status(400).json({ error: "clientId e campaignName são obrigatórios" });
      }

      const sending = await storage.recordCampaignSending({
        userId: user.id,
        campaignId,
        campaignName,
        clientId,
        status,
        erroMensagem,
        origemDisparo: "agendamento",
        mensagemUsada: undefined,
        modeloId: null,
      });
      
      res.json(sending);
    } catch (error: any) {
      console.error("Error recording campaign sending:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/campaigns/record-multiple-sendings", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const { sendings } = req.body;
      
      if (!Array.isArray(sendings) || sendings.length === 0) {
        return res.status(400).json({ error: "sendings array é obrigatório" });
      }

      const records = sendings.map((s: any) => ({
        ...s,
        userId: user.id,
      }));

      const results = await storage.recordMultipleCampaignSendings(records);
      res.json(results);
    } catch (error: any) {
      console.error("Error recording multiple campaign sendings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/campaigns/client-sending-history/:clientId", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const { clientId } = req.params;
      
      const history = await storage.getCampaignSendingHistory(user.id, clientId);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching campaign sending history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== CAMPAIGN GROUPS ROUTES ====================
  app.post("/api/campaign-groups", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const { nome, descricao, filtros } = req.body;
      
      if (!nome) {
        return res.status(400).json({ error: "Nome do grupo é obrigatório" });
      }

      const group = await storage.createCampaignGroup({
        userId: user.id,
        nome,
        descricao,
        filtros,
      });
      
      res.json(group);
    } catch (error: any) {
      console.error("Error creating campaign group:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/campaign-groups", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const groups = await storage.getCampaignGroups(user.id);
      res.json(groups);
    } catch (error: any) {
      console.error("Error fetching campaign groups:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/campaign-groups/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const { id } = req.params;
      const { nome, descricao, filtros } = req.body;

      const group = await storage.updateCampaignGroup(id, user.id, {
        nome,
        descricao,
        filtros,
      });
      
      if (!group) {
        return res.status(404).json({ error: "Grupo não encontrado" });
      }

      res.json(group);
    } catch (error: any) {
      console.error("Error updating campaign group:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/campaign-groups/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const { id } = req.params;

      await storage.deleteCampaignGroup(id, user.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting campaign group:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== TESTE DE AUTOMAÇÃO ====================
  app.get("/api/test/clients-list", async (req, res) => {
    try {
      const clientsList = await db.query.clients.findMany({ limit: 50 });
      const users = await db.query.users.findMany({ limit: 5 });
      res.json({ clients: clientsList, users: users });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/test/quick-followups", async (req, res) => {
    try {
      const { clientId, userId, conversationId } = req.body;
      
      if (!clientId || !userId) {
        return res.status(400).json({ error: "clientId, userId são obrigatórios" });
      }

      const convId = conversationId || clientId;
      await createTestFollowUps(clientId, userId, convId);
      res.json({ success: true, message: "Follow-ups rápidos criados (1, 2, 3 minutos)" });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/test/kanban-movement", async (req, res) => {
    try {
      const { clientId, userId } = req.body;
      
      if (!clientId || !userId) {
        return res.status(400).json({ error: "clientId, userId são obrigatórios" });
      }

      await createTestKanbanMovement(clientId, userId);
      res.json({ success: true, message: "Movimento automático no Kanban agendado (Lead→Contato→Proposta→Fechado)" });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/test/validate-opp-creation", isAuthenticated, async (req, res) => {
    try {
      const { clientId, mensagem, conversationId, isClientMessage = true } = req.body;
      
      if (!clientId || !mensagem) {
        return res.status(400).json({ error: "clientId, mensagem são obrigatórios" });
      }

      // Analisar mensagem
      const analysis = await analyzeClientMessage(mensagem);
      
      // Validar criação
      const isPropostaAction = analysis.etapa === "PROPOSTA";
      const validation = await validateOpportunityCreation(
        clientId,
        analysis,
        isClientMessage,
        conversationId,
        isPropostaAction
      );

      res.json({
        mensagem,
        analysis: {
          etapa: analysis.etapa,
          sentimento: analysis.sentimento,
          intenção: analysis.intenção,
          deveAgir: analysis.deveAgir,
          confianca: analysis.confianca,
          motivo: analysis.motivo,
        },
        validation: {
          podecriar: validation.podecriar,
          motivo: validation.motivo,
          etapa: validation.etapa,
        },
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/test/simulate-response", isAuthenticated, async (req, res) => {
    try {
      const { clientId, messageText } = req.body;
      const userId = (req.user as any).id; // Usar userId do usuário autenticado
      
      console.log(`🧪 [TEST] POST /api/test/simulate-response - userId=${userId}, clientId=${clientId}`);
      
      if (!clientId || !messageText) {
        return res.status(400).json({ error: "clientId, messageText são obrigatórios" });
      }

      const result = await simulateClientResponse(clientId, userId, messageText);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/test/process-batch", isAuthenticated, async (req, res) => {
    try {
      const { responses } = req.body;
      const userId = (req.user as any).id; // Usar userId do usuário autenticado
      
      if (!Array.isArray(responses) || responses.length === 0) {
        return res.status(400).json({ error: "responses (array) é obrigatório" });
      }

      const result = await processBatchResponses(userId, responses);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/test/automation-tasks", async (req, res) => {
    try {
      const tasks = await getAllAutomationTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/test/follow-ups", async (req, res) => {
    try {
      const followups = await getAllFollowUps();
      res.json(followups);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/test/client-scores", async (req, res) => {
    try {
      const scores = await getAllClientScores();
      res.json(scores);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/test/opportunities", async (req, res) => {
    try {
      const allOpps = await db.select().from(opportunities).orderBy(opportunities.etapa);
      res.json(allOpps);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== TEST CONTRACT REMINDER - Envio direto (chat + timeline) ====================
  app.post("/api/test/contract-reminder", async (req, res) => {
    try {
      console.log(`\n📋 [TEST CONTRACT REMINDER] Endpoint chamado!`);
      const { clientId, userId } = req.body;
      console.log(`   clientId: ${clientId}, userId: ${userId}`);
      
      if (!clientId || !userId) {
        console.log(`❌ Faltando clientId ou userId`);
        return res.status(400).json({ error: "clientId e userId são obrigatórios" });
      }

      // 1. Fetch client
      const client = await db.query.clients.findFirst({
        where: (c: any) => eq(c.id, clientId),
      });

      if (!client) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      // 2. Buscar ÚLTIMA opportunity em PROPOSTA ENVIADA (ou criar uma teste)
      let opp = await db.query.opportunities.findFirst({
        where: (o: any) => 
          and(
            eq(o.clientId, clientId),
            eq(o.etapa, "PROPOSTA ENVIADA")
          ),
        orderBy: (o: any) => desc(o.createdAt),
      });

      if (!opp) {
        const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
        const [newOpp] = await db
          .insert(opportunities)
          .values({
            clientId,
            titulo: `TESTE: Cobrança de Contrato`,
            etapa: "PROPOSTA ENVIADA",
            responsavelId: userId,
            updatedAt: oneMinuteAgo,
          })
          .returning();
        opp = newOpp;
      }

      // 3. Buscar ou criar conversation
      let conversation = await db.query.conversations.findFirst({
        where: (conv: any) => eq(conv.clientId, clientId),
      });

      if (!conversation) {
        const [newConv] = await db.insert(conversations).values({
          clientId,
          userId,
          ultimaMensagemEm: new Date(),
        }).returning();
        conversation = newConv;
      }

      // 4. 🔥 LER MENSAGENS DO BANCO (automation_configs) - NÃO HARDCODE!
      const config = await db.query.automationConfigs.findFirst({
        where: (ac: any) => eq(ac.jobType, "contract_reminder"),
      });
      
      let day0Messages = (config?.mensagensTemplates as any)?.["0"] || [];
      
      // Fallback apenas se vazio
      if (day0Messages.length === 0) {
        day0Messages = [
          `Olá, tudo bem? Podemos seguir com a contratação? Qualquer dúvida é só me chamar.`,
          `Oi! Tudo certo? Conseguimos avançar com o plano? Estou por aqui caso precise de algo.`,
          `Olá, tudo bem? Podemos finalizar sua contratação agora? Ficou com alguma dúvida?`,
          `Oi! Só confirmando: deseja seguir com o plano que conversamos? Se quiser ajustar algo, me avise!`,
          `Olá! Tudo bem por aí? Posso dar andamento na contratação para você? Qualquer dúvida me avisa.`,
          `Olá, tudo bem? Qualquer dúvida sobre o plano ou condições, estou à disposição. Podemos avançar?`,
          `Olá, tudo bem? Só passando pra saber se deseja continuar com a contratação. Qualquer dúvida me avisa.`,
        ];
      }
      
      const randomIdx = Math.floor(Math.random() * day0Messages.length);
      const mensagem = day0Messages[randomIdx];

      // 5. REGISTRAR MENSAGEM NO CHAT PRIMEIRO
      await db.insert(messages).values({
        conversationId: conversation.id,
        sender: "user",
        tipo: "texto",
        conteudo: mensagem,
        origem: "automation",
        createdAt: new Date(),
      });

      // 6. REGISTRAR NA TIMELINE DO CLIENTE
      await db.insert(interactions).values({
        clientId,
        tipo: "contract_reminder",
        origem: "automation",
        titulo: "Cobrança de Contrato Enviada (1º dia)",
        texto: mensagem,
        meta: { opportunityId: opp!.id, daysSinceCreation: 0 },
        createdBy: userId,
      });

      res.json({
        success: true,
        message: "✅ Mensagem enviada no chat e registrada na timeline!",
        cliente: client.nome,
        oportunidade_etapa: "PROPOSTA ENVIADA",
        mensagem_enviada: mensagem.substring(0, 50) + "...",
      });
    } catch (error) {
      console.error("❌ Test contract reminder error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== TEST CONTRATO ENVIADO - Envio direto ====================
  app.post("/api/test/contrato-enviado", async (req, res) => {
    try {
      console.log(`\n📄 [TEST CONTRATO ENVIADO] Endpoint chamado!`);
      const { clientId, userId } = req.body;
      console.log(`   clientId: ${clientId}, userId: ${userId}`);
      
      if (!clientId || !userId) {
        console.log(`❌ Faltando clientId ou userId`);
        return res.status(400).json({ error: "clientId e userId são obrigatórios" });
      }

      // 1. Fetch client
      const client = await db.query.clients.findFirst({
        where: (c: any) => eq(c.id, clientId),
      });

      if (!client) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      // 2. Buscar ÚLTIMA opportunity ou criar uma teste
      let opp = await db.query.opportunities.findFirst({
        where: (o: any) => eq(o.clientId, clientId),
        orderBy: (o: any) => desc(o.createdAt),
      });

      if (!opp) {
        const [newOpp] = await db
          .insert(opportunities)
          .values({
            clientId,
            titulo: `TESTE: Contrato Enviado`,
            etapa: "PROPOSTA ENVIADA",
            responsavelId: userId,
          })
          .returning();
        opp = newOpp;
      }

      // 3. Mover para CONTRATO ENVIADO
      await db
        .update(opportunities)
        .set({ etapa: "CONTRATO ENVIADO" })
        .where(eq(opportunities.id, opp.id));

      // 4. Buscar ou criar conversation
      let conversation = await db.query.conversations.findFirst({
        where: (conv: any) => eq(conv.clientId, clientId),
      });

      if (!conversation) {
        const [newConv] = await db.insert(conversations).values({
          clientId,
          userId,
          ultimaMensagemEm: new Date(),
        }).returning();
        conversation = newConv;
      }

      // 5. 🔥 LER MENSAGENS DO BANCO (automation_configs) - NÃO HARDCODE!
      const configContrato = await db.query.automationConfigs.findFirst({
        where: (ac: any) => eq(ac.jobType, "contrato_enviado_message"),
      });
      
      let messages_templates = (configContrato?.mensagensTemplates as any)?.["0"] || [];
      
      // Fallback apenas se vazio
      if (messages_templates.length === 0) {
        messages_templates = [
          `Oi!\nSeu contrato já chegou no seu e-mail.\nÉ só abrir o link, colocar a data de nascimento do gestor e seguir as etapas.\n\nVocê vai receber um e-mail com o TOKEN de confirmação.\nInforme o código e pronto — assinatura concluída.\n\nQualquer dúvida estou por aqui!`,
          `Olá!\nO contrato foi enviado para o seu e-mail.\nÉ só clicar no link, inserir a data de nascimento do gestor e avançar.\n\nDepois disso, você vai receber um e-mail com o TOKEN.\nBasta inserir no campo solicitado e finalizar a assinatura.\n\nQualquer dúvida, estou à disposição.`,
        ];
      }
      
      const randomIdx = Math.floor(Math.random() * messages_templates.length);
      const mensagem = messages_templates[randomIdx];

      // 6. REGISTRAR MENSAGEM NO CHAT PRIMEIRO
      await db.insert(messages).values({
        conversationId: conversation.id,
        sender: "user",
        tipo: "texto",
        conteudo: mensagem,
        origem: "automation",
        createdAt: new Date(),
      });

      // 7. REGISTRAR NA TIMELINE DO CLIENTE
      await db.insert(interactions).values({
        clientId,
        tipo: "contrato_enviado",
        origem: "automation",
        titulo: "Contrato Enviado ao Cliente",
        texto: mensagem,
        meta: { opportunityId: opp.id },
        createdBy: userId,
      });

      res.json({
        success: true,
        message: "✅ Contrato Enviado - Mensagem enviada no chat e registrada na timeline!",
        cliente: client.nome,
        oportunidade_etapa: "CONTRATO ENVIADO",
        mensagem_enviada: mensagem.substring(0, 50) + "...",
      });
    } catch (error) {
      console.error("❌ Test contrato enviado error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== TEST AGUARDANDO ACEITE - Lembretes de Assinatura ====================
  app.post("/api/test/aguardando-aceite", async (req, res) => {
    try {
      const { clientId, userId } = req.body;
      
      if (!clientId || !userId) {
        return res.status(400).json({ error: "clientId e userId são obrigatórios" });
      }

      // 1. Fetch client
      const client = await db.query.clients.findFirst({
        where: (c: any) => eq(c.id, clientId),
      });

      if (!client) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      // 2. Buscar ÚLTIMA opportunity ou criar uma teste
      let opp = await db.query.opportunities.findFirst({
        where: (o: any) => eq(o.clientId, clientId),
        orderBy: (o: any) => desc(o.createdAt),
      });

      // Se não houver, criar uma para teste
      if (!opp) {
        const [newOpp] = await db
          .insert(opportunities)
          .values({
            clientId,
            titulo: `TESTE: Aguardando Aceite`,
            etapa: "PROPOSTA ENVIADA",
            responsavelId: userId,
          })
          .returning();
        opp = newOpp;
      }

      // 3. Mover para AGUARDANDO ACEITE (dispara automação de lembretes)
      await db
        .update(opportunities)
        .set({ etapa: "AGUARDANDO ACEITE", updatedAt: new Date() })
        .where(eq(opportunities.id, opp.id));

      res.json({
        success: true,
        message: "✅ Oportunidade movida para AGUARDANDO ACEITE - Lembretes agendados!",
        cliente: client.nome,
        oportunidade_etapa: "AGUARDANDO ACEITE",
        observacao: "Veja o Kanban - sistema agendará lembretes em 08:00 nos próximos dias",
      });
    } catch (error) {
      console.error("❌ Test aguardando aceite error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== TEST 4º DIA - AUTO-MOVE PERDIDO (chat + timeline) ====================
  app.post("/api/test/contract-reminder-4th-day", async (req, res) => {
    try {
      console.log(`\n⏰ [TEST 4º DIA] Endpoint chamado!`);
      const { clientId, userId } = req.body;
      console.log(`   clientId: ${clientId}, userId: ${userId}`);
      
      if (!clientId || !userId) {
        console.log(`❌ Faltando clientId ou userId`);
        return res.status(400).json({ error: "clientId e userId são obrigatórios", moved: false });
      }

      // 1. Fetch client
      const client = await db.query.clients.findFirst({
        where: (c: any) => eq(c.id, clientId),
      });

      if (!client) {
        return res.status(404).json({ error: "Cliente não encontrado", moved: false });
      }

      // 2. Buscar ÚLTIMA opportunity em PROPOSTA ENVIADA deste cliente
      let opp = await db.query.opportunities.findFirst({
        where: (o: any) => 
          and(
            eq(o.clientId, clientId),
            eq(o.etapa, "PROPOSTA ENVIADA")
          ),
        orderBy: (o: any) => desc(o.createdAt),
      });

      // Se não houver, criar uma com 4 dias de idade
      if (!opp) {
        const fourDaysAgo = new Date(Date.now() - (4 * 24 * 60 * 60 * 1000) - (1 * 60 * 1000));
        const [newOpp] = await db
          .insert(opportunities)
          .values({
            clientId,
            titulo: `TESTE: 4º Dia Auto-Move`,
            etapa: "PROPOSTA ENVIADA",
            responsavelId: userId,
            updatedAt: fourDaysAgo,
          })
          .returning();
        opp = newOpp;
        console.log(`✅ [TEST 4º DIA] Opportunity criada com 4 dias: ${opp.id}`);
      } else {
        // Atualizar o updatedAt da oportunidade existente para 4 dias atrás
        await db
          .update(opportunities)
          .set({
            updatedAt: new Date(Date.now() - (4 * 24 * 60 * 60 * 1000) - (1 * 60 * 1000)),
          })
          .where(eq(opportunities.id, opp.id));
        console.log(`✅ [TEST 4º DIA] Opportunity reutilizada com idade atualizada: ${opp.id}`);
      }

      // 3. Buscar ou criar conversation
      let conversation = await db.query.conversations.findFirst({
        where: (conv: any) => eq(conv.clientId, clientId),
      });

      if (!conversation) {
        const [newConv] = await db.insert(conversations).values({
          clientId,
          userId,
          ultimaMensagemEm: new Date(),
        }).returning();
        conversation = newConv;
      }

      // 4. MOVER para PERDIDO
      await db
        .update(opportunities)
        .set({ etapa: "PERDIDO", updatedAt: new Date() })
        .where(eq(opportunities.id, opp.id));

      // 5. Mensagem de finalização
      const mensagem = `Sua proposta expirou após 3 dias sem retorno. Caso deseje retomar as negociações, é só me chamar!`;

      // 6. REGISTRAR MENSAGEM NO CHAT
      await db.insert(messages).values({
        conversationId: conversation.id,
        sender: "user",
        tipo: "texto",
        conteudo: mensagem,
        origem: "automation",
        createdAt: new Date(),
      });

      // 7. REGISTRAR NA TIMELINE DO CLIENTE
      await db.insert(interactions).values({
        clientId,
        tipo: "contract_reminder",
        origem: "automation",
        titulo: "Proposta Expirada - Movida para PERDIDO (4º dia)",
        texto: mensagem,
        meta: { opportunityId: opp.id, reason: "4th_day_timeout" },
        createdBy: userId,
      });

      res.json({
        success: true,
        message: "✅ Movido para PERDIDO e mensagens enviadas (chat + timeline)!",
        opportunity: {
          id: opp.id,
          etapaAntes: "PROPOSTA ENVIADA",
          etapaAgora: "PERDIDO",
          moved: true,
          timeline: "✅ Registrada",
        },
        cliente: client.nome,
        mensagem_enviada: mensagem.substring(0, 50) + "...",
      });
    } catch (error) {
      console.error("❌ Test 4th day error:", error);
      res.status(500).json({ error: String(error), moved: false });
    }
  });

  // ==================== TEST ENDPOINT - CLIENT STATUS AUTOMATION ====================
  app.post("/api/test/client-status-automation", async (req, res) => {
    try {
      const { clientId } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ error: "clientId is required" });
      }

      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const opportunities = await storage.getOpportunitiesByClientId(clientId);
      const statusAntes = client.status;
      const newStatus = await storage.recalculateClientStatus(clientId);
      await storage.updateClient(clientId, { status: newStatus });
      
      const clientAtualizado = await storage.getClientById(clientId);
      
      res.json({
        success: true,
        cliente: {
          id: client.id,
          nome: client.nome,
          statusAntes: statusAntes.toUpperCase(),
          statusDepois: newStatus.toUpperCase(),
          changed: statusAntes !== newStatus
        },
        oportunidades: opportunities.map(opp => ({
          id: opp.id,
          titulo: opp.titulo,
          etapa: opp.etapa
        })),
        mensagem: statusAntes !== newStatus 
          ? `✅ Status alterado de ${statusAntes.toUpperCase()} para ${newStatus.toUpperCase()}`
          : `⚠️ Status já estava como ${newStatus.toUpperCase()}`
      });
    } catch (error: any) {
      console.error("Test error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== TEST CLEANUP ====================
  // TEST: IA blocked by manual stage
  app.post("/api/test/ia-blocked-manual-stage", isAuthenticated, async (req, res) => {
    try {
      const { clientId, userId, messageText } = req.body;
      
      // 1. Delete existing opps for this client
      await db.delete(opportunities).where(eq(opportunities.clientId, clientId));
      
      // 2. Create opp in PROPOSTA ENVIADA (manual stage)
      const [opp] = await db.insert(opportunities).values({
        clientId,
        titulo: "Teste Manual Stage",
        etapa: "PROPOSTA ENVIADA",
        valorEstimado: "5000",
        responsavelId: userId,
        ordem: 0,
      }).returning();
      
      // 3. Get or create conversation and send message
      const conv = await storage.createOrGetConversation(clientId, userId);
      const msg = await storage.createMessage({
        conversationId: conv.id,
        sender: "client",
        tipo: "texto",
        conteudo: messageText,
      });
      
      // 4. Check if IA acted (it shouldn't)
      const oppAfter = await db.query.opportunities.findFirst({
        where: (o: any) => eq(o.id, opp.id),
      });
      
      res.json({
        etapa: oppAfter?.etapa,
        iaAgiu: oppAfter?.etapa !== "PROPOSTA ENVIADA",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // TEST: IA blocked when user assumed (PROPOSTA+)
  app.post("/api/test/ia-blocked-user-assumed", isAuthenticated, async (req, res) => {
    try {
      const { clientId, userId, messageText } = req.body;
      
      // 1. Delete existing opps
      await db.delete(opportunities).where(eq(opportunities.clientId, clientId));
      
      // 2. Create opp in PROPOSTA (user assumed)
      const [opp] = await db.insert(opportunities).values({
        clientId,
        titulo: "Teste User Assumed",
        etapa: "PROPOSTA",
        valorEstimado: "5000",
        responsavelId: userId,
        ordem: 0,
      }).returning();
      
      // 3. Get or create conversation and send message
      const conv = await storage.createOrGetConversation(clientId, userId);
      await storage.createMessage({
        conversationId: conv.id,
        sender: "client",
        tipo: "texto",
        conteudo: messageText,
      });
      
      // 4. Check if IA acted (it shouldn't)
      const oppAfter = await db.query.opportunities.findFirst({
        where: (o: any) => eq(o.id, opp.id),
      });
      
      res.json({
        etapa: oppAfter?.etapa,
        iaAgiu: oppAfter?.etapa !== "PROPOSTA",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // TEST: Mandatory CONTATO→PROPOSTA on approval
  app.post("/api/test/ia-movement-limits", isAuthenticated, async (req, res) => {
    try {
      const { clientId, userId } = req.body;
      
      // 1. Delete existing opps
      await db.delete(opportunities).where(eq(opportunities.clientId, clientId));
      
      // 2. Create opp in CONTATO
      const [opp] = await db.insert(opportunities).values({
        clientId,
        titulo: "Teste Movimento Obrigatório",
        etapa: "CONTATO",
        valorEstimado: "5000",
        responsavelId: userId,
        ordem: 0,
      }).returning();
      
      // 3. Send "Ok, manda" (should MOVE to PROPOSTA - obrigatório)
      const conv = await storage.createOrGetConversation(clientId, userId);
      await storage.createMessage({
        conversationId: conv.id,
        sender: "client",
        tipo: "texto",
        conteudo: "Ok, manda",
      });
      
      // 4. Check final stage (DEVE ser PROPOSTA - movimento obrigatório)
      const oppAfter = await db.query.opportunities.findFirst({
        where: (o: any) => eq(o.id, opp.id),
      });
      
      res.json({
        from: "CONTATO",
        to: oppAfter?.etapa,
        success: oppAfter?.etapa === "PROPOSTA", // DEVE ser PROPOSTA
        deveSerPROPOSTA: true,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/cleanup", async (req, res) => {
    try {
      // Delete all automation messages
      const deletedMessages = await db
        .delete(messages)
        .where(eq(messages.origem, "automation"))
        .returning();

      // Delete all automation interactions
      const deletedInteractions = await db
        .delete(interactions)
        .where(eq(interactions.origem, "automation"))
        .returning();

      res.json({
        success: true,
        message: "✅ Limpeza concluída!",
        deletedMessages: deletedMessages.length,
        deletedInteractions: deletedInteractions.length,
        detalhes: `${deletedMessages.length} mensagens e ${deletedInteractions.length} interações removidas da base de dados`
      });
    } catch (error) {
      console.error("❌ Cleanup error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== TEST: Auto-create client from phone (SEM WHATSAPP) ====================
  app.post("/api/test/auto-create-client", isAuthenticated, async (req, res) => {
    try {
      const { phone } = req.body;
      const user = req.user as any;

      if (!phone) {
        return res.status(400).json({ error: "Telefone é obrigatório" });
      }

      // Normalize phone
      let normalizado = phone.replace(/\D/g, "");
      if (normalizado.startsWith("55")) {
        normalizado = normalizado.substring(2);
      }

      console.log(`\n🧪 [TEST] Iniciando auto-create-client para: ${normalizado}`);

      // Search for existing client
      const [existingClient] = await db
        .select()
        .from(clients)
        .where(or(
          eq(clients.celular, normalizado),
          eq(clients.telefone2, normalizado),
          ilike(clients.celular, `%${normalizado}%`),
          ilike(clients.telefone2, `%${normalizado}%`)
        ))
        .limit(1);

      let clientResult;
      let isNew = false;

      if (existingClient) {
        console.log(`✅ Cliente encontrado: ${existingClient.id} (${existingClient.nome})`);
        clientResult = existingClient;
      } else {
        console.log(`🆕 Cliente não encontrado, criando novo...`);
        
        // Auto-create new client
        const novoCliente = await storage.createClient({
          nome: `NOVO CONTATO -> ${normalizado}`,
          celular: normalizado,
          status: "Lead",
          carteira: "CONTATO",
          createdBy: user.id,
        });

        console.log(`✅ Novo cliente criado: ${novoCliente.id}`);

        // Create timeline entry
        await storage.createInteraction({
          clientId: novoCliente.id,
          tipo: "nota",
          origem: "system",
          titulo: "Contato criado por sistema",
          texto: `Contato criado automaticamente (via teste) em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
          createdBy: user.id,
        });

        console.log(`📍 Timeline entry criada`);
        clientResult = novoCliente;
        isNew = true;
      }

      res.json({
        success: true,
        isNew,
        message: isNew ? "✅ Novo cliente criado!" : "✅ Cliente encontrado!",
        cliente: {
          id: clientResult.id,
          nome: clientResult.nome,
          telefone: clientResult.celular,
          status: clientResult.status,
          criadoEm: clientResult.createdAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Test auto-create error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ADMIN: AUTOMATION CONFIGS ====================
  app.get("/api/admin/automation-configs", isAuthenticated, async (req, res) => {
    try {
      const configs = await db.select().from(automationConfigs);
      
      // Convert to object keyed by jobType for easy access
      const configsObject: Record<string, any> = {};
      for (const config of configs) {
        configsObject[config.jobType] = config;
      }
      
      res.json(configsObject);
    } catch (error) {
      console.error("❌ Error fetching automation configs:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Get specific job config
  app.get("/api/admin/automation-configs/:jobType", isAuthenticated, async (req, res) => {
    try {
      const { jobType } = req.params;
      const configs = await db
        .select()
        .from(automationConfigs)
        .where(eq(automationConfigs.jobType, jobType));

      if (configs.length === 0) {
        // Return default config
        return res.json({
          jobType,
          ativo: true,
          horarios: [],
          diasSemana: ["segunda", "terca", "quarta", "quinta", "sexta"],
          mensagensTemplates: {},
          intervaloScheduler: 60,
          emailNotificacoes: true,
          mensagemPadraoRespostaIA: "",
          mensagemContatoPositivo: "",
          mensagemPropostaPositivo: "",
        });
      }

      res.json(configs[0]);
    } catch (error) {
      console.error("❌ Error fetching job config:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.patch("/api/admin/automation-configs", isAuthenticated, async (req, res) => {
    try {
      const { jobType, ativo, horarios, timeout2h, timeout4dias, diasSemana, mensagensTemplates, intervaloScheduler, emailNotificacoes, mensagemPadraoRespostaIA, mensagemContatoPositivo, mensagemPropostaPositivo } = req.body;
      
      if (!jobType) {
        return res.status(400).json({ error: "jobType is required" });
      }

      // Check if config exists
      const existing = await db
        .select()
        .from(automationConfigs)
        .where(eq(automationConfigs.jobType, jobType));

      let result;
      if (existing.length > 0) {
        // Update
        [result] = await db
          .update(automationConfigs)
          .set({
            ativo: ativo !== undefined ? ativo : existing[0].ativo,
            horarios: horarios !== undefined ? horarios : existing[0].horarios,
            timeout2h: timeout2h !== undefined ? timeout2h : existing[0].timeout2h,
            timeout4dias: timeout4dias !== undefined ? timeout4dias : existing[0].timeout4dias,
            diasSemana: diasSemana !== undefined ? diasSemana : existing[0].diasSemana,
            mensagensTemplates: mensagensTemplates !== undefined ? mensagensTemplates : existing[0].mensagensTemplates,
            intervaloScheduler: intervaloScheduler !== undefined ? intervaloScheduler : existing[0].intervaloScheduler,
            emailNotificacoes: emailNotificacoes !== undefined ? emailNotificacoes : existing[0].emailNotificacoes,
            mensagemPadraoRespostaIA: mensagemPadraoRespostaIA !== undefined ? mensagemPadraoRespostaIA : existing[0].mensagemPadraoRespostaIA,
            mensagemContatoPositivo: mensagemContatoPositivo !== undefined ? mensagemContatoPositivo : existing[0].mensagemContatoPositivo,
            mensagemPropostaPositivo: mensagemPropostaPositivo !== undefined ? mensagemPropostaPositivo : existing[0].mensagemPropostaPositivo,
            updatedAt: new Date(),
          })
          .where(eq(automationConfigs.jobType, jobType))
          .returning();
      } else {
        // Create
        [result] = await db
          .insert(automationConfigs)
          .values({
            jobType,
            ativo: ativo !== undefined ? ativo : true,
            horarios: horarios || [],
            timeout2h: timeout2h !== undefined ? timeout2h : true,
            timeout4dias: timeout4dias !== undefined ? timeout4dias : true,
            diasSemana: diasSemana || ["segunda", "terca", "quarta", "quinta", "sexta"],
            mensagensTemplates: mensagensTemplates || {},
            intervaloScheduler: intervaloScheduler || 60,
            emailNotificacoes: emailNotificacoes !== undefined ? emailNotificacoes : true,
            mensagemPadraoRespostaIA: mensagemPadraoRespostaIA || "",
            mensagemContatoPositivo: mensagemContatoPositivo || "",
            mensagemPropostaPositivo: mensagemPropostaPositivo || "",
          })
          .returning();
      }

      res.json({
        success: true,
        message: "✅ Configuração atualizada",
        config: result,
      });
    } catch (error) {
      console.error("❌ Error updating automation config:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== TEST ENDPOINT - RUN AUTOMATION CHECKS NOW ====================
  app.post("/api/test/run-automation-checks", async (req, res) => {
    try {
      const startTime = Date.now();
      
      // Importar funções de automação
      const { checkPropostaEnviadaTimeouts, checkAguardandoAceiteTimeouts } = await import('./automationService');
      
      console.log(`\n🔍 [TEST] EXECUTANDO AUTOMAÇÃO CHECKS MANUALMENTE AGORA...`);
      console.log(`⏰ Hora atual: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
      
      // Executar as funções de check
      await checkPropostaEnviadaTimeouts();
      await checkAguardandoAceiteTimeouts();
      
      const duration = Date.now() - startTime;
      
      res.json({
        success: true,
        message: "✅ Automação checks executados manualmente!",
        duration: `${duration}ms`,
        checks: {
          propostas_enviadas: "✅ Executado",
          aguardando_aceite: "✅ Executado",
        },
        info: "Verifique os logs acima para ver o resultado detalhado",
        horaExecucao: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      });
    } catch (error) {
      console.error("❌ Error running automation checks:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== TEST ENDPOINT - CLEANUP TIMELINES & MESSAGES ====================
  app.post("/api/test/cleanup-timelines-messages", async (req, res) => {
    try {
      console.log(`\n🗑️ [TEST] DELETANDO TODAS AS TIMELINES E MENSAGENS...`);
      
      // Contar antes de deletar
      const messagesBefore = await db.select().from(messages);
      const interactionsBefore = await db.select().from(interactions);
      
      // Deletar todas as mensagens
      await db.delete(messages);
      
      // Deletar todas as interações/timelines
      await db.delete(interactions);
      
      console.log(`✅ [TEST] Cleanup concluído!`);
      console.log(`   - ${messagesBefore.length} mensagens deletadas`);
      console.log(`   - ${interactionsBefore.length} interações deletadas`);
      
      res.json({
        success: true,
        message: "✅ Timelines e mensagens deletadas com sucesso!",
        deleted: {
          messages: messagesBefore.length,
          interactions: interactionsBefore.length,
          total: messagesBefore.length + interactionsBefore.length,
        },
        timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      });
    } catch (error) {
      console.error("❌ Error cleaning up timelines and messages:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== UNREAD MESSAGES NOTIFICATIONS ====================
  app.get("/api/unread-messages", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const limit = parseInt(req.query.limit as string) || 30;
      const offset = parseInt(req.query.offset as string) || 0;

      // Buscar conversas com mensagens não lidas
      const unreadMsgs = await db
        .select({
          messageId: messages.id,
          conteudo: messages.conteudo,
          createdAt: messages.createdAt,
          conversationId: messages.conversationId,
          clientId: conversations.clientId,
          clientName: clients.nome,
          clientPhone: clients.celular,
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .innerJoin(clients, eq(conversations.clientId, clients.id))
        .where(and(
          eq(conversations.userId, user.id),
          eq(messages.sender, "client"),
          eq(messages.lido, false)
        ))
        .orderBy(desc(messages.createdAt))
        .limit(limit + 1)
        .offset(offset);

      const hasMore = unreadMsgs.length > limit;
      const items = unreadMsgs.slice(0, limit);

      res.json({
        messages: items,
        hasMore,
        total: items.length,
        offset,
        limit,
      });
    } catch (error: any) {
      console.error("Error fetching unread messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Server is now created and passed in from runApp()
  // No need to create it here
}

// ==================== SCHEDULED CAMPAIGNS STARTER ====================
export function startCampaignScheduler() {
  console.log(`⏰ [SCHEDULER] Iniciando scheduler de campanhas...`);
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const dueCampaigns = await db
        .select()
        .from(campaignsTable)
        .where(
          and(
            eq(campaignsTable.status, 'agendada'),
            lte(campaignsTable.agendadaPara, now)
          )
        );

      if (dueCampaigns.length > 0) {
        console.log(`⏰ SCHEDULER: Encontradas ${dueCampaigns.length} campanhas para executar`);

        // Executa cada campanha com isolamento por usuário
        for (const campaign of dueCampaigns) {
          try {
            const ownerId = campaign.createdBy || undefined;
            if (!ownerId) {
              console.warn(`⚠️ Campanha ${campaign.id} sem proprietário definido`);
              continue;
            }
            
            // ✅ CORREÇÃO ATÔMICA: Só atualiza se ainda está "agendada"
            // WHERE status='agendada' garante que apenas UMA instância executa
            const [claimed] = await db.update(campaignsTable)
              .set({ status: 'em_progresso' })
              .where(and(
                eq(campaignsTable.id, campaign.id),
                eq(campaignsTable.status, 'agendada')
              ))
              .returning({ id: campaignsTable.id });
            
            if (!claimed) {
              console.log(`⏭️ Campanha ${campaign.id} já está em execução - pulando`);
              continue;
            }
            
            console.log(`🔒 Executando campanha ${campaign.id} do usuário ${ownerId} [status: em_progresso]`);
            
            // ✅ INDIVIDUAL: Verificar se o usuário tem sessão WhatsApp conectada ANTES de executar
            const userSession = await storage.getConnectedSessionByUserId(ownerId);
            if (!userSession) {
              console.error(`❌ [SCHEDULER] Usuário ${ownerId} não tem sessão WhatsApp conectada!`);
              await db.update(campaignsTable)
                .set({ status: 'erro', totalErros: campaign.totalRecipients || 0 })
                .where(eq(campaignsTable.id, campaign.id));
              continue;
            }
            console.log(`📱 [SCHEDULER] Usando sessão ${userSession.sessionId} do usuário ${ownerId}`);
            
            // Carrega APENAS clientes do dono da campanha
            const userClients = await storage.getClients({ 
              userId: ownerId,
              limit: 10000,
              isAdmin: false 
            });
            const clientsList = userClients.clientes || [];

            if (clientsList.length === 0) {
              console.warn(`⚠️ Nenhum cliente encontrado para usuário ${ownerId}`);
              continue;
            }

            console.log(`📤 Campanha ${campaign.id}: ${clientsList.length} clientes do usuário ${ownerId}`);
            await whatsappService.executeCampaign(campaign, db, clientsList);
          } catch (campaignError) {
            console.error(`❌ Erro ao executar campanha ${campaign.id}:`, campaignError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro no scheduler de campanhas:', error);
    }
  });
}

export async function bootstrapWhatsAppSessions() {
  console.log(`\n🚀 [BOOT] Carregando sessões WhatsApp em background...`);
  try {
    const allSessions = await storage.getAllWhatsappSessions();
    // ✅ Corrigido: buscar por "conectada" (português) - era "connected" (inglês)
    const connectedSessions = allSessions.filter((s: any) => s.status === "conectada");
    
    if (connectedSessions.length > 0) {
      console.log(`📱 [BOOT] Encontradas ${connectedSessions.length} sessões conectadas. Reinicializando...`);
      
      for (const session of connectedSessions) {
        if (session.sessionId && session.userId) {
          try {
            console.log(`🔄 [BOOT] Reinicializando sessão ${session.sessionId} do usuário ${session.userId}`);
            await whatsappService.initializeWhatsAppSession(session.sessionId, session.userId);
            console.log(`✅ [BOOT] Sessão ${session.sessionId} recarregada com sucesso`);
          } catch (err) {
            console.error(`❌ [BOOT] Erro ao recarregar sessão ${session.sessionId}:`, err);
          }
        }
      }
      console.log(`✅ [BOOT] Bootstrap de sessões WhatsApp concluído!`);
    } else {
      console.log(`ℹ️ [BOOT] Nenhuma sessão conectada encontrada`);
    }
  } catch (err) {
    console.error(`⚠️ [BOOT] Erro ao carregar sessões:`, err);
  }
}

