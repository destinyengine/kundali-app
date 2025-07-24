module.exports = {
  apps: [
    {
      name: 'kundali-backend',
      script: 'kundali_generator.py',
      interpreter: 'python3',
      cwd: '/home/devsumi/Documents/Project/kundali-app/Backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        FASTAPI_HOST: '0.0.0.0',
        FASTAPI_PORT: 8000,
        FRONTEND_URL: 'https://destinyengine.xyz,https://www.destinyengine.xyz',
        ENVIRONMENT: 'production'
      },
      error_file: './logs/kundali-backend-error.log',
      out_file: './logs/kundali-backend-out.log',
      log_file: './logs/kundali-backend.log',
      time: true
    }
  ]
};
