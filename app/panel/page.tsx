import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/core/auth";

export default async function PanelPage() {
  const profile = await requireProfile();

  if (profile.rol === "super_admin") {
    redirect("/super-admin");
  }

  redirect("/portal");
}
