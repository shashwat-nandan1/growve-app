import { Link } from "@tanstack/react-router";
import { Sun, Users, Settings as SettingsIcon } from "lucide-react";

const items = [
  { to: "/today", label: "Today", Icon: Sun },
  { to: "/friends", label: "Friends", Icon: Users },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/85 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {items.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 py-3 text-xs text-muted-foreground transition-colors"
              activeProps={{ className: "text-forest" }}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
