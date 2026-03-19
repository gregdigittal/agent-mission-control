// PM2 ecosystem config — Agent Mission Control Bridge
// Usage: pm2 start pm2.config.js
// Docs:  https://pm2.keymetrics.io/docs/usage/application-declaration/

export default {
  apps: [
    {
      name: 'agent-bridge',
      script: 'dist/index.js',
      cwd: '/home/gregmorris/agent-mission-control/bridge',

      // Restart policy
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      min_uptime: '10s',

      // Logging
      out_file: '/home/gregmorris/.agent-mc/logs/pm2-out.log',
      error_file: '/home/gregmorris/.agent-mc/logs/pm2-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Environment
      env: {
        NODE_ENV: 'production',
        VPS_NODE_ID: 'vps-main',
        VPS_REGION: 'eu-west-1',
      },
    },
  ],
};
