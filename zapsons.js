import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-terminal";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BAILEYS_AUTH_DIR = path.join(__dirname, ".baileys_auth_zapsons");
const RESTART_SIGNAL_PATH = path.join(
  __dirname,
  "data",
  "restart-pending.json",
);

// Chat ID do grupo onde vai responder
const WPP_CHAT_ID = "120363132077830172@g.us";

let wppClient = null;
let wppReady = false;
let reinicioEmAndamento = false;

function extractMessageText(message) {
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    ""
  );
}

async function buscarMotivoNao() {
  try {
    const response = await fetch("https://naas.daniilmira.com/no");
    const data = await response.json();
    return data.reason || "Não tenho um motivo específico agora.";
  } catch (err) {
    console.error("Erro ao buscar motivo:", err.message);
    return "Não consegui obter o motivo agora.";
  }
}

async function traduzirParaPortugues(texto) {
  try {
    const encoded = encodeURIComponent(texto);
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|pt-BR`,
    );
    const data = await response.json();
    if (data.responseStatus === 200) {
      return data.responseData.translatedText;
    }
    return texto; // Retorna o original se não conseguir traduzir
  } catch (err) {
    console.error("Erro ao traduzir:", err.message);
    return texto;
  }
}

async function loadRestartSignal() {
  try {
    const raw = await readFile(RESTART_SIGNAL_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function processarSinalReinicio() {
  if (reinicioEmAndamento) return;

  const signal = await loadRestartSignal();
  if (!signal) return;

  reinicioEmAndamento = true;

  try {
    await unlink(RESTART_SIGNAL_PATH).catch(() => null);
    console.log("🔁 Reinício solicitado pelo updater. Encerrando processo...");
    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    reinicioEmAndamento = false;
    console.error("Erro ao processar sinal de reinício:", err.message);
  }
}

async function initWpp() {
  const { state, saveCreds } = await useMultiFileAuthState(BAILEYS_AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  wppClient = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    browser: ["Zapsons Bot", "Chrome", "1.0.0"],
  });

  wppClient.ev.on("creds.update", saveCreds);

  wppClient.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log("\n📱 Escaneie o QR code com seu WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      wppReady = true;
      console.log("\n✅ WhatsApp conectado! Aguardando mensagens...\n");
    }

    if (connection === "close") {
      wppReady = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("⚠️ WPP desconectado, reconectando...");

      if (shouldReconnect) {
        setTimeout(initWpp, 5000);
      } else {
        console.log("Sessão desconectada (logout). Escaneie o QR novamente.");
      }
    }
  });

  // Listener para mensagens recebidas
  wppClient.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const chatId = msg.key.remoteJid ?? "";
      const remetente = msg.key.participant || chatId;
      const body = extractMessageText(msg.message);
      const bodyLower = body.toLowerCase();

      // Ignora mensagens com "status"
      if (bodyLower.includes("status")) {
        console.log("⏭️  Mensagem contém 'status', ignorando...\n");
        continue;
      }

      // Log das infos do grupo/chat
      console.log("\n📨 Mensagem recebida:");
      console.log(`   De: ${chatId}`);
      console.log(`   Remetente: ${remetente}`);
      console.log(`   Chat ID: ${chatId}`);
      console.log(`   É grupo: ${chatId.endsWith("@g.us")}`);
      console.log(`   Conteúdo: ${body}`);
      console.log(`   Horário: ${new Date().toLocaleString("pt-BR")}`);

      // Responde apenas se for o grupo configurado
      if (chatId === WPP_CHAT_ID) {
        try {
          if (!wppReady) {
            console.log("⏳ Cliente ainda não está pronto para responder.");
            continue;
          }

          console.log("🤖 Buscando motivo...");
          const motivoOriginal = await buscarMotivoNao();
          console.log(`📝 Motivo original: ${motivoOriginal}`);

          const motivoTraduzido = await traduzirParaPortugues(motivoOriginal);
          console.log(`🇧🇷 Motivo traduzido: ${motivoTraduzido}`);

          const resposta = `Não posso responder.\nMotivo: ${motivoTraduzido}`;

          await wppClient.sendMessage(
            chatId,
            { text: resposta },
            { quoted: msg },
          );
          console.log("✅ Resposta enviada\n");
        } catch (err) {
          console.error("❌ Erro ao responder:", err.message, "\n");
        }
      } else {
        console.log("⏭️  Ignoring message (group not configured)\n");
      }
    }
  });
}

async function main() {
  await initWpp();
  setInterval(processarSinalReinicio, 15 * 1000); // 15s
}

main().catch((error) => {
  console.error("Erro:", error.message);
  process.exit(1);
});
