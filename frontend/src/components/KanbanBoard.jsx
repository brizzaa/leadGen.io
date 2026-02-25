import { useState, useMemo } from "react";
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
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";

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
    label: "Vinto",
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
  const [activeId, setActiveId] = useState(null);

  // useSensors and useSensor are used to configure mouse/keyboard input tracking
  // distance: 5 means the user must drag at least 5px before we register a drag.
  // This helps distinguish clicks vs frags.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(() => {
    return STATUSES.reduce((acc, s) => {
      acc[s.id] = businesses.filter((b) => b.status === s.id);
      return acc;
    }, {});
  }, [businesses]);

  const handleDragStart = (e) => {
    setActiveId(e.active.id);
  };

  const handleDragEnd = async (e) => {
    const { active, over } = e;
    setActiveId(null);

    // If dropped nowhere, or no change is made, just skip
    if (!over) return;

    const bizId = active.id;
    const targetStatusId = over.id;

    const biz = businesses.find((b) => b.id === bizId);
    if (biz && biz.status !== targetStatusId) {
      await onStatusUpdate(biz.id, targetStatusId);
    }
  };

  const activeBusiness = useMemo(
    () => businesses.find((b) => b.id === activeId),
    [activeId, businesses],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="kanban-board">
        {STATUSES.map((status) => {
          const cards = grouped[status.id] || [];
          return (
            <KanbanColumn
              key={status.id}
              status={status}
              cards={cards}
              activeId={activeId}
              navigate={navigate}
            />
          );
        })}
      </div>

      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: "0.4" } },
          }),
        }}
      >
        {activeId && activeBusiness ? (
          <KanbanCard business={activeBusiness} isOverlay={true} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({ status, cards, activeId, navigate }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column transition-colors duration-200 ${
        isOver ? "bg-muted/40 ring-1 ring-border/50" : ""
      }`}
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

      {/* Column Body / Cards */}
      <div className="kanban-column__cards">
        {cards.length === 0 && !isOver && (
          <div className="kanban-empty">
            <Building2 className="w-5 h-5 mb-1 opacity-30" />
            <span className="text-xs">Nessun lead</span>
          </div>
        )}

        <AnimatePresence>
          {cards.map((biz) => (
            <DraggableKanbanCard
              key={biz.id}
              business={biz}
              isDragging={activeId === biz.id}
              onClick={() => navigate(`/business/${biz.id}`)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DraggableKanbanCard({ business, isDragging, onClick }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: business.id,
    data: business,
  });

  return (
    <motion.div
      layout
      layoutId={business.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.3 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="outline-none origin-center"
    >
      <KanbanCard business={business} isOverlay={false} onClick={onClick} />
    </motion.div>
  );
}

function KanbanCard({ business: biz, isOverlay, onClick }) {
  const hasWebsite =
    biz.website &&
    !biz.website.includes("facebook.com") &&
    biz.website !== "None";

  return (
    <div
      onClick={!isOverlay ? onClick : undefined}
      className={`kanban-card group cursor-grab active:cursor-grabbing ${
        isOverlay
          ? "kanban-card--dragging scale-105 shadow-xl rotate-1 ring-1 ring-border"
          : ""
      }`}
    >
      {/* Drag handle */}
      <div className="kanban-card__grip">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
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
