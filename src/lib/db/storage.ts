"use client";

import { getSupabase } from "@/lib/supabase";

const BUCKET = "idea-files";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export type UploadedFile = {
  path: string;
  name: string;
  size: number;
  mimeType: string;
};

function safeName(name: string): string {
  // Strip path separators and reduce to safe chars while keeping the extension.
  return name
    .replace(/[\\\/]/g, "_")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 120);
}

export async function uploadIdeaFile(
  file: File,
  userId: string,
): Promise<UploadedFile> {
  const ext = file.name.includes(".") ? "" : "";
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const cleanName = safeName(file.name) + ext;
  const path = `${userId}/${id}_${cleanName}`;

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;

  return {
    path,
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

export async function getIdeaFileUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("[storage signed url]", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function deleteIdeaFile(path: string): Promise<void> {
  const { error } = await getSupabase().storage.from(BUCKET).remove([path]);
  if (error) console.error("[storage delete]", error);
}

export function isImage(mimeType: string | undefined): boolean {
  return !!mimeType && mimeType.startsWith("image/");
}

export function isPdf(mimeType: string | undefined): boolean {
  return mimeType === "application/pdf";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
