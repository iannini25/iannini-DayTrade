#!/usr/bin/env node
/**
 * create-user.mjs — Script para criar usuários iniciais no VPS
 * Execute: node scripts/create-user.mjs
 */
import readline from "readline";
import { createHash } from "crypto";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const AUTHORIZED_EMAILS = [
  "tulio.iannini@gmail.com",
  "lucaszbr@gmail.com",
  "bernardo.iannini14@gmail.com",
];

async function main() {
  console.log("\n=== Iannini Day Trade — Criar Usuário ===\n");
  console.log("E-mails autorizados:");
  AUTHORIZED_EMAILS.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  console.log("");

  const email = (await ask("E-mail: ")).trim().toLowerCase();
  if (!AUTHORIZED_EMAILS.includes(email)) {
    console.error(`\nErro: "${email}" não está na lista de e-mails autorizados.`);
    process.exit(1);
  }

  const name = (await ask("Nome completo: ")).trim();
  if (!name) { console.error("Nome é obrigatório."); process.exit(1); }

  const password = await ask("Senha (mín. 8 caracteres): ");
  if (password.length < 8) { console.error("Senha muito curta."); process.exit(1); }

  const confirm = await ask("Confirme a senha: ");
  if (password !== confirm) { console.error("Senhas não coincidem."); process.exit(1); }

  rl.close();

  // Chamar endpoint de setup
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`\n✅ Usuário "${name}" (${email}) criado com sucesso!`);
      console.log("   Acesse: http://localhost:3000/login\n");
    } else {
      console.error(`\n❌ Erro: ${data.error}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Falha ao conectar ao servidor: ${err.message}`);
    console.error("   Certifique-se de que o servidor está rodando antes de executar este script.");
    process.exit(1);
  }
}

main().catch(console.error);
