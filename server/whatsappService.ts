import QRCode from "qrcode";
import { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers, downloadMediaMessage } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import * as storage from "./storage";
import { db } from "./db";
import { or, ilike, eq, and, desc, gte } from "drizzle-orm";
import { clients as clientsTable, automationConfigs, messages, campaignSendings, conversations } from "@shared/schema";
import { analyzeClientMessage } from "./aiService";

// Track last retry to prevent duplicates
const lastRetryPerUser = new Map<string, Date>();
const RETRY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

// ==================== RETRY DE CAMPANHAS COM ERRO ====================
async function retryFailedCampaigns(userId: string) {
  try {
    console.log(`\n🔄 [RETRY] Verificando campanhas com erro para usuário ${userId}...`);
    
    // ✅ IDEMPOTÊNCIA: Verifica se já tentou retry recentemente
    const lastRetry = lastRetryPerUser.get(userId);
    if (lastRetry) {
      const timeSinceLastRetry = Date.now() - lastRetry.getTime();
      if (timeSinceLastRetry < RETRY_COOLDOWN_MS) {
        console.log(`⏭️ [RETRY] Cooldown ativo - último retry há ${Math.round(timeSinceLastRetry / 1000)}s`);
        return;
      }
    }
    
    const { campaigns } = await import("@shared/schema");
    const { eq, and, or, isNull } = await import("drizzle-orm");
    const { campanhasEmProgresso } = await import("./routes");
    
    const failedCampaigns = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.createdBy, userId),
          eq(campaigns.status, 'erro')
        )
      );
    
    if (failedCampaigns.length === 0) {
      console.log(`✅ [RETRY] Nenhuma campanha com erro encontrada`);
      return;
    }
    
    console.log(`🔄 [RETRY] Encontradas ${failedCampaigns.length} campanhas com erro. Reagendando...`);
    
    const now = new Date();
    let reagendadas = 0;
    
    for (const campaign of failedCampaigns) {
      // ✅ GUARD: Pula campanha se já está em progresso
      const emProgressoValues = Array.from(campanhasEmProgresso.values());
      const jaEmProgresso = emProgressoValues.some(c => 
        c.id === campaign.id || 
        (c.userId === userId && c.status === 'em_progresso')
      );
      
      if (jaEmProgresso) {
        console.log(`⏭️ [RETRY] Pulando campanha ${campaign.id} - já em progresso`);
        continue;
      }
      
      await db.update(campaigns)
        .set({ 
          status: 'agendada',
          agendadaPara: now,
          totalErros: 0,
        })
        .where(eq(campaigns.id, campaign.id));
      
      reagendadas++;
      console.log(`✅ [RETRY] Campanha "${campaign.nome}" (${campaign.id}) reagendada`);
    }
    
    // ✅ Atualiza timestamp do último retry
    lastRetryPerUser.set(userId, new Date());
    
    console.log(`✅ [RETRY] ${reagendadas}/${failedCampaigns.length} campanhas reagendadas com sucesso!`);
  } catch (err) {
    console.error(`❌ [RETRY] Erro ao reprocessar campanhas:`, err);
  }
}

