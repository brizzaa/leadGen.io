import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Tag,
  Loader2,
  Zap,
  XCircle,
  Folder,
} from "lucide-react";
import GroupManager from "./GroupManager";
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
  groups = [],
  onRefreshGroups,
}) {
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    let finalCategory;
    if (category === "__all__") finalCategory = "attività";
    else if (category === "__custom__") finalCategory = customCategory;
    else finalCategory = category;
    if (!area.trim() || !finalCategory.trim()) return;
    onSearch({ area: area.trim(), category: finalCategory.trim() });
  };

  return (
    <Card className="search-panel-card">
      <CardHeader className="search-panel-header">
        <div className="search-panel-header__icon">
          <Search className="w-5 h-5 text-[#0a0f1e]" />
        </div>
        <div className="flex items-center justify-between w-full">
          <div>
            <CardTitle className="search-panel-title">Trova Business</CardTitle>
            <CardDescription className="search-panel-desc">
              Cerca attività locali su Google Maps e identifica i lead migliori
            </CardDescription>
          </div>
          <GroupManager groups={groups} onRefresh={onRefreshGroups} />
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
