import { Badge, Card, Table, TBody, TCell, TH, THead, TRow } from "@/components/ui";
import type { AdminUserRow } from "@/db/queries/admin-users";

const dateFmt = new Intl.DateTimeFormat("bg-BG", { dateStyle: "short" });

const ROLE_LABEL: Record<string, string> = { seller: "Търговец", buyer: "Купувач" };

/** Супер-админ таб „Потребители" — read-only списък акаунти. */
export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-bold text-ink-900">Потребители ({users.length})</h2>
      {users.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500">Няма потребители.</p>
      ) : (
        <Table>
          <THead>
            <TH>Имейл</TH>
            <TH>Роля</TH>
            <TH>Вход</TH>
            <TH>Потвърден</TH>
            <TH>Магазини</TH>
            <TH>Посл. вход</TH>
            <TH>Регистриран</TH>
          </THead>
          <TBody>
            {users.map((u) => (
              <TRow key={u.id}>
                <TCell>
                  <span className="font-medium text-ink-900">{u.email}</span>
                  {u.fullName && <span className="block text-xs text-ink-500">{u.fullName}</span>}
                </TCell>
                <TCell>
                  {u.role ? (
                    <Badge tone="neutral">{ROLE_LABEL[u.role] ?? u.role}</Badge>
                  ) : (
                    <span className="text-ink-500">—</span>
                  )}
                </TCell>
                <TCell className="text-ink-500">{u.provider === "google" ? "Google" : "Имейл"}</TCell>
                <TCell>
                  {u.confirmed ? (
                    <Badge tone="success">Да</Badge>
                  ) : (
                    <Badge tone="warning">Не</Badge>
                  )}
                </TCell>
                <TCell>{u.shopCount}</TCell>
                <TCell className="text-ink-500">
                  {u.lastSignInAt ? dateFmt.format(u.lastSignInAt) : "никога"}
                </TCell>
                <TCell className="text-ink-500">{dateFmt.format(u.createdAt)}</TCell>
              </TRow>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
