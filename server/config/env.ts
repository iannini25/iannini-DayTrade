export const ENV = {
  jwtSecret: process.env.JWT_SECRET ?? "",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT ?? "3000"),
  // LLM (OpenAI-compatible) — opcional, habilita área preditiva
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
};

export function assertRequiredEnv(): void {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  const jwt = process.env.JWT_SECRET ?? "";
  if (jwt.length < 32) {
    missing.push("JWT_SECRET (must be at least 32 chars; generate with `node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"`)");
  }
  const enc = process.env.ENCRYPTION_KEY ?? "";
  if (enc.length !== 64) {
    missing.push("ENCRYPTION_KEY (must be 32 bytes hex = 64 chars; generate with `node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"`)");
  }

  if (missing.length > 0) {
    console.error("\n[Config] Missing or invalid environment variables:");
    for (const m of missing) console.error(`  - ${m}`);
    console.error("\nAborting startup. Set the variables in your .env file and try again.\n");
    process.exit(1);
  }
}
