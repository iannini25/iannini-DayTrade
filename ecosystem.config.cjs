/**
 * PM2 Ecosystem Config — Iannini Day Trade Workspace
 * Uso: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "iannini-daytrade",
      script: "./dist/index.js",
      cwd: "/var/www/ianninidaytrade",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Reiniciar automaticamente em caso de crash
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      // Logs
      out_file: "/var/log/pm2/iannini-daytrade-out.log",
      error_file: "/var/log/pm2/iannini-daytrade-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
