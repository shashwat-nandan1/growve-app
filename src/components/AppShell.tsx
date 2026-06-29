import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-5 pt-8 pb-32">{children}</main>
      <BottomNav />
    </div>
  );
}
