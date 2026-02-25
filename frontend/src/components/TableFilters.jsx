import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [prevSearch, setPrevSearch] = useState(filters.search || "");

  if (filters.search !== prevSearch) {
    setLocalSearch(filters.search || "");
    setPrevSearch(filters.search || "");
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters.search || "")) {
        onFiltersChange({ ...filters, search: localSearch });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localSearch, onFiltersChange, filters]);

  const filterItems = [
    { key: "noWebsite", label: "Senza sito web" },
    { key: "facebookOnly", label: "Solo Facebook" },
    { key: "fewReviews", label: "< 10 recensioni" },
    { key: "unclaimedOnly", label: "Non Rivendicate" },
  ];

  return (
    <div className="bg-card border-x border-t border-border rounded-t-lg p-4 pb-4 mt-4 mb-0 flex-shrink-0 relative z-10 shadow-sm overflow-visible">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <span className="flex items-center text-sm font-medium text-foreground whitespace-nowrap">
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filtri:
        </span>

        <div className="flex flex-wrap gap-4 lg:gap-6 items-center flex-1">
          <div className="flex flex-wrap gap-4 items-center">
            {filterItems.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`filter-${key}`}
                  checked={filters[key]}
                  onCheckedChange={(checked) =>
                    onFiltersChange({ ...filters, [key]: checked })
                  }
                />
                <Label
                  htmlFor={`filter-${key}`}
                  className="text-xs font-medium cursor-pointer"
                >
                  {label}
                </Label>
              </div>
            ))}
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
