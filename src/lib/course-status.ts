import type { Database } from "@/lib/database.types";

export type CourseStatus = Database["public"]["Enums"]["course_status"];

// How each course status reads in the UI. 'pending' and 'rejected' are the review stages (migration 0039).
export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  draft: "Draft",
  pending: "In review",
  published: "Published",
  rejected: "Changes requested",
  archived: "Archived",
};
