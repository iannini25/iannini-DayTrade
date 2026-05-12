#!/usr/bin/env node
/**
 * seed-user.mjs — cria ou atualiza um usuário diretamente no banco.
 * Não depende do servidor estar rodando — usa mysql2 + bcryptjs.
 *
 * Uso:
 *   node scripts/seed-user.mjs <email> <password> <name>
 *
 * Ou via env vars:
 *   SEED_EMAIL=... SEED_PASSWORD=... SEED_NAME=... node scripts/seed-user.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const AUTHORIZED_EMAILS = [
  "tulio.iannini@gmail.com",
  "lucaszbr@gmail.com",
  "bernardo.iannini14@gmail.com",
];

const SALT_ROUNDS = 12;

function fail(msg) {
  console.error(`[seed-user] ${msg}`);
  process.exit(1);
}

async function main() {
  const email = (process.env.SEED_EMAIL || process.argv[2] || "").trim().toLowerCase();
  const password = process.env.SEED_PASSWORD || process.argv[3];
  const name = (process.env.SEED_NAME || process.argv[4] || "").trim();

  if (!email || !password || !name) {
    console.error("Uso: node scripts/seed-user.mjs <email> <password> <name>");
    console.error("Ou via env: SEED_EMAIL, SEED_PASSWORD, SEED_NAME");
    process.exit(1);
  }
  if (!AUTHORIZED_EMAILS.includes(email)) {
    fail(`E-mail '${email}' não está na whitelist. Edite shared/const.ts para adicionar.`);
  }
  if (password.length < 8) {
    fail("Senha precisa ter no mínimo 8 caracteres.");
  }
  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL não definida no .env");
  }

  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  });

  try {
    const [rows] = await conn.execute("SELECT id FROM users WHERE email = ?", [email]);
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    if (rows.length > 0) {
      const id = rows[0].id;
      console.log(`[seed-user] Usuário '${email}' já existe (id=${id}). Atualizando senha e nome…`);
      await conn.execute(
        "UPDATE users SET passwordHash = ?, name = ? WHERE email = ?",
        [hash, name, email]
      );
      console.log(`[seed-user] Senha atualizada para '${email}'.`);
    } else {
      const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await conn.execute(
        "INSERT INTO users (openId, email, name, passwordHash, loginMethod, role, lastSignedIn) VALUES (?, ?, ?, ?, 'email_password', 'admin', NOW())",
        [openId, email, name, hash]
      );
      console.log(`[seed-user] Usuário '${email}' criado com sucesso.`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[seed-user] Erro:", err);
  process.exit(1);
});
