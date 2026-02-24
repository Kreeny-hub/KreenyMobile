import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";

// Upload une image/vidéo locale (uri) vers Convex File Storage et retourne storageId
export async function uploadToConvexStorage(
  convex: ConvexReactClient,
  file: { uri: string; mimeType: string; name: string }
): Promise<string> {
  const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});

  // ✅ FIX : Envoyer le blob brut avec Content-Type explicite
  // (FormData encapsule dans du multipart, ce qui corrompt le fichier dans Convex Storage)
  const fileResp = await fetch(file.uri);
  const blob = await fileResp.blob();

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.mimeType },
    body: blob,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return String(json.storageId);
}