// ==================== FILA DE MENSAGENS OFFLINE ====================
async function processPendingMessages(sessionId: string, userId: string) {
  try {
    console.log(`\n📬 [OFFLINE QUEUE] Processando mensagens pendentes para sessão ${sessionId}...`);
    
    const pendingMessages = await db
      .select({
        message: messages,
        conversation: conversations,
        client: clientsTable,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(clientsTable, eq(conversations.clientId, clientsTable.id))
      .where(
        and(
          eq(conversations.userId, userId),
          eq(messages.sender, "user"),
          eq(messages.statusEntrega, "pendente_offline")
        )
      )
      .orderBy(messages.createdAt);
    
    if (pendingMessages.length === 0) {
      console.log(`📭 [OFFLINE QUEUE] Nenhuma mensagem pendente encontrada`);
      return;
    }
    
    console.log(`📨 [OFFLINE QUEUE] Encontradas ${pendingMessages.length} mensagens pendentes`);
    
    let enviadas = 0;
    let erros = 0;
    
    for (const item of pendingMessages) {
      const { message, client } = item;
      
      if (!client.celular) {
        console.warn(`⚠️ [OFFLINE QUEUE] Cliente sem celular - marcando mensagem ${message.id} como erro`);
        await db.update(messages)
          .set({ statusEntrega: "erro" })
          .where(eq(messages.id, message.id));
        erros++;
        continue;
      }
      
      let telefone = client.celular.replace(/\D/g, "");
      if (!telefone.startsWith("55")) {
        telefone = "55" + telefone;
      }
      
      try {
        let result: { success: boolean; messageId?: string } = { success: false };
        
        if (message.tipo === "texto") {
          result = await sendMessage(sessionId, telefone, message.conteudo || "");
        } else if (message.tipo === "imagem" && message.arquivo) {
          result = await sendImage(sessionId, telefone, message.arquivo, message.conteudo || "");
        } else if (message.tipo === "audio" && message.arquivo) {
          result = await sendAudio(sessionId, telefone, message.arquivo);
        } else if (message.tipo === "documento" && message.arquivo) {
          result = await sendDocument(sessionId, telefone, message.arquivo, message.nomeArquivo || "arquivo");
        } else {
          console.warn(`⚠️ [OFFLINE QUEUE] Tipo não suportado ou arquivo faltando - marcando mensagem ${message.id} como erro`);
          await db.update(messages)
            .set({ statusEntrega: "erro" })
            .where(eq(messages.id, message.id));
          erros++;
          continue;
        }
        
        if (result.success) {
          await db.update(messages)
            .set({ 
              statusEntrega: "enviado",
              whatsappMessageId: result.messageId || null
            })
            .where(eq(messages.id, message.id));
          enviadas++;
          console.log(`✅ [OFFLINE QUEUE] Mensagem ${message.id} enviada com sucesso`);
        } else {
          await db.update(messages)
            .set({ statusEntrega: "erro" })
            .where(eq(messages.id, message.id));
          erros++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (err) {
        console.error(`❌ [OFFLINE QUEUE] Erro ao enviar mensagem ${message.id}:`, err);
        await db.update(messages)
          .set({ statusEntrega: "erro" })
          .where(eq(messages.id, message.id));
        erros++;
      }
    }
    
    console.log(`📊 [OFFLINE QUEUE] Concluído: ${enviadas} enviadas, ${erros} erros`);
    
  } catch (error) {
    console.error(`❌ [OFFLINE QUEUE] Erro ao processar fila:`, error);
  }
}

const execAsync = promisify(exec);

// Map file extensions to MIME types
const mimeTypeMap: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
};

function getMimeTypeFromFileName(fileName: string): string {
  if (!fileName) return "application/octet-stream";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return mimeTypeMap[ext] || "application/octet-stream";
}

const activeSessions = new Map<string, any>();
const qrCodes = new Map<string, string>();
const sessionStatus = new Map<string, string>();
const sessionUsers = new Map<string, string>();
const sessionListeners = new Map<string, boolean>();
const keepAliveIntervals = new Map<string, NodeJS.Timeout>();

let reconnectAttempts = new Map<string, number>();

export function setSessionUser(sessionId: string, userId: string) {
  sessionUsers.set(sessionId, userId);
}

function startKeepAlive(sessionId: string, sock: any) {
  if (keepAliveIntervals.has(sessionId)) {
    clearInterval(keepAliveIntervals.get(sessionId)!);
  }

  const interval = setInterval(async () => {
    try {
      if (activeSessions.has(sessionId)) {
        console.log(`💓 Keep-alive ping enviado para ${sessionId}`);
      }
    } catch (error) {
      console.log(`⚠️ Keep-alive falhou para ${sessionId}, reconectando...`);
      clearInterval(interval);
      keepAliveIntervals.delete(sessionId);
    }
  }, 30000);

  keepAliveIntervals.set(sessionId, interval);
}

function stopKeepAlive(sessionId: string) {
  if (keepAliveIntervals.has(sessionId)) {
    clearInterval(keepAliveIntervals.get(sessionId)!);
    keepAliveIntervals.delete(sessionId);
  }
}

async function processIncomingMessages(sessionId: string, m: any) {
  try {
    const { messages: msgs } = m || {};
    if (!msgs || msgs.length === 0) {
      console.log(`[RECEBIMENTO] ⚠️ Nenhuma mensagem para processar`);
      return;
    }

    const userId = sessionUsers.get(sessionId);
    if (!userId) {
      console.log(`[RECEBIMENTO] ⚠️ userId não encontrado para ${sessionId}`);
      return;
    }

    console.log(`[RECEBIMENTO] 🎯 Processando ${msgs.length} mensagens para ${sessionId}`);

    for (const msg of msgs) {
      if (msg.key.fromMe) {
        console.log(`[RECEBIMENTO] ➡️ Pulando msg enviada por mim (fromMe)`);
        continue;
      }
      if (msg.key.remoteJid?.includes("@g.us")) {
        console.log(`[RECEBIMENTO] ➡️ Pulando msg de grupo`);
        continue;
      }
      // Filter out WhatsApp status updates (broadcasts)
      if (msg.key.remoteJid?.includes("@broadcast") || msg.message?.statusMessage) {
        console.log(`[RECEBIMENTO] ➡️ Pulando status do WhatsApp (broadcast)`);
        continue;
      }

      // Extract phone number from WhatsApp identifiers
      let senderPhone = "";
      
      // Helper function to validate phone format (should be 10-15 digits)
      const isValidPhoneFormat = (phone: string): boolean => {
        const cleaned = phone.replace(/\D/g, "");
        return cleaned.length >= 10 && cleaned.length <= 15;
      };
      
      // Helper to clean phone number (remove WhatsApp suffixes)
      const cleanPhone = (phone: string): string => {
        return phone
          .replace("@s.whatsapp.net", "")
          .replace("@c.us", "")
          .replace("@iid", "")
          .replace("@lid", "")
          .trim();
      };
      
      // Helper to normalize phone (remove 55 prefix if present)
      const normalizePhone = (phone: string): string => {
        let normalized = phone.replace(/\D/g, ""); // Remove non-digits
        if (normalized.startsWith("55")) {
          normalized = normalized.substring(2); // Remove 55 prefix
        }
        return normalized;
      };
      
      // IMPORTANT: If addressingMode is "lid", the remoteJid is a Line ID (not a phone)
      // We should use remoteJidAlt instead, which contains the actual phone
      if ((msg.key as any).addressingMode === "lid" && msg.key.remoteJidAlt) {
        const candidate = cleanPhone(msg.key.remoteJidAlt);
        if (isValidPhoneFormat(candidate)) {
          senderPhone = candidate;
        }
      }
      
      // If not yet found, try remoteJid (normal case)
      if (!senderPhone && msg.key.remoteJid) {
        const candidate = cleanPhone(msg.key.remoteJid);
        if (isValidPhoneFormat(candidate)) {
          senderPhone = candidate;
        }
      }
      
      // If still not found, try participant (for group messages)
      if (!senderPhone && msg.key.participant) {
        const candidate = cleanPhone(msg.key.participant);
        if (isValidPhoneFormat(candidate)) {
          senderPhone = candidate;
        }
      }
      
      // Last resort: try remoteJidAlt
      if (!senderPhone && msg.key.remoteJidAlt) {
        const candidate = cleanPhone(msg.key.remoteJidAlt);
        if (isValidPhoneFormat(candidate)) {
          senderPhone = candidate;
        }
      }
      
      if (!senderPhone) {
        console.log(`[RECEBIMENTO] ⚠️ Telefone vazio após limpeza`);
        continue;
      }
      
      // NORMALIZE IMMEDIATELY - remove 55 prefix if present (all stored without 55)
      senderPhone = normalizePhone(senderPhone);
      
      console.log(`[RECEBIMENTO] 📱 Telefone extraído (normalizado): "${senderPhone}"`);

      let conteudo = "";
      let tipo = "texto";
      let arquivo: string | undefined;
      let nomeArquivo: string | undefined;
      let mimeType: string | undefined;

      if (msg.message?.conversation) {
        conteudo = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        conteudo = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage) {
        tipo = "imagem";
        conteudo = msg.message.imageMessage.caption || "";
        mimeType = msg.message.imageMessage.mimetype || "image/jpeg";
        nomeArquivo = `image_${Date.now()}.jpg`;
      } else if (msg.message?.audioMessage) {
        tipo = "audio";
        conteudo = "";
        mimeType = msg.message.audioMessage.mimetype || "audio/aac";
        nomeArquivo = `audio_${Date.now()}.m4a`;
      } else if (msg.message?.videoMessage) {
        tipo = "video";
        conteudo = msg.message.videoMessage.caption || "";
        mimeType = msg.message.videoMessage.mimetype || "video/mp4";
        nomeArquivo = `video_${Date.now()}.mp4`;
      } else if (msg.message?.documentMessage) {
        tipo = "documento";
        nomeArquivo = msg.message.documentMessage.fileName || "documento";
        conteudo = `[${nomeArquivo}]`;
        // Try to get mimeType from message, fallback to infer from filename
        mimeType = msg.message.documentMessage.mimetype || getMimeTypeFromFileName(nomeArquivo || "");
      } else {
        // Ignorar mensagens de protocolo (history sync, etc)
        continue;
      }

      try {
        console.log(`[RECEBIMENTO] 💾 Salvando: tipo=${tipo}, conteudo="${conteudo.substring(0, 50)}"`);
        
        // Download media if present
        if (tipo !== "texto" && msg.message && activeSessions.has(sessionId)) {
          try {
            const sock = activeSessions.get(sessionId);
            const buffer = await downloadMediaMessage(msg, "buffer", {}, {
              logger: console,
              reuploadRequest: sock.updateMediaMessage,
            } as any);
            
            if (buffer) {
              arquivo = "data:" + (mimeType || "application/octet-stream") + ";base64," + buffer.toString("base64");
              console.log(`✅ Mídia baixada: ${nomeArquivo} (${buffer.length} bytes)`);
            }
          } catch (err) {
            console.warn(`⚠️ Erro ao baixar mídia:`, err);
            // Continue sem mídia - vai salvar só o texto
          }
        }
        
        // ✅ PASSO 1: Buscar conversa para este usuário + telefone
        let conversation = await storage.findConversationByPhoneAndUser(senderPhone, userId);
        
        if (!conversation) {
          console.warn(`[RECEBIMENTO] ⚠️ Conversa não encontrada via findConversationByPhoneAndUser`);
          console.log(`🔍 [BUSCA GLOBAL] Buscando cliente por telefone: "${senderPhone}"`);
          
          // ✅ PASSO 2: Buscar cliente GLOBALMENTE (sem filtrar por usuário) - MAS COM PRIORIDADE
          // Buscar exato primeiro, depois fuzzy
          let client = null;
          
          // Busca exata
          const exactMatches = await db
            .select()
            .from(clientsTable)
            .where(or(
              eq(clientsTable.celular, senderPhone),
              eq(clientsTable.telefone2, senderPhone)
            ));
          
          if (exactMatches.length > 0) {
            // Se encontrar múltiplos, preferir aquele com status "ativo" ou mais recente
            client = exactMatches.sort((a, b) => {
              if (a.status === "ativo" && b.status !== "ativo") return -1;
              if (b.status === "ativo" && a.status !== "ativo") return 1;
              return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
            })[0];
            console.log(`✅ [CLIENTE ENCONTRADO] Exato: ${client.id} (${client.nome}) - celular: ${client.celular}`);
          } else {
            // Busca fuzzy se exato não encontrar
            const fuzzyMatches = await db
              .select()
              .from(clientsTable)
              .where(or(
                ilike(clientsTable.celular, `%${senderPhone}%`),
                ilike(clientsTable.telefone2, `%${senderPhone}%`)
              ))
              .limit(5);
            
            if (fuzzyMatches.length > 0) {
              client = fuzzyMatches[0];
              console.log(`✅ [CLIENTE ENCONTRADO] Fuzzy: ${client.id} (${client.nome})`);
            }
          }
          
          // ✅ PASSO 3: Se encontrou cliente E usuário pode acessar, usar ele. Se não, criar novo
          if (client) {
            // Verificar se o usuário pode acessar esse cliente (criou ou compartilhado)
            const canAccess = await storage.canUserAccessClient(client.id, userId);
            
            if (canAccess) {
              console.log(`✅ Usando cliente existente: ${client.id} (${client.nome})`);
              conversation = await storage.createOrGetConversation(client.id, userId);
              console.log(`✨ Conversa criada para usuário ${userId}: ${conversation.id}`);
            } else {
              console.warn(`⚠️ Cliente encontrado mas usuário não tem acesso: ${client.id}`);
              client = null; // Forçar criação de novo contato
            }
          }
          
          if (!client) {
            console.warn(`[RECEBIMENTO] ⚠️ Nenhum cliente encontrado - criando novo`);
            
            // Auto-create new client
            const novoCliente = await storage.createClient({
              nome: `NOVO CONTATO -> ${senderPhone}`,
              celular: senderPhone,
              status: "Lead",
              carteira: "CONTATO",
              createdBy: userId,
            });
            
            console.log(`✅ Novo cliente criado: ${novoCliente.id} (${senderPhone})`);
            
            await storage.createInteraction({
              clientId: novoCliente.id,
              tipo: "nota",
              origem: "system",
              titulo: "Contato criado por sistema",
              texto: `Contato criado automaticamente ao receber primeira mensagem do WhatsApp`,
              createdBy: userId,
            });
            
            conversation = await storage.createOrGetConversation(novoCliente.id, userId);
            console.log(`✨ Conversa criada para novo contato: ${conversation.id}`);
          }
        }

        if (!conversation) {
          console.error(`[RECEBIMENTO] ❌ ERRO: Conversa não foi criada!`);
          continue;
        }
        
        console.log(`[RECEBIMENTO] Conversa encontrada/criada: ${conversation.id}`);
        
        // 🔓 REABRIR CONVERSA SE ESTIVER OCULTA (cliente respondeu = reabre automaticamente)
        if (conversation.oculta) {
          console.log(`🔓 Reabrindo conversa oculta automaticamente (cliente respondeu): ${conversation.id}`);
          await storage.toggleConversationHidden(conversation.id, userId, false);
        }
        
        await storage.createMessage({
          conversationId: conversation.id,
          sender: "client",
          tipo,
          conteudo,
          arquivo,
          nomeArquivo,
          mimeType,
        });

        console.log(`📥 ✅ RECEBIDO E SALVO DE ${senderPhone}: "${conteudo}"`);

        // 📊 ATUALIZAR CONTADORES DE RESPOSTA EM CAMPAIGN_SENDINGS
        try {
          if (!conversation.clientId) {
            console.warn(`⚠️ conversation.clientId não definido, ignorando campaign update`);
          } else {
            const sendingRecords = await db
              .select()
              .from(campaignSendings)
              .where(eq(campaignSendings.clientId, conversation.clientId))
              .orderBy(desc(campaignSendings.dataSending))
              .limit(1);
            
            console.log(`🔍 Procurando campaign_sendings para clientId=${conversation.clientId}, encontrados: ${sendingRecords.length}`);
            
            if (sendingRecords.length > 0) {
              const sendingRecord = sendingRecords[0];
              const dataPrimeiraResposta = sendingRecord.dataPrimeiraResposta || new Date();
              await db
                .update(campaignSendings)
                .set({
                  totalRespostas: (sendingRecord.totalRespostas || 0) + 1,
                  dataPrimeiraResposta,
                })
                .where(eq(campaignSendings.id, sendingRecord.id));
              console.log(`📊 ✅ Campaign_sendings incrementado: totalRespostas=${(sendingRecord.totalRespostas || 0) + 1}`);
            }
          }
        } catch (err) {
          console.warn(`⚠️ Erro ao incrementar campaign_sendings:`, err);
        }

        // 🤖 IA: Analisar mensagem e criar/mover oportunidade automaticamente
        if (tipo === "texto" && conteudo && conversation.clientId) {
          try {
            const client = await storage.getClientById(conversation.clientId);
            
            // ✅ BUSCAR OPORTUNIDADE ABERTA DO CLIENTE DESTE VENDEDOR (excluindo FECHADO/PERDIDO)
            const openOpp = await storage.getOpenOpportunityForClient(conversation.clientId, userId);
            
            const analysis = await analyzeClientMessage(conteudo, {
              nome: client?.nome,
              etapaAtual: openOpp?.etapa,
            });
            
            console.log(`🔍 [DEBUG ANÁLISE] Mensagem: "${conteudo}"`);
            console.log(`   Sentimento: ${analysis.sentimento}, Intenção: ${analysis.intenção}, Etapa: ${analysis.etapa}`);
            console.log(`   DeveAgir: ${analysis.deveAgir}, Confiança: ${analysis.confianca}`);
            console.log(`   OpenOpp: ${openOpp ? openOpp.etapa : "NENHUMA"}`);

            // ✅ REGRA SIMPLIFICADA:
            // - Se tem oportunidade ABERTA → ATUALIZA essa
            // - Se NÃO tem oportunidade aberta → CRIA nova
            
            if (openOpp) {
              // ✅ TEM NEGÓCIO ABERTO → ATUALIZAR (se etapa válida, diferente e pode agir)
              const etapaValida = analysis.etapa && analysis.etapa !== "" && analysis.etapa !== "AUTOMÁTICA";
              if (etapaValida && openOpp.etapa !== analysis.etapa && analysis.deveAgir) {
                await storage.updateOpportunity(openOpp.id, {
                  etapa: analysis.etapa,
                });
                console.log(`✅ Oportunidade ATUALIZADA de ${openOpp.etapa} para ${analysis.etapa}`);
                // 🔄 RECALCULATE CLIENT STATUS after update
                const newStatus = await storage.recalculateClientStatus(conversation.clientId);
                await storage.updateClient(conversation.clientId, { status: newStatus });
              } else {
                console.log(`ℹ️ Oportunidade mantida em ${openOpp.etapa} (etapaValida=${etapaValida}, deveAgir=${analysis.deveAgir})`);
              }
            } else {
              // ✅ NÃO TEM NEGÓCIO ABERTO → CRIAR NOVO (apenas se IA decidiu agir)
              if (analysis.deveAgir && analysis.etapa && analysis.etapa !== "AUTOMÁTICA" && analysis.etapa !== "") {
                const novaOpp = await storage.createOpportunity({
                  clientId: conversation.clientId,
                  titulo: `${client?.nome} - Novo Negócio`,
                  etapa: analysis.etapa,
                  responsavelId: userId,
                });
                console.log(`🆕 NOVO negócio CRIADO em ${analysis.etapa}`);
                
                // 📝 REGISTRAR CRIAÇÃO NO TIMELINE
                await storage.createInteraction({
                  clientId: conversation.clientId,
                  tipo: "oportunidade_criada",
                  origem: "automation",
                  titulo: `Novo Negócio - ${analysis.etapa}`,
                  texto: `Etapa: ${analysis.etapa} | Motivo: ${analysis.motivo}`,
                  createdBy: userId,
                  meta: { etapa: analysis.etapa, motivo: analysis.motivo, tipo_movimento: "automática" },
                });
                
                // 🔄 RECALCULATE CLIENT STATUS after create
                const newStatus = await storage.recalculateClientStatus(conversation.clientId);
                await storage.updateClient(conversation.clientId, { status: newStatus });
              } else {
                console.log(`ℹ️ Nenhum negócio criado (deveAgir=${analysis.deveAgir}, etapa=${analysis.etapa})`);
              }
            }

            // ✅ ENVIAR MENSAGEM DE INTERESSE AUTOMÁTICA (se resposta positiva)
            console.log(`📊 [VERIFICAÇÃO POSITIVA] Sentimento: ${analysis.sentimento}, Intenção: ${analysis.intenção}`);
            console.log(`   Condição (positivo || aprovacao): ${analysis.sentimento === "positivo" || analysis.intenção === "aprovacao_envio"}`);
            if ((analysis.sentimento === "positivo" || analysis.intenção === "aprovacao_envio") && analysis.etapa !== "AUTOMÁTICA") {
              // ✅ USAR ETAPA ATUAL DA OPORTUNIDADE (não a detectada pela IA)
              // Isso garante que cliente em CONTATO receba msg de CONTATO, mesmo se IA classificar como PROPOSTA
              const etapaParaMensagem = openOpp?.etapa || analysis.etapa;
              console.log(`✅ [ENCONTRADA RESPOSTA POSITIVA] Etapa atual: ${etapaParaMensagem} (IA detectou: ${analysis.etapa})`);
              try {
                // Buscar config de automação para pegar a mensagem apropriada
                const [config] = await db.select().from(automationConfigs).where(eq(automationConfigs.jobType, "ia_resposta_positiva")).limit(1);
                console.log(`📋 [CONFIG AUTOMAÇÃO] Encontrado: ${!!config}, Etapa: ${etapaParaMensagem}`);
                
                let mensagemAutomatica = "";
                if (etapaParaMensagem === "CONTATO" && config?.mensagemContatoPositivo) {
                  mensagemAutomatica = config.mensagemContatoPositivo;
                  console.log(`💬 [MENSAGEM CONTATO] Usando: ${mensagemAutomatica.substring(0, 50)}...`);
                } else if (etapaParaMensagem === "PROPOSTA" && config?.mensagemPropostaPositivo) {
                  mensagemAutomatica = config.mensagemPropostaPositivo;
                  console.log(`💬 [MENSAGEM PROPOSTA] Usando: ${mensagemAutomatica.substring(0, 50)}...`);
                } else {
                  console.log(`❌ [SEM MENSAGEM] Etapa: ${etapaParaMensagem}, Config: ${!!config?.mensagemContatoPositivo} (contato), ${!!config?.mensagemPropostaPositivo} (proposta)`);
                }
                
                if (mensagemAutomatica) {
                  // ⏰ Verificar se NÃO enviou A MESMA MENSAGEM nos últimos 3 horas
                  // (permite enviar mensagens diferentes de etapas diferentes)
                  const treHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000);
                  const ultimaMsgAutomatica = await db
                    .select()
                    .from(messages)
                    .where(and(
                      eq(messages.conversationId, conversation.id),
                      eq(messages.origem, "automation"), // ← Mensagens de automação
                      eq(messages.conteudo, mensagemAutomatica), // ← MESMA MENSAGEM
                      gte(messages.createdAt, treHorasAtras)
                    ))
                    .orderBy(desc(messages.createdAt))
                    .limit(1);
                  
                  console.log(`⏰ [ANTI-SPAM] Última msg igual: ${ultimaMsgAutomatica.length > 0 ? "SIM (bloqueado)" : "NÃO (liberado)"}`);
                  
                  if (ultimaMsgAutomatica.length === 0) {
                    console.log(`🚀 [RESPOSTA POSITIVA] Preparando envio automático...`);
                    
                    // 💬 SALVAR MENSAGEM NO CHAT (com status pendente para tracking)
                    const [savedMessage] = await db.insert(messages).values({
                      conversationId: conversation.id,
                      sender: "user",
                      tipo: "texto",
                      conteudo: mensagemAutomatica,
                      origem: "automation",
                      statusEntrega: "pendente",
                    }).returning();
                    console.log(`💬 [CHAT] Mensagem salva com tracking: ${savedMessage.id}`);
                    
                    // 📡 BROADCAST VIA WEBSOCKET (para aparecer imediatamente no chat)
                    try {
                      const { wsClients } = await import("./routes.js");
                      if (wsClients && wsClients.size > 0) {
                        const wsPayload = JSON.stringify({
                          type: "new_message",
                          conversationId: conversation.id,
                          message: savedMessage,
                        });
                        wsClients.forEach((ws: any) => {
                          if (ws.readyState === 1) {
                            ws.send(wsPayload);
                          }
                        });
                        console.log(`📡 [WS] Broadcast enviado para ${wsClients.size} clientes`);
                      }
                    } catch (wsErr) {
                      console.warn(`⚠️ [WS] Erro ao broadcast (ignorado):`, wsErr);
                    }
                    
                    // 📝 ADICIONAR À TIMELINE
                    await storage.createInteraction({
                      clientId: conversation.clientId,
                      tipo: "nota",
                      origem: "automation",
                      titulo: "Resposta Automática de Interesse",
                      texto: mensagemAutomatica,
                      createdBy: userId,
                      meta: { tipo: "resposta_positiva", etapa: analysis.etapa },
                    });
                    console.log(`📝 [TIMELINE] Interação criada`);
                    
                    // 📱 ENVIAR VIA WHATSAPP COM DELAY RANDOMICO
                    if (client?.celular && isSessionAlive(sessionId)) {
                      // Formatar telefone (adiciona 55 se não tiver)
                      let telefone = client.celular.replace(/\D/g, "");
                      if (!telefone.startsWith("55")) {
                        telefone = "55" + telefone;
                      }
                      
                      // ⏱️ Delay randomico entre 20-40 segundos
                      const delayMs = (Math.random() * 20 + 20) * 1000;
                      console.log(`⏱️ [DELAY] Aguardando ${Math.round(delayMs / 1000)}s antes de enviar para WhatsApp (${telefone})...`);
                      
                      // Salvar referência para atualizar status depois
                      const messageId = savedMessage.id;
                      
                      setTimeout(async () => {
                        try {
                          if (isSessionAlive(sessionId)) {
                            const result = await sendMessage(sessionId, telefone, mensagemAutomatica);
                            if (result.success && result.messageId) {
                              console.log(`✅ [WHATSAPP] Mensagem automática enviada com sucesso para ${telefone} (ID: ${result.messageId})`);
                              // ✅ ATUALIZAR whatsappMessageId e status para tracking de ticks
                              await db.update(messages)
                                .set({ 
                                  whatsappMessageId: result.messageId,
                                  statusEntrega: "enviado"
                                })
                                .where(eq(messages.id, messageId));
                              console.log(`✅ [TRACKING] Status atualizado para "enviado" com ID: ${result.messageId}`);
                            } else {
                              console.warn(`⚠️ [WHATSAPP] Falha ao enviar para ${telefone}`);
                              await db.update(messages)
                                .set({ statusEntrega: "erro" })
                                .where(eq(messages.id, messageId));
                            }
                          } else {
                            console.warn(`⚠️ [WHATSAPP] Sessão não mais ativa ao tentar enviar`);
                            await db.update(messages)
                              .set({ statusEntrega: "erro" })
                              .where(eq(messages.id, messageId));
                          }
                        } catch (err) {
                          console.warn(`⚠️ [WHATSAPP] Erro ao enviar (ignorado):`, err);
                          await db.update(messages)
                            .set({ statusEntrega: "erro" })
                            .where(eq(messages.id, messageId));
                        }
                      }, delayMs);
                    } else {
                      console.warn(`⚠️ [WHATSAPP] Cliente sem celular ou sessão inativa. Mensagem só no chat.`);
                    }
                  } else {
                    console.log(`⏰ [ANTI-SPAM] Mensagem não enviada (já foi enviada nos últimos 3h)`);
                  }
                }
              } catch (err) {
                console.warn(`⚠️ Erro ao enviar mensagem automática (ignorado):`, err);
              }
            }
            
            // Notificar vendedor
            await storage.createNotification({
              tipo: "ia_sentimento",
              titulo: `🤖 IA: ${analysis.sentimento.toUpperCase()}`,
              descricao: `${analysis.motivo}. Sugestão: ${analysis.sugestao}`,
              clientId: conversation.clientId,
              userId,
            });
          } catch (error) {
            console.error(`⚠️ Erro ao processar IA:`, error);
          }
        }
      } catch (error) {
        console.error(`[RECEBIMENTO] Erro ao processar:`, error);
      }
    }
  } catch (error) {
    console.error(`[RECEBIMENTO] Erro geral:`, error);
  }
}

// Processa updates de status de entrega (ticks do WhatsApp)
async function processMessageStatusUpdate(sessionId: string, updates: any) {
  try {
    console.log(`🔔 [STATUS] Recebido ${updates?.length || 0} updates para ${sessionId}`);
    
    for (const update of updates) {
      const messageId = update.key?.id;
      const status = update.update?.status;
      
      console.log(`📋 [STATUS] Update: messageId=${messageId}, status=${status}, full:`, JSON.stringify(update));
      
      if (!messageId) continue;
      
      // Mapeia status do Baileys para nosso sistema
      // status: 0 = erro, 1 = pendente, 2 = enviado (servidor), 3 = entregue, 4 = lido
      let statusEntrega: 'enviado' | 'entregue' | 'lido' | null = null;
      const statusPriority = { enviado: 2, entregue: 3, lido: 4 };
      
      if (status === 3) {
        statusEntrega = 'entregue';
        console.log(`📬 [STATUS] Mensagem ${messageId} ENTREGUE (2 ticks)`);
      } else if (status === 4) {
        statusEntrega = 'lido';
        console.log(`👁️ [STATUS] Mensagem ${messageId} LIDA (2 ticks azuis)`);
      } else if (status === 2) {
        statusEntrega = 'enviado';
        console.log(`📤 [STATUS] Mensagem ${messageId} ENVIADA (1 tick)`);
      }
      
      if (statusEntrega) {
        const now = new Date();
        
        // GUARD: Verificar se já temos um status "melhor" - não permitir regressão
        try {
          const [existingMsg] = await db.select({ statusEntrega: messages.statusEntrega })
            .from(messages)
            .where(eq(messages.whatsappMessageId, messageId))
            .limit(1);
          
          if (existingMsg && existingMsg.statusEntrega && statusPriority[existingMsg.statusEntrega as keyof typeof statusPriority] > statusPriority[statusEntrega as keyof typeof statusPriority]) {
            console.log(`⛔ [STATUS] IGNORANDO regressão: ${existingMsg.statusEntrega} (${statusPriority[existingMsg.statusEntrega as keyof typeof statusPriority]}) → ${statusEntrega} (${statusPriority[statusEntrega as keyof typeof statusPriority]})`);
            continue;
          }
        } catch (err) {
          // Mensagem não existe no chat, seguir normalmente
        }
        
        // 1. Atualiza na tabela messages (chat)
        try {
          await db.update(messages)
            .set({ statusEntrega })
            .where(eq(messages.whatsappMessageId, messageId));
          console.log(`✅ [STATUS] Atualizado chat para ${statusEntrega}: ${messageId}`);
        } catch (err) {
          // Normal para mensagens que não estão no chat
        }
        
        // 2. ✅ NOVO: Atualiza na tabela campaign_sendings (campanhas)
        try {
          const { campaignSendings } = await import('@shared/schema');
          
          // GUARD: Verificar status anterior em campaign_sendings também
          const [existingCampaign] = await db.select({ status: campaignSendings.status })
            .from(campaignSendings)
            .where(eq(campaignSendings.whatsappMessageId, messageId))
            .limit(1);
          
          if (existingCampaign && existingCampaign.status && statusPriority[existingCampaign.status as keyof typeof statusPriority] > statusPriority[statusEntrega as keyof typeof statusPriority]) {
            console.log(`⛔ [STATUS CAMPAIGN] IGNORANDO regressão: ${existingCampaign.status} → ${statusEntrega}`);
            continue;
          }
          
          // Prepara campos para atualização
          const updateData: any = {
            status: statusEntrega,
            statusWhatsapp: status,
            ultimaInteracao: now,
          };
          
          // Campos específicos por status
          if (status === 3) {
            updateData.dataEntrega = now;
            updateData.estadoDerivado = 'entregue';
          } else if (status === 4) {
            updateData.dataVisualizacao = now;
            updateData.estadoDerivado = 'visualizado';
          }
          
          const result = await db.update(campaignSendings)
            .set(updateData)
            .where(eq(campaignSendings.whatsappMessageId, messageId))
            .returning({ id: campaignSendings.id });
          
          if (result.length > 0) {
            console.log(`✅ [STATUS] Atualizado campaign_sendings para ${statusEntrega}: ${messageId}`);
          }
        } catch (err) {
          // Normal para mensagens que não são de campanha
        }
      }
    }
  } catch (error) {
    console.error(`❌ [STATUS] Erro ao processar update:`, error);
  }
}

async function handleIncomingMessages(sessionId: string, sock: any) {
  // Reset listener flag for this socket (important on reconnect)
  sessionListeners.delete(sessionId);
  
  sessionListeners.set(sessionId, true);
  console.log(`\n🎯🎯🎯 LISTENER REGISTRADO E ATIVADO PARA: ${sessionId} 🎯🎯🎯\n`);

  // Listener para novas mensagens recebidas
  sock.ev.on("messages.upsert", (m: any) => processIncomingMessages(sessionId, m));
  
  // Listener para status de entrega (ticks do WhatsApp)
  sock.ev.on("messages.update", (updates: any[]) => processMessageStatusUpdate(sessionId, updates));
  
  console.log(`[LISTENER] Aguardando mensagens e status updates para ${sessionId}...`);
}

export async function initializeWhatsAppSession(sessionId: string, userId?: string): Promise<void> {
  try {
    const authDir = path.join(process.cwd(), "whatsapp_auth", sessionId);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      qrTimeout: 5 * 60_000,
      defaultQueryTimeoutMs: 60_000,
      retryRequestDelayMs: 30_000,
      shouldIgnoreJid: () => false,
      syncFullHistory: false,
    });

    let qrGenerated = false;
    const storedUserId = userId || sessionUsers.get(sessionId);

    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !qrGenerated) {
        qrGenerated = true;
        try {
          const qrString = await QRCode.toDataURL(qr);
          qrCodes.set(sessionId, qrString);
          console.log(`✅ QR Code gerado para sessão: ${sessionId}`);
        } catch (err) {
          console.error("❌ Erro ao gerar QR code image:", err);
        }
      }

      if (connection === "open") {
        console.log("🟢 CONEXÃO ABERTA:", sessionId);
        activeSessions.set(sessionId, sock);
        sessionStatus.set(sessionId, "conectada");
        qrCodes.delete(sessionId);
        reconnectAttempts.delete(sessionId);
        
        // ✅ PERSISTIR STATUS NO BANCO DE DADOS IMEDIATAMENTE
        try {
          const dbSession = await storage.getWhatsappSessionBySessionId(sessionId);
          if (dbSession) {
            await storage.updateWhatsappSession(dbSession.id, { status: "conectada" });
            console.log(`✅ Status persistido no banco: ${sessionId} → conectada`);
          }
        } catch (err) {
          console.error(`⚠️ Erro ao persistir status no banco:`, err);
        }
        
        startKeepAlive(sessionId, sock);
        
        if (storedUserId) {
          setSessionUser(sessionId, storedUserId);
          await handleIncomingMessages(sessionId, sock);
          console.log(`🎯 INICIALIZAÇÃO COMPLETA: ${sessionId}`);
          
          // 📬 PROCESSAR FILA DE MENSAGENS OFFLINE (em background)
          setTimeout(() => {
            processPendingMessages(sessionId, storedUserId).catch(err => {
              console.error(`❌ Erro ao processar fila offline:`, err);
            });
          }, 3000);
          
          // 🔄 REPROCESSAR CAMPANHAS COM ERRO (em background)
          setTimeout(() => {
            retryFailedCampaigns(storedUserId).catch(err => {
              console.error(`❌ Erro ao reprocessar campanhas:`, err);
            });
          }, 5000);
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        sessionStatus.set(sessionId, "desconectada");
        stopKeepAlive(sessionId);
        activeSessions.delete(sessionId);
        sessionListeners.delete(sessionId);
        
        // ✅ PERSISTIR STATUS DESCONECTADA NO BANCO
        try {
          const dbSession = await storage.getWhatsappSessionBySessionId(sessionId);
          if (dbSession) {
            await storage.updateWhatsappSession(dbSession.id, { status: "desconectada" });
            console.log(`⚠️ Status persistido no banco: ${sessionId} → desconectada`);
          }
        } catch (err) {
          console.error(`⚠️ Erro ao persistir status desconectada:`, err);
        }

        if (
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401
        ) {
          console.log(`❌ Sessão encerrada: ${sessionId}`);
        } else {
          const attempts = (reconnectAttempts.get(sessionId) || 0) + 1;
          if (attempts < 5) {
            reconnectAttempts.set(sessionId, attempts);
            console.log(`🔄 Reconectando... (tentativa ${attempts})`);
            setTimeout(() => initializeWhatsAppSession(sessionId, storedUserId), 5000);
          }
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (error) {
    console.error(`❌ Erro ao inicializar sessão ${sessionId}:`, error);
  }
}

export function getQRCode(sessionId: string): string | null {
  return qrCodes.get(sessionId) || null;
}

export function getSessionStatus(sessionId: string): string {
  return sessionStatus.get(sessionId) || "desconectada";
}

export function closeSession(sessionId: string): void {
  const sock = activeSessions.get(sessionId);
  if (sock) {
    sock.end(undefined);
    activeSessions.delete(sessionId);
    sessionStatus.set(sessionId, "desconectada");
    stopKeepAlive(sessionId);
  }
}

export function getAllActiveSessions(): string[] {
  return Array.from(activeSessions.keys());
}

export function isSessionAlive(sessionId: string): boolean {
  return activeSessions.has(sessionId) && sessionStatus.get(sessionId) === "conectada";
}

export function getActiveSession(sessionId: string): any {
  return activeSessions.get(sessionId) || null;
}

// Tipo de retorno para envio de mensagem
export type SendMessageResult = {
  success: boolean;
  messageId?: string;
};

export async function sendMessage(sessionId: string, telefone: string, mensagem: string): Promise<SendMessageResult> {
  try {
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ Sessão ${sessionId} não encontrada para enviar mensagem`);
      return { success: false };
    }

    let jid = telefone.replace(/\D/g, "");
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
    }
    
    // ✅ VERIFICAR SE O NÚMERO EXISTE NO WHATSAPP ANTES DE ENVIAR
    try {
      const [exists] = await sock.onWhatsApp(jid);
      if (!exists || !exists.exists) {
        console.error(`❌ Número ${jid} NÃO existe no WhatsApp!`);
        return { success: false };
      }
      console.log(`✅ Número ${jid} verificado - existe no WhatsApp`);
    } catch (checkErr) {
      console.warn(`⚠️ Não foi possível verificar se ${jid} existe, tentando enviar mesmo assim...`);
    }
    
    jid = jid + "@s.whatsapp.net";

    console.log(`📤 Enviando mensagem para ${jid}...`);
    
    const result = await sock.sendMessage(jid, { text: mensagem });
    
    // ✅ VALIDAÇÃO RIGOROSA: Verificar se realmente foi enviado
    if (!result || !result.key || !result.key.id) {
      console.error(`❌ Falha ao enviar para ${jid}: Resposta inválida ou sem ID. Retorno:`, result);
      return { success: false };
    }
    
    console.log(`✅ Mensagem enviada com sucesso para ${jid}. Message ID: ${result.key.id}`);
    return { success: true, messageId: result.key.id };
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem para ${telefone}:`, error);
    return { success: false };
  }
}

export async function deleteMessageForEveryone(sessionId: string, telefone: string, whatsappMessageId: string): Promise<boolean> {
  try {
    console.log(`🗑️ [DELETE] Iniciando exclusão: sessionId=${sessionId}, telefone=${telefone}, msgId=${whatsappMessageId}`);
    
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ [DELETE] Sessão ${sessionId} não encontrada para deletar mensagem`);
      return false;
    }

    let jid = telefone.replace(/\D/g, "");
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
    }
    jid = jid + "@s.whatsapp.net";

    console.log(`🗑️ [DELETE] Deletando mensagem ${whatsappMessageId} para ${jid}...`);
    
    // Formato correto: passar o objeto key completo
    const deleteKey = {
      remoteJid: jid,
      fromMe: true,
      id: whatsappMessageId
    };
    
    console.log(`🗑️ [DELETE] Key de exclusão:`, JSON.stringify(deleteKey));
    
    await sock.sendMessage(jid, { delete: deleteKey });
    
    console.log(`✅ [DELETE] Mensagem ${whatsappMessageId} deletada para todos no WhatsApp!`);
    return true;
  } catch (error) {
    console.error(`❌ [DELETE] Erro ao deletar mensagem ${whatsappMessageId}:`, error);
    return false;
  }
}

export async function sendImage(sessionId: string, telefone: string, imageBase64: string, caption?: string): Promise<SendMessageResult> {
  try {
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ Sessão ${sessionId} não encontrada para enviar imagem`);
      return { success: false };
    }

    let jid = telefone.replace(/\D/g, "");
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
    }
    
    // ✅ VERIFICAR SE O NÚMERO EXISTE NO WHATSAPP ANTES DE ENVIAR
    try {
      const [exists] = await sock.onWhatsApp(jid);
      if (!exists || !exists.exists) {
        console.error(`❌ Número ${jid} NÃO existe no WhatsApp!`);
        return { success: false };
      }
    } catch (checkErr) {
      console.warn(`⚠️ Não foi possível verificar se ${jid} existe, tentando enviar mesmo assim...`);
    }
    
    jid = jid + "@s.whatsapp.net";

    console.log(`📤 Enviando imagem para ${jid}...`);
    
    const buffer = Buffer.from(imageBase64.split(",")[1] || imageBase64, "base64");
    const result = await sock.sendMessage(jid, { 
      image: buffer,
      caption: caption || ""
    });
    
    // ✅ VALIDAÇÃO RIGOROSA
    if (!result || !result.key || !result.key.id) {
      console.error(`❌ Falha ao enviar imagem para ${jid}: Resposta inválida. Retorno:`, result);
      return { success: false };
    }
    
    console.log(`✅ Imagem enviada com sucesso para ${jid}. Message ID: ${result.key.id}`);
    return { success: true, messageId: result.key.id };
  } catch (error) {
    console.error(`❌ Erro ao enviar imagem para ${telefone}:`, error);
    return { success: false };
  }
}

