import { ShieldCheck } from "lucide-react";

// Plain GET form: /certificate?code=XXXX redirects to the certificate's own page.
export function VerifyBox({ defaultCode = "" }: { defaultCode?: string }) {
  return (
    <form action="/certificate" method="get" className="et-verify-form">
      <label htmlFor="cert-code" className="sr-only">
        Certificate ID
      </label>
      <input
        id="cert-code"
        name="code"
        className="et-input"
        defaultValue={defaultCode}
        placeholder="e.g. K7QX2M9P"
        maxLength={12}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        required
      />
      <button type="submit" className="et-btn et-btn-primary">
        <ShieldCheck size={15} /> Verify
      </button>
    </form>
  );
}
