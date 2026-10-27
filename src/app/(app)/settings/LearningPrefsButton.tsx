"use client";
import { Target } from "lucide-react";
import { openLearningPrefs } from "@/lib/guide";

// Reopens the welcome questions (goals, topics, level, time) with the learner's current answers.
export function LearningPrefsButton() {
  return (
    <button type="button" className="et-btn" onClick={openLearningPrefs}>
      <Target size={15} /> Update learning goals
    </button>
  );
}
