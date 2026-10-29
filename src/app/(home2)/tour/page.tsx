import type { Metadata } from "next";
import { Tour } from "./Tour";

export const metadata: Metadata = {
  title: "Etivio tour",
  // Only shown inside the home page's product tour.
  robots: { index: false, follow: false },
};

export default function TourPage() {
  return <Tour />;
}
