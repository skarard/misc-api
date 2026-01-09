/**
 * Google Keep API client with OAuth token management
 */
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { KeepNote } from "./types";

const KEEP_API_ENDPOINT = "https://keep.googleapis.com/v1";

/**
 * Initialize OAuth2 client with stored refresh token
 */
export function getKeepOAuthClient(): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob" // For server-to-server
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

/**
 * Get a fresh access token
 */
async function getAccessToken(): Promise<string> {
  const oauth2Client = getKeepOAuthClient();
  const { token } = await oauth2Client.getAccessToken();

  if (!token) {
    throw new Error("Failed to get access token");
  }

  return token;
}

/**
 * Make an authenticated request to Keep API
 */
async function keepRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: any
): Promise<any> {
  const accessToken = await getAccessToken();

  const url = `${KEEP_API_ENDPOINT}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Keep API error: ${response.status} ${error}`);
  }

  // Handle empty responses (e.g., DELETE)
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

/**
 * List all notes
 */
export async function listKeepNotes(
  pageSize: number = 100
): Promise<KeepNote[]> {
  const response = await keepRequest("GET", `/notes?pageSize=${pageSize}`);
  return response.notes || [];
}

/**
 * Get a specific note by name
 */
export async function getKeepNote(noteName: string): Promise<KeepNote> {
  return await keepRequest("GET", `/${noteName}`);
}

/**
 * Create a new note
 */
export async function createKeepNote(
  note: Partial<KeepNote>
): Promise<KeepNote> {
  return await keepRequest("POST", "/notes", note);
}

/**
 * Update an existing note
 */
export async function updateKeepNote(
  noteName: string,
  note: Partial<KeepNote>
): Promise<KeepNote> {
  // For PATCH, we need to specify update mask
  const updateMask = Object.keys(note).join(",");
  return await keepRequest(
    "PATCH",
    `/${noteName}?updateMask=${updateMask}`,
    note
  );
}

/**
 * Delete a note (move to trash)
 */
export async function deleteKeepNote(noteName: string): Promise<void> {
  await keepRequest("DELETE", `/${noteName}`);
}

/**
 * Create or update a Keep note (upsert)
 */
export async function upsertKeepNote(
  existingNoteName: string | null,
  note: Partial<KeepNote>
): Promise<KeepNote> {
  if (existingNoteName) {
    return await updateKeepNote(existingNoteName, note);
  } else {
    return await createKeepNote(note);
  }
}
