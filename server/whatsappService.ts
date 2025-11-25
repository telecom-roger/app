import QRCode from "qrcode";
import { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";

// Map to store active connections and QR codes
const activeSessions = new Map<string, any>();
const qrCodes = new Map<string, string>();

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
        qrCodes.delete(sessionId);
        reconnectAttempts.delete(sessionId); // Reset tentativas após sucesso
      }

      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        console.log(`❌ Conexão fechada para sessão ${sessionId}, código: ${statusCode}, reconectar: ${shouldReconnect}`);

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
