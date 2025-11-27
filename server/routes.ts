import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { eq, and, or, ilike, desc, sql, lte, inArray, isNull } from "drizzle-orm";
import cron from "node-cron";
import { insertClientSchema, insertOpportunitySchema, insertCampaignSchema, insertTemplateSchema, insertClientSharingSchema, whatsappSessions, clients, interactions, conversations, messages, campaigns as campaignsTable, templates as templatesTable, tags, clientSharing, notifications, users } from "@shared/schema";
import * as storage from "./storage";
import * as whatsappService from "./whatsappService";
import { setupAuth, isAuthenticated } from "./localAuth";
import { db } from "./db";

// Track campaigns in progress
const campanhasEmProgresso = new Map<string, {
  id: string;
  total: number;
  enviadas: number;
  erros: number;
  status: "em_progresso" | "concluida" | "cancelada";
  criadoEm: Date;
}>();

// Admin middleware
function requireAdmin(req: Request, res: Response, next: Function) {
  const user = (req.user as any);
  if (!user || !user.dbUser || user.dbUser.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // ==================== SCHEDULER: CAMPANHAS AGENDADAS ====================
  // Executa a cada 1 minuto
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
        
        const allClients = await storage.getClients({ limit: 10000, isAdmin: true });
        const clientsList = allClients.clientes || [];

        for (const campaign of dueCampaigns) {
          await whatsappService.executeCampaign(campaign, db, clientsList);
        }
      }
    } catch (error) {
      console.error('❌ Erro no scheduler de campanhas:', error);
    }
  });

  // ==================== AUTH ROUTES ====================
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    res.json(req.user);
  });

  // ==================== CLIENT ROUTES ====================
  app.get("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { search, status, tagName, page = "1", limit = "10000" } = req.query;
      // Adicionar userId para filtrar apenas clientes do usuário
      const result = await storage.getClients({
        userId: user.id,
        search: search as string,
        status: status as string,
        tagName: tagName as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        userId: user.id,
        isAdmin: user.role === 'admin',
      });
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint para listar clientes com WhatsApp (MUST be before :id route)
  app.get("/api/clients/whatsapp-list", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const whereCondition = user.role === 'admin' ? undefined : or(
        eq(clients.createdBy, user.id),
        sql`${clients.createdBy} IS NULL`
      );
      
      const allClients = await db
        .select({
          id: clients.id,
          nome: clients.nome,
          razaoSocial: clients.razaoSocial,
          telefone: clients.CELULAR_PRINCIPAL,
          email: clients.EMAIL_PRINCIPAL,
          cpfCnpj: clients.cpfCnpj,
          status: clients.status,
          tagNames: clients.tags,
        })
        .from(clients)
        .where(whereCondition)
        .limit(10000);

      // Fetch all available tags
      const allTags = await db.select().from(tags);
      
      const clientsWithPhones = allClients.filter((c) => c.telefone && c.telefone.trim());
      const result = clientsWithPhones.map((client) => {
        // Convert tag names to tag objects with id, nome, cor
        const clientTags = (client.tagNames || []).map((tagName: string) => {
          const tag = allTags.find(t => t.nome === tagName);
          return tag ? { id: tag.id, nome: tag.nome, cor: tag.cor } : null;
        }).filter(Boolean);

        return {
          id: client.id,
          nome: client.nome,
          razaoSocial: client.razaoSocial,
          telefone: client.telefone,
          email: client.email,
          cpfCnpj: client.cpfCnpj,
          status: client.status,
          tags: clientTags,
          ultimaCampanha: undefined,
        };
      });

      res.json(result);
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

      const validatedData = insertClientSchema.partial().parse(req.body);
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

  // ==================== OPPORTUNITY ROUTES ====================
  app.get("/api/opportunities", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { etapa } = req.query;
      const opportunities = await storage.getOpportunities({
        userId: user.id, // Filtrar por usuário autenticado
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
      const opportunity = await storage.createOpportunity(validatedData);

      // Create audit log
      await storage.createAuditLog({
        userId: (req.user as any).id,
        acao: "criar",
        entidade: "opportunity",
        entidadeId: opportunity.id,
        dadosNovos: opportunity as any,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

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

      const opportunity = await storage.updateOpportunity(req.params.id, { etapa });

      // Atualizar tag do cliente para manter sincronizado
      if (oldOpportunity.clientId) {
        const client = await storage.getClientById(oldOpportunity.clientId);
        if (client) {
          const oldTags = client.tags || [];
          // Remover tag antiga, adicionar tag nova
          let newTags = oldTags.filter((t: string) => t !== oldOpportunity.etapa);
          if (!newTags.includes(etapa)) {
            newTags = [etapa]; // Cliente tem apenas 1 tag/oportunidade
          }
          await storage.updateClient(oldOpportunity.clientId, { tags: newTags });
        }
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

      const validatedData = insertOpportunitySchema.partial().parse(req.body);
      const opportunity = await storage.updateOpportunity(req.params.id, validatedData);

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
      const validatedData = insertCampaignSchema.parse({
        ...req.body,
        createdBy: (req.user as any).id,
      });
      const campaign = await storage.createCampaign(validatedData);

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

  app.post("/api/campaigns/schedule", isAuthenticated, async (req, res) => {
    try {
      const { nome, templateId, agendadaPara, filtros, totalRecipients } = req.body;
      if (!nome || !templateId || !agendadaPara) {
        return res.status(400).json({ error: "Nome, templateId e agendadaPara são obrigatórios" });
      }

      const validatedData = insertCampaignSchema.parse({
        nome,
        tipo: "whatsapp",
        templateId,
        status: "agendada",
        agendadaPara: new Date(agendadaPara),
        filtros: filtros || {},
        totalRecipients: totalRecipients || 0,
        createdBy: (req.user as any).id,
      });

      const campaign = await storage.createCampaign(validatedData);

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

  // Get campaign details with recipients
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
      
      if (clientIds.length === 0) {
        return res.json([]);
      }

      // Fetch all clients that match the clientIds
      const allClients = await db
        .select({
          id: clients.id,
          razaoSocial: clients.razaoSocial,
          CELULAR_PRINCIPAL: clients.CELULAR_PRINCIPAL,
          telefone: clients.CELULAR_PRINCIPAL,
          email: clients.EMAIL_PRINCIPAL,
          status: clients.status,
        })
        .from(clients)
        .where(inArray(clients.id, clientIds))
        .limit(10000);

      res.json(allClients);
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
        .where(
          user.role === 'admin'
            ? undefined
            : eq(templatesTable.createdBy, user.id)
        );
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

  // ==================== IMPORT ROUTES ====================
  app.post("/api/import/clients", isAuthenticated, async (req, res) => {
    try {
      const { data, mapping } = req.body; // data = array of rows, mapping = column mapping
      
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
            razaoSocial: getRowValue(row, mapping.razaoSocial),
            cpfCnpj: getRowValue(row, mapping.cpfCnpj),
            status: getRowValue(row, mapping.status) || "lead",
            carteira: getRowValue(row, mapping.carteira),
            categoria: getRowValue(row, mapping.categoria),
            score: mapping.score >= 0 ? parseInt(getRowValue(row, mapping.score) || "0") || 0 : 0,
            planoAtual: getRowValue(row, mapping.planoAtual),
            produtoAtual: getRowValue(row, mapping.produtoAtual),
            // Contact fields
            telefone: getRowValue(row, mapping.telefone),
            email: getRowValue(row, mapping.email),
            contato: getRowValue(row, mapping.contato),
            // Address fields
            endereco: getRowValue(row, mapping.endereco),
            numero: getRowValue(row, mapping.numero),
            complemento: getRowValue(row, mapping.complemento),
            cep: getRowValue(row, mapping.cep),
            cidade: getRowValue(row, mapping.cidade),
            uf: getRowValue(row, mapping.uf),
            // Contract fields
            dataContrato: mapping.dataContrato >= 0 ? new Date(getRowValue(row, mapping.dataContrato) || "") : null,
            valorContrato: mapping.valorContrato >= 0 ? parseInt(getRowValue(row, mapping.valorContrato) || "0") || 0 : null,
            dataUltimoContato: mapping.dataUltimoContato >= 0 ? new Date(getRowValue(row, mapping.dataUltimoContato) || "") : null,
            observacoes: getRowValue(row, mapping.observacoes),
            // Telecom fields (UPPERCASE)
            APARELHO_LIBERADO: getRowValue(row, mapping.APARELHO_LIBERADO),
            PEDIDO_MOVEL: getRowValue(row, mapping.PEDIDO_MOVEL),
            M_FIXA: getRowValue(row, mapping.M_FIXA),
            PEDIDO_FIXA: getRowValue(row, mapping.PEDIDO_FIXA),
            NOME_CONTATO: getRowValue(row, mapping.NOME_CONTATO),
            EMAIL_PRINCIPAL: getRowValue(row, mapping.EMAIL_PRINCIPAL),
            CELULAR_PRINCIPAL: getRowValue(row, mapping.CELULAR_PRINCIPAL),
            TIPO_GESTOR: getRowValue(row, mapping.TIPO_GESTOR),
            FLG_DOMINIO_PUBLICO_SFA: getRowValue(row, mapping.FLG_DOMINIO_PUBLICO_SFA) === "1" || getRowValue(row, mapping.FLG_DOMINIO_PUBLICO_SFA) === "true",
            TELEFONE_COMERCIAL: getRowValue(row, mapping.TELEFONE_COMERCIAL),
            CELULAR: getRowValue(row, mapping.CELULAR),
            TELEFONE_RESIDENCIAL: getRowValue(row, mapping.TELEFONE_RESIDENCIAL),
            EMAIL_SIBEL: getRowValue(row, mapping.EMAIL_SIBEL),
            PROP_MOVEL_AVANCADA: getRowValue(row, mapping.PROP_MOVEL_AVANCADA),
            SERASA: getRowValue(row, mapping.SERASA),
            MENSAGEM_SERASA: getRowValue(row, mapping.MENSAGEM_SERASA),
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
      const session = await storage.getWhatsappSessionById(sessionId);
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
      const { sessionId, mensagem, filtros } = req.body;
      
      if (!sessionId || !mensagem) {
        return res.status(400).json({ error: "sessionId e mensagem são obrigatórios" });
      }

      // Verify session ownership - only owner can use
      const session = await storage.getWhatsappSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Sessão não encontrada" });
      }

      if (session.userId !== (req.user as any).id) {
        return res.status(403).json({ error: "Não autorizado - essa sessão não é sua" });
      }

      // Verify session is connected
      const isAlive = await whatsappService.isSessionAlive(session.sessionId);
      if (!isAlive) {
        return res.status(400).json({ error: "Sessão WhatsApp não está conectada" });
      }

      // Get clients to send to
      const clientes = await storage.getClientsForBroadcast(filtros);
      
      // Queue messages for sending (async, non-blocking)
      let enfileiradas = 0;
      for (const cliente of clientes) {
        const telefone = cliente.CELULAR_PRINCIPAL || cliente.telefone;
        if (telefone) {
          // Queue message asynchronously (don't wait)
          whatsappService.sendMessage(session.sessionId, telefone, mensagem).catch(err => {
            console.error(`Erro ao enviar para ${telefone}:`, err);
          });
          enfileiradas++;
        }
      }

      res.json({ 
        success: true, 
        enfileiradas,
        total: clientes.length 
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
      const sessions = await storage.getAllWhatsappSessions(user.role === 'admin' ? undefined : user.id);
      const sessaoConectada = sessions.find((s) => s.status === 'conectada');
      
      if (!sessaoConectada) {
        return res.status(400).json({ error: "Nenhuma sessão WhatsApp conectada" });
      }

      // Create campaign tracking ID
      const campanhaId = `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      campanhasEmProgresso.set(campanhaId, {
        id: campanhaId,
        total: contatos.length,
        enviadas: 0,
        erros: 0,
        status: "em_progresso",
        criadoEm: new Date(),
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

              await whatsappService.sendMessage(sessaoConectada.sessionId, telefone, mensagem);
              enviadas++;
              
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
      const campanhas = Array.from(campanhasEmProgresso.values())
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
      
      // Remove do memory
      campanhasEmProgresso.delete(id);

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

  // New endpoint for single message sending from campaigns page
  app.post("/api/whatsapp/enviar-broadcast", isAuthenticated, async (req, res) => {
    try {
      const { telefone, mensagem, clientId } = req.body;
      
      if (!telefone || !mensagem) {
        return res.status(400).json({ error: "telefone e mensagem são obrigatórios" });
      }

      // Get user's first active WhatsApp session
      const user = (req.user as any);
      const sessions = await storage.getAllWhatsappSessions(user.role === 'admin' ? undefined : user.id);
      const sessaoConectada = sessions.find((s) => s.status === 'conectada');
      
      if (!sessaoConectada) {
        return res.status(400).json({ error: "Nenhuma sessão WhatsApp conectada" });
      }

      // Verify the session is actually alive
      const isAlive = await whatsappService.isSessionAlive(sessaoConectada.sessionId);
      if (!isAlive) {
        return res.status(400).json({ error: "Sessão WhatsApp não está mais conectada" });
      }

      // Send the message
      try {
        await whatsappService.sendMessage(sessaoConectada.sessionId, telefone, mensagem);
        
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
      const conversas = await storage.getConversations(user.id);
      res.json(conversas);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
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

      // 🚀 ENVIAR MENSAGEM PARA WHATSAPP
      try {
        if (conversation && conversation.clientId) {
          // Pega a sessão do usuário
          const [session] = await db
            .select()
            .from(whatsappSessions)
            .where(and(eq(whatsappSessions.userId, user.id), eq(whatsappSessions.status, "conectada")))
            .limit(1);

          if (session) {
            // Pega o cliente para obter o telefone
            const [client] = await db
              .select()
              .from(clients)
              .where(eq(clients.id, conversation.clientId))
              .limit(1);

            if (client && client.CELULAR_PRINCIPAL) {
              const isAlive = whatsappService.isSessionAlive(session.sessionId);
              if (isAlive) {
                // Formata o telefone para WhatsApp
                let telefone = client.CELULAR_PRINCIPAL.replace(/\D/g, "");
                if (!telefone.startsWith("55")) {
                  telefone = "55" + telefone;
                }

                // Envia a mensagem
                if (tipo === "texto") {
                  await whatsappService.sendMessage(session.sessionId, telefone, conteudo);
                  console.log(`✅ Mensagem enviada para WhatsApp: ${telefone}`);
                } else if (tipo === "imagem" && arquivo) {
                  await whatsappService.sendImage(session.sessionId, telefone, arquivo, conteudo);
                  console.log(`✅ Imagem enviada para WhatsApp: ${telefone}`);
                } else if (tipo === "audio" && arquivo) {
                  await whatsappService.sendAudio(session.sessionId, telefone, arquivo);
                  console.log(`✅ Áudio enviado para WhatsApp: ${telefone}`);
                } else if (tipo === "documento" && arquivo) {
                  await whatsappService.sendDocument(session.sessionId, telefone, arquivo, nomeArquivo);
                  console.log(`✅ Documento enviado para WhatsApp: ${telefone}`);
                }
              }
            }
          }
        }
      } catch (whatsappError) {
        console.warn("⚠️ Mensagem salva mas não enviada para WhatsApp:", whatsappError);
        // Não falha a requisição se WhatsApp falhar
      }

      res.json(mensagem);
    } catch (error: any) {
      console.error("Error creating message:", error);
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

  // TEST ENDPOINT: Simulate receiving a message from client
  app.post("/api/chat/test/receive-message/:conversationId", isAuthenticated, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { conteudo = "Olá! Tudo bem?" } = req.body;

      const mensagem = await storage.createMessage({
        conversationId,
        sender: "client",
        tipo: "texto",
        conteudo,
      });

      res.json(mensagem);
    } catch (error: any) {
      console.error("Error simulating message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Helper endpoint to get/create conversation by phone
  app.post("/api/chat/conversation-by-phone", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ error: "Phone number required" });
      }
      
      let normalizado = phone.replace(/\D/g, "");
      if (normalizado.startsWith("55")) {
        normalizado = normalizado.substring(2);
      }
      
      let [client] = await db
        .select()
        .from(clients)
        .where(or(
          ilike(clients.CELULAR_PRINCIPAL, `%${normalizado}%`),
          ilike(clients.telefone, `%${normalizado}%`)
        ))
        .limit(1);
      
      // Se não encontrar, criar novo cliente automaticamente
      if (!client) {
        console.log(`[CHAT] 🆕 Auto-criando cliente para telefone: ${phone}`);
        const newClient = await storage.createClient({
          nome: `Novo contato ${phone}`,
          telefone: phone,
          CELULAR_PRINCIPAL: phone,
          cpfCnpj: "",
          status: "Lead",
          carteira: "Dominio",
          score: 0,
        });
        client = newClient;
        console.log(`[CHAT] ✅ Cliente criado: ${client.id}`);
      }
      
      const conv = await storage.createOrGetConversation(client.id, userId);
      console.log(`[CHAT] ✨ Conversa criada/carregada: ${conv.id}`);
      res.json(conv);
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
      const { conteudo, cor } = req.body;
      
      const note = await storage.createClientNote({
        userId: user.id,
        clientId,
        conteudo,
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
      const { conteudo, cor } = req.body;
      
      const note = await storage.updateClientNote(id, { conteudo, cor });
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
      const user = req.user as any;
      
      console.log(`🏷️ Adicionando tag ao cliente:`, { clientId, tagName, valorEstimado });
      
      const client = await storage.addTagToClient(clientId, tagName);
      if (!client) return res.status(404).json({ error: "Client not found" });
      
      console.log(`✅ Cliente atualizado com tag: ${tagName}`);
      
      // Criar oportunidade automaticamente com a tag como etapa
      if (tagName && valorEstimado && valorEstimado > 0) {
        try {
          console.log(`📌 Criando oportunidade com valor: ${valorEstimado / 100}`);
          const opp = await storage.createOpportunity({
            clientId,
            titulo: `Oportunidade - ${client.razaoSocial || client.nome}`,
            valorEstimado,
            etapa: tagName,
            responsavelId: user.id,
          });
          console.log(`✅ Oportunidade criada:`, opp.id);
          queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
        } catch (err) {
          console.error(`❌ Erro ao criar oportunidade:`, err);
        }
      } else {
        console.log(`⚠️ Oportunidade não criada - valorEstimado:`, valorEstimado);
      }
      
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
      const client = await storage.removeTagFromClient(clientId, tagName);
      if (!client) return res.status(404).json({ error: "Client not found" });
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
      const { sharedWithUserId, permissao = "visualizar" } = req.body;
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

      if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({ error: "Selecione pelo menos um cliente" });
      }

      // Verify ownership of all clients
      const clientsToShare = await db
        .select()
        .from(clients)
        .where(inArray(clients.id, clientIds));

      const allOwned = clientsToShare.every(c => c.createdBy === user.id);
      if (!allOwned) {
        return res.status(403).json({ error: "Você só pode compartilhar seus próprios clientes" });
      }

      const sharings = await storage.shareClientsWithUser(clientIds, sharedWithUserId, user.id);

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

  // Get sharing info for a client
  app.get("/api/clients/:clientId/sharing", isAuthenticated, async (req, res) => {
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
        .update(clientsTable)
        .set({ createdBy: user.id })
        .where(isNull(clientsTable.createdBy))
        .returning({ id: clientsTable.id });

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

  const httpServer = createServer(app);

  return httpServer;
}
