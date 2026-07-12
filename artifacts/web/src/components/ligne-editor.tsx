import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ligneMontantHt, type LigneInput } from "@/lib/devis";

interface LigneEditorProps {
  lignes: LigneInput[];
  onChange: (lignes: LigneInput[]) => void;
  disabled?: boolean;
}

const EMPTY_LIGNE: LigneInput = { designation: "", quantite: 1, unite: "u", prixUnitaireHt: 0, remisePercent: 0 };

// Editeur de lignes reutilisable (devis + factures, tant que le document est
// encore BROUILLON) — toutes les lignes partagent le taux de TVA du document
// parent, saisi separement (voir la page appelante).
export function LigneEditor({ lignes, onChange, disabled }: LigneEditorProps) {
  const total = lignes.reduce((s, l) => s + ligneMontantHt(l), 0);

  function updateLigne(index: number, patch: Partial<LigneInput>) {
    onChange(lignes.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLigne(index: number) {
    onChange(lignes.filter((_, i) => i !== index));
  }

  function addLigne() {
    onChange([...lignes, { ...EMPTY_LIGNE }]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-2 py-1.5">Designation</th>
              <th className="w-20 px-2 py-1.5">Qte</th>
              <th className="w-16 px-2 py-1.5">Unite</th>
              <th className="w-28 px-2 py-1.5">PU HT</th>
              <th className="w-20 px-2 py-1.5">Remise %</th>
              <th className="w-28 px-2 py-1.5 text-right">Montant HT</th>
              {!disabled && <th className="w-10 px-2 py-1.5"></th>}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-2 py-1">
                  <Input
                    className="h-8"
                    value={l.designation}
                    disabled={disabled}
                    onChange={(e) => updateLigne(i, { designation: e.target.value })}
                    placeholder="Description de la prestation"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    className="h-8"
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.quantite}
                    disabled={disabled}
                    onChange={(e) => updateLigne(i, { quantite: Number(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8" value={l.unite ?? "u"} disabled={disabled} onChange={(e) => updateLigne(i, { unite: e.target.value })} />
                </td>
                <td className="px-2 py-1">
                  <Input
                    className="h-8"
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.prixUnitaireHt}
                    disabled={disabled}
                    onChange={(e) => updateLigne(i, { prixUnitaireHt: Number(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    className="h-8"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={l.remisePercent ?? 0}
                    disabled={disabled}
                    onChange={(e) => updateLigne(i, { remisePercent: Number(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-1 text-right font-medium">{ligneMontantHt(l).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</td>
                {!disabled && (
                  <td className="px-2 py-1 text-right">
                    <button type="button" onClick={() => removeLigne(i)} className="text-muted-foreground hover:text-red-400" title="Supprimer">✕</button>
                  </td>
                )}
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">Aucune ligne.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        {!disabled && <Button type="button" size="sm" variant="outline" onClick={addLigne}>+ Ajouter une ligne</Button>}
        <p className="text-sm font-semibold">Total HT : {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
      </div>
    </div>
  );
}
