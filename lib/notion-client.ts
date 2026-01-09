/**
 * Notion API client with webhook verification
 */
import { Client } from "@notionhq/client";
import crypto from "crypto";
import { NotionPage } from "./types";

/**
 * Initialize Notion client
 */
export function getNotionClient(): Client {
  return new Client({
    auth: process.env.NOTION_API_KEY,
  });
}

/**
 * Verify Notion webhook signature
 */
export function verifyNotionWebhook(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expectedSignature = hmac.digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Get a Notion page by ID
 */
export async function getNotionPage(pageId: string): Promise<NotionPage> {
  const notion = getNotionClient();
  const page = await notion.pages.retrieve({ page_id: pageId });
  return page as NotionPage;
}

/**
 * Update a Notion page
 */
export async function updateNotionPage(
  pageId: string,
  properties: any
): Promise<NotionPage> {
  const notion = getNotionClient();
  const page = await notion.pages.update({
    page_id: pageId,
    properties,
  });
  return page as NotionPage;
}

/**
 * Create a new page in a database
 */
export async function createNotionPage(
  databaseId: string,
  properties: any
): Promise<NotionPage> {
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  });
  return page as NotionPage;
}

/**
 * Query database for all pages
 */
export async function queryNotionDatabase(
  databaseId: string
): Promise<NotionPage[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: databaseId,
  });
  return response.results as NotionPage[];
}

/**
 * Extract title from Notion page properties
 */
export function extractNotionTitle(page: NotionPage): string {
  // Find the title property
  const titleProp = Object.values(page.properties).find(
    (prop: any) => prop.type === "title"
  ) as any;

  if (!titleProp || !titleProp.title || titleProp.title.length === 0) {
    return "";
  }

  return titleProp.title.map((t: any) => t.plain_text).join("");
}

/**
 * Extract rich text from a property
 */
export function extractRichText(property: any): string {
  if (!property || !property.rich_text) {
    return "";
  }
  return property.rich_text.map((t: any) => t.plain_text).join("");
}

/**
 * Extract select value from a property
 */
export function extractSelect(property: any): string | null {
  if (!property || !property.select) {
    return null;
  }
  return property.select.name;
}

/**
 * Extract multi-select values from a property
 */
export function extractMultiSelect(property: any): string[] {
  if (!property || !property.multi_select) {
    return [];
  }
  return property.multi_select.map((s: any) => s.name);
}

/**
 * Extract checkbox value from a property
 */
export function extractCheckbox(property: any): boolean {
  if (!property || property.type !== "checkbox") {
    return false;
  }
  return property.checkbox;
}
