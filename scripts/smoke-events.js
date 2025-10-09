#!/usr/bin/env node

/**
 * Smoke test script for /api/events/week endpoint
 * Validates that the endpoint is accessible and returns proper data
 */

import http from 'http';

const config = {
  host: process.env.TEST_HOST || 'localhost',
  port: process.env.TEST_PORT || '3000',
  token: process.env.DISPLAY_TOKEN || 'test-token',
  timeout: 10000 // 10 seconds
};

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: path,
      method: 'GET',
      timeout: config.timeout,
      headers: {
        'User-Agent': 'smoke-test/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          reject(new Error(`Failed to parse JSON response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runSmokeTest() {
  console.log('🔥 Starting events API smoke test...');
  console.log(`📍 Testing: http://${config.host}:${config.port}/api/events/week`);
  
  try {
    // Test 1: Basic endpoint accessibility
    console.log('\n📋 Test 1: Basic endpoint accessibility');
    const response = await makeRequest(`/api/events/week?token=${config.token}`);
    
    if (response.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${response.statusCode}`);
    }
    
    console.log(`✅ Status: ${response.statusCode}`);
    console.log(`📊 Response length: ${JSON.stringify(response.data).length} bytes`);
    
    // Test 2: Response format validation
    console.log('\n📋 Test 2: Response format validation');
    
    if (!Array.isArray(response.data)) {
      throw new Error(`Expected array response, got ${typeof response.data}`);
    }
    
    console.log(`✅ Response is array with ${response.data.length} events`);
    
    // Test 3: Cache headers validation
    console.log('\n📋 Test 3: Cache headers validation');
    
    const cacheControl = response.headers['cache-control'];
    if (!cacheControl || !cacheControl.includes('public')) {
      throw new Error(`Expected cache-control header with 'public', got: ${cacheControl}`);
    }
    
    console.log(`✅ Cache-Control: ${cacheControl}`);
    
    // Test 4: Content-Type validation
    console.log('\n📋 Test 4: Content-Type validation');
    
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected content-type application/json, got: ${contentType}`);
    }
    
    console.log(`✅ Content-Type: ${contentType}`);
    
    // Test 5: Date range parameters
    console.log('\n📋 Test 5: Date range parameters');
    
    const from = '2025-01-01T00:00:00.000Z';
    const to = '2025-01-07T00:00:00.000Z';
    const rangeResponse = await makeRequest(`/api/events/week?token=${config.token}&from=${from}&to=${to}`);
    
    if (rangeResponse.statusCode !== 200) {
      throw new Error(`Date range test failed with status ${rangeResponse.statusCode}`);
    }
    
    if (!Array.isArray(rangeResponse.data)) {
      throw new Error(`Date range test returned non-array: ${typeof rangeResponse.data}`);
    }
    
    console.log(`✅ Date range test passed (${rangeResponse.data.length} events)`);
    
    // Test 6: Authentication validation
    console.log('\n📋 Test 6: Authentication validation');
    
    try {
      await makeRequest('/api/events/week'); // No token
      throw new Error('Expected 401 for request without token');
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.log('✅ Authentication properly required');
      } else {
        throw error;
      }
    }
    
    // Test 7: Invalid token validation
    console.log('\n📋 Test 7: Invalid token validation');
    
    try {
      await makeRequest('/api/events/week?token=invalid-token');
      throw new Error('Expected 401 for invalid token');
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.log('✅ Invalid token properly rejected');
      } else {
        throw error;
      }
    }
    
    console.log('\n🎉 All smoke tests passed!');
    console.log(`📈 Summary: ${response.data.length} events found, endpoint is healthy`);
    
    // Exit with success code
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Smoke test failed:');
    console.error(`   ${error.message}`);
    console.error('\n🔍 Debug information:');
    console.error(`   Host: ${config.host}`);
    console.error(`   Port: ${config.port}`);
    console.error(`   Token: ${config.token.substring(0, 8)}...`);
    
    // Exit with failure code
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Smoke test interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Smoke test terminated');
  process.exit(1);
});

// Run the smoke test
runSmokeTest();
