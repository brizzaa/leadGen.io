import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Tag,
  Loader2,
  SlidersHorizontal,
  Zap,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const CATEGORIES = [
  "ristorante",
  "pizzeria",
  "bar",
  "hotel",
  "parrucchiere",
  "idraulico",
  "elettricista",
  "meccanico",
  "dentista",
  "medico",
  "studio legale",
  "commercialista",
  "panificio",
  "pasticceria",
  "farmacia",
  "ottico",
  "palestra",
  "centro estetico",
  "falegname",
  "gioielleria",
  "negozio abbigliamento",
  "supermercato",
  "tabaccheria",
];

export default function SearchPanel({
  onSearch,
  onStop,
  isLoading,
  filters,
  onFiltersChange,
}) {
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [localSearch, setLocalSearch] = useState(filters.search || "");
  const [prevSearch, setPrevSearch] = useState(filters.search || "");

  // Sync localSearch if filters.search changes externally (e.g. reset)
  if (filters.search !== prevSearch) {
    setLocalSearch(filters.search || "");
    setPrevSearch(filters.search || "");
  }

  // Debounce search update
  useEffect(() => {
    const timer = setTimeout(() => {
      // Use localSearch to avoid stale closures, but check against current filters.search
      if (localSearch !== (filters.search || "")) {
        onFiltersChange({ ...filters, search: localSearch });
      }
    }, 500);

    return () => clearTimeout(timer);
    // Be careful with dependencies. We really only want to trigger this when localSearch changes.
    // However, onFiltersChange and filters are also needed to perform the update.
  }, [localSearch, onFiltersChange, filters]);

  const handleSubmit = (e) => {
    e.preventDefault();
    let finalCategory;
    if (category === "__all__") finalCategory = "attività";
    else if (category === "__custom__") finalCategory = customCategory;
    else finalCategory = category;
    if (!area.trim() || !finalCategory.trim()) return;
    onSearch({ area: area.trim(), category: finalCategory.trim() });
  };

  const filterItems = [
    { key: "noWebsite", label: "Senza sito web" },
    { key: "facebookOnly", label: "Solo Facebook" },
    { key: "fewReviews", label: "< 10 recensioni" },
    { key: "unclaimedOnly", label: "Non Rivendicate" },
  ];

  return (
    <Card className="search-panel-card">
      <CardHeader className="search-panel-header">
        <div className="search-panel-header__icon">
          <Search className="w-5 h-5 text-[#0a0f1e]" />
        </div>
        <div>
          <CardTitle className="search-panel-title">Trova Business</CardTitle>
          <CardDescription className="search-panel-desc">
            Cerca attività locali su Google Maps e identifica i lead migliori
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="search-panel-content">
        <form onSubmit={handleSubmit} className="search-panel__form">
          <div className="search-panel__fields">
            <div className="form-group">
              <Label htmlFor="area-input" className="form-label">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />
                Area / Città
              </Label>
              <Input
                id="area-input"
                type="text"
                placeholder="es. Rovigo, Padova, Milano..."
                value={area}
                onChange={(e) => setArea(e.target.value)}
                required
                className="search-input mt-3"
              />
            </div>

            <div className="form-group">
              <Label htmlFor="category-select" className="form-label">
                <Tag className="w-3.5 h-3.5 inline mr-1" />
                Categoria
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger
                  id="category-select"
                  className="search-input mt-3"
                >
                  <SelectValue placeholder="Seleziona una categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">
                    ✏️ Altra categoria...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {category === "__custom__" && (
              <div className="form-group">
                <Label className="form-label">Categoria personalizzata</Label>
                <Input
                  type="text"
                  placeholder="es. falegname, giardiniere..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                  className="search-input"
                />
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="search-panel__filters">
            <span className="filter-label">
              <SlidersHorizontal className="w-3.5 h-3.5 inline mr-1" />
              Mostra:
            </span>
            <div className="flex gap-4 items-center w-full">
              <div className="flex-1 flex gap-6 items-center">
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
                <span className="filter-label whitespace-nowrap">Stato:</span>
                <Select
                  value={filters.status}
                  onValueChange={(val) =>
                    onFiltersChange({ ...filters, status: val })
                  }
                >
                  <SelectTrigger className="search-input w-[180px] h-9">
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tutti">Tutti</SelectItem>
                    <SelectItem value="Da Contattare">Da Contattare</SelectItem>
                    <SelectItem value="Inviata Mail">Inviata Mail</SelectItem>
                    <SelectItem value="In Trattativa">In Trattativa</SelectItem>
                    <SelectItem value="Vinto (Cliente)">
                      Vinto (Cliente)
                    </SelectItem>
                    <SelectItem value="Perso">Perso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-sm ml-auto">
                <div className="relative w-full group">
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
                        <XCircle className="h-3.5 w-3.5" />
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
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Input
                    placeholder="Cerca nel database (nome, indirizzo...)"
                    className="pl-8 h-9 text-xs transition-all duration-300 focus:pl-9"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Button
              id="search-submit-btn"
              type="submit"
              disabled={isLoading}
              className="search-submit-btn w-1/4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ricerca in corso...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Avvia Ricerca
                </>
              )}
            </Button>

            {isLoading && (
              <Button
                type="button"
                variant="destructive"
                onClick={onStop}
                style={{
                  flex: "0 0 auto",
                  padding: "0 24px",
                  height: "42px",
                  fontSize: "15px",
                }}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
