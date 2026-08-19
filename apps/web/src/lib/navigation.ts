export type NavigationItem = {
  href: "/" | "/health";
  label: string;
};

export const navigationItems: readonly NavigationItem[] = [
  { href: "/", label: "Home" },
  { href: "/health", label: "Health" },
];
