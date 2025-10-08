module.exports = {
    apps: [
      {
        name: 'ai-planner-api',
        script: 'dist/server.js',
        instances: 'max', // Use all available CPUs
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'development',
          PORT: 5000,
          NODE_OPTIONS: '--max-old-space-size=512'
        },
        env_staging: {
          NODE_ENV: 'staging',
          PORT: 5000,
          NODE_OPTIONS: '--max-old-space-size=1024'
        },
        env_production: {
          NODE_ENV: 'production',
          PORT: 5000,
          NODE_OPTIONS: '--max-old-space-size=2048'
        },
        // Logging
        error_file: 'logs/err.log',
        out_file: 'logs/out.log',
        log_file: 'logs/combined.log',
        time: true,
        
        // Process management
        max_memory_restart: '1G',
        restart_delay: 4000,
        max_restarts: 10,
        min_uptime: '10s',
        
        // Monitoring
        monitoring: false,
        pmx: false,
        
        // Advanced options
        kill_timeout: 5000,
        wait_ready: true,
        listen_timeout: 8000,
        
        // Auto restart on file changes (development only)
        watch: false,
        ignore_watch: ['node_modules', 'logs', 'uploads'],
        
        // Environment specific settings
        env_development: {
          watch: true,
          instances: 1,
          exec_mode: 'fork'
        }
      },
      
      // Queue worker process
      {
        name: 'ai-planner-worker',
        script: 'dist/workers/index.js',
        instances: 2,
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'production',
          WORKER_TYPE: 'queue',
          NODE_OPTIONS: '--max-old-space-size=1024'
        },
        error_file: 'logs/worker-err.log',
        out_file: 'logs/worker-out.log',
        max_memory_restart: '512M',
        restart_delay: 2000,
        max_restarts: 5,
        min_uptime: '5s'
      },
      
      // Scheduled job processor
      {
        name: 'ai-planner-scheduler',
        script: 'dist/jobs/scheduler.js',
        instances: 1,
        exec_mode: 'fork',
        cron_restart: '0 0 * * *', // Daily at midnight
        env: {
          NODE_ENV: 'production',
          JOB_TYPE: 'scheduled',
          NODE_OPTIONS: '--max-old-space-size=512'
        },
        error_file: 'logs/scheduler-err.log',
        out_file: 'logs/scheduler-out.log',
        max_memory_restart: '256M'
      }
    ],
    
    deploy: {
      production: {
        user: 'node',
        host: ['production-server.com'],
        ref: 'origin/main',
        repo: 'git@github.com:ayy-oub/ai-planner-api.git',
        path: '/var/www/ai-planner-api',
        'pre-deploy-local': '',
        'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
        'pre-setup': '',
        'ssh_options': 'StrictHostKeyChecking=no'
      },
      
      staging: {
        user: 'node',
        host: ['staging-server.com'],
        ref: 'origin/develop',
        repo: 'git@github.com:ayy-oub/ai-planner-api.git',
        path: '/var/www/ai-planner-api-staging',
        'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
        'ssh_options': 'StrictHostKeyChecking=no'
      }
    }
  };