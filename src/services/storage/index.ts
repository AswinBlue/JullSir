import { IQueueRepository } from './queueRepository';
import { isSupabaseConfigured } from '../supabase/client';
import { MockQueueRepository } from './mockQueueRepository';
import { SupabaseQueueRepository } from './supabaseQueueRepository';

export * from './queueRepository';
export * from './mockQueueRepository';
export * from './supabaseQueueRepository';

function createQueueRepository(): IQueueRepository {
  if (isSupabaseConfigured()) {
    try {
      console.info('[JullSir] Connecting to live Supabase cloud backend.');
      return new SupabaseQueueRepository();
    } catch (err) {
      console.warn('[JullSir] Failed to initialize Supabase repository, falling back to local storage:', err);
      return new MockQueueRepository();
    }
  }

  return new MockQueueRepository();
}

export const queueRepository: IQueueRepository = createQueueRepository();
