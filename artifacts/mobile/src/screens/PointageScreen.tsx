import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

interface Employee {
  id: string;
  nom: string;
  prenom: string;
  couleur: string;
  active: boolean;
}

interface Pointage {
  id: string;
  employeeId: string;
  dateJour: string;
  heureArrivee: string;
  heureDepart: string | null;
  active: boolean;
}

function formatHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PointageScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Employe en cours de pointage (arrivee/depart) : evite un double-tap
  // pendant l'aller-retour reseau, sans bloquer les AUTRES employes de la liste.
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [emp, pt] = await Promise.all([
        apiFetch<Employee[]>("/employees"),
        apiFetch<Pointage[]>("/pointage"),
      ]);
      setEmployees(emp);
      setPointages(pt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  function openPointageFor(employeeId: string): Pointage | undefined {
    return pointages.find((p) => p.employeeId === employeeId && p.active && !p.heureDepart && p.dateJour === todayStr());
  }

  async function handleToggle(employee: Employee) {
    const open = openPointageFor(employee.id);
    setPending(employee.id);
    try {
      if (open) {
        await apiFetch<Pointage>(`/pointage/${open.id}/depart`, { method: "POST" });
      } else {
        await apiFetch<Pointage>("/pointage/arrivee", { method: "POST", body: JSON.stringify({ employeeId: employee.id }) });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du pointage");
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Pointage</Text>
          {user && <Text style={styles.userInfo}>{user.nom}</Text>}
        </View>
        <View style={styles.headerActions}>
          {/* @ts-expect-error -- navigation typee globalement, pas de RootParamList declare (app minimale, 2 ecrans) */}
          <TouchableOpacity onPress={() => navigation.navigate("Chantiers")}>
            <Text style={styles.navLink}>Chantiers</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logout}>Deconnexion</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && <ActivityIndicator style={styles.loader} color="#f59e0b" />}
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={employees.filter((e) => e.active)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#f59e0b" />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Aucun employe.</Text> : null}
        renderItem={({ item }) => {
          const open = openPointageFor(item.id);
          const busy = pending === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <View style={[styles.dot, { backgroundColor: item.couleur }]} />
                <View>
                  <Text style={styles.cardTitle}>{item.prenom} {item.nom}</Text>
                  {open && <Text style={styles.cardSub}>Arrive a {formatHeure(open.heureArrivee)}</Text>}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.button, open ? styles.buttonOutline : styles.buttonFilled]}
                onPress={() => handleToggle(item)}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={open ? "#f59e0b" : "#0b1120"} />
                ) : (
                  <Text style={open ? styles.buttonTextOutline : styles.buttonTextFilled}>
                    {open ? "Pointer depart" : "Pointer arrivee"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  navLink: { color: "#f59e0b", fontSize: 14 },
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#f3f4f6" },
  cardSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  button: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  buttonFilled: { backgroundColor: "#f59e0b" },
  buttonOutline: { borderWidth: 1, borderColor: "#f59e0b" },
  buttonTextFilled: { color: "#0b1120", fontWeight: "600", fontSize: 13 },
  buttonTextOutline: { color: "#f59e0b", fontWeight: "600", fontSize: 13 },
});
