// @ts-nocheck — lógica/props PETS aún requieren tipado estricto.
"use client";

import { useState } from "react";

export default function PasswordField({
  label = "Contraseña",
  name = "password",
  autoComplete = "new-password",
  minLength = 8,
  placeholder,
  required = true
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <span className="passwordControl">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          className="passwordToggle"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? "Ocultar contraseña" : "Ver contraseña"}
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </span>
    </label>
  );
}
