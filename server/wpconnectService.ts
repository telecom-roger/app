import * as WPPConnectModule from "@wppconnect-team/wppconnect";
import path from "path";
import * as storage from "./storage";

const WPPConnect = (WPPConnectModule as any).default || WPPConnectModule;

const activeSessions = new Map<string, any>();
const qrCodes = new Map<string, string>();
const sessionStatus = new Map<string, string>();
const sessionUsers = new Map<string, string>();
const sessionListeners = new Map<string, boolean>();

export function setSessionUser(sessionId: string, userId: string) {
  sessionUsers.set(sessionId, userId);
}

async function processIncomingMessage(sessionId: string, message: any) {
  try {
    if (!message.text || message.isGroupMsg) return;
    if (message.fromMe) return;

    const userId = sessionUsers.get(sessionId);
    if (!userId) {
      console.log(`[RECEBIMENTO] userId não encontrado para ${sessionId}`);
      return;
    }

    const senderPhone = message.from.replace("@c.us", "");
    if (!senderPhone) return;

    console.log(`📥 RECEBIDO DE ${senderPhone}: "${message.text}"`);

    try {
      const conversation = await storage.findConversationByPhoneAndUser(senderPhone, userId);
      if (!conversation) return;

      await storage.createMessage({
        conversationId: conversation.id,
        sender: "client",
        tipo: "texto",
        conteudo: message.text,
      });

      console.log(`📥 ✅ SALVO: "${message.text}"`);
    } catch (error) {
      console.error(`[RECEBIMENTO] Erro:`, error);
    }
  } catch (error) {
    console.error(`[RECEBIMENTO] Erro geral:`, error);
  }
}

export async function initializeWhatsAppSession(sessionId: string, userId?: string): Promise<void> {
  try {
    const storedUserId = userId || sessionUsers.get(sessionId);
    
    console.log(`🔄 Inicializando WPConnect para: ${sessionId}`);

    const client = await WPPConnect.create({
      session: sessionId,
      folderNameToken: "./whatsapp_sessions",
      disableWelcome: true,
      headless: true,
      devtools: false,
      useChrome: true,
      autoClose: 60000,
    });

    activeSessions.set(sessionId, client);
    sessionStatus.set(sessionId, "conectada");
    console.log(`🟢 CONECTADO: ${sessionId}`);

    if (storedUserId) {
      setSessionUser(sessionId, storedUserId);
      
      // Registrar listener de mensagens
      if (!sessionListeners.get(sessionId)) {
        sessionListeners.set(sessionId, true);
        console.log(`🎯🎯🎯 LISTENER ATIVADO PARA: ${sessionId} 🎯🎯🎯`);
        
        client.onMessage(async (message: any) => {
          await processIncomingMessage(sessionId, message);
        });
      }
    }

    // QR Code - WPConnect retorna automáticamente
    client.onQrCode((qrCode: string) => {
      try {
        const dataUrl = `data:image/png;base64,${qrCode}`;
        qrCodes.set(sessionId, dataUrl);
        console.log(`✅ QR Code gerado para: ${sessionId}`);
      } catch (err) {
        console.error("❌ Erro ao processar QR:", err);
      }
    });

    // Desconexão
    client.onClose(async () => {
      console.log(`❌ Sessão desconectada: ${sessionId}`);
      sessionStatus.set(sessionId, "desconectada");
      activeSessions.delete(sessionId);
      sessionListeners.delete(sessionId);
    });

  } catch (error) {
    console.error(`❌ Erro ao inicializar WPConnect ${sessionId}:`, error);
    sessionStatus.set(sessionId, "erro");
  }
}

export function getQRCode(sessionId: string): string | null {
  return qrCodes.get(sessionId) || null;
}

export function getSessionStatus(sessionId: string): string {
  return sessionStatus.get(sessionId) || "desconectada";
}

export function closeSession(sessionId: string): void {
  const client = activeSessions.get(sessionId);
  if (client) {
    client.close();
    activeSessions.delete(sessionId);
    sessionStatus.set(sessionId, "desconectada");
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
    const client = activeSessions.get(sessionId);
    if (!client) {
      console.error(`❌ Sessão ${sessionId} não encontrada`);
      return false;
    }

    let number = telefone.replace(/\D/g, "");
    if (!number.startsWith("55")) {
      number = "55" + number;
    }
    const jid = number + "@c.us";

    console.log(`📤 Enviando para ${jid}...`);
    
    await client.sendText(jid, mensagem);
    
    console.log(`✅ ENVIADO para ${jid}: "${mensagem}"`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar para ${telefone}:`, error);
    return false;
  }
}
