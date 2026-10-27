// Shared vocabulary for the welcome guide, course categories, recommendations, and admin insights.

// Course categories and learner topics are the same list, so they can be matched directly.
export const TOPICS = [
  "Design",
  "Development",
  "Marketing",
  "Business",
  "Data & AI",
  "Product",
  "Content creation",
  "Finance",
  "Photography & video",
  "Writing",
  "Sales",
  "Personal growth",
] as const;

export const GOAL_LABELS = {
  new_skill: "Learn a new skill",
  career: "Grow in my career",
  job: "Get a job or switch careers",
  freelance: "Find freelance work",
  creative: "Explore creative interests",
} as const;

export const LEVEL_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
} as const;

export const HOURS_LABELS = {
  under_3: "Less than 3 hours a week",
  "3_to_6": "3 to 6 hours a week",
  over_6: "More than 6 hours a week",
} as const;

export type LearningGoal = keyof typeof GOAL_LABELS;
export type SkillLevel = keyof typeof LEVEL_LABELS;
export type WeeklyHours = keyof typeof HOURS_LABELS;

// learning_goal holds one or more goal keys, comma-separated.
export const parseGoals = (raw: string | null | undefined): LearningGoal[] => (raw ?? "").split(",").filter((g): g is LearningGoal => g in GOAL_LABELS);

export const label = <T extends Record<string, string>>(map: T, key: string | null | undefined) => (key && key in map ? map[key as keyof T] : null);
