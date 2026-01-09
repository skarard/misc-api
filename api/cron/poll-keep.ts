/**
 * Keep polling cron job endpoint
 * Polls Keep for changes and syncs to Notion
 */
import { VercelRequest, VercelResponse } from "@vercel/node";
import { listKeepNotes } from "../../lib/keep-client";
import {
  getNotionPage,
  updateNotionPage,
  createNotionPage,
} from "../../lib/notion-client";
import { keepToNotion, buildDefaultNotionProperties } from "../../lib/mapping";
import {
  getAllMappings,
  getMappingByKeepName,
  upsertMapping,
  updateLastPolled,
  shouldSkipDueToCooldown,
} from "../../lib/sync-state";
import { SyncMapping } from "../../lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify cron secret (optional but recommended)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    // In development, this header might not be present
    // So we only enforce it in production
    if (process.env.NODE_ENV === "production" && authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    console.log("Starting Keep polling job...");

    // Get all Keep notes
    const notes = await listKeepNotes();
    console.log(`Found ${notes.length} Keep notes`);

    const databaseId = process.env.NOTION_DATABASE_ID!;
    let processed = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Process each note
    for (const note of notes) {
      try {
        // Skip trashed notes
        if (note.trashed) {
          continue;
        }

        // Skip notes without a name
        if (!note.name) {
          continue;
        }

        // Get existing mapping
        const existingMapping = await getMappingByKeepName(note.name);

        // Check cooldown to prevent loops
        if (shouldSkipDueToCooldown(existingMapping, "keep")) {
          console.log(`Skipping note ${note.name} due to cooldown`);
          skipped++;
          continue;
        }

        // Check if note has been updated since last sync
        if (existingMapping) {
          const lastSyncedTime = new Date(
            existingMapping.lastSyncedKeepUpdateTime
          ).getTime();
          const currentUpdateTime = new Date(note.updateTime!).getTime();

          if (currentUpdateTime <= lastSyncedTime) {
            // Note hasn't changed
            skipped++;
            continue;
          }
        }

        // Convert Keep note to Notion properties
        const notionProps = keepToNotion(note);

        let notionPage;
        let notionPageId: string;

        if (existingMapping) {
          // Update existing Notion page
          notionPage = await updateNotionPage(
            existingMapping.notionPageId,
            notionProps
          );
          notionPageId = existingMapping.notionPageId;
          updated++;
          console.log(
            `Updated Notion page ${notionPageId} from Keep ${note.name}`
          );
        } else {
          // Create new Notion page
          // Use a default structure if keepToNotion returns empty properties
          const properties =
            Object.keys(notionProps).length > 0
              ? notionProps
              : buildDefaultNotionProperties(
                  note.title || "Untitled",
                  note.body?.text?.text || ""
                );

          notionPage = await createNotionPage(databaseId, properties);
          notionPageId = notionPage.id;
          created++;
          console.log(
            `Created Notion page ${notionPageId} from Keep ${note.name}`
          );
        }

        // Update mapping
        const mapping: SyncMapping = {
          notionPageId,
          keepNoteName: note.name,
          lastSyncedNotionEditedTime: notionPage.last_edited_time,
          lastSyncedKeepUpdateTime: note.updateTime!,
          lastWriteOrigin: "keep",
          lastWriteTimestamp: Date.now(),
        };

        await upsertMapping(mapping);
        processed++;
      } catch (error: any) {
        console.error(`Error processing note ${note.name}:`, error);
        errors.push({
          id: note.name || "unknown",
          error: error.message,
        });
      }
    }

    // Update last polled timestamp
    await updateLastPolled(Date.now());

    console.log(
      `Keep polling complete: ${processed} processed, ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors`
    );

    return res.status(200).json({
      success: true,
      message: "Keep polling complete",
      details: {
        processed,
        created,
        updated,
        skipped,
        errors,
      },
    });
  } catch (error: any) {
    console.error("Polling error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
