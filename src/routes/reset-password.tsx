import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Growve" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Use at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    navigate({ to: "/today" });
  }

  return (
    <div className="min-h-screen bg-background px-5 pt-16">
      <div className="mx-auto max-w-md grove-card p-6">
        <h1 className="font-display text-2xl text-forest">Set a new password</h1>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="np">New password</Label>
            <Input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1.5" required />
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-xl bg-forest text-parchment hover:bg-forest/90">
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
