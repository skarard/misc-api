/**
 * Data mapping utilities for converting between Notion and Keep formats
 */
import { NotionPage, KeepNote } from "./types";
import {
  extractNotionTitle,
  extractRichText,
  extractMultiSelect,
  extractCheckbox,
} from "./notion-client";

/**
 * Convert a Notion page to a Keep note
 */
export function notionToKeep(page: NotionPage): Partial<KeepNote> {
  const title = extractNotionTitle(page);

  // Build body from other properties
  const bodyParts: string[] = [];

  // Extract text fields (you can customize this based on your database schema)
  for (const [key, value] of Object.entries(page.properties)) {
    if (value.type === "rich_text") {
      const text = extractRichText(value);
      if (text) {
        bodyParts.push(`${key}: ${text}`);
      }
    }
  }

  const note: Partial<KeepNote> = {
    title: title || "Untitled",
  };

  // Determine if we should use a checklist or plain text
  const hasCheckboxes = Object.values(page.properties).some(
    (prop: any) => prop.type === "checkbox"
  );

  if (hasCheckboxes) {
    // Create a checklist
    const listItems = [];

    for (const [key, value] of Object.entries(page.properties)) {
      if (value.type === "checkbox") {
        listItems.push({
          text: { text: key },
          checked: extractCheckbox(value),
        });
      }
    }

    note.body = {
      list: { listItems },
    };
  } else {
    // Create plain text note
    note.body = {
      text: {
        text: bodyParts.join("\n\n"),
      },
    };
  }

  return note;
}

/**
 * Convert a Keep note to Notion page properties
 */
export function keepToNotion(note: KeepNote): any {
  const properties: any = {};

  // Set title
  if (note.title) {
    properties.Name = {
      title: [
        {
          text: {
            content: note.title,
          },
        },
      ],
    };
  }

  // Handle body content
  if (note.body?.text?.text) {
    // Parse plain text body and try to extract structured data
    const lines = note.body.text.text.split("\n\n");

    for (const line of lines) {
      const match = line.match(/^(.+?):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        properties[key] = {
          rich_text: [
            {
              text: {
                content: value,
              },
            },
          ],
        };
      }
    }
  } else if (note.body?.list?.listItems) {
    // Handle checklist items
    for (const item of note.body.list.listItems) {
      const key = item.text.text;
      properties[key] = {
        checkbox: item.checked,
      };
    }
  }

  return properties;
}

/**
 * Build a simple default mapping for a basic Notion database
 * This creates a structure with Title and Notes fields
 */
export function buildDefaultNotionProperties(
  title: string,
  content: string
): any {
  return {
    Name: {
      title: [
        {
          text: {
            content: title,
          },
        },
      ],
    },
    Notes: {
      rich_text: [
        {
          text: {
            content: content,
          },
        },
      ],
    },
  };
}

/**
 * Extract simple content from Keep note for debugging/logging
 */
export function getKeepNoteContent(note: KeepNote): string {
  if (note.body?.text?.text) {
    return note.body.text.text;
  } else if (note.body?.list?.listItems) {
    return note.body.list.listItems
      .map((item) => `${item.checked ? "✓" : "○"} ${item.text.text}`)
      .join("\n");
  }
  return "";
}

/**
 * Extract note ID from Keep note name (notes/{id})
 */
export function extractKeepNoteId(noteName: string): string {
  return noteName.replace("notes/", "");
}

/**
 * Build Keep note name from ID
 */
export function buildKeepNoteName(noteId: string): string {
  return `notes/${noteId}`;
}
