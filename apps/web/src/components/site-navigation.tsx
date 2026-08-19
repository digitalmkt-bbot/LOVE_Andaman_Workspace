import Link from "next/link";

import { navigationItems } from "@/lib/navigation";

export function SiteNavigation(): React.ReactElement {
  return (
    <nav aria-label="Primary navigation">
      <ul className="navigation-list">
        {navigationItems.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
