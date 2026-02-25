import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Mail,
  ArrowRightLeft,
  MessageSquare,
  Phone,
  Globe,
  Instagram,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL || "";

const TYPE_MAP = {
  status: {
    icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
  },
  email: {
    icon: <Mail className="w-3.5 h-3.5" />,
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  note: {
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    color: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  phone: {
    icon: <Phone className="w-3.5 h-3.5" />,
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  website: {
    icon: <Globe className="w-3.5 h-3.5" />,
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    dot: "bg-purple-400",
  },
  social: {
    icon: <Instagram className="w-3.5 h-3.5" />,
    color: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    dot: "bg-pink-400",
  },
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Adesso";
  if (diffMins < 60) return `${diffMins} min fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  if (diffDays === 1) return "Ieri";
  if (diffDays < 7) return `${diffDays}g fa`;
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ActivityTimeline({ businessId }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/activity/${businessId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch(`${API_URL}/api/activity/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "note", message: newNote.trim() }),
      });
      if (res.ok) {
        setNewNote("");
        setShowInput(false);
        await fetchLogs();
      }
    } catch (e) {
      console.error(e);
    }
    setIsAdding(false);
  };

  const handleDeleteLog = async (logId) => {
    try {
      await fetch(`${API_URL}/api/activity/log/${logId}`, { method: "DELETE" });
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary/70" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Storico Attività
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowInput((v) => !v)}
          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-3.5 h-3.5" />
          Nota rapida
        </Button>
      </div>

      {/* Quick note input */}
      {showInput && (
        <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            placeholder="Aggiungi una nota rapida..."
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors"
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={isAdding || !newNote.trim()}
            className="h-9 px-3"
          >
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva"}
          </Button>
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Nessuna attività registrata</p>
          <p className="text-xs mt-1 opacity-60">
            Le azioni verranno tracciate automaticamente
          </p>
        </div>
      ) : (
        <div className="relative pl-4">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

          <div className="flex flex-col gap-3">
            {logs.map((log) => {
              const typeInfo = TYPE_MAP[log.type] || TYPE_MAP.note;
              return (
                <div
                  key={log.id}
                  className="relative flex items-start gap-3 group"
                >
                  {/* Dot */}
                  <div
                    className={`absolute -left-[13px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background ${typeInfo.dot} flex-shrink-0`}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md border ${typeInfo.color}`}
                        >
                          {typeInfo.icon}
                        </span>
                        <span className="text-sm text-foreground leading-snug">
                          {log.message}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </span>
                        {log.type === "note" && (
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
