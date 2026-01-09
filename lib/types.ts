/**
 * Type definitions for Notion <-> Google Keep sync
 */

// Notion types
export interface NotionPage {
  id: string;
  last_edited_time: string;
  properties: {
    [key: string]: any;
  };
}

export interface NotionWebhookPayload {
  object: "page" | "database";
  id: string;
  type: "page_updated" | "page_created" | "page_deleted";
}

// Google Keep types
export interface KeepNote {
  name: string; // Resource name: notes/{noteId}
  title?: string;
  body?: {
    text?: {
      text: string;
    };
    list?: {
      listItems: Array<{
        text: {
          text: string;
        };
        checked: boolean;
      }>;
    };
  };
  updateTime?: string;
  createTime?: string;
  trashed?: boolean;
}

// Sync state types
export interface SyncMapping {
  notionPageId: string;
  keepNoteName: string; // notes/{noteId}
  lastSyncedNotionEditedTime: string;
  lastSyncedKeepUpdateTime: string;
  lastWriteOrigin: "notion" | "keep";
  lastWriteTimestamp: number; // Unix timestamp in milliseconds
}

export interface SyncState {
  lastPolledAt: number; // Unix timestamp in milliseconds
  mappings: Record<string, SyncMapping>; // keyed by notionPageId
}

// Configuration
export interface SyncConfig {
  cooldownMs: number; // Default: 30000 (30 seconds)
  pollIntervalMinutes: number; // Default: 2 minutes
}

// API responses
export interface SyncResult {
  success: boolean;
  message: string;
  details?: {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{
      id: string;
      error: string;
    }>;
  };
}
