#!/usr/bin/env node

/**
 * Docker Health Check Script
 * This script is used by Docker to check if the container is healthy
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 5000,
  path: '/health',
  method: 'GET',
  timeout: 5000, // 5 seconds timeout
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const healthData = JSON.parse(data);
        if (healthData.status === 'healthy') {
          console.log('Health check passed');
          process.exit(0);
        } else {
          console.error('Health check failed: Service status is', healthData.status);
          process.exit(1);
        }
      } catch (error) {
        console.error('Health check failed: Invalid response format');
        process.exit(1);
      }
    } else {
      console.error(`Health check failed: HTTP ${res.statusCode}`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Health check failed:', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check failed: Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();