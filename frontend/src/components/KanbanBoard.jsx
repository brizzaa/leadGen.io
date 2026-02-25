import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  GripVertical,
  ExternalLink,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

const STATUSES = [
  {
    id: "Inviata Mail",
    label: "Inviata Mail",
    color: "border-t-blue-400",
    dot: "bg-blue-400",
    headerBg: "bg-blue-400/5",
  },
  {
    id: "In Trattativa",
    label: "In Trattativa",
    color: "border-t-yellow-400",
    dot: "bg-yellow-400",
    headerBg: "bg-yellow-400/5",
  },
  {
    id: "Vinto (Cliente)",
    label: "Vinto ✓",
    color: "border-t-emerald-400",
    dot: "bg-emerald-400",
    headerBg: "bg-emerald-400/5",
  },
  {
    id: "Perso",
    label: "Perso",
    color: "border-t-red-400",
    dot: "bg-red-400",
    headerBg: "bg-red-400/5",
  },
];

export default function KanbanBoard({ businesses, onStatusUpdate }) {
  const navigate = useNavigate();
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const dragDataRef = useRef(null);

  // Group businesses by status (pipeline stages only, "Da Contattare" excluded)
  const grouped = STATUSES.reduce((acc, s) => {
    acc[s.id] = businesses.filter((b) => b.status === s.id);
    return acc;
  }, {});

  const handleDragStart = (e, business) => {
    setDraggingId(business.id);
    dragDataRef.current = business;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStatus(null);
    dragDataRef.current = null;
  };

  const handleDragOver = (e, statusId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(statusId);
  };

  const handleDrop = async (e, statusId) => {
    e.preventDefault();
    const biz = dragDataRef.current;
    if (!biz || biz.status === statusId) {
      handleDragEnd();
      return;
    }
    await onStatusUpdate(biz.id, statusId);
    handleDragEnd();
  };

  return (
    <div className="kanban-board">
      {STATUSES.map((status) => {
        const cards = grouped[status.id] || [];
        const isOver = dragOverStatus === status.id;
        return (
          <div
            key={status.id}
            className={`kanban-column ${isOver ? "kanban-column--over" : ""}`}
            onDragOver={(e) => handleDragOver(e, status.id)}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(e) => handleDrop(e, status.id)}
          >
            {/* Column Header */}
            <div
              className={`kanban-column__header border-t-2 ${status.color} ${status.headerBg}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                  <span className="text-sm font-medium text-foreground">
                    {status.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono">
                  {cards.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="kanban-column__cards">
              {isOver && draggingId && (
                <div className="kanban-drop-indicator" />
              )}
              {cards.length === 0 && !isOver && (
                <div className="kanban-empty">
                  <Building2 className="w-5 h-5 mb-1 opacity-30" />
                  <span className="text-xs">Nessun lead</span>
                </div>
              )}
              {cards.map((biz) => (
                <KanbanCard
                  key={biz.id}
                  business={biz}
                  isDragging={draggingId === biz.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onClick={() => navigate(`/business/${biz.id}`)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  business: biz,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}) {
  const hasWebsite =
    biz.website &&
    !biz.website.includes("facebook.com") &&
    biz.website !== "None";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, biz)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`kanban-card group ${isDragging ? "kanban-card--dragging" : ""}`}
    >
      {/* Drag handle */}
      <div className="kanban-card__grip">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
      </div>

      <div className="kanban-card__body">
        {/* Name */}
        <div className="flex items-start justify-between gap-1">
          <span className="font-medium text-sm text-foreground leading-tight line-clamp-2">
            {biz.name}
          </span>
          <ExternalLink className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all flex-shrink-0 mt-0.5" />
        </div>

        {/* Area */}
        {biz.area && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{biz.area}</span>
          </div>
        )}

        {/* Category */}
        {biz.category && (
          <span className="inline-block text-xs text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded mt-1.5 max-w-full truncate">
            {biz.category}
          </span>
        )}

        {/* Footer icons */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
          {biz.rating && (
            <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>{biz.rating?.toFixed(1)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            {biz.phone && (
              <Phone className="w-3 h-3 text-muted-foreground/50" />
            )}
            {biz.email && <Mail className="w-3 h-3 text-muted-foreground/50" />}
            {hasWebsite && (
              <Globe className="w-3 h-3 text-muted-foreground/50" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