async function convertWebMToM4A(webmBase64: string): Promise<Buffer | null> {
  try {
    const tempDir = path.join(process.cwd(), "temp_audio");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const timestamp = Date.now();
    const webmPath = path.join(tempDir, `audio_${timestamp}.webm`);
    const m4aPath = path.join(tempDir, `audio_${timestamp}.m4a`);
    
    // Write WebM to temp file
    const base64Data = webmBase64.split(",")[1] || webmBase64;
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(webmPath, buffer);
    console.log(`📝 WebM temporário salvo (${buffer.length} bytes)`);
    
    // Convert WebM to M4A/AAC (WhatsApp mobile format)
    try {
      await execAsync(`ffmpeg -i "${webmPath}" -c:a aac -b:a 128k -ac 1 "${m4aPath}" -y 2>/dev/null`, { timeout: 30000 });
      console.log(`✅ Conversão WebM → M4A/AAC concluída`);
    } catch (err) {
      console.warn(`⚠️ ffmpeg warning (ignorando):`, (err as any).message?.substring(0, 100));
    }
    
    if (fs.existsSync(m4aPath)) {
      const m4aBuffer = fs.readFileSync(m4aPath);
      console.log(`📊 M4A gerado (${m4aBuffer.length} bytes)`);
      
      // Cleanup
      try { fs.unlinkSync(webmPath); } catch (e) {}
      try { fs.unlinkSync(m4aPath); } catch (e) {}
      
      return m4aBuffer;
    } else {
      console.warn(`⚠️ M4A não gerado, usando WebM original`);
      try { fs.unlinkSync(webmPath); } catch (e) {}
      return buffer;
    }
  } catch (error) {
    console.error(`❌ Erro na conversão:`, error);
    return null;
  }
}

