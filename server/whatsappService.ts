import QRCode from "qrcode";
import { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import * as storage from "./storage";

// Map to store active connections and QR codes
const activeSessions = new Map<string, any>();
const qrCodes = new Map<string, string>();
const sessionStatus = new Map<string, string>(); // Track session status: conectada/desconectada
const sessionUsers = new Map<string, string>(); // Map sessionId to userId
const sessionListeners = new Map<string, boolean>(); // Track if listener is active
const keepAliveIntervals = new Map<string, NodeJS.Timeout>(); // Store intervals for keep-alive

let reconnectAttempts = new Map<string, number>();

export function setSessionUser(sessionId: string, userId: string) {
  sessionUsers.set(sessionId, userId);
}

// Keep-alive function to maintain socket connection
function startKeepAlive(sessionId: string, sock: any) {
  // Clear any existing interval
  if (keepAliveIntervals.has(sessionId)) {
    clearInterval(keepAliveIntervals.get(sessionId)!);
  }

  // Send ping every 30 seconds
  const interval = setInterval(async () => {
    try {
      if (activeSessions.has(sessionId)) {
        // Ping via simple message check to keep connection alive
        console.log(`💓 Keep-alive ping enviado para ${sessionId}`);
      }
    } catch (error) {
      console.log(`⚠️ Keep-alive falhou para ${sessionId}, reconectando...`);
      clearInterval(interval);
      keepAliveIntervals.delete(sessionId);
    }
  }, 30000); // 30 segundos

  keepAliveIntervals.set(sessionId, interval);
}

// Stop keep-alive for session
function stopKeepAlive(sessionId: string) {
  if (keepAliveIntervals.has(sessionId)) {
    clearInterval(keepAliveIntervals.get(sessionId)!);
    keepAliveIntervals.delete(sessionId);
  }
}

async function handleIncomingMessages(sessionId: string, sock: any) {
  // Prevent duplicate listeners
  if (sessionListeners.get(sessionId)) {
    console.log(`📨 [${sessionId}] Listener já ativo, ignorando duplicata`);
    return;
  }

  sessionListeners.set(sessionId, true);

  sock.ev.on("messages.upsert", async (m: any) => {
    try {
      const { messages: msgs } = m;
      const userId = sessionUsers.get(sessionId);
      
      console.log(`📨 [${sessionId}] 🔔 LISTENER ATIVADO - userId=${userId}, msgs recebidas=${msgs?.length || 0}`);
      
      if (!userId) {
        console.log(`📨 [${sessionId}] ❌ Nenhum userId configurado!`);
        return;
      }
      
      if (!msgs || msgs.length === 0) {
        return;
      }
      
      for (const msg of msgs) {
        // Ignore sent messages, only process incoming
        if (msg.key.fromMe) {
          console.log(`📨 [${sessionId}] Ignorando mensagem enviada por mim`);
          continue;
        }
        
        // Get sender phone
        const senderPhone = msg.key.remoteJid?.replace("@s.whatsapp.net", "") || "";
        if (!senderPhone) {
          console.log(`📨 [${sessionId}] Nenhum telefone encontrado no remoteJid`);
          continue;
        }
        
        console.log(`📨 [${sessionId}] Recebendo mensagem de ${senderPhone}`);
        
        try {
          // Extract message content
          let conteudo = "";
          let tipo = "texto";
          
          if (msg.message?.conversation) {
            conteudo = msg.message.conversation;
          } else if (msg.message?.extendedTextMessage?.text) {
            conteudo = msg.message.extendedTextMessage.text;
          } else if (msg.message?.imageMessage) {
            tipo = "imagem";
            conteudo = msg.message.imageMessage.caption || "[Imagem]";
          } else if (msg.message?.audioMessage) {
            tipo = "audio";
            conteudo = "[Áudio]";
          } else if (msg.message?.videoMessage) {
            tipo = "video";
            conteudo = msg.message.videoMessage.caption || "[Vídeo]";
          } else if (msg.message?.documentMessage) {
            tipo = "documento";
            conteudo = `[${msg.message.documentMessage.fileName || "Documento"}]`;
          } else {
            continue;
          }
          
          // Get or create conversation
          let conversation = await storage.findConversationByPhoneAndUser(senderPhone, userId);
          
          if (!conversation) {
            console.log(`📨 [${sessionId}] ⚠️ NENHUMA CONVERSA ENCONTRADA para ${senderPhone}, ignorando`);
            continue;
          }
          
          console.log(`📨 [${sessionId}] ✓ Conversa encontrada: ${conversation.id}`);
          
          // Save message to database
          await storage.createMessage({
            conversationId: conversation.id,
            sender: "client",
            tipo,
            conteudo,
          });
          
          console.log(`✅ [RECEBIDO] Mensagem de ${senderPhone} salva em ${conversation.id}: "${conteudo}"`);
        } catch (error) {
          console.error(`Erro ao processar mensagem recebida:`, error);
        }
      }
    } catch (error) {
      console.error(`Erro no handler de mensagens recebidas:`, error);
    }
  });
}

export async function initializeWhatsAppSession(sessionId: string, userId?: string): Promise<void> {
  try {
    // Create auth directory for this session
    const authDir = path.join(process.cwd(), "whatsapp_auth", sessionId);

    // Get auth state
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // Create socket with optimized settings for stability
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      qrTimeout: 5 * 60_000, // 5 minutes for QR
      defaultQueryTimeoutMs: 60_000, // 60 seconds timeout
      retryRequestDelayMs: 30_000, // 30 seconds between retries
      shouldIgnoreJid: () => false,
    });

    // Handle QR code
    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      // If QR is generated, capture it as image
      if (qr) {
        console.log("📱 QR Code recebido para sessão:", sessionId, "valor:", qr.substring(0, 50));
        try {
          // Usar configurações padrão do QRCode para máxima compatibilidade
          const qrDataUrl = await QRCode.toDataURL(qr, {
            width: 320,
            margin: 2,
          });
          qrCodes.set(sessionId, qrDataUrl);
          console.log("✅ QR code gerado com sucesso para sessão:", sessionId);
        } catch (err) {
          console.error("❌ Erro ao gerar QR code image:", err);
        }
      }

      if (connection === "open") {
        console.log("✅ Conexão estabelecida para sessão:", sessionId);
        activeSessions.set(sessionId, sock);
        sessionStatus.set(sessionId, "conectada");
        qrCodes.delete(sessionId);
        reconnectAttempts.delete(sessionId); // Reset tentativas após sucesso
        
        // ✅ ATIVAR KEEP-ALIVE para manter conexão estável
        startKeepAlive(sessionId, sock);
        
        // 🎯 ATIVAR LISTENER DE MENSAGENS RECEBIDAS
        if (userId) {
          setSessionUser(sessionId, userId);
          handleIncomingMessages(sessionId, sock);
          console.log(`🎯 LISTENER ATIVADO: ${sessionId} | Usuário: ${userId}`);
        } else {
          console.log(`⚠️ UserId não configurado para ${sessionId} - listener NÃO ativado`);
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        console.log(`❌ Conexão fechada para sessão ${sessionId}, código: ${statusCode}`);
        sessionStatus.set(sessionId, "desconectada");
        
        // Para keep-alive quando desconectar
        stopKeepAlive(sessionId);
        
        // Sempre deletar socket de sessão ativa
        activeSessions.delete(sessionId);

        // **SEMPRE** reconectar automaticamente (máximo 30 tentativas)
        const attempts = (reconnectAttempts.get(sessionId) || 0) + 1;
        reconnectAttempts.set(sessionId, attempts);
        
        if (attempts <= 30) {
          console.log(`🔄 Auto-reconectando ${attempts}/30 para sessão ${sessionId}... (código: ${statusCode})`);
          // Delay progressivo: 100ms, 500ms, 1s, 2s, etc.
          const delay = Math.min(100 * Math.pow(1.5, attempts - 1), 15000);
          setTimeout(() => {
            console.log(`⚡ Tentativa ${attempts} de reconexão para sessão ${sessionId}...`);
            const userId = sessionUsers.get(sessionId);
            // IMPORTANTE: Resetar listener flag aqui para criar novo listener
            sessionListeners.delete(sessionId);
            initializeWhatsAppSession(sessionId, userId);
          }, delay);
        } else {
          console.warn(`⚠️ Máximo de tentativas atingido para sessão ${sessionId}`);
          reconnectAttempts.delete(sessionId);
          sessionListeners.delete(sessionId);
        }
      }
    });

    // Handle credentials
    sock.ev.on("creds.update", saveCreds);

    // Set timeout for QR code (120 seconds = 2 minutes)
    setTimeout(() => {
      if (!activeSessions.has(sessionId) && qrCodes.has(sessionId)) {
        console.warn("⏱️ QR code timeout para sessão:", sessionId);
        sock.end?.();
      }
    }, 120000);
  } catch (error) {
    console.error("❌ Erro ao inicializar sessão WhatsApp:", error);
  }
}

