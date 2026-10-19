"use client";
import { Download } from "lucide-react";

// Browsers' "Save as PDF" in the print dialog gives a crisp, vector certificate (print CSS hides the page chrome).
export function PrintButton() {
  return (
    <button type="button" className="et-btn et-btn-primary" onClick={() => window.print()}>
      <Download size={15} /> Download PDF
    </button>
  );
}
