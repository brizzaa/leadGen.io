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
import GroupManager from "../groups/GroupManager";
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
  // cibo & bevande
  "ristorante","pizzeria","bar","trattoria","osteria","enoteca","gelateria",
  "piadineria","rosticceria","kebab","sushi","gastronomia","macelleria",
  "pescheria","fruttivendolo","caffetteria","wine bar","birrificio","cantina",
  "pasticceria","panificio","fast food",
  // salute
  "dentista","medico","farmacia","fisioterapista","psicologo","veterinario",
  "laboratorio analisi","nutrizionista","pediatra","cardiologo","ortopedico",
  "dermatologo","ginecologo","oculista","clinica","ambulatorio","centro medico",
  // estetica & wellness
  "parrucchiere","centro estetico","palestra","barbiere","spa","centro massaggi",
  "nail salon","solarium","centro benessere","yoga","pilates","crossfit",
  "arti marziali","danza","piscina",
  // automotive
  "meccanico","carrozzeria","gommista","autolavaggio","officina","elettrauto",
  "concessionaria auto","autonoleggio","stazione di servizio",
  // servizi professionali
  "studio legale","commercialista","notaio","architetto","geometra",
  "agenzia immobiliare","assicurazioni","agenzia di viaggio","consulente del lavoro",
  "studio fotografico","agenzia pubblicitaria","web agency","banca",
  // casa & artigianato
  "idraulico","elettricista","falegname","imbianchino","giardiniere","muratore",
  "fabbro","impresa di pulizie","traslochi","serramentista","arredamento",
  "cucine","infissi","pavimenti","ceramiche","tende",
  // retail
  "hotel","negozio abbigliamento","supermercato","tabaccheria","gioielleria",
  "ottico","libreria","cartoleria","ferramenta","elettronica","calzature",
  "profumeria","casalinghi","elettrodomestici","mobili","pet shop","fiori",
  "sport","informatica","telefonia","abbigliamento bambini","orologeria",
  "antiquariato","merceria","cosmetica","illuminazione","bricolage","edicola",
  // formazione & intrattenimento
  "scuola guida","scuola di lingue","musica","scuola di cucina",
  "campo da tennis","circolo sportivo","bowling","maneggio","cinema","teatro",
  // altri servizi
  "bed and breakfast","agriturismo","affittacamere",
  "lavanderia","sartoria","calzolaio","riparazione telefoni","centro stampa",
  "tipografia","pompe funebri","toelettatura cani",
  "fotografo","parafarmacia","erboristeria","centro scommesse",
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
    else if (category === "__grid__") finalCategory = "__grid__";
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
                  <SelectItem value="__all__">Tutti (per categoria)</SelectItem>
                  <SelectItem value="__grid__">⚡ Scan Completo (griglia)</SelectItem>
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
