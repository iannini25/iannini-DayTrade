# GUIA DE DEPLOY — Iannini Day Trade Workspace

Deploy completo em VPS Ubuntu (Hostinger KVM) com Node 22, MySQL 8, Nginx, PM2 e HTTPS via Let's Encrypt. Tempo estimado: **30–45 min** (mais a propagação de DNS).

## Pré-requisitos

- VPS Ubuntu 22.04+ com acesso root (SSH)
- Domínio apontando para o IP da VPS (registros A para `@` e `www`)
- Conta no GitHub com o repositório `iannini25/iannini-DayTrade`

> **Atenção sobre IP:** confirme o IP da VPS na Hostinger antes de seguir. `dig +short ianninidaytrade.com.br` deve retornar o IP correto.

---

## 1) Setup inicial da VPS (rodar como root)

```bash
ssh -o StrictHostKeyChecking=accept-new root@<IP_DA_VPS>

# Atualização e deps base
apt-get update && apt-get upgrade -y
apt-get install -y curl git build-essential ufw fail2ban

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v && npm -v   # deve mostrar v22.x

# pnpm + PM2
npm install -g pnpm pm2

# MySQL 8
apt-get install -y mysql-server
systemctl enable --now mysql

# Nginx + Certbot
apt-get install -y nginx certbot python3-certbot-nginx

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Fail2ban (config padrão já protege SSH)
systemctl enable --now fail2ban
```

---

## 2) Banco MySQL

Gere uma senha forte, salve fora do bash history:

```bash
DB_PASS=$(openssl rand -base64 24 | tr -d '/=+' | cut -c1-24)
echo "MYSQL_PASSWORD: $DB_PASS" > /root/.iannini-secrets
chmod 600 /root/.iannini-secrets

mysql -e "
CREATE DATABASE IF NOT EXISTS iannini_daytrade CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'iannini_user'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON iannini_daytrade.* TO 'iannini_user'@'localhost';
FLUSH PRIVILEGES;
"
echo "Banco criado. Senha em /root/.iannini-secrets"
```

---

## 3) Clonar o repositório

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/iannini25/iannini-DayTrade.git ianninidaytrade
cd /var/www/ianninidaytrade
```

---

## 4) Configurar `.env`

```bash
cd /var/www/ianninidaytrade

# Gerar segredos
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
DB_PASS=$(grep MYSQL_PASSWORD /root/.iannini-secrets | cut -d' ' -f2)

cat > .env <<EOF
DATABASE_URL=mysql://iannini_user:${DB_PASS}@localhost:3306/iannini_daytrade
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
NODE_ENV=production
PORT=3000

# OpenAI (opcional — IA fica desabilitada se vazio)
OPENAI_API_KEY=
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
EOF

chmod 600 .env
```

Anote os 3 segredos gerados em local seguro. Eles **NÃO** precisam ser mudados ao atualizar o código.

---

## 5) Instalar deps, rodar migrations e buildar

```bash
cd /var/www/ianninidaytrade
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build

# Smoke test rápido (Ctrl+C depois de ver "Server running on http://localhost:3000/")
NODE_ENV=production node dist/index.js &
sleep 3
curl -s http://localhost:3000/api/health
echo
kill %1 2>/dev/null
```

A resposta esperada do health check:
```json
{"status":"ok","db":true,"time":"..."}
```

---

## 6) Inserir o primeiro usuário

```bash
cd /var/www/ianninidaytrade
SEED_EMAIL=tulio.iannini@gmail.com \
SEED_PASSWORD=Daytrade123 \
SEED_NAME="Túlio Iannini" \
node scripts/seed-user.mjs
```

> **⚠️ Importante:** a senha `Daytrade123` é fraca e foi usada apenas para o primeiro acesso. Recomende ao Túlio que use a opção de troca de senha imediatamente após o primeiro login.

Repita o comando para os outros traders se necessário (`lucaszbr@gmail.com`, `bernardo.iannini14@gmail.com`).

---

## 7) Iniciar com PM2

```bash
cd /var/www/ianninidaytrade
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root
# ← Execute o comando que o pm2 imprimir (cola e roda)

