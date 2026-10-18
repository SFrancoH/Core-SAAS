import PasswordField from "@/components/password-field";
import { createCoreUser, assignExistingCoreUser } from "@/app/core-users/actions";

export type PermissionOption = { code: string; name: string; product: string | null; module: string | null };
export type MemberInfo = {
  user_id: string; name: string; email: string; role: "admin" | "user";
  active: boolean; created_by: string | null; creator_name?: string | null; permissions: string[];
};

function PermissionChoices({ options, inputName }: { options: PermissionOption[]; inputName: string }) {
  // La jerarquía Core se deriva del rol; el selector controla solo permisos de vertical/módulo.
  const verticalPermissions = options.filter(item=>Boolean(item.product || item.module));
  const categories = [...new Set(verticalPermissions.map(item=>item.product ?? item.module ?? "CORE"))];
  return <fieldset className="corePermissionSelector">
    <legend>Permisos por vertical</legend>
    <p className="description">Solo se pueden delegar permisos autorizados y correspondientes a licencias activas. El backend comprueba nuevamente cada selección.</p>
    {categories.map(group=><div className="corePermissionGroup" key={group}>
      <h3>{group}</h3>
      {verticalPermissions.filter(p=>(p.product ?? p.module ?? "CORE")===group).map(p=>
        <label className="checkLabel" key={p.code}>
          <input type="checkbox" name={inputName} value={p.code} />
          <span>{p.name} <small>({p.code})</small></span>
        </label>
      )}
    </div>)}
  </fieldset>;
}

export function CoreCompanyUserForms({
  companyId, permissions, owner, origin = ""
}: { companyId: string; permissions: PermissionOption[]; owner: boolean; origin?: string }) {
  return <>
    <section className="managementSection">
      <p className="eyebrow">Accesos de empresa</p>
      <h2>Crear Admin o User</h2>
      <p className="description">Una identidad para Core SaaS. Puedes añadirla a varias empresas desde Super-Admin, con permisos distintos en cada una.</p>
      <form action={createCoreUser} className="managementForm">
        <input type="hidden" name="empresa_id" value={companyId}/>
        <input type="hidden" name="origen" value={origin}/>
        <label>Rol de empresa
          <select name="rol" defaultValue="user" required>
            <option value="user">User · Trabajador</option>
            <option value="admin">Admin · Administrador</option>
          </select>
        </label>
        <label>Nombre completo<input name="nombre" minLength={2} maxLength={120} required/></label>
        <label>Correo<input name="email" type="email" autoComplete="off" required/></label>
        <PasswordField label="Contraseña inicial (mínimo 12 caracteres)" minLength={12}/>
        <PermissionChoices options={permissions} inputName="permisos"/>
        <button type="submit">Crear acceso</button>
      </form>
    </section>
    {owner?<>
      <section className="managementSection">
        <p className="eyebrow">Multiempresa</p>
        <h2>Asociar usuario existente</h2>
        <p className="description">Solo Super-Admin puede asociar sin una invitación previa una cuenta existente a otra empresa. Esta acción genera un evento de auditoría.</p>
        <form action={assignExistingCoreUser} className="managementForm">
          <input type="hidden" name="empresa_id" value={companyId}/>
          <label>Correo ya registrado<input type="email" name="email_existente" required/></label>
          <label>Rol en esta empresa<select name="rol_existente" defaultValue="user">
            <option value="user">User</option><option value="admin">Admin</option>
          </select></label>
          <PermissionChoices options={permissions} inputName="permisos_existentes"/>
          <button type="submit">Asociar a empresa</button>
        </form>
      </section>
    </>:null}
  </>;
}

export function CoreStaffForm() {
  return <section className="managementSection">
    <p className="eyebrow">Personal interno</p>
    <h2>Crear Super-User</h2>
    <p className="description">Este trabajador no obtiene automáticamente acceso a empresas. Sus permisos deberán asignarse explícitamente y quedar auditados.</p>
    <form action={createCoreUser} className="managementForm">
      <input type="hidden" name="rol" value="super_user"/>
      <label>Nombre<input name="nombre" minLength={2} maxLength={120} required/></label>
      <label>Correo<input name="email" type="email" required/></label>
      <PasswordField label="Contraseña inicial (mínimo 12 caracteres)" minLength={12}/>
      <button type="submit">Crear Super-User</button>
    </form>
  </section>;
}

export function CompanyMembershipTable({ members }: { members: MemberInfo[] }) {
  return <section className="managementSection">
    <p className="eyebrow">Directorio empresarial</p>
    <h2>Usuarios asociados ({members.length})</h2>
    {members.length===0?<div className="emptyState">No hay membresías registradas.</div>:<div className="userList">
      {members.map(member=><article className="userRow" key={member.user_id}>
        <div className="userIdentity">
          <strong>{member.name}</strong><span>{member.email}</span>
          <small>{member.role === "admin" ? "Admin" : "User"} · {member.permissions.length} permisos</small>
          <small>{member.permissions.join(", ") || "Sin permisos"}</small>
          {member.creator_name ? <small>Creado por: {member.creator_name}</small> : null}
        </div>
        <div className="userActions">
          <span className={member.active?"badgeActive":"badgeInactive"}>{member.active?"Activo":"Inactivo"}</span>
        </div>
      </article>)}
    </div>}
  </section>;
}
