"use client";
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { saveCover } from "@/app/(app)/settings/actions";
import { CropUpload, type CropUploadHandle } from "./CropUpload";

// Profile banner with the add/change cover modal. Without an image it falls back to the brand-blue cover.
export function CoverEditor({ url }: { url: string | null }) {
  const modal = useRef<CropUploadHandle>(null);
  const [removing, setRemoving] = useState(false);

  return (
    <div className={`et-set-cover${url ? " has-img" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" />}
      <div className="et-cover-tools">
        <button type="button" className="et-cover-btn" onClick={() => modal.current?.open()}>
          <ImagePlus size={14} />
          {url ? "Change cover" : "Add cover"}
        </button>
        {url && (
          <button
            type="button"
            className="et-cover-btn"
            disabled={removing}
            aria-label="Remove cover"
            onClick={async () => {
              setRemoving(true);
              await saveCover(null);
              setRemoving(false);
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <CropUpload
        ref={modal}
        kind="banner"
        out={{ width: 1600, height: 400 }}
        title={url ? "Change cover image" : "Add a cover image"}
        hint="Recommended 1600 × 400 px (4:1) or larger. JPG, PNG, or WebP, up to 20 MB."
        confirmLabel={url ? "Save cover" : "Add cover"}
        onUploaded={saveCover}
      />
    </div>
  );
}