export async function sendAudio(sessionId: string, telefone: string, audioBase64: string): Promise<SendMessageResult> {
  try {
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ Sessão ${sessionId} não encontrada para enviar áudio`);
      return { success: false };
    }

    let jid = telefone.replace(/\D/g, "");
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
    }
    
    // ✅ VERIFICAR SE O NÚMERO EXISTE NO WHATSAPP ANTES DE ENVIAR
    try {
      const [exists] = await sock.onWhatsApp(jid);
      if (!exists || !exists.exists) {
        console.error(`❌ Número ${jid} NÃO existe no WhatsApp!`);
        return { success: false };
      }
    } catch (checkErr) {
      console.warn(`⚠️ Não foi possível verificar se ${jid} existe, tentando enviar mesmo assim...`);
    }
    
    jid = jid + "@s.whatsapp.net";

    console.log(`📤 Enviando áudio para ${jid}...`);
    
    // Convert WebM to M4A/AAC (WhatsApp mobile format)
    let audioBuffer = await convertWebMToM4A(audioBase64);
    if (!audioBuffer) {
      const base64Data = audioBase64.split(",")[1] || audioBase64;
      audioBuffer = Buffer.from(base64Data, "base64");
    }
    
    console.log(`📊 Áudio final: ${audioBuffer.length} bytes`);
    
    const result = await sock.sendMessage(jid, { 
      audio: audioBuffer,
      mimetype: "audio/aac",
      ptt: true
    });
    
    // ✅ VALIDAÇÃO RIGOROSA
    if (!result || !result.key || !result.key.id) {
      console.error(`❌ Falha ao enviar áudio para ${jid}: Resposta inválida. Retorno:`, result);
      return { success: false };
    }
    
    console.log(`✅ Áudio enviado com sucesso para ${jid}. Message ID: ${result.key.id}`);
    return { success: true, messageId: result.key.id };
  } catch (error) {
    console.error(`❌ Erro ao enviar áudio para ${telefone}:`, error);
    return { success: false };
  }
}

export async function sendDocument(sessionId: string, telefone: string, docBase64: string, filename: string): Promise<SendMessageResult> {
  try {
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ Sessão ${sessionId} não encontrada para enviar documento`);
      return { success: false };
    }

    let jid = telefone.replace(/\D/g, "");
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
    }
    
    // ✅ VERIFICAR SE O NÚMERO EXISTE NO WHATSAPP ANTES DE ENVIAR
    try {
      const [exists] = await sock.onWhatsApp(jid);
      if (!exists || !exists.exists) {
        console.error(`❌ Número ${jid} NÃO existe no WhatsApp!`);
        return { success: false };
      }
    } catch (checkErr) {
      console.warn(`⚠️ Não foi possível verificar se ${jid} existe, tentando enviar mesmo assim...`);
    }
    
    jid = jid + "@s.whatsapp.net";

    console.log(`📤 Enviando documento para ${jid}...`);
    
    const buffer = Buffer.from(docBase64.split(",")[1] || docBase64, "base64");
    const mimeType = getMimeTypeFromFileName(filename);
    
    const result = await sock.sendMessage(jid, { 
      document: buffer,
      mimetype: mimeType,
      fileName: filename
    });
    
    // ✅ VALIDAÇÃO RIGOROSA
    if (!result || !result.key || !result.key.id) {
      console.error(`❌ Falha ao enviar documento para ${jid}: Resposta inválida. Retorno:`, result);
      return { success: false };
    }
    
    console.log(`✅ Documento enviado com sucesso para ${jid} (${mimeType}). Message ID: ${result.key.id}`);
    return { success: true, messageId: result.key.id };
  } catch (error) {
    console.error(`❌ Erro ao enviar documento para ${telefone}:`, error);
    return { success: false };
  }
}

