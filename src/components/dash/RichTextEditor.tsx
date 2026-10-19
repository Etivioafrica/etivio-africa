"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import YoutubeExtension from "@tiptap/extension-youtube";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  Video,
} from "lucide-react";

// Rich text editor (Tiptap), ported from the nnamdi-obi admin. Images upload to R2 through /api/upload.
function ToolBtn({ onClick, active = false, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={active} className={`et-rte-btn${active ? " is-on" : ""}`}>
      {children}
    </button>
  );
}

const Divider = () => <span className="et-rte-div" />;

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const colorRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    // Re-render on every change so the toolbar's active states (bold, headings…) stay in sync.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ link: false }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      ImageExtension.configure({ inline: false }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      YoutubeExtension.configure({ width: 640, height: 360, nocookie: true }),
    ],
    content: value,
    editorProps: { attributes: { class: "et-rich et-rte-content" } },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Load new content when the panel switches to a different announcement.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <div className="et-rte et-skel" style={{ height: 300 }} />;
  const state = {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    code: editor.isActive("code"),
    highlight: editor.isActive("highlight"),
    h1: editor.isActive("heading", { level: 1 }),
    h2: editor.isActive("heading", { level: 2 }),
    h3: editor.isActive("heading", { level: 3 }),
    bullet: editor.isActive("bulletList"),
    ordered: editor.isActive("orderedList"),
    quote: editor.isActive("blockquote"),
    link: editor.isActive("link"),
  };

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    fetch("/api/upload?kind=blog", {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name) },
      body: file,
    })
      .then((r) => r.json())
      .then((body: { url?: string }) => body.url && editor?.chain().focus().setImage({ src: body.url }).run())
      .finally(() => setUploading(false));
  }

  function addLink() {
    const url = window.prompt("Link URL");
    if (url) editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    else editor?.chain().focus().unsetLink().run();
  }

  function addYoutube() {
    const url = window.prompt("YouTube URL");
    if (url) editor?.chain().focus().setYoutubeVideo({ src: url }).run();
  }

  const c = () => editor.chain().focus();
  return (
    <div className="et-rte">
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={handleImageFile} />
      <div className="et-rte-bar">
        <ToolBtn onClick={() => c().undo().run()} title="Undo">
          <Undo2 size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => c().redo().run()} title="Redo">
          <Redo2 size={14} />
        </ToolBtn>
        <Divider />
        <ToolBtn onClick={() => c().toggleBold().run()} active={state.bold} title="Bold">
          <Bold size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => c().toggleItalic().run()} active={state.italic} title="Italic">
          <Italic size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => c().toggleStrike().run()} active={state.strike} title="Strikethrough">
          <Strikethrough size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => c().toggleCode().run()} active={state.code} title="Inline code">
          <Code size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => c().toggleHighlight().run()} active={state.highlight} title="Highlight">
          <Highlighter size={14} />
        </ToolBtn>
        <span className="et-rte-color">
          <ToolBtn onClick={() => colorRef.current?.click()} title="Text colour">
            <Palette size={14} />
          </ToolBtn>
          <input ref={colorRef} type="color" aria-label="Text colour" onChange={(e) => c().setColor(e.target.value).run()} />
        </span>
        <Divider />
        <ToolBtn onClick={() => c().toggleHeading({ level: 1 }).run()} active={state.h1} title="Heading 1">
          <Heading1 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => c().toggleHeading({ level: 2 }).run()} active={state.h2} title="Heading 2">
          <Heading2 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => c().toggleHeading({ level: 3 }).run()} active={state.h3} title="Heading 3">
          <Heading3 size={15} />
        </ToolBtn>
        <Divider />
        <ToolBtn onClick={() => c().toggleBulletList().run()} active={state.bullet} title="Bullet list">
          <List size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => c().toggleOrderedList().run()} active={state.ordered} title="Numbered list">
          <ListOrdered size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => c().toggleBlockquote().run()} active={state.quote} title="Quote">
          <Quote size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => c().setHorizontalRule().run()} title="Divider">
          <Minus size={14} />
        </ToolBtn>
        <Divider />
        <ToolBtn onClick={() => imageRef.current?.click()} title={uploading ? "Uploading…" : "Insert image"}>
          <ImageIcon size={14} />
        </ToolBtn>
        <ToolBtn onClick={addYoutube} title="Insert YouTube video">
          <Video size={14} />
        </ToolBtn>
        <ToolBtn onClick={addLink} active={state.link} title="Insert link">
          <LinkIcon size={14} />
        </ToolBtn>
        {uploading && <small className="et-muted">Uploading image…</small>}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
