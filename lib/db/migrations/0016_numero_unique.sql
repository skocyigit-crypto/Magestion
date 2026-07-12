-- Empeche les doublons de numerotation devis/factures sous concurrence :
-- nextNumero() lit un COUNT sans verrou ; deux requetes simultanees pouvaient
-- calculer le meme numero. L'index unique transforme la course en erreur
-- (23505) que l'application retente avec un numero frais (voir lib/numbering.ts).

CREATE UNIQUE INDEX IF NOT EXISTS devis_licence_numero_uniq ON devis(licence_id, numero);
CREATE UNIQUE INDEX IF NOT EXISTS factures_licence_numero_uniq ON factures(licence_id, numero);
