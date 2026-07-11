import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUser } from "@/lib/api";
import {
  ROLE_LABELS,
  createUser,
  listUsers,
  updateUser,
  type AppUser,
  type UserInput,
  type UserRole,
} from "@/lib/users";

const EMPTY_FORM: UserInput = { email: "", password: "", nom: "", role: "TERRAIN" };
const ROLE_ORDER: UserRole[] = ["SUPER_ADMIN", "COMMERCIAL", "TERRAIN", "COMPTABILITE"];

export default function UtilisateursPage() {
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const { data: users, isLoading, isError } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<UserInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const all = users ?? [];
  const actifs = all.filter((u) => u.active).length;
  const superAdmins = all.filter((u) => u.role === "SUPER_ADMIN").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (u) => u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [all, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createUser(form);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la creation");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(user: AppUser, role: UserRole) {
    await updateUser(user.id, { role });
    await queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  async function handleToggleActive(user: AppUser) {
    await updateUser(user.id, { active: !user.active });
    await queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Utilisateurs</h1>
          <Button onClick={() => setIsOpen(true)}>Ajouter un utilisateur</Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total utilisateurs</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{all.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Actifs</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{actifs}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Super administrateurs</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{superAdmins}</p></CardContent>
          </Card>
        </div>

        <Input
          placeholder="Rechercher (nom, email)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isError && <p className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-400">Erreur lors du chargement des donnees. Verifiez votre connexion et reessayez.</p>}
        {isLoading && <p className="text-muted-foreground">Chargement...</p>}

        <div className="flex flex-col gap-3">
          {filtered.map((user) => {
            const isSelf = user.id === currentUser?.id;
            return (
              <Card key={user.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {user.nom} {isSelf && <span className="text-xs text-muted-foreground">(vous)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={user.active ? "text-xs text-green-500" : "text-xs text-muted-foreground"}>
                      {user.active ? "Actif" : "Desactive"}
                    </span>
                    <select
                      className="h-8 rounded-md border border-border bg-transparent px-2 text-xs disabled:opacity-50"
                      value={user.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                    >
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSelf}
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.active ? "Desactiver" : "Reactiver"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!isLoading && !isError && filtered.length === 0 && <p className="text-muted-foreground">Aucun utilisateur pour le moment.</p>}
        </div>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogHeader>
          <DialogTitle>Ajouter un utilisateur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creation..." : "Creer"}</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
