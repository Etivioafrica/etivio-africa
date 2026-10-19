import { assetUrl } from "./site";

// Builds an Unlayer design from simple parts, so every email opens in the editor with a sensible starting layout
// (logo, banner, heading, text, button, sign-off, footer) instead of a blank page. The editor fills in any values
// left out here with its own defaults.

export type StarterPart =
  | { type: "heading"; text: string }
  | { type: "text"; html: string }
  | { type: "button"; label: string; href: string }
  | { type: "box"; html: string };

let n = 0;
const id = (p: string) => `${p}_${++n}`;
const FONT = { label: "Inter", value: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" };

function content(type: string, values: Record<string, unknown>) {
  const htmlID = id(`u_content_${type}`);
  return { id: htmlID, type, values: { containerPadding: "10px 40px", ...values, _meta: { htmlID, htmlClassNames: `u_content_${type}` } } };
}

function row(contents: object[], values: Record<string, unknown> = {}) {
  const rowId = id("u_row");
  const colId = id("u_column");
  return {
    id: rowId,
    cells: [1],
    columns: [{ id: colId, contents, values: { backgroundColor: "", padding: "0px", _meta: { htmlID: colId, htmlClassNames: "u_column" } } }],
    values: { columnsBackgroundColor: "#ffffff", padding: "0px", _meta: { htmlID: rowId, htmlClassNames: "u_row" }, ...values },
  };
}

const spaced = (html: string) => html.replace(/<p>/g, '<p style="margin:0 0 12px">').replace(/<ul>/g, '<ul style="margin:0 0 12px;padding-left:20px">');

function part(p: StarterPart) {
  if (p.type === "heading")
    return content("heading", { headingType: "h1", fontSize: "26px", fontWeight: 700, color: "#1f2430", textAlign: "left", lineHeight: "130%", text: p.text, containerPadding: "34px 40px 10px" });
  // The editor resets paragraph margins, so give them spacing inline.
  if (p.type === "text") return content("text", { fontSize: "15px", color: "#4a5160", textAlign: "left", lineHeight: "170%", text: spaced(p.html) });
  if (p.type === "box")
    return content("text", {
      fontSize: "14px",
      color: "#1f2430",
      textAlign: "left",
      lineHeight: "170%",
      text: `<div style="background:#f6f8fc;border:1px solid #e6e9f0;border-radius:10px;padding:16px 20px">${p.html}</div>`,
      containerPadding: "8px 40px 14px",
    });
  return content("button", {
    text: `<span style="font-size:15px;line-height:18px;">${p.label}</span>`,
    href: { name: "web", values: { href: p.href, target: "_blank" } },
    buttonColors: { color: "#ffffff", backgroundColor: "#2563eb", hoverColor: "#ffffff", hoverBackgroundColor: "#1d4ed8" },
    size: { autoWidth: true, width: "100%" },
    padding: "14px 28px",
    borderRadius: "8px",
    textAlign: "left",
    fontWeight: 600,
    containerPadding: "14px 40px 18px",
  });
}

export function starterDesign({ banner, parts, footer }: { banner: string; parts: StarterPart[]; footer: string }) {
  n = 0;
  const assets = assetUrl();
  const rows = [
    row([content("image", { src: { url: `${assets}/etivio-logo.png`, width: 232, height: 62, maxWidth: "116px", autoWidth: false }, textAlign: "left", altText: "Etivio", action: { name: "web", values: { href: "{{site_url}}", target: "_blank" } }, containerPadding: "22px 32px" })]),
    row([content("image", { src: { url: `${assets}/email/${banner}.png`, width: 1200, height: 440 }, textAlign: "center", altText: "", containerPadding: "0px" })]),
    row([...parts.map(part), content("text", { fontSize: "15px", color: "#4a5160", lineHeight: "160%", text: "<p>Regards,<br><strong style=\"color:#1f2430\">The Etivio team</strong></p>", containerPadding: "10px 40px 30px" })]),
    row([content("text", { fontSize: "12.5px", color: "#7a8294", lineHeight: "160%", text: `<p>${footer}</p>`, containerPadding: "20px 40px 24px" })], { columnsBackgroundColor: "#fafbfd" }),
  ];
  return {
    counters: {},
    body: {
      id: "etivio_body",
      rows,
      headers: [],
      footers: [],
      values: {
        contentWidth: "600px",
        contentAlign: "center",
        backgroundColor: "#f1f3f8",
        textColor: "#1f2430",
        fontFamily: FONT,
        linkStyle: { body: true, linkColor: "#2563eb", linkHoverColor: "#1d4ed8", linkUnderline: true, linkHoverUnderline: true },
        preheaderText: "",
        _meta: { htmlID: "u_body", htmlClassNames: "u_body" },
      },
    },
    schemaVersion: 27,
  };
}
