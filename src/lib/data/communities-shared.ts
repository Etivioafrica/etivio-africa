// Types and constants for communities that client components can import too (communities.ts is server-only).

export type JoinMode = "open" | "request" | "course" | "invite";
export type Membership = { role: "owner" | "moderator" | "member"; status: "active" | "pending" | "banned" } | null;

export const JOIN_LABEL: Record<JoinMode, string> = {
  open: "Anyone can join",
  request: "Request to join",
  course: "For students of a course",
  invite: "Invite only",
};

export type CommunityCard = { id: string; slug: string; name: string; description: string | null; coverUrl: string | null; joinMode: JoinMode; isOfficial: boolean; members: number; courseTitle: string | null; mine: Membership };

export const CATEGORIES = [
  { id: "discussion", label: "Discussion" },
  { id: "question", label: "Question" },
  { id: "win", label: "Win" },
  { id: "resource", label: "Resource" },
] as const;
export type Category = (typeof CATEGORIES)[number]["id"];
export const isCategory = (v: unknown): v is Category => CATEGORIES.some((c) => c.id === v);

export type FeedPost = {
  id: string;
  body: string;
  image: string | null;
  category: Category;
  pinned: boolean;
  hidden: boolean;
  createdAt: string;
  editedAt: string | null;
  comments: number;
  likes: number;
  liked: boolean;
  author: { id: string | null; name: string; avatar: string | null };
};

export const FEED_PAGE = 20;

export type MemberRow = { userId: string; name: string; avatar: string | null; role: "owner" | "moderator" | "member"; joinedAt: string };
