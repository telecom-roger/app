import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { insertClientSchema, insertOpportunitySchema, insertCampaignSchema, insertTemplateSchema, whatsappSessions, clients, interactions } from "@shared/schema";
import * as storage from "./storage";
import * as whatsappService from "./whatsappService";
import { setupAuth, isAuthenticated } from "./localAuth";
import { db } from "./db";

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

  // ==================== AUTH ROUTES ====================
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    res.json(req.user);
  });

  // ==================== CLIENT ROUTES ====================
  app.get("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const { search, status, page = "1", limit = "10000" } = req.query;
      const result = await storage.getClients({
        search: search as string,
        status: status as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
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
      const allClients = await db
        .select({
          id: clients.id,
          nome: clients.razaoSocial || clients.nome,
          telefone: clients.CELULAR_PRINCIPAL,
          email: clients.EMAIL_PRINCIPAL,
        })
        .from(clients)
        .limit(10000);

      const clientsWithPhones = allClients.filter((c) => c.telefone && c.telefone.trim());
      const result = clientsWithPhones.map((client) => ({
        ...client,
        ultimaCampanha: undefined,
      }));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching WhatsApp client list:", error);
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
      const { responsavel, etapa } = req.query;
      const opportunities = await storage.getOpportunities({
        responsavel: responsavel as string,
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
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
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

  // ==================== TEMPLATE ROUTES ====================
  app.get("/api/templates", isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
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
      const funnelData = await storage.getFunnelData();
      res.json(funnelData);
    } catch (error: any) {
      console.error("Error fetching funnel data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/stats/status-distribution", isAuthenticated, async (req, res) => {
    try {
      const distribution = await storage.getStatusDistribution();
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
        await whatsappService.initializeWhatsAppSession(sessionId);
        
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

      // Verify ownership
      if (session.userId !== (req.user as any).id && (req.user as any).role !== "admin") {
        return res.status(403).json({ error: "Não autorizado" });
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
        await whatsappService.initializeWhatsAppSession(newSessionId);
        
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

      // Verify ownership
      if (session.userId !== (req.user as any).id && (req.user as any).role !== "admin") {
        return res.status(403).json({ error: "Não autorizado" });
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

      // Verify session ownership
      const session = await storage.getWhatsappSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Sessão não encontrada" });
      }

      if (session.userId !== (req.user as any).id && (req.user as any).role !== "admin") {
        return res.status(403).json({ error: "Não autorizado" });
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

      // Verify session ownership
      const session = await storage.getWhatsappSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Sessão não encontrada" });
      }

      if (session.userId !== (req.user as any).id && (req.user as any).role !== "admin") {
        return res.status(403).json({ error: "Não autorizado" });
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

      // Return immediately - processing happens in background
      res.json({ 
        success: true,
        mensagem: "Campanha iniciada em background",
        total: contatos.length
      });

      // Process messages in background (don't wait for response)
      (async () => {
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
            }

            // Wait before next message
            if (i < contatos.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, (tempoDelay || 40) * 1000));
            }
          } catch (err) {
            console.error("Erro processando contato:", err);
          }
        }
        console.log("Campanha de fundo concluída");
      })().catch((err) => console.error("Erro na campanha de background:", err));
    } catch (error: any) {
      console.error("Error in background campaign:", error);
      res.status(500).json({ error: "Internal server error" });
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

  // ==================== ADMIN ROUTES ====================
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
