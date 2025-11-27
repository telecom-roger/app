import QRCode from "qrcode";
import { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers, downloadMediaMessage } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import * as storage from "./storage";
import { db } from "./db";
import { or, ilike } from "drizzle-orm";
import { clients as clientsTable } from "@shared/schema";

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

      // Extract phone number from WhatsApp identifiers
      // Priority: remoteJid > participant > remoteJidAlt (remoteJid is most reliable)
      let senderPhone = "";
      
      if (msg.key.remoteJid) {
        // Individual messages - remoteJid contains the actual phone
        senderPhone = msg.key.remoteJid;
      } else if (msg.key.participant) {
        // Group messages have participant
        senderPhone = msg.key.participant;
      } else if (msg.key.remoteJidAlt) {
        // Fallback: remoteJidAlt may contain alternate ID
        senderPhone = msg.key.remoteJidAlt;
      }
      
      senderPhone = senderPhone
        .replace("@s.whatsapp.net", "")
        .replace("@c.us", "")
        .replace("@iid", "")
        .replace("@lid", "")
        .trim();
      
      if (!senderPhone) {
        console.log(`[RECEBIMENTO] ⚠️ Telefone vazio após limpeza`);
        continue;
      }
      
      console.log(`[RECEBIMENTO] 📱 Telefone extraído: "${senderPhone}"`);

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
          console.warn(`[RECEBIMENTO] ⚠️ Conversa não encontrada, procurando cliente...`);
          
          // Normalize phone for lookup
          let normalizado = senderPhone.replace(/\D/g, "");
          if (normalizado.startsWith("55")) {
            normalizado = normalizado.substring(2);
          }
          
          const [client] = await db
            .select()
            .from(clientsTable)
            .where(or(
              ilike(clientsTable.CELULAR_PRINCIPAL, `%${normalizado}%`),
              ilike(clientsTable.telefone, `%${normalizado}%`)
            ))
            .limit(1);
          
          if (client) {
            console.log(`✅ Cliente encontrado: ${client.id} (${client.nome})`);
            conversation = await storage.createOrGetConversation(client.id, userId);
            console.log(`✨ Conversa criada automaticamente: ${conversation.id}`);
          } else {
            console.warn(`[RECEBIMENTO] ⚠️ Cliente não encontrado, criando novo...`);
            
            // Auto-create new client for this phone number
            const novoCliente = await storage.createClient({
              nome: `Novo contato ${senderPhone}`,
              telefone: senderPhone,
              CELULAR_PRINCIPAL: senderPhone,
              cpfCnpj: "",
              status: "Lead",
              carteira: "Dominio",
              score: 0,
            });
            
            console.log(`✅ Novo cliente criado: ${novoCliente.id}`);
            conversation = await storage.createOrGetConversation(novoCliente.id, userId);
            console.log(`✨ Conversa criada para novo contato: ${conversation.id}`);
          }
        }

        console.log(`[RECEBIMENTO] Conversa encontrada/criada: ${conversation.id}`);
        
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
      } catch (error) {
        console.error(`[RECEBIMENTO] Erro ao processar:`, error);
      }
    }
  } catch (error) {
    console.error(`[RECEBIMENTO] Erro geral:`, error);
  }
}

async function handleIncomingMessages(sessionId: string, sock: any) {
  // Reset listener flag for this socket (important on reconnect)
  sessionListeners.delete(sessionId);
  
  sessionListeners.set(sessionId, true);
  console.log(`\n🎯🎯🎯 LISTENER REGISTRADO E ATIVADO PARA: ${sessionId} 🎯🎯🎯\n`);

  sock.ev.on("messages.upsert", (m: any) => processIncomingMessages(sessionId, m));
  sock.ev.on("messages.update", (m: any) => processIncomingMessages(sessionId, m));
  
  console.log(`[LISTENER] Aguardando mensagens para ${sessionId}...`);
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

export async function sendMessage(sessionId: string, telefone: string, mensagem: string): Promise<boolean> {
  try {
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ Sessão ${sessionId} não encontrada para enviar mensagem`);
      return false;
    }

    let jid = telefone.replace(/\D/g, "");
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
    }
    jid = jid + "@s.whatsapp.net";

    console.log(`📤 Enviando mensagem para ${jid}...`);
    
    await sock.sendMessage(jid, { text: mensagem });
    
    console.log(`✅ Mensagem enviada com sucesso para ${jid}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem para ${telefone}:`, error);
    return false;
  }
}

export async function sendImage(sessionId: string, telefone: string, imageBase64: string, caption?: string): Promise<boolean> {
  try {
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ Sessão ${sessionId} não encontrada para enviar imagem`);
      return false;
    }

    let jid = telefone.replace(/\D/g, "");
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
    }
    jid = jid + "@s.whatsapp.net";

    console.log(`📤 Enviando imagem para ${jid}...`);
    
    const buffer = Buffer.from(imageBase64.split(",")[1] || imageBase64, "base64");
    await sock.sendMessage(jid, { 
      image: buffer,
      caption: caption || ""
    });
    
    console.log(`✅ Imagem enviada com sucesso para ${jid}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar imagem para ${telefone}:`, error);
    return false;
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

