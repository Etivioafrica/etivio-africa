import { requireAdmin } from "@/lib/admin";
import { featureStatuses } from "@/lib/data/features";
import { FEATURES, FEATURE_KEYS } from "@/lib/features";
import { FeatureRow } from "./FeatureRow";

export const metadata = { title: "Features" };

// Turn features off, try them as admins first, then launch them to everyone. Changes apply straight away.
export default async function FeaturesSettings() {
  await requireAdmin("platform");
  const statuses = await featureStatuses();
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>Features</h2>
        <small className="et-muted">Off hides it from everyone. Admins only lets staff try it first. Everyone launches it.</small>
      </div>
      <div className="et-ff-list">
        {FEATURE_KEYS.map((k) => (
          <FeatureRow key={k} id={k} label={FEATURES[k].label} description={FEATURES[k].description} status={statuses[k]} />
        ))}
      </div>
    </section>
  );
}
