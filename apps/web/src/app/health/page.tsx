import { runtimeConfig } from "@/lib/runtime-config";

export const dynamic = "force-static";

export default function HealthPage(): React.ReactElement {
  return (
    <section aria-labelledby="health-title">
      <p className="eyebrow">System check</p>
      <h1 id="health-title">Healthy</h1>
      <p>The application shell is available.</p>
      <dl className="health-details">
        <div>
          <dt>Application</dt>
          <dd>{runtimeConfig.appName}</dd>
        </div>
        <div>
          <dt>Environment</dt>
          <dd>{runtimeConfig.environment}</dd>
        </div>
      </dl>
    </section>
  );
}
