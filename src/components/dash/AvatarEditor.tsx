"use client";
import { useRef, useState } from "react";
import { AVATAR_FACES, defaultAvatar, isAvatarFace } from "@/lib/avatars";
import { Camera, Check } from "lucide-react";
import { saveAvatar } from "@/app/(app)/settings/actions";
import { CropUpload, type CropUploadHandle } from "./CropUpload";

// Profile photo with the crop modal. `variant="banner"` is the big tile on the settings banner;
// `variant="row"` is the preview + buttons in My details.
export function AvatarEditor({ url, initial, seed, variant }: { url: string | null; initial: string; seed?: string; variant: "banner" | "row" }) {
  // No photo yet: their character face (see lib/avatars), or the initial if there's nothing to pick one from.
  const fallback = seed?.trim() ? defaultAvatar(seed) : null;
  const modal = useRef<CropUploadHandle>(null);
  const [removing, setRemoving] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const isFace = isAvatarFace(url);
  const pick = async (face: string | null) => {
    setPicking(face ?? "auto");
    await saveAvatar(face);
    setPicking(null);
  };
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
          {url ? <img src={url} alt="" /> : fallback ? <img src={fallback} alt="" /> : initial}
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
        {url ? <img src={url} alt="" /> : fallback ? <img src={fallback} alt="" /> : <span>{initial}</span>}
      </button>
      <div className="et-upload-avatar-side">
        <div className="et-inline">
          <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={open}>
            <Camera size={14} />
            {url && !isFace ? "Change photo" : "Upload photo"}
          </button>
          {url && !isFace && (
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
        <div className="et-face-pick">
          <div className="et-face-pick-head">
            <span>Or pick a character</span>
            {isFace && (
              <button type="button" className="et-face-auto" disabled={!!picking} onClick={() => pick(null)}>
                {picking === "auto" ? "Saving…" : "Use automatic"}
              </button>
            )}
          </div>
          <div role="radiogroup" aria-label="Character avatar">
            {AVATAR_FACES.map((face, i) => {
              const on = url === face;
              return (
                <button key={face} type="button" role="radio" aria-checked={on} aria-label={`Character ${i + 1}`} className={on ? "is-on" : ""} disabled={!!picking} onClick={() => pick(face)}>
                  <img src={face} alt="" />
                  {on && (
                    <i>
                      <Check size={11} strokeWidth={3} />
                    </i>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {cropper}
    </div>
  );
}
