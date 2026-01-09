/**
 * Internal sync endpoint
 * Manually trigger sync operations for testing, backfill, or repair
 */
import { VercelRequest, VercelResponse } from "@vercel/node";
import { listKeepNotes } from "../../lib/keep-client";
import { queryNotionDatabase } from "../../lib/notion-client";
import {
  getAllMappings,
  getMappingByKeepName,
  getMapping,
} from "../../lib/sync-state";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify internal API key
  const apiKey = req.headers["x-api-key"] as string;
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { action } = req.body;

    switch (action) {
      case "status":
        return await handleStatus(req, res);

      case "list-mappings":
        return await handleListMappings(req, res);

      case "force-sync":
        return await handleForceSync(req, res);

      default:
        return res.status(400).json({
          error: "Invalid action",
          validActions: ["status", "list-mappings", "force-sync"],
        });
    }
  } catch (error: any) {
    console.error("Internal sync error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}

/**
 * Get sync status and statistics
 */
async function handleStatus(req: VercelRequest, res: VercelResponse) {
  const mappings = await getAllMappings();
  const keepNotes = await listKeepNotes();
  const notionPages = await queryNotionDatabase(
    process.env.NOTION_DATABASE_ID!
  );

  return res.status(200).json({
    success: true,
    status: {
      mappings: mappings.length,
      keepNotes: keepNotes.length,
      notionPages: notionPages.length,
      unmappedKeep: keepNotes.length - mappings.length,
      unmappedNotion: notionPages.length - mappings.length,
    },
  });
}

/**
 * List all current mappings
 */
async function handleListMappings(req: VercelRequest, res: VercelResponse) {
  const mappings = await getAllMappings();

  return res.status(200).json({
    success: true,
    mappings: mappings.map((m) => ({
      notionPageId: m.notionPageId,
      keepNoteName: m.keepNoteName,
      lastSyncedNotionTime: m.lastSyncedNotionEditedTime,
      lastSyncedKeepTime: m.lastSyncedKeepUpdateTime,
      lastWriteOrigin: m.lastWriteOrigin,
      lastWriteTimestamp: new Date(m.lastWriteTimestamp).toISOString(),
    })),
  });
}

/**
 * Force a full sync (ignoring cooldowns)
 */
async function handleForceSync(req: VercelRequest, res: VercelResponse) {
  const { direction } = req.body;

  if (
    !direction ||
    !["notion-to-keep", "keep-to-notion", "both"].includes(direction)
  ) {
    return res.status(400).json({
      error: "Invalid direction",
      validDirections: ["notion-to-keep", "keep-to-notion", "both"],
    });
  }

  // Note: This would require implementing the sync logic here
  // or calling the webhook/cron endpoints programmatically
  // For now, return a placeholder response

  return res.status(200).json({
    success: true,
    message: `Force sync initiated: ${direction}`,
    note: "This is a placeholder. Implement full sync logic as needed.",
  });
}
