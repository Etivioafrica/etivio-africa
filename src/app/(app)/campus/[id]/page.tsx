import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { campusComments, campusOn, campusPost } from "@/lib/data/campus";
import { PostCard } from "../PostCard";
import "../campus.css";

export const metadata = { title: "Campus post" };

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CampusPostPage({ params }: Props) {
  return (
    <div className="et-page et-cps et-cps-single">
      <Link href="/campus" className="et-back">
        <ArrowLeft size={14} />
        Campus
      </Link>
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Post params={params} />
      </Suspense>
    </div>
  );
}

async function Post({ params }: Props) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!(await campusOn())) redirect("/learn");
  if (!UUID.test(id)) notFound();
  const viewer = { id: user.id, staff: isStaff(user.roles), name: user.name || user.email, avatar: user.avatarUrl };
  const post = await campusPost(id, viewer);
  if (!post) notFound();
  const comments = await campusComments(id, viewer);
  return (
    <div className="et-cps-list">
      <PostCard post={post} viewer={viewer} open clamp={0} initialComments={comments} />
    </div>
  );
}
