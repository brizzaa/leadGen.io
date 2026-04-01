import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Calendar, ArrowRight, X, Phone, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays < 0) return `${Math.abs(diffDays)}g fa`;
  if (diffDays === 0) return "Oggi";
  if (diffDays === 1) return "Domani";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export default function RemindersWidget() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissing, setDismissing] = useState(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_URL}/api/activity/reminders/due`);
        if (res.ok) {
          const data = await res.json();
          setReminders(data);
          setIsVisible(data.length > 0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetch_();
    const interval = setInterval(fetch_, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Rimuove il reminder svuotando next_contact
  const handleDismiss = async (e, id) => {
    e.stopPropagation();
    setDismissing(id);
    try {
      await fetch(`${API_URL}/api/businesses/${id}/next-contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next_contact: "" }),
      });
      const updated = reminders.filter((r) => r.id !== id);
      setReminders(updated);
      if (updated.length === 0) {
        setIsOpen(false);
        setIsVisible(false);
      }
    } catch (e) {
      console.error(e);
    }
    setDismissing(null);
  };

  if (isLoading || !isVisible) return null;

  const overdueCount = reminders.filter((r) =>
    isOverdue(r.next_contact),
  ).length;

  return (
    <>
      {/* Bell badge */}
      <AnimatePresence>
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={() => setIsOpen(true)}
          className="reminder-bell"
          title={`${reminders.length} follow-up in scadenza`}
        >
          <Bell className="w-4 h-4" />
          <span className="reminder-bell__badge">{reminders.length}</span>
        </motion.button>
      </AnimatePresence>

      {/* Drawer panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-x-0 bottom-0 bg-black/40 z-40"
              style={{ top: "72px" }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="reminder-panel"
            >
              {/* Header */}
              <div className="reminder-panel__header">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold">
                    Follow-up in scadenza
                  </h2>
                  {overdueCount > 0 && (
                    <span className="text-xs bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 rounded-md font-medium">
                      {overdueCount} scaduti
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Items */}
              <div className="reminder-panel__list">
                <AnimatePresence>
                  {reminders.map((r) => {
                    const overdue = isOverdue(r.next_contact);
                    return (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`reminder-item ${overdue ? "reminder-item--overdue" : ""}`}
                        onClick={() => {
                          navigate(`/business/${r.id}`);
                          setIsOpen(false);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {r.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {r.area} · {r.category}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium ${
                                overdue
                                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                                  : "bg-yellow-400/10 text-yellow-500 border border-yellow-400/20"
                              }`}
                            >
                              <Calendar className="w-3 h-3" />
                              {formatDate(r.next_contact)}
                            </div>
                            {/* Dismiss button */}
                            <button
                              onClick={(e) => handleDismiss(e, r.id)}
                              disabled={dismissing === r.id}
                              className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0"
                              title="Rimuovi reminder"
                            >
                              {dismissing === r.id ? (
                                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin block" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Quick contact icons */}
                        <div className="flex items-center gap-2 mt-2">
                          {r.phone && (
                            <a
                              href={`tel:${r.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="reminder-quick-btn"
                            >
                              <Phone className="w-3 h-3" />
                              Chiama
                            </a>
                          )}
                          {r.email && (
                            <a
                              href={`mailto:${r.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="reminder-quick-btn"
                            >
                              <Mail className="w-3 h-3" />
                              Email
                            </a>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground/60 flex items-center gap-1">
                            Apri <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
