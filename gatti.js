import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import * as cheerio from "cheerio";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-terminal";

const TARGET_URL = "https://concursos.objetivas.com.br/informacoes/2568/";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.join(
  __dirname,
  "data",
  "gatti-publicacoes.snapshot.json",
);
const RESTART_SIGNAL_PATH = path.join(
  __dirname,
  "data",
  "restart-pending.json",
);
const BAILEYS_AUTH_DIR = path.join(__dirname, ".baileys_auth");

// CONFIG WPP: Chat ID do grupo para notificações
const WPP_CHAT_ID = "120363132077830172@g.us"; // Grupo: Eu você e o bot

let wppClient = null;
let wppReady = false;
let ultimasNotificacoes = new Map(); // Rastreia notificações enviadas
let aguardandoResposta = false; // Flag para pausar reenvios
let reinicioEmAndamento = false;
let ultimaConferencia = null;
let ultimoDocumento = null;

function extractMessageText(message) {
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    ""
  );
}

function formatarDataHora(isoDate) {
  if (!isoDate) return "ainda não realizada";
  return new Date(isoDate).toLocaleString("pt-BR");
}

function montarMensagemStatus() {
  if (!ultimaConferencia) {
    return "📊 Status do monitoramento:\nAinda não houve conferência concluída.";
  }

  let msg = "📊 *Status do monitoramento*\n\n";
  msg += `• Última conferência: ${formatarDataHora(ultimaConferencia)}\n`;

  if (ultimoDocumento) {
    msg += `• Último documento: ${ultimoDocumento.title}\n`;
    msg += `• Data do documento: ${ultimoDocumento.date || "não informada"}\n`;
    msg += `• Link: ${ultimoDocumento.href}\n`;
  } else {
    msg += "• Último documento: não encontrado\n";
  }

  return msg;
}

async function responderStatusWpp(chatId) {
  if (!wppClient || !wppReady) {
    console.log("WPP não pronto para responder status.");
    return;
  }

  try {
    await wppClient.sendMessage(chatId, { text: montarMensagemStatus() });
    console.log("📊 Status enviado no grupo.");
  } catch (err) {
    console.error("Erro ao enviar status:", err.message);
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
  if (!wppClient || !wppReady || reinicioEmAndamento) return;

  const signal = await loadRestartSignal();
  if (!signal) return;

  reinicioEmAndamento = true;
  const motivo = signal.reason || "Atualização detectada";

  console.log("🔔 Sinal de reinício detectado! Avisando grupo...");

  try {
    await wppClient.sendMessage(WPP_CHAT_ID, {
      text: `⚠️ Atualização detectada (${motivo}). Vou ficar fora do ar por instantes para reiniciar.`,
    });
    console.log("✅ Primeira mensagem enviada no grupo.");

    await wppClient.sendMessage(WPP_CHAT_ID, {
      text: "🔁 Reiniciando agora...",
    });
    console.log("✅ Segunda mensagem enviada no grupo.");

    await unlink(RESTART_SIGNAL_PATH).catch(() => null);

    console.log("🔁 Reinício solicitado pelo updater. Encerrando processo...");
    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    reinicioEmAndamento = false;
    console.error("❌ Erro ao processar sinal de reinício:", err.message);
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
    browser: ["Gatti Bot", "Chrome", "1.0.0"],
  });

  wppClient.ev.on("creds.update", saveCreds);

  wppClient.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log("Escaneie o QR code:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      wppReady = true;
      console.log("✅ WhatsApp conectado!");
    }

    if (connection === "close") {
      wppReady = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("WPP desconectado, reconectando...");

      if (shouldReconnect) {
        setTimeout(initWpp, 3000);
      } else {
        console.log("Sessão desconectada (logout). Escaneie o QR novamente.");
      }
    }
  });

  // Listener para detectar respostas no grupo
  wppClient.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      if (msg.key.remoteJid !== WPP_CHAT_ID) continue;

      const body = extractMessageText(msg.message);
      const bodyLower = body.toLowerCase();

      if (bodyLower.includes("status")) {
        await responderStatusWpp(msg.key.remoteJid);
      }

      console.log(`📨 Resposta recebida: "${body}"`);
      aguardandoResposta = true;
      ultimasNotificacoes.clear();
      console.log("⏸️  Pausando reenvios de notificação (alguém respondeu)\n");
    }
  });
}

