import { Suspense } from "react";
import { BlogEditor } from "../BlogEditor";
import { editorContext } from "../editor-data";

export const metadata = { title: "New post" };

export default function NewPost() {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 640 }} />}>
      <NewEditor />
    </Suspense>
  );
}

async function NewEditor() {
  const { admin, categories, authors } = await editorContext();
  return (
    <BlogEditor
      categories={categories}
      authors={authors}
      initial={{ title: "", slug: "", excerpt: "", content: "", coverUrl: "", status: "draft", publishedAt: null, metaTitle: "", metaDesc: "", keyword: "", authorId: admin.id, categoryIds: [] }}
    />
  );
}
