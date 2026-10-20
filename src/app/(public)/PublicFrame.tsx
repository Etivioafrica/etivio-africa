"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useTheme, writeTheme } from "@/lib/theme";
import { CartButton } from "@/components/market/CartButton";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/tutors", label: "Tutors" },
  { href: "/blog", label: "Blog" },
  { href: "/teach-on-etivio", label: "Teach on Etivio" },
];

const FOOTER = [
  {
    title: "Etivio",
    links: [
      { href: "/about", label: "About us" },
      { href: "/tutors", label: "Tutors" },
      { href: "/blog", label: "Blog" },
      { href: "/teach-on-etivio", label: "Teach on Etivio" },
    ],
  },
  {
    title: "Marketplace",
    links: [
      { href: "/explore?type=course", label: "Courses" },
      { href: "/explore?type=template", label: "Templates" },
      { href: "/explore?type=ebook", label: "E-books and guides" },
      { href: "/explore?type=resource_pack", label: "Resource packs" },
      { href: "/explore?type=bundle", label: "Bundles" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help centre" },
      { href: "/contact", label: "Contact us" },
      { href: "/certificate", label: "Verify a certificate" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/refund-policy", label: "Refund policy" },
    ],
  },
];

// Light chrome for public pages that reuses the dashboard design tokens.
export function PublicFrame({ children, footerLinks }: { children: React.ReactNode; footerLinks?: React.ReactNode }) {
  const { light } = useTheme();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    const onOutside = (e: PointerEvent) => {
      if (!header.current?.contains(e.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1001px)");
    const onResize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("pointerdown", onOutside);
    desktop.addEventListener("change", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <div className={`et-app et-public${light ? " is-light" : ""}`}>
      <header className="et-public-top" ref={header}>
        <div className="et-public-top-inner">
        <Link href="/" className="et-public-brand" aria-label="Etivio home" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="Etivio" className="et-brand-logo" />
        </Link>
        <nav className="et-public-nav" aria-label="Main">
          {/* The current path is only known at request time, so the highlight streams in. */}
          <Suspense fallback={<NavLinks />}>
            <ActiveNavLinks />
          </Suspense>
        </nav>
        <HeaderSearch />
        <div className="et-public-actions">
          <CartButton />
          <button type="button" className="et-icon-btn" onClick={() => writeTheme(!light)} aria-label={light ? "Switch to dark mode" : "Switch to light mode"}>
            {light ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <Link href="/login" className="et-btn et-btn-ghost et-btn-sm et-public-login">
            Log in
          </Link>
          <Link href="/signup" className="et-btn et-btn-primary et-public-start">
            Start learning <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="et-icon-btn et-public-burger"
            ref={menuButton}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="et-public-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {open && (
          <nav id="et-public-menu" className="et-public-menu" aria-label="Menu" onBlur={(e) => {
            if (!header.current?.contains(e.relatedTarget)) setOpen(false);
          }}>
            <HeaderSearch mobile />
            <span className="et-public-menu-label">Make your next move</span>
            {[...NAV, { href: "/about", label: "About us" }, { href: "/help", label: "Help centre" }, { href: "/contact", label: "Contact us" }, { href: "/login", label: "Log in" }].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        )}
        </div>
      </header>
      <main className="et-public-main">{children}</main>
      <footer className="et-public-foot">
        <div className="et-public-foot-cols">
          <div className="et-public-foot-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/etiviologo.svg" alt="Etivio" className="et-brand-logo" />
            <p>Practical courses and tools from creators across Africa.</p>
          </div>
          {FOOTER.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <b>{col.title}</b>
              {col.links.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="et-public-foot-base">
          <span>© Etivio Africa</span>
          {footerLinks}
        </div>
      </footer>
    </div>
  );
}

function NavLinks({ pathname }: { pathname?: string }) {
  return NAV.map((l) => {
    const active = !!pathname && (pathname === l.href || pathname.startsWith(`${l.href}/`));
    return (
      <Link key={l.href} href={l.href} className={`et-public-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
        {l.label}
      </Link>
    );
  });
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

function HeaderSearch({ mobile = false }: { mobile?: boolean }) {
  return (
    <form action="/explore" role="search" aria-label="Search marketplace" className={`et-public-search${mobile ? " is-mobile" : ""}`}>
      <Search size={16} aria-hidden="true" />
      <input type="search" name="q" placeholder="What do you want to learn?" aria-label="Search courses and resources" />
      <button type="submit" aria-label="Search"><ArrowRight size={15} aria-hidden="true" /></button>
    </form>
  );
}