// ✅ Lock para evitar múltiplas execuções de campanha
const campaignExecutionLock = new Set<string>();

export async function executeCampaign(campaign: any, db: any, clients: any[]): Promise<void> {
  try {
    const { campaigns, campaignSendings } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    // ✅ PROTEÇÃO: Evitar múltiplas execuções da mesma campanha
    if (campaignExecutionLock.has(campaign.id)) {
      console.warn(`⚠️ [PROTEÇÃO] Campanha ${campaign.id} já está em execução. Pulando...`);
      return;
    }
    campaignExecutionLock.add(campaign.id);
    
    console.log(`🚀 INICIANDO EXECUÇÃO DE CAMPANHA: ${campaign.nome} (${campaign.id})`);
    
    // Muda status para "enviando"
    await db.update(campaigns)
      .set({ status: 'enviando' })
      .where(eq(campaigns.id, campaign.id));

    const clientIds = campaign.filtros?.clientIds || [];
    if (clientIds.length === 0) {
      console.warn(`⚠️ Nenhum cliente selecionado para campanha ${campaign.id}`);
      campaignExecutionLock.delete(campaign.id);
      return;
    }

    // ✅ Pega conteúdo: broadcasts têm conteúdo direto em filtros, templates vêm da tabela
    let conteudoBase = campaign.filtros?.conteudo;
    
    if (!conteudoBase) {
      // É um template campaign - procura template
      const template = await storage.getTemplateById(campaign.templateId);
      if (!template) {
        console.error(`❌ Template ${campaign.templateId} não encontrado`);
        return;
      }
      conteudoBase = template.conteudo;
    }
    
    console.log(`📝 Usando conteúdo: ${conteudoBase?.substring(0, 50)}...`);

    // Pega os clientes a enviar
    let recipientClients = clients.filter((c: any) => clientIds.includes(c.id));
    
    // ✅ RETRY INTELIGENTE: Buscar quais clientes JÁ RECEBERAM mensagem dessa campanha
    const alreadySent = await db
      .select({ clientId: campaignSendings.clientId })
      .from(campaignSendings)
      .where(
        and(
          eq(campaignSendings.campaignId, campaign.id),
          eq(campaignSendings.status, 'enviado')
        )
      );
    
    const alreadySentIds = new Set(alreadySent.map((s: { clientId: string }) => s.clientId));
    const totalOriginal = recipientClients.length;
    const jaEnviados = alreadySentIds.size;
    
    // Filtra para enviar APENAS os que ainda NÃO receberam
    recipientClients = recipientClients.filter((c: any) => !alreadySentIds.has(c.id));
    
    console.log(`📊 [RETRY] Total na lista: ${totalOriginal} | Já enviados: ${jaEnviados} | Faltam: ${recipientClients.length}`);
    
    if (recipientClients.length === 0) {
      console.log(`✅ [RETRY] Todos os clientes já receberam esta campanha - nada a fazer!`);
      await db.update(campaigns)
        .set({ status: 'concluida', totalEnviados: jaEnviados, totalErros: 0 })
        .where(eq(campaigns.id, campaign.id));
      campaignExecutionLock.delete(campaign.id);
      return;
    }
    
    let enviados = 0;
    let erros = 0;

    // Usa valores da campanha ou padrão
    const tempoDelay = campaign.tempoFixoSegundos || 21; // segundos
    const tempoRandomMin = campaign.tempoAleatorioMin || 10; // segundos
    const tempoRandomMax = campaign.tempoAleatorioMax || 60; // segundos

    // ✅ INDIVIDUAL: Busca a sessão WhatsApp do usuário que criou a campanha
    const userSession = await storage.getConnectedSessionByUserId(campaign.createdBy);
    const sessionId = userSession?.sessionId || null;
    
    if (!sessionId) {
      console.error(`❌ Usuário ${campaign.createdBy} não tem sessão WhatsApp conectada!`);
      await db.update(campaigns)
        .set({ status: 'erro', totalErros: recipientClients.length })
        .where(eq(campaigns.id, campaign.id));
      return;
    }
    
    console.log(`📱 Usando sessão ${sessionId} do usuário ${campaign.createdBy}`);
    
    // Envia mensagens via WhatsApp
    for (let index = 0; index < recipientClients.length; index++) {
      const client = recipientClients[index];
      try {
        // Substitui variáveis no template (suporta {variavel} e {{variavel}})
        let conteudo = conteudoBase;
        
        // Com duas chaves {{variavel}}
        conteudo = conteudo.replace(/{{razao_social}}/g, client.nome || '');
        conteudo = conteudo.replace(/{{empresa}}/g, client.nome || '');
        conteudo = conteudo.replace(/{{nome}}/g, client.nome || '');
        conteudo = conteudo.replace(/{{telefone}}/g, client.celular || '');
        conteudo = conteudo.replace(/{{celular}}/g, client.celular || '');
        conteudo = conteudo.replace(/{{email}}/g, client.email || '');
        conteudo = conteudo.replace(/{{CELULAR_PRINCIPAL}}/g, client.celular || '');
        conteudo = conteudo.replace(/{{NOME_CONTATO}}/g, client.nomeGestor || '');
        
        // Com uma chave {variavel} - igual a campanhas WhatsApp
        conteudo = conteudo.replace(/{razao_social}/g, client.nome || '');
        conteudo = conteudo.replace(/{empresa}/g, client.nome || '');
        conteudo = conteudo.replace(/{nome}/g, client.nome || '');
        conteudo = conteudo.replace(/{telefone}/g, client.celular || '');
        conteudo = conteudo.replace(/{celular}/g, client.celular || '');
        conteudo = conteudo.replace(/{email}/g, client.email || '');
        conteudo = conteudo.replace(/{CELULAR_PRINCIPAL}/g, client.celular || '');
        conteudo = conteudo.replace(/{NOME_CONTATO}/g, client.nomeGestor || '');

        console.log(`📤 [${index + 1}/${recipientClients.length}] Enviando para ${client.nome} (${client.celular})...`);
        
        // Tenta enviar via WhatsApp se houver sessão ativa
        let mensagemEnviada = false;
        let whatsappMessageId: string | undefined;
        if (sessionId && isSessionAlive(sessionId)) {
          const result = await sendMessage(sessionId, client.celular || client.telefone2, conteudo);
          mensagemEnviada = result.success;
          whatsappMessageId = result.messageId; // ✅ Captura o messageId para rastreamento
        }
        
        // ✅ CONTAGEM IMEDIATA: Incrementa enviados/erros LOGO APÓS o envio
        if (mensagemEnviada) {
          enviados++;
          console.log(`✅ [${index + 1}/${recipientClients.length}] Enviado para ${client.nome} [msgId: ${whatsappMessageId}]`);
        } else {
          erros++;
          console.log(`❌ [${index + 1}/${recipientClients.length}] Falha ao enviar para ${client.nome}`);
        }
        
        // ✅ ATUALIZAR EM TEMPO REAL: A cada mensagem processada
        try {
          await db.update(campaigns)
            .set({ 
              totalEnviados: enviados,
              totalErros: erros,
            })
            .where(eq(campaigns.id, campaign.id));
        } catch (err) {
          console.warn(`⚠️ Erro ao atualizar progresso:`, err);
        }
        
        // Update client status to "Enviado" if message was sent successfully
        if (mensagemEnviada) {
          try {
            await storage.updateClient(client.id, { status: "Enviado" });
          } catch (err) {
            console.warn("Erro ao atualizar status do cliente:", err);
          }
        }
        
        // Registra interação (não falha se der erro)
        // ✅ CORRIGIDO: Verificar origemDisparo nos filtros (não "origem")
        const origemDisparo = (campaign.filtros as any)?.origemDisparo === 'envio_imediato' ? 'envio_imediato' : 'agendamento';
        try {
          await storage.createInteraction({
            clientId: client.id,
            tipo: 'whatsapp_enviado',
            origem: 'system',
            titulo: `Campanha ${origemDisparo === 'envio_imediato' ? 'imediata' : 'agendada'}: ${campaign.nome}`,
            texto: conteudo,
            meta: { 
              campaignId: campaign.id, 
              templateId: campaign.templateId,
              enviado: mensagemEnviada,
              origem_disparo: origemDisparo,
              status: mensagemEnviada ? 'enviado' : 'erro'
            },
            createdBy: campaign.createdBy,
          });
        } catch (err) {
          console.warn(`⚠️ Erro ao registrar interação:`, err);
        }

        // Registra em campaign_sendings com whatsappMessageId para rastreamento
        try {
          // ✅ Verificar que campanha ainda existe
          const campaignExists = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id)).limit(1);
          if (campaignExists.length === 0) {
            console.warn(`⚠️ Campanha ${campaign.id} foi deletada. Abortando...`);
            break; // Sair do loop
          }
          
          await storage.recordCampaignSending({
            userId: campaign.createdBy,
            campaignId: campaign.id,
            campaignName: campaign.nome,
            clientId: client.id,
            status: mensagemEnviada ? 'enviado' : 'erro',
            erroMensagem: mensagemEnviada ? undefined : 'Falha ao enviar mensagem',
            origemDisparo: origemDisparo,
            mensagemUsada: conteudo,
            modeloId: campaign.templateId || null,
            whatsappMessageId: whatsappMessageId,
            statusWhatsapp: mensagemEnviada ? 2 : 0,
            estadoDerivado: mensagemEnviada ? 'enviado' : 'erro',
          });
        } catch (err) {
          console.warn(`⚠️ Erro ao registrar envio em campaign_sendings:`, err);
          if (err instanceof Error && err.message.includes('foreign key')) {
            console.warn(`⚠️ Erro de chave estrangeira - campanha pode ter sido deletada`);
            break; // Sair do loop para evitar mais erros
          }
        }

        // Delay entre mensagens: 21s + 10-60s aleatório (total 31-81s)
        if (index < recipientClients.length - 1) {
          const rangeExtra = (tempoRandomMax - tempoRandomMin) * 1000; // 50000ms
          const randomExtra = Math.random() * rangeExtra + (tempoRandomMin * 1000); // 10000-60000ms
          const totalDelay = (tempoDelay * 1000) + randomExtra; // 31000-81000ms
          console.log(`⏳ Aguardando ${(totalDelay / 1000).toFixed(1)}s antes do próximo envio...`);
          await new Promise((resolve) => setTimeout(resolve, totalDelay));
        }
      } catch (error) {
        console.error(`❌ Erro ao enviar para ${client.nome}:`, error);
        erros++;

        // ✅ ATUALIZAR ERROS EM TEMPO REAL: A cada 5 erros
        if (erros % 5 === 0) {
          try {
            await db.update(campaigns)
              .set({ 
                totalEnviados: jaEnviados + enviados,
                totalErros: erros,
              })
              .where(eq(campaigns.id, campaign.id));
            console.log(`📊 [PROGRESSO] ${jaEnviados + enviados} enviados total (${enviados} nesta rodada) / ${erros} erros (${index + 1}/${recipientClients.length})`);
          } catch (err) {
            console.warn(`⚠️ Erro ao atualizar progresso:`, err);
          }
        }

        // Mesmo com erro, aplica o delay
        if (index < recipientClients.length - 1) {
          const rangeExtra = (tempoRandomMax - tempoRandomMin) * 1000;
          const randomExtra = Math.random() * rangeExtra + (tempoRandomMin * 1000);
          const totalDelay = (tempoDelay * 1000) + randomExtra;
          await new Promise((resolve) => setTimeout(resolve, totalDelay));
        }
      }
    }

    // Atualiza status para "concluida" com estatísticas
    // ✅ Preservar totalRecipients original (importante para taxa de sucesso)
    // ✅ SOMA ENVIADOS: já enviados anteriormente + enviados nesta rodada
    const totalEnviadosFinal = jaEnviados + enviados;
    await db.update(campaigns)
      .set({ 
        status: 'concluida',
        totalEnviados: totalEnviadosFinal,
        totalErros: erros,
        totalRecipients: campaign.totalRecipients || totalOriginal,
      })
      .where(eq(campaigns.id, campaign.id));

    console.log(`✅ CAMPANHA CONCLUÍDA: ${campaign.nome} | Total enviados: ${totalEnviadosFinal} (${jaEnviados} anteriores + ${enviados} agora) | Erros nesta rodada: ${erros}`);
  } catch (error) {
    console.error(`❌ Erro ao executar campanha:`, error);
  } finally {
    // ✅ Remover lock ao finalizar (sucesso ou erro)
    campaignExecutionLock.delete(campaign.id);
    console.log(`🔓 Lock removido para campanha ${campaign.id}`);
  }
}
