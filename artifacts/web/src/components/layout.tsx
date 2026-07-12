import { useEffect, useRef, useState, type ReactNode } from "react";
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
      { href: "/analytics-commercial", label: "Performance commerciale" },
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
      { href: "/rapprochement-bancaire", label: "Rapprochement bancaire" },
    ],
  },
  {
    label: "RH & Chantier",
    items: [
      { href: "/equipe", label: "Equipe" },
      { href: "/pointage", label: "Pointage" },
      { href: "/planning-personnel", label: "Planning" },
      { href: "/securite", label: "Securite" },
      { href: "/notes-de-frais", label: "Notes de frais" },
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
      { href: "/locations-materiel", label: "Locations de materiel" },
      { href: "/import-ia", label: "Import IA" },
    ],
  },
];

// Clic/tap pour ouvrir (pas seulement hover, inutilisable au tactile) + fermeture
// automatique au clic exterieur — fonctionne identiquement souris/tactile.
function NavDropdown({ label, items, active }: { label: string; items: { href: string; label: string }[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={active ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground hover:text-foreground"}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 flex min-w-44 flex-col rounded-md border border-border bg-background py-1 shadow-lg">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-sm text-foreground hover:bg-muted/50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Menu mobile : la nav desktop (hover/dropdowns cote a cote) deborde sur un
// ecran de telephone. En dessous du breakpoint md, on remplace tout par un
// bouton hamburger + panneau avec accordeons natifs <details> (tactile,
// sans JS supplementaire par groupe).
function MobileMenu({ groups, onNavigate }: { groups: (NavLink | NavGroup)[]; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground"
      >
        <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 max-h-[80vh] overflow-y-auto border-b border-border bg-background shadow-lg">
          <nav className="flex flex-col divide-y divide-border">
            {groups.map((group) =>
              "href" in group ? (
                <Link
                  key={group.href}
                  href={group.href}
                  onClick={() => { setOpen(false); onNavigate(); }}
                  className="px-4 py-3 text-sm font-medium text-foreground"
                >
                  {group.label}
                </Link>
              ) : (
                <details key={group.label} className="px-4 py-1">
                  <summary className="cursor-pointer py-2 text-sm font-medium text-foreground">{group.label}</summary>
                  <div className="flex flex-col pb-2 pl-3">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => { setOpen(false); onNavigate(); }}
                        className="py-2 text-sm text-muted-foreground"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </details>
              ),
            )}
          </nav>
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
              { href: "/rgpd", label: "RGPD" },
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
      <header className="relative border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-primary">Magestion</span>
            <nav className="hidden gap-5 md:flex">
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
          <div className="flex items-center gap-3">
            <MobileMenu groups={navGroups} onNavigate={() => {}} />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Deconnexion
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
