"use client";

function bogotaCarnet(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.day}${values.month}${values.year}${values.hour}${values.minute}${values.second}`;
}

export default function CarnetGenerator({ inputId = "numero_carnet" }: { inputId?: string }) {
  function generate() {
    const input = document.getElementById(inputId);
    if (!(input instanceof HTMLInputElement)) return;
    input.value = bogotaCarnet();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  return <button className="buttonSecondary" type="button" onClick={generate}>Generar</button>;
}
