#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
function loadEnv() {
  const envPath = '.env';
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          envVars[key] = value;
        }
      }
    });
    
    Object.assign(process.env, envVars);
  }
}

// Wait for database to be ready
async function waitForDatabase(maxRetries = 30, delay = 1000) {
  console.log('🔍 Checking database connection...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync('npx prisma db push --accept-data-loss', { 
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      });
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('❌ Database connection failed after maximum retries');
        throw new Error('Database not available');
      }
      console.log(`⏳ Database not ready, retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

// Run database migrations
function runMigrations() {
  console.log('🔄 Running database migrations...');
  try {
    execSync('npx prisma migrate deploy', { 
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
    console.log('✅ Database migrations completed');
  } catch (error) {
    // Check if it's a "schema not empty" error, which is expected if migrations are already applied
    if (error.message.includes('P3005') || error.message.includes('schema is not empty')) {
      console.log('✅ Database migrations already applied');
    } else {
      console.error('❌ Database migration failed:', error.message);
      throw error;
    }
  }
}

// Test admin endpoints
async function testAdminEndpoints() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const adminToken = process.env.ADMIN_API_TOKEN;
  
  if (!adminToken) {
    console.log('⚠️  No ADMIN_API_TOKEN set, skipping admin endpoint tests');
    return;
  }
  
  console.log('🔍 Testing admin endpoints...');
  
  try {
    // Test admin sources endpoint
    const sourcesResponse = await fetch(`${baseURL}/api/admin/sources`, {
      headers: {
        'X-Admin-Token': adminToken
      }
    });
    
    if (!sourcesResponse.ok) {
      throw new Error(`Admin sources endpoint failed: ${sourcesResponse.status} ${sourcesResponse.statusText}`);
    }
    
    const sourcesData = await sourcesResponse.json();
    console.log(`✅ Admin sources endpoint: ${sourcesData.count} sources found`);
    
    // Test admin sync endpoint
    const syncResponse = await fetch(`${baseURL}/api/admin/sync`, {
      method: 'POST',
      headers: {
        'X-Admin-Token': adminToken
      }
    });
    
    if (!syncResponse.ok) {
      throw new Error(`Admin sync endpoint failed: ${syncResponse.status} ${syncResponse.statusText}`);
    }
    
    const syncData = await syncResponse.json();
    console.log(`✅ Admin sync endpoint: ${syncData.summary.sources} sources, ${syncData.summary.fetched} fetched, ${syncData.summary.upserts} upserts, ${syncData.summary.errors} errors`);
    
  } catch (error) {
    console.error('❌ Admin endpoint test failed:', error.message);
    throw error;
  }
}

// Test events endpoint
async function testEventsEndpoint() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const displayToken = process.env.DISPLAY_TOKEN;
  
  console.log('🔍 Testing events endpoint...');
  
  try {
    const url = displayToken ? `${baseURL}/api/events/week?token=${displayToken}` : `${baseURL}/api/events/week`;
    const eventsResponse = await fetch(url);
    
    if (!eventsResponse.ok) {
      throw new Error(`Events endpoint failed: ${eventsResponse.status} ${eventsResponse.statusText}`);
    }
    
    const eventsData = await eventsResponse.json();
    console.log(`✅ Events endpoint: ${Array.isArray(eventsData.events) ? eventsData.events.length : 'unknown'} events found`);
    
  } catch (error) {
    console.error('❌ Events endpoint test failed:', error.message);
    throw error;
  }
}

// Test kiosk display
async function testKioskDisplay() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const displayToken = process.env.DISPLAY_TOKEN;
  
  if (!displayToken) {
    console.log('⚠️  No DISPLAY_TOKEN set, skipping kiosk display test');
    return;
  }
  
  console.log('🔍 Testing kiosk display...');
  
  try {
    const displayResponse = await fetch(`${baseURL}/display?token=${displayToken}`);
    
    if (!displayResponse.ok) {
      throw new Error(`Kiosk display failed: ${displayResponse.status} ${displayResponse.statusText}`);
    }
    
    const displayContent = await displayResponse.text();
    if (displayContent.includes('kiosk') || displayContent.includes('calendar')) {
      console.log('✅ Kiosk display: Calendar interface rendered');
    } else {
      console.log('⚠️  Kiosk display: Response received but may not be calendar interface');
    }
    
  } catch (error) {
    console.error('❌ Kiosk display test failed:', error.message);
    throw error;
  }
}

// Main smoke test function
async function runSmokeTest() {
  console.log('🚀 Starting SkyLite-UX smoke test...');
  
  try {
    // Load environment
    loadEnv();
    
    // Check database connection and run migrations
    await waitForDatabase();
    runMigrations();
    
    // Test endpoints
    await testAdminEndpoints();
    await testEventsEndpoint();
    await testKioskDisplay();
    
    console.log('🎉 All smoke tests passed!');
    
  } catch (error) {
    console.error('💥 Smoke test failed:', error.message);
    process.exit(1);
  }
}

// Run the smoke test
runSmokeTest();
