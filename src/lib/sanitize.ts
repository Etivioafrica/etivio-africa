import "server-only";
import sanitize from "sanitize-html";

// Rich text from the editor (announcements). Keeps formatting, images, links, and YouTube embeds; strips scripts,
// event handlers, and anything else that could run code in a learner's browser.
export function sanitizeRichText(html: string) {
  return sanitize(html, {
    allowedTags: [
      "p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "s", "u", "code", "pre", "mark", "span",
      "ul", "ol", "li", "blockquote", "hr", "a", "img", "div", "iframe",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
      span: ["style"],
      mark: ["style", "data-color"],
      div: ["data-youtube-video"],
      iframe: ["src", "width", "height", "allowfullscreen", "allow"],
    },
    allowedStyles: { "*": { color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/i], "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/i] } },
    allowedSchemes: ["https", "http", "mailto"],
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "youtube.com"],
    transformTags: { a: sanitize.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
  });
}
