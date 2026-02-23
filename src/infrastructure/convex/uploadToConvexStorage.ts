import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";

// Upload une image/vidéo locale (uri) vers Convex File Storage et retourne storageId
export async function uploadToConvexStorage(
  convex: ConvexReactClient,
  file: { uri: string; mimeType: string; name: string }
): Promise<string> {
  const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});

  const form = new FormData();
  form.append("file", {
    uri: file.uri,
    type: file.mimeType,
    name: file.name,
  } as any);

  const res = await fetch(uploadUrl, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return String(json.storageId);
}