import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESTART_SIGNAL_PATH = path.join(
  __dirname,
  "data",
  "restart-pending.json",
);
const CHECK_INTERVAL_MS = Number(
  process.env.UPDATE_CHECK_INTERVAL_MS || 5 * 60 * 1000,
);

async function runGit(args) {
  const { stdout } = await execFileAsync("git", args, { cwd: __dirname });
  return stdout.trim();
}

async function hasRestartSignal() {
  try {
    await access(RESTART_SIGNAL_PATH);
    return true;
  } catch {
    return false;
  }
}

async function writeRestartSignal(payload) {
  await mkdir(path.dirname(RESTART_SIGNAL_PATH), { recursive: true });
  await writeFile(
    RESTART_SIGNAL_PATH,
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
}

async function readPackageLock() {
  try {
    const content = await readFile(
      path.join(__dirname, "package-lock.json"),
      "utf-8",
    );
    return content;
  } catch {
    return "";
  }
}

function parseAheadBehind(raw) {
  const [aheadRaw, behindRaw] = raw.split("\t");
  return {
    ahead: Number(aheadRaw || 0),
    behind: Number(behindRaw || 0),
  };
}

function isHorarioComercial() {
  const now = new Date();
  const brTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const hour = brTime.getHours();
  return hour >= 7; // 8h até 23h59 (meia-noite)
}

async function checkForUpdates() {
  if (!isHorarioComercial()) {
    console.log(
      "⏰ Fora do horário de verificação (7h-00h BRT). Aguardando...",
    );
    return;
  }

  console.log("🔎 Verificando atualizações remotas...");

  await runGit(["fetch", "--prune", "--quiet"]);

  let upstream;
  try {
    upstream = await runGit([
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{u}",
    ]);
  } catch {
    console.log(
      "ℹ️ Branch sem upstream configurado. Updater aguardando configuração.",
    );
    return;
  }

  const counts = await runGit([
    "rev-list",
    "--left-right",
    "--count",
    `HEAD...${upstream}`,
  ]);
  const { ahead, behind } = parseAheadBehind(counts);

  if (behind === 0) {
    console.log("✅ Sem atualizações pendentes.");
    return;
  }

  if (await hasRestartSignal()) {
    console.log("⏭️ Já existe reinício pendente. Aguardando bot reiniciar.");
    return;
  }

  console.log(
    `⬇️ Atualização detectada (${behind} commit(s) atrás). Aplicando git pull...`,
  );

  const lockBefore = await readPackageLock();

  // Pega mensagem do último commit antes do pull
  const lastCommitMsg = await runGit(["log", "-1", "--pretty=%s", "@{u}"]);

  await runGit(["pull", "--ff-only"]);
  const lockAfter = await readPackageLock();

  const depsChanged = lockBefore !== lockAfter;

  const signalPayload = {
    createdAt: new Date().toISOString(),
    reason: `nova versão disponível: ${lastCommitMsg}`,
    upstream,
    ahead,
    behind,
    depsChanged,
  };

  await writeRestartSignal(signalPayload);
  console.log("📣 Sinal de reinício criado para o bot avisar e reiniciar.");

  if (depsChanged) {
    console.log(
      "⚠️ package-lock mudou. Rode npm install para garantir dependências atualizadas.",
    );
  }

  // Aguarda 20s para gatti avisar no grupo, depois força restart via PM2
  console.log("⏳ Aguardando 20s para bot avisar...");
  await new Promise((resolve) => setTimeout(resolve, 20000));

  console.log("🔄 Forçando restart via PM2...");
  try {
    await execFileAsync("pm2", ["restart", "ecosystem.config.cjs"], {
      cwd: __dirname,
    });
    console.log("✅ PM2 restart executado com sucesso!");
  } catch (err) {
    console.error("⚠️ Erro ao executar pm2 restart:", err.message);
    console.log("💡 Bots devem reiniciar via sinal normalmente.");
  }
}

async function main() {
  await checkForUpdates();
  setInterval(async () => {
    try {
      await checkForUpdates();
    } catch (err) {
      console.error("Erro no updater:", err.message);
    }
  }, CHECK_INTERVAL_MS);
}

main().catch((error) => {
  console.error("Erro fatal updater:", error.message);
  process.exit(1);
});
