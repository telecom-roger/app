import QRCode from "qrcode";
import { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import * as storage from "./storage";

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
    if (!msgs || msgs.length === 0) return;

    const userId = sessionUsers.get(sessionId);
    if (!userId) {
      console.log(`[RECEBIMENTO] userId não encontrado para ${sessionId}`);
      return;
    }

    console.log(`[RECEBIMENTO] Processando ${msgs.length} mensagens para ${sessionId}`);

    for (const msg of msgs) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid?.includes("@g.us")) continue;

      const senderPhone = msg.key.remoteJid?.replace("@s.whatsapp.net", "") || "";
      if (!senderPhone) continue;

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

      try {
        const conversation = await storage.findConversationByPhoneAndUser(senderPhone, userId);
        if (!conversation) continue;

        await storage.createMessage({
          conversationId: conversation.id,
          sender: "client",
          tipo,
          conteudo,
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
  if (sessionListeners.get(sessionId)) {
    return;
  }

  sessionListeners.set(sessionId, true);
  console.log(`\n🎯🎯🎯 LISTENER REGISTRADO E ATIVADO PARA: ${sessionId} 🎯🎯🎯\n`);

  sock.ev.on("messages.upsert", (m: any) => processIncomingMessages(sessionId, m));
  sock.ev.on("messages.update", (m: any) => processIncomingMessages(sessionId, m));
  
  // Força o processamento de mensagens antigas quando conecta
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
          statusCode === DisconnectReason.userInitiatedDisconnect
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
