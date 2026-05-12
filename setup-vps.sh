#!/bin/bash
# ============================================================
# Iannini Day Trade Workspace — Script de Setup VPS
# Testado em Ubuntu 22.04 LTS / Debian 12 (Hostinger KVM)
# Execute como root: bash setup-vps.sh
# ============================================================
# Idempotente. Pode ser rodado de novo sem efeito colateral.

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Rode como root: sudo bash setup-vps.sh"

APP_DIR="/var/www/ianninidaytrade"
DB_NAME="iannini_daytrade"
DB_USER="iannini_user"

info "=== Iannini Day Trade — Setup VPS ==="

# 1. Atualizar e instalar deps base ─────────────────────────
info "Atualizando pacotes e instalando dependências base..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y curl git build-essential ufw fail2ban

# 2. Node 22 ─────────────────────────────────────────────────
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  info "Instalando Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
info "Node $(node -v) / npm $(npm -v)"

# 3. pnpm + PM2 ─────────────────────────────────────────────
info "Instalando pnpm e PM2..."
npm install -g pnpm pm2

# 4. MySQL 8 ────────────────────────────────────────────────
info "Instalando MySQL..."
apt-get install -y mysql-server
systemctl enable --now mysql

# 5. Criar banco ────────────────────────────────────────────
info "Configurando banco de dados '$DB_NAME'..."
if [ -z "$DB_PASS" ]; then
  DB_PASS=$(openssl rand -base64 24 | tr -d '/=+' | cut -c1-24)
  echo "MYSQL_PASSWORD: $DB_PASS" > /root/.iannini-secrets
  chmod 600 /root/.iannini-secrets
  warning "Senha gerada automaticamente e salva em /root/.iannini-secrets"
fi

mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
info "Banco criado."

# 6. Nginx + Certbot ────────────────────────────────────────
info "Instalando Nginx e Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

# 7. Firewall + fail2ban ────────────────────────────────────
info "Configurando firewall (UFW) e fail2ban..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

# 8. Diretório da aplicação ─────────────────────────────────
info "Criando diretório da aplicação em $APP_DIR..."
mkdir -p $APP_DIR

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Setup base concluído!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Próximos passos (ver GUIA_VPS_IANNINI_DAYTRADE.md):"
echo ""
echo "1. Clone o repositório:"
echo "   cd /var/www && git clone https://github.com/iannini25/iannini-DayTrade.git ianninidaytrade"
echo ""
echo "2. Configure .env:"
echo "   cd $APP_DIR && cp env-template.txt .env"
echo "   # Edite .env: DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY"
echo "   # MYSQL_PASSWORD está em /root/.iannini-secrets"
echo ""
echo "3. Build:"
echo "   pnpm install --frozen-lockfile && pnpm db:migrate && pnpm build"
echo ""
echo "4. Crie o primeiro usuário:"
echo "   SEED_EMAIL=tulio.iannini@gmail.com SEED_PASSWORD=... SEED_NAME='Túlio Iannini' \\"
echo "     node scripts/seed-user.mjs"
echo ""
echo "5. PM2:"
echo "   pm2 start ecosystem.config.cjs && pm2 save && pm2 startup systemd -u root --hp /root"
echo ""
echo "6. Nginx + HTTPS:"
echo "   cp $APP_DIR/nginx.conf /etc/nginx/sites-available/ianninidaytrade"
echo "   ln -sf /etc/nginx/sites-available/ianninidaytrade /etc/nginx/sites-enabled/"
echo "   rm -f /etc/nginx/sites-enabled/default"
echo "   nginx -t && systemctl reload nginx"
echo "   certbot --nginx -d ianninidaytrade.com.br -d www.ianninidaytrade.com.br \\"
echo "     --non-interactive --agree-tos -m tulio.iannini@gmail.com --redirect"
echo ""