async function obterMembrosGrupo() {
  if (!wppClient || !wppReady) return [];

  try {
    const groupMetadata = await wppClient.groupMetadata(WPP_CHAT_ID);
    return groupMetadata.participants.map((p) => p.id);
  } catch (err) {
    console.error("Erro ao obter membros do grupo:", err.message);
    return [];
  }
}

async function enviarNotificacaoWpp(diff) {
  if (!wppClient || !wppReady) return console.log("WPP não pronto ainda");

  // Se alguém respondeu, pausa temporariamente os reenvios
  if (aguardandoResposta) {
    console.log(
      "⏸️  Aguardando resposta... notificação não será reenviada por enquanto",
    );
    return;
  }

  // Cria chave única para essa notificação
  const notifKey = JSON.stringify(diff);

  // Se já enviou essa notificação há menos de 2min, não reenvia
  if (ultimasNotificacoes.has(notifKey)) {
    const ultimaVez = ultimasNotificacoes.get(notifKey);
    const agora = Date.now();
    if (agora - ultimaVez < 2 * 60 * 1000) {
      console.log(
        "⏩ Notificação recente já enviada, aguardando 2min para reenviar...",
      );
      return;
    }
  }

  let msg = "⚠️ *ALTERAÇÕES em Publicações Gatti!*\n\n";
  if (diff.added.length) {
    msg += `+ *Novos (${diff.added.length})*:\n`;
    diff.added.forEach((item) => {
      msg += `• ${item.date} - ${item.title}\n${item.href}\n\n`;
    });
  }
  if (diff.removed.length) {
    msg += `- *Removidos (${diff.removed.length})*:\n`;
    diff.removed.forEach((item) => {
      msg += `• ${item.date} - ${item.title}\n${item.href}\n\n`;
    });
  }
  if (diff.changed.length) {
    msg += `~ *Alterados (${diff.changed.length})*:\n`;
    diff.changed.forEach((item) => {
      msg += `• ${item.href}\n  Antes: ${item.before.date} | ${item.before.title}\n  Agora: ${item.after.date} | ${item.after.title}\n\n`;
    });
  }

  try {
    // Envia no grupo
    await wppClient.sendMessage(WPP_CHAT_ID, { text: msg });
    console.log("📱 Notificação WPP enviada no grupo!");

    // Envia no privado para cada membro
    const membros = await obterMembrosGrupo();
    console.log(
      `📤 Enviando notificação privada para ${membros.length} membros...`,
    );

    for (const membroId of membros) {
      try {
        await wppClient.sendMessage(membroId, { text: msg });
        console.log(`✅ Enviado para ${membroId}`);
      } catch (err) {
        console.error(`❌ Erro ao enviar para ${membroId}:`, err.message);
      }
    }

    ultimasNotificacoes.set(notifKey, Date.now());
    aguardandoResposta = false; // Reset para permitir próximas notificações
  } catch (err) {
    console.error("Erro ao enviar WPP:", err.message);
  }
}

// Suas funções originais (sem mudança)
function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function extractPublicacoes(html) {
  const $ = cheerio.load(html);
  const items = [];

  $("#blocoPublicacoes li.pdf a").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href")?.trim() ?? "";
    const date = normalizeText(anchor.find("span").first().text());

    const anchorClone = anchor.clone();
    anchorClone.find("span").remove();
    const title = normalizeText(anchorClone.text());

    if (!href || !title) return;

    items.push({ href, title, date });
  });

  return {
    source: TARGET_URL,
    checkedAt: new Date().toISOString(),
    total: items.length,
    items,
  };
}

