"use client";
import { useState, useTransition } from "react";
import { ChevronRight, Plus, Search, Trash2, X } from "lucide-react";
import { useToast } from "@/components/dash/useToast";
import { confirmDialog } from "@/components/dash/dialogs";
export type Category = { id: string; name: string; slug: string; parent_id: string | null };
type Result = { ok?: string; error?: string };

// Shared by Blog and Courses: main categories with one level of subcategories.
export function CategoryManager({
  categories,
  counts,
  noun,
  help,
  addCategory,
  deleteCategory,
}: {
  categories: Category[];
  counts: Record<string, number>;
  noun: string;
  help: string;
  addCategory: (name: string, parentId: string | null) => Promise<Result>;
  deleteCategory: (id: string) => Promise<Result>;
}) {
  const [toast, show] = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [subName, setSubName] = useState<Record<string, string>>({});

  const all = categories.filter((c) => !c.parent_id);
  const subs = (id: string) => categories.filter((c) => c.parent_id === id);
  const q = search.trim().toLowerCase();
  const parents = q ? all.filter((p) => p.name.toLowerCase().includes(q) || subs(p.id).some((s) => s.name.toLowerCase().includes(q))) : all;

  function add(value: string, parentId: string | null) {
    if (!value.trim()) return;
    start(async () => {
      const res = await addCategory(value, parentId);
      show(res);
      if (res.error) return;
      if (parentId) {
        setSubName((s) => ({ ...s, [parentId]: "" }));
        setOpen((o) => ({ ...o, [parentId]: true }));
      } else setName("");
    });
  }

  async function remove(c: Category) {
    const n = counts[c.id] ?? 0;
    const extra = c.parent_id ? "" : subs(c.id).length ? " Its subcategories go too." : "";
    const body = `${n ? `It's on ${n} ${noun}${n === 1 ? "" : "s"}; they keep everything else.` : ""}${extra}`.trim();
    if (!(await confirmDialog({ title: `Delete "${c.name}"?`, body: body || undefined, confirmLabel: "Delete", danger: true }))) return;
    start(async () => show(await deleteCategory(c.id)));
  }

  return (
    <>
      {toast}
      <div className="et-page-head">
        <div>
          <h1>Categories</h1>
          <p>
            {all.length} {all.length === 1 ? "category" : "categories"} · {categories.length - all.length} subcategories
          </p>
        </div>
        <label className="et-blog-search">
          <Search size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories…" aria-label="Search categories" />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear">
              <X size={13} />
            </button>
          )}
        </label>
      </div>

      <div className="et-grid-2" style={{ alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="et-card et-card-pad et-form">
            <div className="et-be-label is-flat">
              <span>New category</span>
            </div>
            <input className="et-input" value={name} placeholder="e.g. Careers" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add(name, null)} />
            <button type="button" className="et-btn et-btn-primary" onClick={() => add(name, null)} disabled={pending || !name.trim()}>
              <Plus size={15} /> {pending ? "Adding…" : "Add category"}
            </button>
          </section>
          <section className="et-blog-note">
            <b>How categories work</b>
            <p>{help}</p>
          </section>
        </div>

        <section className="et-card">
          <div className="et-card-head">
            <h2>All categories</h2>
          </div>
          {parents.length === 0 ? (
            <p className="et-empty">{q ? "Nothing matches that search." : "No categories yet. Add your first one."}</p>
          ) : (
            <ul className="et-cat-tree">
              {parents.map((p) => {
                const children = subs(p.id);
                const isOpen = open[p.id] || (!!q && children.length > 0);
                return (
                  <li key={p.id}>
                    <div className="et-cat-row">
                      <button type="button" className={`et-cat-toggle${isOpen ? " is-open" : ""}`} onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))} aria-label={isOpen ? "Collapse" : "Expand"} aria-expanded={isOpen}>
                        <ChevronRight size={14} />
                      </button>
                      <b>{p.name}</b>
                      {children.length > 0 && <span className="et-tag">{children.length} sub</span>}
                      <small>
                        {counts[p.id] ?? 0} {noun}s
                      </small>
                      <button type="button" className="et-icon-btn is-danger" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="et-cat-subs">
                        {children.map((s) => (
                          <div key={s.id} className="et-cat-row is-sub">
                            <i />
                            <span>{s.name}</span>
                            <small>
                              {counts[s.id] ?? 0} {noun}s
                            </small>
                            <button type="button" className="et-icon-btn is-danger" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        <div className="et-cat-add">
                          <input
                            className="et-input"
                            value={subName[p.id] ?? ""}
                            placeholder="Add a subcategory…"
                            onChange={(e) => setSubName((s) => ({ ...s, [p.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && add(subName[p.id] ?? "", p.id)}
                          />
                          <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={() => add(subName[p.id] ?? "", p.id)} disabled={pending || !subName[p.id]?.trim()}>
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
