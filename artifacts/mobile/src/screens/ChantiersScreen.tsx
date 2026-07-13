import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

interface Project {
  id: string;
  nom: string;
  client: string;
  adresse: string | null;
  codePostal: string | null;
  statut: "EN_ATTENTE" | "EN_COURS" | "TERMINE" | "SUSPENDU";
  budgetEstimeHt: string;
}

const STATUT_LABELS: Record<Project["statut"], string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TERMINE: "Termine",
  SUSPENDU: "Suspendu",
};

const STATUT_COLORS: Record<Project["statut"], string> = {
  EN_ATTENTE: "#9ca3af",
  EN_COURS: "#34d399",
  TERMINE: "#60a5fa",
  SUSPENDU: "#f87171",
};

export default function ChantiersScreen() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<Project[]>("/projects");
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recharge a chaque retour sur l'ecran (pas seulement au premier montage) —
  // utile si un chantier a ete modifie ailleurs pendant la session.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Chantiers</Text>
          {user && <Text style={styles.userInfo}>{user.nom}</Text>}
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Deconnexion</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={styles.loader} color="#f59e0b" />}
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#f59e0b" />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Aucun chantier pour le moment.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.nom}</Text>
              <Text style={[styles.badge, { color: STATUT_COLORS[item.statut] }]}>{STATUT_LABELS[item.statut]}</Text>
            </View>
            <Text style={styles.cardClient}>{item.client}</Text>
            {item.adresse && <Text style={styles.cardAddress}>{item.adresse}{item.codePostal ? ` (${item.codePostal})` : ""}</Text>}
            <Text style={styles.cardBudget}>{Number(item.budgetEstimeHt).toLocaleString("fr-FR")} € budget estime</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1120" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#f3f4f6" },
  userInfo: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  logout: { color: "#f87171", fontSize: 14 },
  loader: { marginTop: 24 },
  error: { color: "#f87171", textAlign: "center", marginTop: 12 },
  list: { padding: 16, gap: 12 },
  empty: { color: "#9ca3af", textAlign: "center", marginTop: 40 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 17, fontWeight: "600", color: "#f3f4f6", flex: 1 },
  badge: { fontSize: 12, fontWeight: "600" },
  cardClient: { color: "#9ca3af", marginTop: 4 },
  cardAddress: { color: "#6b7280", marginTop: 2, fontSize: 13 },
  cardBudget: { color: "#f59e0b", marginTop: 8, fontWeight: "600" },
});
