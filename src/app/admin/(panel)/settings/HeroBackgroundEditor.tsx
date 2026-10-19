"use client";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, RotateCcw } from "lucide-react";
import { CropUpload, type CropUploadHandle } from "@/components/dash/CropUpload";
import { setHeroBackground } from "./actions";

// Banner background picker: crop modal (drag, zoom, WebP) plus reset to the built-in default.
export function HeroBackgroundEditor({ current }: { current: string | null }) {
  const modal = useRef<CropUploadHandle>(null);
  const [resetting, startReset] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="et-field">
      <label>Background image</label>
      <small>
        Wide images work best. You can drag and zoom to choose what shows. Keep the left side darker so the white text stays readable.
        {current ? "" : " Currently using the default Etivio background."}
      </small>
      <div className="et-inline" style={{ marginTop: 4 }}>
        <button type="button" className="et-btn et-btn-primary" onClick={() => modal.current?.open()}>
          <ImagePlus size={15} /> Change background
        </button>
        {current && (
          <button
            type="button"
            className="et-btn et-btn-ghost"
            disabled={resetting}
            onClick={() =>
              startReset(async () => {
                const res = await setHeroBackground(null);
                setError(res.error ?? null);
              })
            }
          >
            <RotateCcw size={15} /> {resetting ? "Resetting…" : "Reset to default"}
          </button>
        )}
      </div>
      {error && <p className="et-upload-err">{error}</p>}
      <CropUpload
        ref={modal}
        kind="banner"
        out={{ width: 1800, height: 400 }}
        title="Dashboard banner background"
        hint="Recommended 1800 × 400 px or larger. JPG, PNG, or WebP, up to 20 MB."
        confirmLabel="Save background"
        onUploaded={setHeroBackground}
      />
    </div>
  );
}
