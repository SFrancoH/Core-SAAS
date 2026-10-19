/** Contratos puros PULSE; ninguna función consulta datos de otra vertical. */
export const PULSE_TICKET_STATES = [
  "Disponible", "No disponible", "Debe", "Abonado", "Pagado"
] as const;

export type PulseTicketState = (typeof PULSE_TICKET_STATES)[number];

export function isPulseTicketNumber(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{4}$/.test(value);
}

/** Devuelve EXACTAMENTE un texto plano: coma por número y | por cada 50.
 * Esta función NO consulta ni selecciona boletos: el backend hace esa consulta
 * después de autenticar empresa, proyecto, permiso y licencia.
 */
export function formatOfficeNumbers(numbers: readonly string[]): string {
  if (numbers.length > 150) throw new RangeError("PULSE_NUMBERS_LIMIT_EXCEEDED");
  if (!numbers.every(isPulseTicketNumber)) throw new TypeError("PULSE_INVALID_TICKET_NUMBER");
  if (new Set(numbers).size !== numbers.length) throw new Error("PULSE_DUPLICATE_NUMBER");
  const blocks: string[] = [];
  for (let offset = 0; offset < numbers.length; offset += 50) {
    blocks.push(numbers.slice(offset, offset + 50).join(", "));
  }
  return blocks.join(" | ");
}

export type OfficeAvailabilityInput = {
  numero: string;
  estado: PulseTicketState;
  vendedor_user_id: string | null;
  vendedor_nombre: string | null;
  valor_pagado: number;
  reserva_grupo: string | null;
};

/** Regla conservadora para mostrar números en Oficina.
 * Una verificación de frontend no sustituye la reserva transaccional.
 */
export function isOfficeTicketAvailable(ticket: OfficeAvailabilityInput): boolean {
  return isPulseTicketNumber(ticket.numero) &&
    ticket.estado === "Disponible" &&
    ticket.vendedor_user_id === null &&
    ticket.vendedor_nombre === "Oficina" &&
    ticket.valor_pagado === 0 &&
    ticket.reserva_grupo === null;
}

export function canReleasePulseTicket(
  estado: PulseTicketState,
  valorPagado: number,
  vendedorUserId: string | null
): boolean {
  return estado !== "Pagado" && estado !== "Abonado" &&
    valorPagado === 0 && vendedorUserId === null;
}
