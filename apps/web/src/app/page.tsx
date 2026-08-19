import { runtimeConfig } from "@/lib/runtime-config";

export default function HomePage(): React.ReactElement {
  return (
    <section aria-labelledby="shell-title">
      <p className="eyebrow">Modernization shell</p>
      <h1 id="shell-title">{runtimeConfig.appName}</h1>
      <p>
        This isolated Next.js App Router shell is ready for incremental migration. The existing
        production application and its persistence paths are unchanged.
      </p>
    </section>
  );
}
