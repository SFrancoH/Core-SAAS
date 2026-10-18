import type { ReactNode } from "react";

type Props = { label: string; value: number | string; description?: string; icon?: ReactNode };
export function StatCard({ label, value, description, icon }: Props) {
  return <article className="coreStatCard">
    <div className="coreStatTop"><span>{label}</span>{icon}</div>
    <strong>{value}</strong>
    {description && <small>{description}</small>}
  </article>;
}
