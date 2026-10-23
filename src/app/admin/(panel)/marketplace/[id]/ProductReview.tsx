"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/dash/useToast";
import { deleteProduct, setProductStatus } from "../actions";
import { confirmDialog } from "@/components/dash/dialogs";

// Status bar above the editor: who made it, how it's doing, and the review / archive controls.
export function ProductReview({ id, status, creator, owners, downloads, isOwn }: { id: string; status: string; creator: string; owners: number; downloads: number; isOwn: boolean }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [busy, start] = useTransition();
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const act = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      show(res);
      if (!res.error) (after ?? (() => router.refresh()))();
    });

  return (
    <div className="et-page" style={{ paddingBottom: 0 }}>
      {toast}
      <section className={`et-card et-card-pad et-pr${status === "pending" ? " is-pending" : ""}`}>
        <div className="et-pr-facts">
          <span>
            By <b>{isOwn ? "you" : creator}</b>
          </span>
          <span>
            <b>{owners}</b> {owners === 1 ? "owner" : "owners"}
          </span>
          <span>
            <b>{downloads}</b> {downloads === 1 ? "download" : "downloads"}
          </span>
        </div>
        <div className="et-inline">
          {status === "pending" && (
            <>
              <button type="button" className="et-btn et-btn-success" disabled={busy} onClick={() => act(() => setProductStatus(id, "approve"))}>
                Approve and publish
              </button>
              <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={() => setRejecting((r) => !r)}>
                Request changes
              </button>
            </>
          )}
          {status === "published" && (
            <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={async () => (await confirmDialog({ title: "Take it off the marketplace?", body: "Owners keep their downloads.", confirmLabel: "Archive" })) && act(() => setProductStatus(id, "archive"))}>
              Archive
            </button>
          )}
          {status === "archived" && (
            <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={() => act(() => setProductStatus(id, "restore"))}>
              Restore to drafts
            </button>
          )}
          {owners === 0 && (
            <button
              type="button"
              className="et-btn et-btn-ghost et-btn-danger"
              disabled={busy}
              onClick={async () => (await confirmDialog({ title: "Delete this product?", body: "This deletes the product and its files for good.", confirmLabel: "Delete", danger: true })) && act(() => deleteProduct(id), () => router.push("/admin/marketplace"))}
            >
              Delete
            </button>
          )}
        </div>
        {rejecting && (
          <div className="et-pr-note">
            <textarea className="et-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the creator change? They'll see this note." />
            <button type="button" className="et-btn et-btn-primary" disabled={busy || !note.trim()} onClick={() => act(() => setProductStatus(id, "reject", note), () => { setRejecting(false); router.refresh(); })}>
              Send back
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
