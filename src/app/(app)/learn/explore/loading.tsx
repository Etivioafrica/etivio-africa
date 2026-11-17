import { ExploreSkeleton } from "@/components/dash/Skeletons";

// Shaped like this screen, shown while it loads (also gives the tab its own loading boundary).
export default function Loading() {
  return <ExploreSkeleton />;
}
