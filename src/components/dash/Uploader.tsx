"use client";
import { useRef, useState } from "react";
import { FileUp, ImageIcon, Video, X } from "lucide-react";
import { formatBytes } from "@/lib/format";

export type Uploaded = { url: string; key: string; name: string; size: number; type: string };
type Kind = "cover" | "avatar" | "blog" | "video" | "document";

const ACCEPT: Record<Kind, string> = {
  cover: "image/*",
  avatar: "image/*",
  blog: "image/*",
  video: "video/*",
  document: "*/*",
};

// Uploads to R2 via /api/upload and writes the public URL into a hidden input named `name`.
// For documents it also fills `${name}_key`, `${name}_name`, `${name}_size`, `${name}_type`.
export function Uploader({
  name,
  kind,
  defaultUrl = "",
  label,
  onUploaded,
}: {
  name: string;
  kind: Kind;
  defaultUrl?: string | null;
  label?: string;
  onUploaded?: (file: Uploaded) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Uploaded | null>(defaultUrl ? { url: defaultUrl, key: "", name: "", size: 0, type: "" } : null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function upload(f: File) {
    setError(null);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload?kind=${kind}`);
    xhr.setRequestHeader("content-type", f.type || "application/octet-stream");
    xhr.setRequestHeader("x-file-name", encodeURIComponent(f.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let body: { error?: string } & Partial<Uploaded> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.url) {
        const done = body as Uploaded;
        setFile(done);
        onUploaded?.(done);
      } else setError(body.error ?? "Upload failed.");
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Network error during upload.");
    };
    xhr.send(f);
  }

  const isImage = kind === "cover" || kind === "avatar" || kind === "blog";
  const Icon = isImage ? ImageIcon : kind === "video" ? Video : FileUp;

  return (
    <div className="et-upload">
      <input type="hidden" name={name} value={file?.url ?? ""} />
      {kind === "document" && (
        <>
          <input type="hidden" name={`${name}_key`} value={file?.key ?? ""} />
          <input type="hidden" name={`${name}_name`} value={file?.name ?? ""} />
          <input type="hidden" name={`${name}_size`} value={file?.size ?? ""} />
          <input type="hidden" name={`${name}_type`} value={file?.type ?? ""} />
        </>
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT[kind]}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />

      {file?.url && isImage ? (
        <div className="et-upload-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.url} alt="" />
          <button type="button" className="et-upload-clear" onClick={() => setFile(null)} aria-label="Remove image">
            <X size={14} />
          </button>
        </div>
      ) : file?.url && kind === "video" ? (
        <div className="et-upload-preview">
          <video src={file.url} controls preload="metadata" />
          <button type="button" className="et-upload-clear" onClick={() => setFile(null)} aria-label="Remove video">
            <X size={14} />
          </button>
        </div>
      ) : file?.url ? (
        <div className="et-upload-file">
          <FileUp size={16} />
          <span>{file.name || file.url.split("/").pop()}</span>
          {file.size ? <small>{formatBytes(file.size)}</small> : null}
          <button type="button" onClick={() => setFile(null)} aria-label="Remove file">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`et-dropzone${dragging ? " is-drag" : ""}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          disabled={progress !== null}
        >
          <Icon size={20} strokeWidth={1.7} />
          <b>{progress !== null ? `Uploading… ${progress}%` : (label ?? "Click or drop a file to upload")}</b>
          {progress !== null && (
            <span className="et-progress" style={{ width: "100%" }}>
              <span style={{ width: `${progress}%` }} />
            </span>
          )}
        </button>
      )}
      {file?.url && progress === null && (
        <button type="button" className="et-upload-replace" onClick={() => input.current?.click()}>
          Replace
        </button>
      )}
      {error && <p className="et-upload-err">{error}</p>}
    </div>
  );
}
