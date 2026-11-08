import { Caveat, Newsreader } from "next/font/google";

// Fonts shared by the homepage and the About page.
export const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--h2-serif",
  display: "swap",
});

export const hand = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--h2-hand",
});
