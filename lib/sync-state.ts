/**
 * Sync state management using Vercel KV
 */
import { kv } from "@vercel/kv";
import { SyncMapping, SyncState } from "./types";

const SYNC_STATE_KEY = "sync:state";
const MAPPING_KEY_PREFIX = "sync:mapping:";

/**
 * Get the global sync state
 */
export async function getSyncState(): Promise<SyncState> {
  const state = await kv.get<SyncState>(SYNC_STATE_KEY);
  return (
    state || {
      lastPolledAt: 0,
      mappings: {},
    }
  );
}

/**
 * Update the last polled timestamp
 */
export async function updateLastPolled(timestamp: number): Promise<void> {
  const state = await getSyncState();
  state.lastPolledAt = timestamp;
  await kv.set(SYNC_STATE_KEY, state);
}

/**
 * Get mapping by Notion page ID
 */
export async function getMapping(
  notionPageId: string
): Promise<SyncMapping | null> {
  const mapping = await kv.get<SyncMapping>(
    `${MAPPING_KEY_PREFIX}${notionPageId}`
  );
  return mapping;
}

/**
 * Get mapping by Keep note name
 */
export async function getMappingByKeepName(
  keepNoteName: string
): Promise<SyncMapping | null> {
  const state = await getSyncState();
  const notionPageId = Object.keys(state.mappings).find(
    (id) => state.mappings[id].keepNoteName === keepNoteName
  );

  if (!notionPageId) {
    return null;
  }

  return getMapping(notionPageId);
}

/**
 * Get all mappings
 */
export async function getAllMappings(): Promise<SyncMapping[]> {
  const state = await getSyncState();
  return Object.values(state.mappings);
}

/**
 * Create or update a mapping
 */
export async function upsertMapping(mapping: SyncMapping): Promise<void> {
  // Update individual mapping
  await kv.set(`${MAPPING_KEY_PREFIX}${mapping.notionPageId}`, mapping);

  // Update global state index
  const state = await getSyncState();
  state.mappings[mapping.notionPageId] = mapping;
  await kv.set(SYNC_STATE_KEY, state);
}

/**
 * Delete a mapping
 */
export async function deleteMapping(notionPageId: string): Promise<void> {
  await kv.del(`${MAPPING_KEY_PREFIX}${notionPageId}`);

  const state = await getSyncState();
  delete state.mappings[notionPageId];
  await kv.set(SYNC_STATE_KEY, state);
}

/**
 * Check if we should skip a change based on cooldown period
 */
export function shouldSkipDueToCooldown(
  mapping: SyncMapping | null,
  origin: "notion" | "keep",
  cooldownMs: number = 30000
): boolean {
  if (!mapping) {
    return false;
  }

  // If the last write was from the opposite origin, don't skip
  if (mapping.lastWriteOrigin !== origin) {
    return false;
  }

  // Check if we're within the cooldown window
  const now = Date.now();
  const timeSinceLastWrite = now - mapping.lastWriteTimestamp;

  return timeSinceLastWrite < cooldownMs;
}