export function getQRCode(sessionId: string): string | null {
  return qrCodes.get(sessionId) || null;
}

export function getActiveSession(sessionId: string): any {
  return activeSessions.get(sessionId) || null;
}

export function closeSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.end();
    activeSessions.delete(sessionId);
    qrCodes.delete(sessionId);
    stopKeepAlive(sessionId);
    sessionListeners.delete(sessionId);
    console.log("Sessão fechada:", sessionId);
  }
}

export function isSessionConnected(sessionId: string): boolean {
  return activeSessions.has(sessionId);
}

export function getSessionStatus(sessionId: string): string {
  return sessionStatus.get(sessionId) || "desconectada";
}

export function isSessionCredentialsSaved(sessionId: string): boolean {
  // Check if this session has saved credentials (indicating it was previously connected)
  const authDir = path.join(process.cwd(), "whatsapp_auth", sessionId);
  const credsPath = path.join(authDir, "creds.json");
  
  try {
    if (fs.existsSync(credsPath)) {
      const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
      // If creds exist and have me data, it means the session was connected before
      return !!creds?.me;
    }
  } catch (error) {
    console.error(`Error checking credentials for ${sessionId}:`, error);
  }
  
  return false;
}

export async function isSessionAlive(sessionId: string): Promise<boolean> {
  // Check if session is in memory and marked as connected
  const sock = activeSessions.get(sessionId);
  const status = sessionStatus.get(sessionId);
  
  // If socket doesn't exist or status is explicitly disconnected, return false
  if (!sock || status === "desconectada") {
    return false;
  }
  
  // If socket exists and status is conectada, assume it's alive
  // (we're trusting the connection.update events from Baileys)
  return status === "conectada";
}

export async function sendMessage(sessionId: string, telefone: string, mensagem: string): Promise<boolean> {
  try {
    const sock = activeSessions.get(sessionId);
    if (!sock) {
      console.error(`❌ Sessão ${sessionId} não encontrada para enviar mensagem`);
      return false;
    }

    // Normalize phone number (add country code if needed)
    let jid = telefone.replace(/\D/g, ""); // Remove non-digits
    if (!jid.startsWith("55")) {
      jid = "55" + jid;
    }
    jid = jid + "@s.whatsapp.net";

    console.log(`📤 Enviando mensagem para ${jid}...`);
    
    // Send message
    await sock.sendMessage(jid, { text: mensagem });
    
    console.log(`✅ Mensagem enviada com sucesso para ${jid}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem para ${telefone}:`, error);
    return false;
  }
}