pm2 logs iannini-daytrade --lines 30
# Verifique que não há erros recorrentes
```

---

## 8) Nginx

```bash
cp /var/www/ianninidaytrade/nginx.conf /etc/nginx/sites-available/ianninidaytrade
ln -sf /etc/nginx/sites-available/ianninidaytrade /etc/nginx/sites-enabled/ianninidaytrade
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## 9) HTTPS (Let's Encrypt)

```bash
certbot --nginx \
  -d ianninidaytrade.com.br \
  -d www.ianninidaytrade.com.br \
  --non-interactive --agree-tos \
  -m tulio.iannini@gmail.com \
  --redirect
```

Certbot configura o renewal automático em `/etc/cron.d/certbot`.

---

## 10) Verificação

```bash
# Da própria VPS
curl -I https://ianninidaytrade.com.br/api/health
# Esperado: HTTP/2 200

pm2 status
pm2 logs iannini-daytrade --lines 50 --nostream
tail -n 30 /var/log/nginx/ianninidaytrade_error.log
```

Do navegador: abra `https://ianninidaytrade.com.br`, faça login com o usuário criado, confirme:

- ✅ Login funciona
- ✅ Banner amarelo de "MODO SIMULAÇÃO" aparece
- ✅ Workspace carrega (gráfico + SuperDOM + Times & Trades)
- ✅ Botão "Pausar" no header funciona (kill switch)
- ✅ Navegação entre páginas sem 401
- ✅ Configurações → seção "Segurança Operacional" exibe os 3 toggles

---

## Atualização (deploys subsequentes)

```bash
cd /var/www/ianninidaytrade
git pull
pnpm install --frozen-lockfile
pnpm db:migrate                     # roda novas migrations se houver
pnpm build
pm2 restart iannini-daytrade
pm2 logs iannini-daytrade --lines 30 --nostream
```

---

## Manutenção

| Comando | Quando usar |
|---|---|
| `pm2 logs iannini-daytrade` | Debug em tempo real |
| `pm2 restart iannini-daytrade` | Forçar restart |
| `pm2 monit` | Dashboard interativo (CPU, mem) |
| `tail -f /var/log/nginx/ianninidaytrade_error.log` | Erros do reverse proxy |
| `mysql -u iannini_user -p iannini_daytrade` | Inspecionar DB |
| `node scripts/seed-user.mjs <email> <pass> <nome>` | Adicionar/resetar usuário |

### Backup do MySQL (cron diário sugerido)

Adicione em `/etc/cron.daily/backup-iannini`:

```bash
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M)
mkdir -p /var/backups/iannini
DB_PASS=$(grep MYSQL_PASSWORD /root/.iannini-secrets | cut -d' ' -f2)
mysqldump -u iannini_user -p"$DB_PASS" iannini_daytrade | gzip > /var/backups/iannini/db_${DATE}.sql.gz
find /var/backups/iannini -name "db_*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x /etc/cron.daily/backup-iannini
```

---

## Troubleshooting

- **Login não persiste**: verifique se `app.set("trust proxy", 1)` está ativo (deveria estar) e se o Nginx envia `X-Forwarded-Proto`.
- **`ENCRYPTION_KEY must be 32 bytes hex (64 chars)`**: confira `.env` — a chave precisa ter exatamente 64 caracteres hexadecimais.
- **Página em branco**: rode `pnpm build` de novo e `pm2 restart iannini-daytrade`. Verifique `dist/public/index.html`.
- **502 Bad Gateway**: PM2 caiu. `pm2 status` para confirmar e `pm2 logs` para investigar.
- **Yahoo Finance retorna erro**: API não-oficial. Esperado falhar pontualmente. Considere migrar para B3 ou provedor pago no futuro.
