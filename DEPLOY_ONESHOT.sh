#!/bin/bash
# ============================================================
# Deploy one-shot — Iannini Day Trade Workspace
# Cole isso COMO ROOT na VPS depois de fazer `ssh root@2.24.89.246`
# ------------------------------------------------------------
# Idempotente: pode rodar de novo se algo falhar no meio.
# NÃO faz Certbot (DNS ainda não está configurado).
# ============================================================

set -e
set -o pipefail

# ── 0. Sanity check: rodar como root ────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  echo "ERRO: rode como root (use 'sudo -i' antes)"
  exit 1
fi

echo ""
echo "=============================================="
echo "  Iannini Day Trade — Deploy Automatizado"
echo "  $(hostname) | $(date '+%F %T')"
echo "=============================================="
echo ""

# ── 1. Pacotes base + Node 22 + MySQL + Nginx + Certbot ─────
echo "[1/9] Atualizando sistema e instalando dependências..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
apt-get install -y curl git build-essential ufw fail2ban

if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  echo "  → instalando Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "  Node $(node -v) / npm $(npm -v)"

echo "[2/9] Instalando pnpm e PM2..."
npm install -g pnpm pm2 >/dev/null 2>&1

echo "[3/9] Instalando MySQL..."
DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
systemctl enable --now mysql

echo "    Instalando Nginx e Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

# ── 2. Firewall + fail2ban ──────────────────────────────────
echo "[4/9] Configurando firewall (UFW) e fail2ban..."
ufw allow OpenSSH      >/dev/null 2>&1 || true
ufw allow 80/tcp       >/dev/null 2>&1 || true
ufw allow 443/tcp      >/dev/null 2>&1 || true
ufw --force enable     >/dev/null 2>&1
systemctl enable --now fail2ban

# ── 3. Banco MySQL ──────────────────────────────────────────
echo "[5/9] Configurando banco MySQL..."
if [ ! -f /root/.iannini-secrets ]; then
  DB_PASS=$(openssl rand -base64 24 | tr -d '/=+' | cut -c1-24)
  echo "MYSQL_PASSWORD: $DB_PASS" > /root/.iannini-secrets
  chmod 600 /root/.iannini-secrets
  echo "  → senha do MySQL salva em /root/.iannini-secrets"
else
  DB_PASS=$(grep MYSQL_PASSWORD /root/.iannini-secrets | cut -d' ' -f2)
  echo "  → reutilizando senha de /root/.iannini-secrets"
fi

mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS iannini_daytrade CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'iannini_user'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER 'iannini_user'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON iannini_daytrade.* TO 'iannini_user'@'localhost';
FLUSH PRIVILEGES;
SQL

# ── 4. Clonar / atualizar repositório ───────────────────────
echo "[6/9] Sincronizando código do GitHub..."
mkdir -p /var/www
if [ -d /var/www/ianninidaytrade/.git ]; then
  cd /var/www/ianninidaytrade
  git fetch origin
  git reset --hard origin/main
else
  cd /var/www
  rm -rf ianninidaytrade
  git clone https://github.com/iannini25/iannini-DayTrade.git ianninidaytrade
fi
cd /var/www/ianninidaytrade

# ── 5. .env ─────────────────────────────────────────────────
echo "[7/9] Configurando .env..."
if [ ! -f .env ] || ! grep -q "ENCRYPTION_KEY=" .env; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  cat > .env <<EOF
DATABASE_URL=mysql://iannini_user:${DB_PASS}@localhost:3306/iannini_daytrade
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
NODE_ENV=production
PORT=3000

OPENAI_API_KEY=
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
EOF
  chmod 600 .env
  {
    echo "JWT_SECRET: $JWT_SECRET"
    echo "ENCRYPTION_KEY: $ENCRYPTION_KEY"
  } >> /root/.iannini-secrets
  echo "  → .env criado e segredos anexados a /root/.iannini-secrets"
else
  echo "  → .env já existe e tem ENCRYPTION_KEY, mantendo"
fi

# ── 6. Install + migrate + build ────────────────────────────
echo "[8/9] Instalando dependências (pode levar ~2 min)..."
pnpm install --frozen-lockfile
echo "    Rodando migrations..."
pnpm db:migrate
echo "    Buildando frontend + backend..."
pnpm build

# Smoke test
echo "    Smoke test do bundle..."
PORT=3001 NODE_ENV=production node dist/index.js >/tmp/iannini-smoke.log 2>&1 &
SMOKE_PID=$!
sleep 4
if curl -sf http://localhost:3001/api/health >/dev/null; then
  echo "    ✓ Health check OK"
else
  echo "    ✗ Health check FALHOU:"
  cat /tmp/iannini-smoke.log
  kill $SMOKE_PID 2>/dev/null || true
  exit 1
fi
kill $SMOKE_PID 2>/dev/null || true
wait 2>/dev/null || true

# ── 7. Seed user inicial ────────────────────────────────────
echo "[9/9] Criando/atualizando usuário Túlio..."
SEED_EMAIL=tulio.iannini@gmail.com \
SEED_PASSWORD=Daytrade123 \
SEED_NAME="Túlio Iannini" \
node scripts/seed-user.mjs

# ── 8. PM2 ──────────────────────────────────────────────────
echo "    Configurando PM2..."
pm2 delete iannini-daytrade 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
PM2_STARTUP=$(pm2 startup systemd -u root --hp /root 2>&1 | grep "sudo env" | head -1 || true)
if [ -n "$PM2_STARTUP" ]; then
  eval "$PM2_STARTUP" >/dev/null 2>&1 || true
fi

# ── 9. Nginx (sem TLS por enquanto) ─────────────────────────
echo "    Configurando Nginx..."
cp /var/www/ianninidaytrade/nginx.conf /etc/nginx/sites-available/ianninidaytrade
ln -sf /etc/nginx/sites-available/ianninidaytrade /etc/nginx/sites-enabled/ianninidaytrade
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 10. Resumo final ────────────────────────────────────────
echo ""
echo "=============================================="
echo "  ✓ DEPLOY CONCLUÍDO"
echo "=============================================="
echo ""
echo "  PM2 status:"
pm2 status iannini-daytrade --no-color
echo ""
echo "  Health check local:"
curl -s http://localhost:3000/api/health
echo ""
echo ""
echo "  Próximos passos manuais:"
echo "  1. Configure DNS na Hostinger:"
echo "       Registro A    @         → $(curl -s ifconfig.me 2>/dev/null || echo 'IP_DA_VPS')"
echo "       Registro A    www       → $(curl -s ifconfig.me 2>/dev/null || echo 'IP_DA_VPS')"
echo ""
echo "  2. Aguarde propagação (5–30 min), confirme com:"
echo "       dig +short ianninidaytrade.com.br"
echo ""
echo "  3. Habilite HTTPS:"
echo "       certbot --nginx -d ianninidaytrade.com.br -d www.ianninidaytrade.com.br \\"
echo "         --non-interactive --agree-tos -m tulio.iannini@gmail.com --redirect"
echo ""
echo "  4. Acesse e teste login:"
echo "       http://ianninidaytrade.com.br  (sem HTTPS ainda)"
echo "       Email: tulio.iannini@gmail.com"
echo "       Senha: Daytrade123  (TROCAR após primeiro login)"
echo ""
echo "  Segredos salvos em: /root/.iannini-secrets"
echo "    cat /root/.iannini-secrets  # para visualizar"
echo ""
