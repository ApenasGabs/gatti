import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

// Chat ID do grupo onde vai responder
const WPP_CHAT_ID = "120363132077830172@g.us";

let wppClient = null;

async function buscarPiada() {
  try {
    const response = await fetch("https://naas.isalman.dev/no");
    const data = await response.json();
    return data.joke || "Não consegui buscar uma piada 😅";
  } catch (err) {
    console.error("Erro ao buscar piada:", err.message);
    return "Erro ao buscar piada 😅";
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

async function initWpp() {
  wppClient = new Client({
    authStrategy: new LocalAuth(),
  });

  wppClient.on("qr", (qr) => {
    console.log("\n📱 Escaneie o QR code com seu WhatsApp:");
    qrcode.generate(qr, { small: true });
  });

  wppClient.on("ready", () => {
    console.log("\n✅ WhatsApp conectado! Aguardando mensagens...\n");
  });

  wppClient.on("disconnected", () => {
    console.log("⚠️ WPP desconectado, reconectando...");
    setTimeout(initWpp, 5000);
  });

  // Listener para mensagens recebidas
  wppClient.on("message", async (msg) => {
    const chat = await msg.getChat();

    // Log das infos do grupo/chat
    console.log("\n📨 Mensagem recebida:");
    console.log(`   De: ${msg.from}`);
    console.log(`   Remetente: ${msg.author || msg.from}`);
    console.log(`   Chat ID: ${chat.id._serialized}`);
    console.log(`   Chat Nome: ${chat.name}`);
    console.log(`   É grupo: ${chat.isGroup}`);
    console.log(`   Conteúdo: ${msg.body}`);
    console.log(`   Horário: ${new Date().toLocaleString("pt-BR")}`);

    // Responde apenas se for o grupo configurado
    if (chat.id._serialized === WPP_CHAT_ID) {
      try {
        console.log("🤖 Buscando piada...");
        const piada = await buscarPiada();
        console.log(`📝 Piada original: ${piada}`);

        const piadaTraduzida = await traduzirParaPortugues(piada);
        console.log(`🇧🇷 Piada traduzida: ${piadaTraduzida}`);

        await msg.reply(piadaTraduzida);
        console.log("✅ Resposta enviada\n");
      } catch (err) {
        console.error("❌ Erro ao responder:", err.message, "\n");
      }
    } else {
      console.log("⏭️  Ignoring message (group not configured)\n");
    }
  });

  await wppClient.initialize();
}

async function main() {
  await initWpp();
}

main().catch((error) => {
  console.error("Erro:", error.message);
  process.exit(1);
});
