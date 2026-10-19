// The public site address used in email links. No server-only imports, so templates can be rendered anywhere.
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://etivio.co").replace(/\/$/, "");

// Where email images (logo, banners) are loaded from. Always the live site, even in local development: inboxes and
// the drag-and-drop editor (which runs on Unlayer's domain) can't load images from localhost.
export const assetUrl = () => (process.env.EMAIL_ASSET_URL || "https://etivio.co").replace(/\/$/, "");
