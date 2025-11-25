import QRCode from "qrcode";
import { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";

// Map to store active connections and QR codes
const activeSessions = new Map<string, any>();
const qrCodes = new Map<string, string>();
const sessionStatus = new Map<string, string>(); // Track session status: conectada/desconectada

let reconnectAttempts = new Map<string, number>();

export async function initializeWhatsAppSession(sessionId: string): Promise<void> {
  try {
    // Create auth directory for this session
    const authDir = path.join(process.cwd(), "whatsapp_auth", sessionId);

    // Get auth state
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // Create socket
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      qrTimeout: 5 * 60_000, // 5 minutes
      defaultQueryTimeoutMs: undefined,
      // Adicionar retry automático
      retryRequestDelayMs: 10_000,
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
      }

      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        console.log(`❌ Conexão fechada para sessão ${sessionId}, código: ${statusCode}, reconectar: ${shouldReconnect}`);
        sessionStatus.set(sessionId, "desconectada");

        if (shouldReconnect) {
          const attempts = (reconnectAttempts.get(sessionId) || 0) + 1;
          reconnectAttempts.set(sessionId, attempts);
          
          if (attempts <= 3) {
            console.log(`🔄 Tentativa de reconexão ${attempts}/3 para sessão ${sessionId}...`);
            // Reconectar após delay progressivo
            setTimeout(() => {
              console.log(`⚡ Reiniciando conexão para sessão ${sessionId}...`);
              initializeWhatsAppSession(sessionId);
            }, 3000 * attempts);
          } else {
            console.warn(`⚠️ Máximo de tentativas atingido para sessão ${sessionId}`);
            reconnectAttempts.delete(sessionId);
          }
        } else {
          console.log("Sessão finalizada pelo usuário");
          reconnectAttempts.delete(sessionId);
        }
        
        activeSessions.delete(sessionId);
      }
    });

    // Handle credentials
    sock.ev.on("creds.update", saveCreds);

    // Set timeout for QR code (120 seconds = 2 minutes)
    setTimeout(() => {
      if (!activeSessions.has(sessionId) && qrCodes.has(sessionId)) {
        console.warn("⏱️ QR code timeout para sessão:", sessionId);
        sock?.end();
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
  // Check if the Baileys socket is actually alive
  const sock = activeSessions.get(sessionId);
  
  if (!sock) {
    return false; // Socket doesn't exist in memory
  }
  
  try {
    // Check if socket still has a connection property (lightweight check)
    // If the socket exists and hasn't been closed, it should have a ws connection
    if (!sock.ws) {
      console.warn(`⚠️ Socket ${sessionId} não tem ws connection - marcando como desconectada`);
      sessionStatus.set(sessionId, "desconectada");
      activeSessions.delete(sessionId);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn(`⚠️ Sessão ${sessionId} erro ao verificar alive:`, (error as any)?.message);
    sessionStatus.set(sessionId, "desconectada");
    activeSessions.delete(sessionId);
    return false;
  }
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
