#!/usr/bin/env node

/**
 * Load test script for /api/events/week endpoint
 * Tests 100 requests/second for 30 seconds and monitors performance
 */

import http from 'http';

const config = {
  host: process.env.TEST_HOST || 'localhost',
  port: process.env.TEST_PORT || '3000',
  token: process.env.DISPLAY_TOKEN || 'test-token',
  requestsPerSecond: 100,
  durationSeconds: 30,
  timeout: 5000
};

const stats = {
  total: 0,
  success: 0,
  errors: 0,
  timeouts: 0,
  responseTimes: [],
  startTime: null,
  endTime: null
};

function makeRequest() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const options = {
      hostname: config.host,
      port: config.port,
      path: `/api/events/week?token=${config.token}`,
      method: 'GET',
      timeout: config.timeout,
      headers: {
        'User-Agent': 'load-test/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        stats.responseTimes.push(responseTime);
        
        if (res.statusCode === 200) {
          stats.success++;
          resolve({ statusCode: res.statusCode, responseTime, data });
        } else {
          stats.errors++;
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      stats.errors++;
      reject(error);
    });

    req.on('timeout', () => {
      stats.timeouts++;
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function calculatePercentile(values, percentile) {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

async function runLoadTest() {
  console.log(`🚀 Starting load test: ${config.requestsPerSecond} req/sec for ${config.durationSeconds}s`);
  console.log(`📍 Target: http://${config.host}:${config.port}/api/events/week`);
  
  stats.startTime = Date.now();
  const endTime = stats.startTime + (config.durationSeconds * 1000);
  
  // Start the load test
  const interval = setInterval(async () => {
    for (let i = 0; i < config.requestsPerSecond; i++) {
      stats.total++;
      makeRequest()
        .then(() => {
          // Success handled in makeRequest
        })
        .catch((error) => {
          // Error handled in makeRequest
        });
    }
  }, 1000);
  
  // Monitor progress
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rate = stats.total / elapsed;
    console.log(`⏱️  ${elapsed.toFixed(1)}s: ${stats.total} requests, ${rate.toFixed(1)} req/s, ${stats.success} success, ${stats.errors} errors`);
  }, 5000);
  
  // Wait for test to complete
  await new Promise(resolve => setTimeout(resolve, config.durationSeconds * 1000));
  
  clearInterval(interval);
  clearInterval(progressInterval);
  
  stats.endTime = Date.now();
  
  // Calculate final statistics
  const totalTime = (stats.endTime - stats.startTime) / 1000;
  const actualRate = stats.total / totalTime;
  const successRate = (stats.success / stats.total) * 100;
  
  const p50 = calculatePercentile(stats.responseTimes, 50);
  const p95 = calculatePercentile(stats.responseTimes, 95);
  const p99 = calculatePercentile(stats.responseTimes, 99);
  
  console.log('\n📊 Load Test Results:');
  console.log(`   Total Requests: ${stats.total}`);
  console.log(`   Successful: ${stats.success} (${successRate.toFixed(1)}%)`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Timeouts: ${stats.timeouts}`);
  console.log(`   Actual Rate: ${actualRate.toFixed(1)} req/s`);
  console.log(`   Response Times:`);
  console.log(`     P50: ${p50}ms`);
  console.log(`     P95: ${p95}ms`);
  console.log(`     P99: ${p99}ms`);
  
  // Performance thresholds
  const maxP95 = 200; // 200ms max for P95
  const maxP99 = 500; // 500ms max for P99
  
  if (p95 > maxP95) {
    console.log(`⚠️  P95 response time (${p95}ms) exceeds threshold (${maxP95}ms)`);
  }
  
  if (p99 > maxP99) {
    console.log(`⚠️  P99 response time (${p99}ms) exceeds threshold (${maxP99}ms)`);
  }
  
  if (successRate < 95) {
    console.log(`⚠️  Success rate (${successRate.toFixed(1)}%) below threshold (95%)`);
  }
  
  if (p95 <= maxP95 && p99 <= maxP99 && successRate >= 95) {
    console.log('✅ Load test passed - performance within acceptable limits');
    process.exit(0);
  } else {
    console.log('❌ Load test failed - performance issues detected');
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Load test interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Load test terminated');
  process.exit(1);
});

// Run the load test
runLoadTest();
