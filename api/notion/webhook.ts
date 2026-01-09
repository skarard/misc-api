/**
 * Notion webhook endpoint
 * Handles page updates from Notion and syncs to Keep
 */
import { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyNotionWebhook, getNotionPage } from "../../lib/notion-client";
import { upsertKeepNote } from "../../lib/keep-client";
import { notionToKeep } from "../../lib/mapping";
import {
  getMapping,
  upsertMapping,
  shouldSkipDueToCooldown,
} from "../../lib/sync-state";
import { SyncMapping } from "../../lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify webhook signature
    const signature = req.headers["notion-signature"] as string;
    const webhookSecret = process.env.NOTION_WEBHOOK_SECRET!;

    console.log("=== Webhook Debug Info ===");
    console.log("Signature received:", signature);
    console.log("Webhook secret (from env):", webhookSecret);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("========================");

    if (!signature) {
      return res.status(401).json({ error: "Missing signature" });
    }

    const body = JSON.stringify(req.body);
    const isValid = verifyNotionWebhook(body, signature, webhookSecret);

    if (!isValid) {
      console.log("❌ Signature verification FAILED");
      return res.status(401).json({ error: "Invalid signature" });
    }

    console.log("✅ Signature verification SUCCESS");

    // Parse the webhook payload
    const payload = req.body;

    // Only handle page events
    if (payload.object !== "page") {
      return res.status(200).json({ message: "Not a page event, skipping" });
    }

    const pageId = payload.id;
    const eventType = payload.type;

    console.log(`Notion webhook: ${eventType} for page ${pageId}`);

    // Handle deletions
    if (eventType === "page_deleted") {
      // You could delete the Keep note here if desired
      // For now, we'll just skip it
      return res.status(200).json({ message: "Page deleted, skipping" });
    }

    // Fetch the full page content
    const page = await getNotionPage(pageId);

    // Check if we have an existing mapping
    const existingMapping = await getMapping(pageId);

    // Check cooldown to prevent loops
    if (shouldSkipDueToCooldown(existingMapping, "notion")) {
      console.log(`Skipping page ${pageId} due to cooldown`);
      return res.status(200).json({ message: "Skipped due to cooldown" });
    }

    // Convert Notion page to Keep note
    const keepNote = notionToKeep(page);

    // Upsert to Keep
    const savedNote = await upsertKeepNote(
      existingMapping?.keepNoteName || null,
      keepNote
    );

    console.log(`Synced to Keep: ${savedNote.name}`);

    // Update mapping
    const mapping: SyncMapping = {
      notionPageId: pageId,
      keepNoteName: savedNote.name!,
      lastSyncedNotionEditedTime: page.last_edited_time,
      lastSyncedKeepUpdateTime: savedNote.updateTime!,
      lastWriteOrigin: "notion",
      lastWriteTimestamp: Date.now(),
    };

    await upsertMapping(mapping);

    return res.status(200).json({
      success: true,
      message: "Synced to Keep",
      keepNoteName: savedNote.name,
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
