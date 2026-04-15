import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, XCircle, Globe, Facebook, Users, HelpCircle, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TableFilters({
  filters,
  onFiltersChange,
  groups = [],
}) {
  const [localSearch, setLocalSearch] = useState(filters.search || "");

  // Sincronizza localSearch quando filters.search cambia dall'esterno
  useEffect(() => {
    setLocalSearch(filters.search || "");
  }, [filters.search]);

  // Debounce: aggiorna il filtro globale dopo 500ms di inattività
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters.search || "")) {
        onFiltersChange({ ...filters, search: localSearch });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localSearch]);

  const filterItems = [
    { key: "noWebsite",    label: "Senza sito",     icon: <Globe className="w-3 h-3" /> },
    { key: "facebookOnly", label: "Solo Facebook",  icon: <Facebook className="w-3 h-3" /> },
    { key: "fewReviews",   label: "< 10 rec.",      icon: <Users className="w-3 h-3" /> },
    { key: "unclaimedOnly",label: "Non rivendicate",icon: <HelpCircle className="w-3 h-3" /> },
    { key: "mobileOnly",   label: "WhatsApp",       icon: <MessageCircle className="w-3 h-3" />, activeClass: "bg-[#25D366] text-white border-[#25D366] hover:bg-[#1ebe5d]" },
  ];

  return (
    <div className="bg-card border-x border-t border-border rounded-t-lg p-4 pb-4 mt-4 mb-0 flex-shrink-0 relative z-10 shadow-sm overflow-visible">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <span className="flex items-center text-sm font-medium text-foreground whitespace-nowrap">
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filtri:
        </span>

        <div className="flex flex-wrap gap-4 lg:gap-6 items-center flex-1">
          <div className="flex flex-wrap gap-2 items-center">
            {filterItems.map(({ key, label, icon, activeClass }) => {
              const isActive = filters[key];
              return (
                <button
                  key={key}
                  onClick={() => onFiltersChange({ ...filters, [key]: !isActive })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 select-none ${
                    isActive
                      ? activeClass || "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Stato:
            </span>
            <Select
              value={filters.status}
              onValueChange={(val) =>
                onFiltersChange({ ...filters, status: val })
              }
            >
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue placeholder="Tutti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tutti">Tutti</SelectItem>
                <SelectItem value="Da Contattare">Da Contattare</SelectItem>
                <SelectItem value="Inviata Mail">Inviata Mail</SelectItem>
                <SelectItem value="In Trattativa">In Trattativa</SelectItem>
                <SelectItem value="Vinto (Cliente)">Vinto (Cliente)</SelectItem>
                <SelectItem value="Perso">Perso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Gruppo:
            </span>
            <Select
              value={filters.groupId || "all"}
              onValueChange={(val) =>
                onFiltersChange({
                  ...filters,
                  groupId: val === "all" ? null : val,
                })
              }
            >
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue placeholder="Tutti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i gruppi</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: g.color }}
                      />
                      {g.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="w-full md:w-80 ml-auto">
          <div className="relative group">
            <AnimatePresence mode="wait">
              {localSearch ? (
                <motion.button
                  key="clear"
                  initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
                  transition={{ duration: 0.15 }}
                  type="button"
                  onClick={() => setLocalSearch("")}
                  className="absolute left-2.5 top-2.5 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center z-10"
                >
                  <XCircle className="h-4 w-4" />
                </motion.button>
              ) : (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-2.5 top-2.5"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
            <Input
              placeholder="Cerca nel database..."
              className="pl-9 h-9 text-sm transition-all duration-300 focus:pl-10"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
