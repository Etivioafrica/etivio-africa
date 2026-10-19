"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { saveAvatar } from "@/app/(app)/settings/actions";
import { CropUpload, type CropUploadHandle } from "./CropUpload";

// Profile photo with the crop modal. `variant="banner"` is the big tile on the settings banner;
// `variant="row"` is the preview + buttons in My details.
export function AvatarEditor({ url, initial, variant }: { url: string | null; initial: string; variant: "banner" | "row" }) {
  const modal = useRef<CropUploadHandle>(null);
  const [removing, setRemoving] = useState(false);
  const open = () => modal.current?.open();

  const cropper = (
    <CropUpload
      ref={modal}
      kind="avatar"
      out={{ width: 512, height: 512 }}
      minZoom={0.5}
      round
      title={url ? "Change profile photo" : "Add a profile photo"}
      hint="A clear, front-facing photo works best. Square, at least 400 × 400 px."
      confirmLabel="Save photo"
      onUploaded={saveAvatar}
    />
  );

  /* eslint-disable @next/next/no-img-element */
  if (variant === "banner")
    return (
      <>
        <button type="button" className="et-set-avatar et-avatar-edit" onClick={open} aria-label={url ? "Change profile photo" : "Add profile photo"}>
          {url ? <img src={url} alt="" /> : initial}
          <span className="et-avatar-cam">
            <Camera size={18} />
          </span>
        </button>
        {cropper}
      </>
    );

  return (
    <div className="et-upload-avatar">
      <button type="button" className="et-upload-avatar-img" onClick={open} aria-label="Change profile photo">
        {url ? <img src={url} alt="" /> : <span>{initial}</span>}
      </button>
      <div className="et-upload-avatar-side">
        <div className="et-inline">
          <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={open}>
            <Camera size={14} />
            {url ? "Change photo" : "Upload photo"}
          </button>
          {url && (
            <button
              type="button"
              className="et-btn et-btn-danger-text et-btn-sm"
              disabled={removing}
              onClick={async () => {
                setRemoving(true);
                await saveAvatar(null);
                setRemoving(false);
              }}
            >
              Remove
            </button>
          )}
        </div>
        <small>Crop and position it in the next step. Saved as a small WebP.</small>
      </div>
      {cropper}
    </div>
  );
}
