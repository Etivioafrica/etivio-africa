// Browser uploads: ask the server for a signed link, PUT the file straight to R2 (with progress), then have the
// server check it and move it into place. Throws an Error with a message that can be shown to the person.

export type Uploaded = { url: string; key: string; name: string; size: number; type: string };
export type UploadKind = "cover" | "avatar" | "banner" | "blog" | "video" | "document" | "product" | "post";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) throw new Error("Network error during upload. Check your connection and try again.");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed. Try again.");
  return data as T;
}

function put(url: string, file: Blob, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Try again.")));
    xhr.onerror = () => reject(new Error("Network error during upload. Check your connection and try again."));
    xhr.send(file);
  });
}

// `onProgress` gets 0-100 while bytes are sent; `onChecking` fires once they're all sent and the server is checking.
export async function uploadFile(kind: UploadKind, file: Blob, name: string, { onProgress, onChecking }: { onProgress?: (percent: number) => void; onChecking?: () => void } = {}) {
  const { key, url } = await post<{ key: string; url: string }>("/api/upload/sign", { kind, name, size: file.size });
  await put(url, file, onProgress);
  onChecking?.();
  return post<Uploaded>("/api/upload/finish", { kind, key, name });
}
