"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RegistrationStatus = "completado" | "pendiente" | "error" | string;
type Props = { registrationId: string; formUrl: string; initialStatus: RegistrationStatus };

export default function RegistrationConfirmation({ registrationId, formUrl, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [petId, setPetId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "completado") return undefined;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/registros/${registrationId}/estado`, { cache: "no-store" });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!data || typeof data !== "object") return;
        const value = data as Record<string, unknown>;
        if (typeof value.estado === "string") setStatus(value.estado);
        setPetId(typeof value.mascota_id === "string" ? value.mascota_id : null);
      } catch {
        // El siguiente intento de consulta volverá a comprobar el estado.
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [registrationId, status]);

  if (status === "completado") {
    return (
      <div className="registrationComplete">
        <span className="completeMark">✓</span>
        <h2>Registro completado</h2>
        <p>El propietario, la mascota y su asociación quedaron guardados.</p>
        <div className="registrationActions">
          <Link className="secondaryLink" href="/registros/nuevo">Crear otro registro</Link>
          {petId ? <Link className="actionLink" href={`/mascotas/${petId}`}>Ver mascota</Link> : <Link className="actionLink" href="/mascotas">Ver mascotas</Link>}
        </div>
      </div>
    );
  }

  return (
    <div className="confirmationFrameWrap">
      <div className="confirmationStatus"><span className="progressSpinner" /><div><strong>Esperando confirmación</strong><small>Revisa la información y pulsa “Confirmar creación” dentro del formulario.</small></div></div>
      <iframe className="confirmationFrame" src={formUrl} title="Formulario de confirmación del propietario" />
    </div>
  );
}
