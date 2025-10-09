/**
 * Calendar Write Quota Manager
 * Manages per-source write quotas and retry logic for CalDAV operations
 */

import { consola } from 'consola';

interface QuotaBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per second
}

export class QuotaManager {
  private buckets = new Map<string, QuotaBucket>();
  private readonly defaultMaxTokens = 30; // 30 writes per minute
  private readonly defaultRefillRate = 0.5; // 0.5 tokens per second (30 per minute)

  /**
   * Check if a source has quota available for a write operation
   */
  canWrite(sourceId: string): boolean {
    const bucket = this.getBucket(sourceId);
    this.refillBucket(bucket);
    return bucket.tokens >= 1;
  }

  /**
   * Consume a token for a write operation
   */
  consumeToken(sourceId: string): boolean {
    const bucket = this.getBucket(sourceId);
    this.refillBucket(bucket);
    
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      consola.debug(`Quota: Consumed token for source ${sourceId}, ${bucket.tokens} remaining`);
      return true;
    }
    
    return false;
  }

  /**
   * Get remaining tokens for a source
   */
  getRemainingTokens(sourceId: string): number {
    const bucket = this.getBucket(sourceId);
    this.refillBucket(bucket);
    return bucket.tokens;
  }

  /**
   * Get or create a quota bucket for a source
   */
  private getBucket(sourceId: string): QuotaBucket {
    if (!this.buckets.has(sourceId)) {
      this.buckets.set(sourceId, {
        tokens: this.defaultMaxTokens,
        lastRefill: Date.now(),
        maxTokens: this.defaultMaxTokens,
        refillRate: this.defaultRefillRate
      });
    }
    
    return this.buckets.get(sourceId)!;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillBucket(bucket: QuotaBucket): void {
    const now = Date.now();
    const timeElapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = timeElapsed * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Clean up old buckets (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sourceId, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(sourceId);
        consola.debug(`Quota: Cleaned up old bucket for source ${sourceId}`);
      }
    }
  }
}

/**
 * Retry logic for CalDAV operations
 */
export class RetryManager {
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second
  private readonly maxDelay = 10000; // 10 seconds

  /**
   * Execute an operation with exponential backoff retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    sourceId: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          consola.info(`Retry: ${operationName} succeeded on attempt ${attempt} for source ${sourceId}`);
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on 4xx errors (except 409 which should bubble up)
        if (this.isClientError(error)) {
          if (error instanceof Error && error.message.includes('409')) {
            throw error; // Conflict errors should bubble up immediately
          }
          throw error; // Don't retry client errors
        }
        
        if (attempt === this.maxRetries) {
          consola.error(`Retry: ${operationName} failed after ${this.maxRetries} attempts for source ${sourceId}:`, error);
          throw error;
        }
        
        const delay = Math.min(this.baseDelay * Math.pow(2, attempt - 1), this.maxDelay);
        consola.warn(`Retry: ${operationName} failed on attempt ${attempt} for source ${sourceId}, retrying in ${delay}ms:`, error);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError || new Error('Retry failed');
  }

  /**
   * Check if an error is a client error (4xx)
   */
  private isClientError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('400') || 
             message.includes('401') || 
             message.includes('403') || 
             message.includes('404') || 
             message.includes('409') ||
             message.includes('412') ||
             message.includes('422');
    }
    return false;
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global instances
export const quotaManager = new QuotaManager();
export const retryManager = new RetryManager();

// Cleanup old buckets every hour
setInterval(() => {
  quotaManager.cleanup();
}, 60 * 60 * 1000);
