// Catálogo tipado. La fuente de autorización real será SQL 010, aún no aplicado.
export const PERMISSIONS = {
  COMPANY_READ: "core.company.read",
  COMPANY_MANAGE: "core.company.manage",
  MEMBERS_MANAGE: "core.members.manage",
  ENTITLEMENTS_MANAGE: "core.entitlements.manage",
  PET_READ: "pets.pet.read",
  PET_WRITE: "pets.pet.write",
  CONSULTATION_READ: "pets.consultation.read",
  CONSULTATION_WRITE: "pets.consultation.write",
  PULSE_PROJECT_CREATE: "pulse.project.create",
  PULSE_PROJECT_READ: "pulse.project.read",
  PULSE_TICKET_RESERVE: "pulse.ticket.reserve",
  PULSE_TICKET_PAY: "pulse.ticket.pay",
  PULSE_TICKET_ASSIGN: "pulse.ticket.assign",
  PULSE_PROJECT_DELETE: "pulse.project.delete"
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const PRODUCTS = {
  PETS: "PETS",
  PULSE: "PULSE",
  AURA: "AURA",
  VISION: "VISION",
  DRIVE: "DRIVE",
  NEURO: "NEURO",
  LENS: "LENS"
} as const;

export type ProductCode = typeof PRODUCTS[keyof typeof PRODUCTS];
