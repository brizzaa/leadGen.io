import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  CheckCircle2,
  XCircle,
  MapPin,
  LayoutGrid,
  List,
  Map as MapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import SearchPanel from "../components/SearchPanel";
import ProgressLog from "../components/ProgressLog";
import TableFilters from "../components/TableFilters";
import BusinessTable from "../components/BusinessTable";
import KanbanBoard from "../components/KanbanBoard";
import BusinessMap from "../components/BusinessMap";
import RemindersWidget from "../components/RemindersWidget";
import { ModeToggle } from "../components/ModeToggle";
import "../App.css";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Dashboard() {
  const [businesses, setBusinesses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessages, setProgressMessages] = useState([]);
  const [toast, setToast] = useState(null);
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("leadgen-view") || "table",
  );
  const [filters, setFilters] = useState({
    noWebsite: false,
    facebookOnly: false,
    fewReviews: false,
    unclaimedOnly: false,
    status: "Tutti",
    search: "",
    groupId: null,
  });

  const setView = (mode) => {
    setViewMode(mode);
    localStorage.setItem("leadgen-view", mode);
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        noWebsite: filters.noWebsite,
        facebookOnly: filters.facebookOnly,
        fewReviews: filters.fewReviews,
        unclaimedOnly: filters.unclaimedOnly,
        status: filters.status,
        search: filters.search || "",
        ...(filters.groupId && { groupId: filters.groupId }),
      });

      const res = await fetch(`${API_URL}/api/businesses?${params.toString()}`);
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const data = await res.json();

      const businessesArray = Array.isArray(data)
        ? data
        : data.businesses || [];
      setBusinesses(businessesArray);
    } catch (err) {
      console.error("Error fetching businesses:", err);
      showToast("Errore nel caricamento dei dati", "error");
      setBusinesses([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/groups`);
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (err) {
      console.error("Error fetching groups:", err);
    }
  }, []);

  useEffect(() => {
    fetchBusinesses();
    fetchGroups();
  }, [fetchBusinesses, fetchGroups]);

  const handleSearch = async ({ area, category }) => {
    setIsLoading(true);
    setProgressMessages([]);

    try {
      const response = await fetch(`${API_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, category }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress") {
              setProgressMessages((prev) => [...prev, event.message]);
            } else if (event.type === "done") {
              setProgressMessages((prev) => [...prev, event.message]);
              await fetchBusinesses();
              showToast(event.message, "success");
            } else if (event.type === "error") {
              showToast(`Errore: ${event.message}`, "error");
            }
          } catch {
            /* ignore json parse errors */
          }
        }
      }
    } catch (e) {
      showToast(`Errore di connessione: ${e.message}`, "error");
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgressMessages([]), 5000);
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`${API_URL}/api/search/stop`, { method: "POST" });
      showToast("Richiesta di stop inviata. Attendere...", "success");
    } catch {
      showToast("Impossibile fermare la ricerca", "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_URL}/api/businesses/${id}`, { method: "DELETE" });
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      showToast("Business eliminato");
    } catch {
      showToast("Errore durante eliminazione", "error");
    }
  };

  const handleDeleteBatch = async (ids) => {
    try {
      await fetch(`${API_URL}/api/businesses/delete-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setBusinesses((prev) => prev.filter((b) => !ids.includes(b.id)));
      showToast(`${ids.length} business eliminati`);
    } catch {
      showToast("Errore durante l'eliminazione multipla", "error");
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/api/businesses/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setBusinesses((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)),
        );
        showToast("Stato aggiornato");
      }
    } catch {
      showToast("Errore durante l'aggiornamento dello stato", "error");
    }
  };

  return (
    <div className="app bg-background text-foreground">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-logo">
            <div className="app-logo__icon">
              <MapPin className="w-5 h-5 text-background" />
            </div>
            <div>
              <h1 className="app-logo__title">LeadGen.io</h1>
              <span className="text-muted-foreground text-md">
                Find your next Lead!
              </span>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, staggerChildren: 0.1 }}
            className="header-stats"
          >
            <StatPill
              icon={<Building2 className="w-4 h-4" />}
              value={businesses?.length || 0}
              label="Totale filtrati"
            />
            <div className="ml-2">
              <ModeToggle />
            </div>
          </motion.div>
        </div>
      </header>

      <main className="app-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="app-container"
        >
          <SearchPanel
            onSearch={handleSearch}
            onStop={handleStop}
            isLoading={isLoading}
            groups={groups}
            onRefreshGroups={fetchGroups}
          />
          {progressMessages.length > 0 && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ProgressLog messages={progressMessages} />
              </motion.div>
            </AnimatePresence>
          )}
          <section className="results-section">
            <div className="flex items-center justify-between">
              <h2 className="section-title">
                Business Trovati
                <span className="section-subtitle">
                  {businesses.length} totali trovati
                </span>
              </h2>
              {/* View toggle */}
              <div className="view-toggle">
                <button
                  onClick={() => setView("table")}
                  className={`view-toggle__btn ${viewMode === "table" ? "view-toggle__btn--active" : ""}`}
                  title="Vista Tabella"
                >
                  <List className="w-4 h-4" />
                  <span>Tabella</span>
                </button>
                <button
                  onClick={() => setView("kanban")}
                  className={`view-toggle__btn ${viewMode === "kanban" ? "view-toggle__btn--active" : ""}`}
                  title="Vista Kanban"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Kanban</span>
                </button>
                <button
                  onClick={() => setView("map")}
                  className={`view-toggle__btn ${viewMode === "map" ? "view-toggle__btn--active" : ""}`}
                  title="Vista Mappa"
                >
                  <MapIcon className="w-4 h-4" />
                  <span>Mappa</span>
                </button>
              </div>
            </div>

            <TableFilters
              filters={filters}
              onFiltersChange={setFilters}
              groups={groups}
            />

            <AnimatePresence mode="wait">
              {viewMode === "table" ? (
                <motion.div
                  key="table"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <BusinessTable
                    businesses={businesses}
                    onDelete={handleDelete}
                    onDeleteBatch={handleDeleteBatch}
                    onStatusUpdate={handleStatusUpdate}
                    onRefresh={fetchBusinesses}
                    groups={groups}
                  />
                </motion.div>
              ) : viewMode === "kanban" ? (
                <motion.div
                  key="kanban"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <KanbanBoard
                    businesses={businesses}
                    onStatusUpdate={handleStatusUpdate}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="map"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4"
                >
                  <BusinessMap
                    businesses={businesses}
                    onStatusUpdate={handleStatusUpdate}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </motion.div>
      </main>

      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00d4aa]" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 text-[#ff4d6d]" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <RemindersWidget />
    </div>
  );
}

const statPillVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

function StatPill({ icon, value, label }) {
  return (
    <motion.div
      variants={statPillVariants}
      className="stat-pill relative overflow-hidden group hover:bg-muted/30 transition-colors border border-transparent hover:border-border cursor-default"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="stat-pill__icon text-primary/70">{icon}</span>
      <span className="stat-pill__value relative z-10">{value}</span>
      <span className="stat-pill__label relative z-10">{label}</span>
    </motion.div>
  );
}
