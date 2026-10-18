// @ts-nocheck — lógica/props PETS aún requieren tipado estricto.
"use client";

import { useFormStatus } from "react-dom";

export default function ImportSubmitButton({
  idleLabel = "Importar archivo",
  pendingLabel = "Importando..."
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <button className="importSubmitButton" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? <span className="buttonSpinner" aria-hidden="true" /> : null}
        {pending ? pendingLabel : idleLabel}
      </button>
      {pending ? (
        <div className="importProgress" role="status" aria-live="polite">
          <span className="progressSpinner" aria-hidden="true" />
          <span>
            <strong>Archivo enviado. Estamos procesando los registros.</strong>
            No cierres ni recargues esta página. La importación puede tardar varios segundos.
          </span>
        </div>
      ) : null}
    </>
  );
}
