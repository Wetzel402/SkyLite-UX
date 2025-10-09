import { consola } from "consola";
import { createError, defineEventHandler } from "h3";

// Simple in-memory rate limiter for kiosk endpoints
// Uses token bucket algorithm with LRU cleanup

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  lastAccess: number;
}

class KioskRateLimiter {
  private buckets = new Map<string, RateLimitEntry>();
  private maxSize = 1000; // Maximum number of IPs to track
  private refillRate = 1; // tokens per second
  private maxTokens = 60; // maximum tokens (60 requests per minute)
  private cleanupInterval = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  private cleanup() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [key, entry] of this.buckets.entries()) {
      if (now - entry.lastAccess > maxAge) {
        this.buckets.delete(key);
      }
    }

    // If we still have too many entries, remove oldest
    if (this.buckets.size > this.maxSize) {
      const entries = Array.from(this.buckets.entries());
      entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      
      const toRemove = entries.slice(0, this.buckets.size - this.maxSize);
      for (const [key] of toRemove) {
        this.buckets.delete(key);
      }
    }

    consola.debug(`Kiosk Rate Limit: Cleaned up, ${this.buckets.size} active buckets`);
  }

  private refillTokens(entry: RateLimitEntry): number {
    const now = Date.now();
    const timePassed = (now - entry.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    entry.tokens = Math.min(this.maxTokens, entry.tokens + tokensToAdd);
    entry.lastRefill = now;
    
    return entry.tokens;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    let entry = this.buckets.get(key);

    if (!entry) {
      entry = {
        tokens: this.maxTokens,
        lastRefill: now,
        lastAccess: now
      };
      this.buckets.set(key, entry);
    }

    // Refill tokens based on time passed
    this.refillTokens(entry);
    entry.lastAccess = now;

    if (entry.tokens >= 1) {
      entry.tokens -= 1;
      return true;
    }

    return false;
  }

  getRemainingTokens(key: string): number {
    const entry = this.buckets.get(key);
    if (!entry) return this.maxTokens;
    
    this.refillTokens(entry);
    return Math.floor(entry.tokens);
  }
}

const rateLimiter = new KioskRateLimiter();

export default defineEventHandler(async (event) => {
  const url = event.node.req.url || '';
  
  // Only apply to kiosk API endpoints
  if (!url.startsWith('/api/events/week')) {
    return;
  }

  // Check if this is a kiosk request
  if (!event.context.kioskMode) {
    return;
  }

  // Get client identifier (IP or token)
  const clientIP = event.node.req.headers['x-forwarded-for'] || 
                   event.node.req.headers['x-real-ip'] || 
                   event.node.req.connection?.remoteAddress || 
                   'unknown';
  const displayToken = event.context.displayToken;
  
  // Use token as identifier if available, otherwise use IP
  const identifier = displayToken ? `token:${displayToken}` : `ip:${clientIP}`;

  if (!rateLimiter.isAllowed(identifier)) {
    const remaining = rateLimiter.getRemainingTokens(identifier);
    
    consola.warn(`Kiosk Rate Limit: Rate limit exceeded for ${identifier}`);
    
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      data: {
        retryAfter: 60, // seconds
        remaining: remaining
      }
    });
  }

  const remaining = rateLimiter.getRemainingTokens(identifier);
  consola.debug(`Kiosk Rate Limit: ${remaining} requests remaining for ${identifier}`);
});
