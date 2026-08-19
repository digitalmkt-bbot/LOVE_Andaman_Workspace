import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteNavigation } from "@/components/site-navigation";
import { runtimeConfig } from "@/lib/runtime-config";

import "./globals.css";

export const metadata: Metadata = {
  title: `${runtimeConfig.appName} shell`,
  description: "LOVE Andaman modernization application shell",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <LinkBrand />
          <SiteNavigation />
        </header>
        <main className="content">{children}</main>
      </body>
    </html>
  );
}

function LinkBrand(): React.ReactElement {
  return <span className="brand">{runtimeConfig.appName}</span>;
}
