import QRCode from "qrcode";
import { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";

// Map to store active connections and QR codes
const activeSessions = new Map<string, any>();
const qrCodes = new Map<string, string>();

export async function initializeWhatsAppSession(sessionId: string): Promise<string | null> {
  return new Promise(async (resolve, reject) => {
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
      });

      // Handle QR code
      sock.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        // If QR is generated, capture it as image
        if (qr) {
          console.log("📱 QR Code recebido (valor) para sessão:", sessionId);
          try {
            // Use o próprio QR do Baileys - é um string que pode ser renderizado
            const qrDataUrl = await QRCode.toDataURL(qr, {
              errorCorrectionLevel: "L", // Usar L para compatibilidade máxima
              type: "image/png",
              width: 320,
              margin: 1,
              color: { dark: "#000000", light: "#FFFFFF" }, // Cores padrão para melhor leitura
            });
            qrCodes.set(sessionId, qrDataUrl);
            console.log("✅ QR code Baileys convertido para image para sessão:", sessionId, "tamanho:", qr.length);
          } catch (err) {
            console.error("❌ Erro ao gerar QR code image:", err);
            reject(new Error("Falha ao gerar QR code"));
          }
        }

        if (connection === "open") {
          console.log("✅ Conexão estabelecida para sessão:", sessionId);
          activeSessions.set(sessionId, sock);
          qrCodes.delete(sessionId);
          resolve(null); // Conexão bem-sucedida
        }

        if (connection === "close") {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          console.log(`Conexão fechada para sessão ${sessionId}, reconectar: ${shouldReconnect}`);

          if (shouldReconnect) {
            // Try to reconnect
            console.log("Tentando reconectar...");
          } else {
            console.log("Sessão finalizada pelo usuário");
          }
        }
      });

      // Handle credentials
      sock.ev.on("creds.update", saveCreds);

      // Set timeout for QR code
      setTimeout(() => {
        if (!activeSessions.has(sessionId) && qrCodes.has(sessionId)) {
          console.warn("⏱️ QR code timeout para sessão:", sessionId);
          sock?.end();
          resolve(qrCodes.get(sessionId) || null);
        }
      }, 30000); // 30 seconds timeout
    } catch (error) {
      console.error("❌ Erro ao inicializar sessão WhatsApp:", error);
      reject(error);
    }
  });
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