async function loadPreviousSnapshot() {
  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function compareSnapshots(previous, current) {
  const previousMap = new Map(previous.items.map((item) => [item.href, item]));
  const currentMap = new Map(current.items.map((item) => [item.href, item]));

  const added = current.items.filter((item) => !previousMap.has(item.href));
  const removed = previous.items.filter((item) => !currentMap.has(item.href));

  const changed = current.items
    .filter((item) => {
      const oldItem = previousMap.get(item.href);
      if (!oldItem) return false;
      return oldItem.title !== item.title || oldItem.date !== item.date;
    })
    .map((item) => {
      const oldItem = previousMap.get(item.href);
      return {
        href: item.href,
        before: { title: oldItem?.title ?? "", date: oldItem?.date ?? "" },
        after: { title: item.title, date: item.date },
      };
    });

  return { added, removed, changed };
}

async function saveSnapshot(snapshot) {
  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
}

function printDiff(diff) {
  if (!diff.added.length && !diff.removed.length && !diff.changed.length) {
    console.log("Nenhuma alteração em Publicações desde o último snapshot.");
    return false; // Sem mudanças
  }

  console.log("⚠️ Alterações detectadas em Publicações:");

  if (diff.added.length) {
    console.log(`\n+ Novos (${diff.added.length}):`);
    diff.added.forEach((item) => {
      console.log(`- ${item.date} | ${item.title}`);
      console.log(`  ${item.href}`);
    });
  }

  if (diff.removed.length) {
    console.log(`\n- Removidos (${diff.removed.length}):`);
    diff.removed.forEach((item) => {
      console.log(`- ${item.date} | ${item.title}`);
      console.log(`  ${item.href}`);
    });
  }

  if (diff.changed.length) {
    console.log(`\n~ Alterados (${diff.changed.length}):`);
    diff.changed.forEach((item) => {
      console.log(`- ${item.href}`);
      console.log(`  Antes: ${item.before.date} | ${item.before.title}`);
      console.log(`  Agora: ${item.after.date} | ${item.after.title}`);
    });
  }
  return true; // Tem mudanças
}

async function scrapSite() {
  const response = await fetch(TARGET_URL);

  if (!response.ok) {
    throw new Error(`Falha ao baixar página (${response.status})`);
  }

  const body = await response.text();
  const currentSnapshot = extractPublicacoes(body);
  ultimaConferencia = currentSnapshot.checkedAt;
  ultimoDocumento = currentSnapshot.items.at(-1) ?? null;

  if (!currentSnapshot.total) {
    throw new Error("Nenhum item encontrado em #blocoPublicacoes.");
  }

  const previousSnapshot = await loadPreviousSnapshot();

  if (!previousSnapshot) {
    await saveSnapshot(currentSnapshot);
    console.log("Snapshot inicial criado.");
    console.log(`Itens monitorados: ${currentSnapshot.total}`);
    console.log(`Arquivo: ${SNAPSHOT_PATH}`);
    return;
  }

  const diff = compareSnapshots(previousSnapshot, currentSnapshot);
  const temMudancas = printDiff(diff);

  await saveSnapshot(currentSnapshot);
  console.log(`\nSnapshot atualizado: ${SNAPSHOT_PATH}`);

  if (temMudancas) {
    await enviarNotificacaoWpp(diff);
  }
}

// Inicializa tudo
async function main() {
  await initWpp();
  setInterval(processarSinalReinicio, 15 * 1000); // 15s
  // Roda uma vez imediato, depois em loop (ajuste intervalo)
  setInterval(scrapSite, 5 * 60 * 1000); // 5min
  await scrapSite(); // Primeira execução
}

main().catch((error) => {
  console.error("Erro:", error.message);
  process.exit(1);
});
