import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { clearToken, clearUser, fetchCurrentUser, getUser, setUser, type CurrentUser } from "@/lib/api";

interface NavLink {
  label: string;
  href: string;
}
interface NavGroup {
  label: string;
  items: NavLink[];
}

const NAV_GROUPS: (NavLink | NavGroup)[] = [
  { label: "Tableau de bord", href: "/dashboard" },
  {
    label: "Commercial",
    items: [
      { href: "/chantiers", label: "Chantiers" },
      { href: "/prospects", label: "Prospects" },
      { href: "/devis", label: "Devis" },
      { href: "/agenda-commercial", label: "Agenda commercial" },
      { href: "/relances", label: "Relances" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/factures", label: "Factures" },
      { href: "/depenses", label: "Depenses" },
      { href: "/commandes", label: "Commandes" },
      { href: "/situations", label: "Situations" },
      { href: "/comptabilite", label: "Comptabilite" },
    ],
  },
  {
    label: "RH & Chantier",
    items: [
      { href: "/equipe", label: "Equipe" },
      { href: "/pointage", label: "Pointage" },
      { href: "/planning-personnel", label: "Planning" },
      { href: "/securite", label: "Securite" },
    ],
  },
  {
    label: "Ressources",
    items: [
      { href: "/sous-traitants", label: "Sous-traitants" },
      { href: "/articles", label: "Articles" },
      { href: "/ouvrages", label: "Ouvrages" },
      { href: "/stock", label: "Stock" },
      { href: "/documents", label: "Documents" },
      { href: "/vehicules", label: "Vehicules" },
      { href: "/import-ia", label: "Import IA" },
    ],
  },
];

function NavDropdown({ label, items, active }: { label: string; items: { href: string; label: string }[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className={active ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground hover:text-foreground"}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 flex min-w-44 flex-col rounded-md border border-border bg-background py-1 shadow-lg">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="px-3 py-2 text-sm text-foreground hover:bg-muted/50">
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => getUser());

  // Sessions ouvertes avant l'ajout du cache localStorage "magestion_user"
  // n'ont pas cette info : on la recupere une fois via /auth/me et on la
  // met en cache, sans forcer une reconnexion.
  useEffect(() => {
    if (currentUser) return;
    fetchCurrentUser()
      .then((user) => {
        setUser(user);
        setCurrentUser(user);
      })
      .catch(() => {});
  }, [currentUser]);

  const navGroups: (NavLink | NavGroup)[] =
    currentUser?.role === "SUPER_ADMIN"
      ? [
          ...NAV_GROUPS,
          {
            label: "Administration",
            items: [
              { href: "/utilisateurs", label: "Utilisateurs" },
              { href: "/parametres", label: "Parametres" },
            ],
          },
        ]
      : NAV_GROUPS;

  function handleLogout() {
    clearToken();
    clearUser();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-primary">Magestion</span>
            <nav className="flex gap-5">
              {navGroups.map((group) =>
                "href" in group ? (
                  <Link
                    key={group.href}
                    href={group.href}
                    className={
                      location.startsWith(group.href)
                        ? "text-sm font-medium text-foreground"
                        : "text-sm text-muted-foreground hover:text-foreground"
                    }
                  >
                    {group.label}
                  </Link>
                ) : (
                  <NavDropdown
                    key={group.label}
                    label={group.label}
                    items={group.items}
                    active={group.items.some((i) => location.startsWith(i.href))}
                  />
                ),
              )}
            </nav>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Deconnexion
          </Button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
