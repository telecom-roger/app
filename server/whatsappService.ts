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
import { clients as clientsTable, automationConfigs, messages } from "@shared/schema";
import { analyzeClientMessage } from "./aiService";

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
        
        let conversation = await storage.findConversationByPhoneAndUser(senderPhone, userId);
        
        if (!conversation) {
          console.warn(`[RECEBIMENTO] ⚠️ Conversa não encontrada via findConversationByPhoneAndUser`);
          console.log(`🔍 Buscando cliente com: "${senderPhone}"`);
          
          // Search for existing client (senderPhone is already normalized without 55)
          const [client] = await db
            .select()
            .from(clientsTable)
            .where(or(
              eq(clientsTable.celular, senderPhone),
              eq(clientsTable.telefone2, senderPhone),
              ilike(clientsTable.celular, `%${senderPhone}%`),
              ilike(clientsTable.telefone2, `%${senderPhone}%`)
            ))
            .limit(1);
          
          if (client) {
            console.log(`✅ Cliente encontrado: ${client.id} (${client.nome})`);
            conversation = await storage.createOrGetConversation(client.id, userId);
            console.log(`✨ Conversa criada automaticamente: ${conversation.id}`);
          } else {
            console.warn(`[RECEBIMENTO] ⚠️ Cliente não encontrado, criando novo...`);
            
            // Auto-create new client - store WITHOUT 55 prefix (senderPhone already normalized)
            const novoCliente = await storage.createClient({
              nome: `NOVO CONTATO -> ${senderPhone}`,
              celular: senderPhone,
              status: "Lead",
              carteira: "CONTATO",
              createdBy: userId, // Atrelar ao usuário que recebeu a mensagem
            });
            
            console.log(`✅ Novo cliente criado: ${novoCliente.id} (${senderPhone})`);
            
            // Create timeline entry for new client created by system
            await storage.createInteraction({
              clientId: novoCliente.id,
              tipo: "nota",
              origem: "system",
              titulo: "Contato criado por sistema",
              texto: `Contato criado automaticamente ao receber primeira mensagem do WhatsApp em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
              createdBy: userId,
            });
            
            console.log(`📍 Timeline entry criada para novo cliente`);
            
            conversation = await storage.createOrGetConversation(novoCliente.id, userId);
            console.log(`✨ Conversa criada para novo contato: ${conversation.id}`);
          }
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
    for (const update of updates) {
      const messageId = update.key?.id;
      if (!messageId) continue;
      
      // Mapeia status do Baileys para nosso sistema
      // status: 0 = erro, 1 = pendente, 2 = enviado (servidor), 3 = entregue, 4 = lido
      let statusEntrega: 'enviado' | 'entregue' | 'lido' | null = null;
      
      if (update.update?.status === 3) {
        statusEntrega = 'entregue';
        console.log(`📬 [STATUS] Mensagem ${messageId} ENTREGUE (2 ticks)`);
      } else if (update.update?.status === 4) {
        statusEntrega = 'lido';
        console.log(`👁️ [STATUS] Mensagem ${messageId} LIDA (2 ticks azuis)`);
      }
      
      if (statusEntrega) {
        try {
          // Atualiza o status no banco de dados
          const result = await db.update(messages)
            .set({ statusEntrega })
            .where(eq(messages.whatsappMessageId, messageId));
          
          console.log(`✅ [STATUS] Atualizado para ${statusEntrega}: ${messageId}`);
        } catch (err) {
          // Pode não encontrar se for mensagem recebida (não enviada por nós)
          // Isso é esperado e normal
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
        
        startKeepAlive(sessionId, sock);
        
        if (storedUserId) {
          setSessionUser(sessionId, storedUserId);
          await handleIncomingMessages(sessionId, sock);
          console.log(`🎯 INICIALIZAÇÃO COMPLETA: ${sessionId}`);
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        sessionStatus.set(sessionId, "desconectada");
        stopKeepAlive(sessionId);
        activeSessions.delete(sessionId);
        sessionListeners.delete(sessionId);

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

export async function executeCampaign(campaign: any, db: any, clients: any[]): Promise<void> {
  try {
    const { campaigns } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    console.log(`🚀 INICIANDO EXECUÇÃO DE CAMPANHA: ${campaign.nome} (${campaign.id})`);
    
    // Muda status para "enviando"
    await db.update(campaigns)
      .set({ status: 'enviando' })
      .where(eq(campaigns.id, campaign.id));

    const clientIds = campaign.filtros?.clientIds || [];
    if (clientIds.length === 0) {
      console.warn(`⚠️ Nenhum cliente selecionado para campanha ${campaign.id}`);
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
    const recipientClients = clients.filter((c: any) => clientIds.includes(c.id));
    let enviados = 0;
    let erros = 0;

    // Usa valores da campanha ou padrão
    const tempoDelay = campaign.tempoFixoSegundos || 21; // segundos
    const tempoRandomMin = campaign.tempoAleatorioMin || 10; // segundos
    const tempoRandomMax = campaign.tempoAleatorioMax || 60; // segundos

    // Pega a primeira sessão ativa para enviar mensagens
    const activeSessions = getAllActiveSessions();
    const sessionId = activeSessions.length > 0 ? activeSessions[0] : null;
    
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
        if (sessionId && isSessionAlive(sessionId)) {
          const result = await sendMessage(sessionId, client.celular || client.telefone2, conteudo);
          mensagemEnviada = result.success;
        }
        
        // ✅ CONTAGEM IMEDIATA: Incrementa enviados/erros LOGO APÓS o envio
        if (mensagemEnviada) {
          enviados++;
          console.log(`✅ [${index + 1}/${recipientClients.length}] Enviado para ${client.nome}`);
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
        try {
          await storage.createInteraction({
            clientId: client.id,
            tipo: 'whatsapp_enviado',
            origem: 'system',
            titulo: `Campanha agendada: ${campaign.nome}`,
            texto: conteudo,
            meta: { 
              campaignId: campaign.id, 
              templateId: campaign.templateId,
              enviado: mensagemEnviada,
              origem_disparo: 'agendamento',
              status: mensagemEnviada ? 'enviado' : 'erro'
            },
            createdBy: campaign.createdBy,
          });
        } catch (err) {
          console.warn(`⚠️ Erro ao registrar interação:`, err);
        }

        // Registra em campaign_sendings
        try {
          await storage.recordCampaignSending({
            userId: campaign.createdBy,
            campaignId: campaign.id,
            campaignName: campaign.nome,
            clientId: client.id,
            status: mensagemEnviada ? 'enviado' : 'erro',
            erroMensagem: mensagemEnviada ? undefined : 'Falha ao enviar mensagem',
            origemDisparo: 'agendamento',
            mensagemUsada: conteudo,
            modeloId: campaign.templateId || null,
          });
        } catch (err) {
          console.warn(`⚠️ Erro ao registrar envio em campaign_sendings:`, err);
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
                totalEnviados: enviados,
                totalErros: erros,
              })
              .where(eq(campaigns.id, campaign.id));
            console.log(`📊 [PROGRESSO] ${enviados} enviados / ${erros} erros (${index + 1}/${recipientClients.length})`);
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
    await db.update(campaigns)
      .set({ 
        status: 'concluida',
        totalEnviados: enviados,
        totalErros: erros,
      })
      .where(eq(campaigns.id, campaign.id));

    console.log(`✅ CAMPANHA CONCLUÍDA: ${campaign.nome} | Enviados: ${enviados} | Erros: ${erros}`);
  } catch (error) {
    console.error(`❌ Erro ao executar campanha:`, error);
  }
}