export async function sendAudio(sessionId: string, telefone: string, audioBase64: string): Promise<boolean> {
  try {
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ Sessão ${sessionId} não encontrada para enviar áudio`);
      return false;
    }

    let jid = telefone.replace(/\D/g, "");
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
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
    
    console.log(`✅ Áudio enviado com sucesso para ${jid}. Message ID:`, result.key?.id);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar áudio para ${telefone}:`, error);
    return false;
  }
}

export async function sendDocument(sessionId: string, telefone: string, docBase64: string, filename: string): Promise<boolean> {
  try {
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ Sessão ${sessionId} não encontrada para enviar documento`);
      return false;
    }

    let jid = telefone.replace(/\D/g, "");
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
    }
    jid = jid + "@s.whatsapp.net";

    console.log(`📤 Enviando documento para ${jid}...`);
    
    const buffer = Buffer.from(docBase64.split(",")[1] || docBase64, "base64");
    const mimeType = getMimeTypeFromFileName(filename);
    
    await sock.sendMessage(jid, { 
      document: buffer,
      mimetype: mimeType,
      fileName: filename
    });
    
    console.log(`✅ Documento enviado com sucesso para ${jid} (${mimeType})`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar documento para ${telefone}:`, error);
    return false;
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

    const template = await storage.getTemplateById(campaign.templateId);
    if (!template) {
      console.error(`❌ Template ${campaign.templateId} não encontrado`);
      return;
    }

    const clientIds = campaign.filtros?.clientIds || [];
    if (clientIds.length === 0) {
      console.warn(`⚠️ Nenhum cliente selecionado para campanha ${campaign.id}`);
      return;
    }

    // Pega os clientes a enviar
    const recipientClients = clients.filter((c: any) => clientIds.includes(c.id));
    let enviados = 0;
    let erros = 0;

    // Padrão de delay: 21 segundos + 10-60 segundos aleatório (31-81 segundos total)
    const tempoDelay = 21; // segundos
    const tempoRandomMin = 10; // segundos
    const tempoRandomMax = 60; // segundos

    // Pega a primeira sessão ativa para enviar mensagens
    const activeSessions = getAllActiveSessions();
    const sessionId = activeSessions.length > 0 ? activeSessions[0] : null;
    
    // Envia mensagens via WhatsApp
    for (let index = 0; index < recipientClients.length; index++) {
      const client = recipientClients[index];
      try {
        // Substitui variáveis no template (suporta {variavel} e {{variavel}})
        let conteudo = template.conteudo;
        
        // Com duas chaves {{variavel}}
        conteudo = conteudo.replace(/{{razao_social}}/g, client.razaoSocial || '');
        conteudo = conteudo.replace(/{{empresa}}/g, client.razaoSocial || '');
        conteudo = conteudo.replace(/{{telefone}}/g, client.telefone || '');
        conteudo = conteudo.replace(/{{email}}/g, client.email || '');
        conteudo = conteudo.replace(/{{CELULAR_PRINCIPAL}}/g, client.CELULAR_PRINCIPAL || '');
        conteudo = conteudo.replace(/{{NOME_CONTATO}}/g, client.NOME_CONTATO || '');
        
        // Com uma chave {variavel} - igual a campanhas WhatsApp
        conteudo = conteudo.replace(/{razao_social}/g, client.razaoSocial || '');
        conteudo = conteudo.replace(/{empresa}/g, client.razaoSocial || '');
        conteudo = conteudo.replace(/{telefone}/g, client.telefone || '');
        conteudo = conteudo.replace(/{email}/g, client.email || '');
        conteudo = conteudo.replace(/{CELULAR_PRINCIPAL}/g, client.CELULAR_PRINCIPAL || '');
        conteudo = conteudo.replace(/{NOME_CONTATO}/g, client.NOME_CONTATO || '');

        console.log(`📤 [${index + 1}/${recipientClients.length}] Enviando para ${client.razaoSocial} (${client.telefone})...`);
        
        // Tenta enviar via WhatsApp se houver sessão ativa
        let mensagemEnviada = false;
        if (sessionId && isSessionAlive(sessionId)) {
          mensagemEnviada = await sendMessage(sessionId, client.CELULAR_PRINCIPAL || client.telefone, conteudo);
        }
        
        // Registra interação
        await storage.createInteraction({
          clientId: client.id,
          tipo: 'whatsapp_enviado',
          origem: 'system',
          titulo: `Campanha agendada: ${campaign.nome}`,
          texto: conteudo,
          meta: { campaignId: campaign.id, templateId: template.id, enviado: mensagemEnviada },
          createdBy: campaign.createdBy,
        });

        enviados++;
        console.log(`✅ Enviado para ${client.razaoSocial}`);

        // Delay entre mensagens: 21s + 10-60s aleatório (total 31-81s)
        if (index < recipientClients.length - 1) {
          const rangeExtra = (tempoRandomMax - tempoRandomMin) * 1000; // 50000ms
          const randomExtra = Math.random() * rangeExtra + (tempoRandomMin * 1000); // 10000-60000ms
          const totalDelay = (tempoDelay * 1000) + randomExtra; // 31000-81000ms
          console.log(`⏳ Aguardando ${(totalDelay / 1000).toFixed(1)}s antes do próximo envio...`);
          await new Promise((resolve) => setTimeout(resolve, totalDelay));
        }
      } catch (error) {
        console.error(`❌ Erro ao enviar para ${client.razaoSocial}:`, error);
        erros++;

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
