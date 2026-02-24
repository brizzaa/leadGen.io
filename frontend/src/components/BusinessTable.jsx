import { useState, useEffect, useRef } from "react";
import {
  Search,
  RefreshCw,
  Download,
  Trash2,
  Phone,
  Mail,
  Globe,
  Star,
  MessageSquare,
  Facebook,
  Instagram,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MapPin,
  ExternalLink,
  MessageCircle,
  Building2,
  Calendar,
  FileText,
  Save,
  Zap,
  Loader2,
  Copy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_COLORS = {
  "Da Contattare": "text-muted-foreground",
  "Inviata Mail": "text-blue-500",
  "In Trattativa": "text-yellow-500",
  "Vinto (Cliente)": "text-emerald-500",
  Perso: "text-red-500",
};

const API_URL = import.meta.env.VITE_API_URL || "";
const isFacebook = (url) => url && url.toLowerCase().includes("facebook.com");

const formatUrl = (url) => {
  if (!url) return "#";
  // Remove hidden Google Maps font icons (Private Use Area unicode) that corrupt the URL
  let cleanUrl = url.replace(/[\uE000-\uF8FF]/g, "").trim();

  // Decodifica url da duckduckgo
  try {
    const urlObj = new URL(cleanUrl);
    if (urlObj.hostname.includes("duckduckgo.com")) {
      const uddg = urlObj.searchParams.get("uddg");
      if (uddg) {
        cleanUrl = decodeURIComponent(uddg);
      }
    }
  } catch {
    // block empty
  }

  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }
  // encode spaces and other invalid characters so the browser respects the href
  return encodeURI(cleanUrl);
};

const formatWhatsappUrl = (phone) => {
  if (!phone) return "#";
  let clean = phone.replace(/[^0-9+]/g, "");
  // Se è un numero italiano senza prefisso (inizia per 3), aggiungiamo +39
  if (clean.startsWith("3") && clean.length >= 9) {
    clean = "39" + clean;
  }
  // Rimuovi eventuali + dal link finale
  clean = clean.replace("+", "");
  return `https://wa.me/${clean}?text=Buongiorno,%20ho%20visto%20la%20sua%20attività%20su%20Google...`;
};

function SortIcon({ sortKey, sortDir, k }) {
  if (sortKey !== k)
    return <ChevronsUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />;
  return sortDir === "asc" ? (
    <ChevronUp className="w-3.5 h-3.5 ml-1 text-[#00d4aa]" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5 ml-1 text-[#00d4aa]" />
  );
}

function SortableHead({ label, k, sortKey, sortDir, onSort }) {
  return (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap hover:text-[#00d4aa] transition-colors"
      onClick={() => onSort(k)}
    >
      <span className="inline-flex items-center">
        {label}
        <SortIcon sortKey={sortKey} sortDir={sortDir} k={k} />
      </span>
    </TableHead>
  );
}

const MotionTableRow = motion(TableRow);

export default function BusinessTable({
  businesses,
  onDelete,
  onDeleteBatch,
  onStatusUpdate,
  onRefresh,
  groups = [],
}) {
  const [localSearch, setLocalSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tutti");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedIds, setSelectedIds] = useState([]);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [scanningIds, setScanningIds] = useState([]);
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [dialogConfig, setDialogConfig] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [direction, setDirection] = useState(0);
  const ITEMS_PER_PAGE = 20;

  const navigate = useNavigate();
  const tableRef = useRef(null);

  // Load saved search from sessionStorage if returning from detail
  useEffect(() => {
    const savedSearch = sessionStorage.getItem("returnToSearch");
    if (savedSearch) {
      setLocalSearch(savedSearch);
      setDebouncedSearch(savedSearch);
      sessionStorage.removeItem("returnToSearch");
    }
  }, []);

  // Reset page when filtering or sorting
  useEffect(() => {
    setCurrentPage(1);
    setDirection(0);
  }, [debouncedSearch, statusFilter, sortKey, sortDir]);

  // Debounce search update
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const handlePageChange = (newPage) => {
    setDirection(newPage > currentPage ? 1 : -1);
    setCurrentPage(newPage);
    // Use a tiny delay to ensure React has started the state transition/render
    setTimeout(() => {
      if (tableRef.current) {
        tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 10);
  };

  const handleOpenDetails = (b) => {
    sessionStorage.setItem("returnToSearch", b.name);
    navigate(`/business/${b.id}`);
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = businesses
    .filter((b) => {
      // Per il filtro di default ("Da Contattare"), trattiamo anche status non validi come "Da Contattare"
      const currentStatus = STATUS_COLORS[b.status]
        ? b.status
        : "Da Contattare";
      if (statusFilter !== "Tutti" && currentStatus !== statusFilter) {
        return false;
      }
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return (
        b.name?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q) ||
        b.area?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortKey] ?? "";
      let bVal = b[sortKey] ?? "";
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedResults = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const rowVariants = {
    hidden: (params) => ({
      opacity: 0,
      x: params.direction > 0 ? 30 : params.direction < 0 ? -30 : 0,
      y: params.direction === 0 ? 15 : 0,
    }),
    visible: (params) => ({
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        delay: params.index * 0.03,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      },
    }),
    exit: (params) => ({
      opacity: 0,
      x: params.direction > 0 ? -30 : params.direction < 0 ? 30 : 0,
      transition: { duration: 0.2 },
    }),
  };

  const startBatchSocialScan = (toScan) => {
    setIsBatchScanning(true);
    setBatchProgress("Inizializzazione...");

    const ids = toScan.map((b) => b.id).join(",");
    console.log(`[batch-social] Avvio EventSource per IDS: ${ids}`);
    const eventSource = new EventSource(
      `${API_URL}/api/businesses/scan-social-batch?ids=${ids}`,
    );

    eventSource.onopen = () => {
      console.log("[batch-social] Connessione SSE aperta");
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("[batch-social] Ricevuto evento:", data);
      if (data.type === "progress") {
        setBatchProgress(data.message);
      } else if (data.type === "done") {
        setBatchProgress(data.message);
        setTimeout(() => {
          setIsBatchScanning(false);
          onRefresh();
        }, 2000);
        eventSource.close();
      } else if (data.type === "error") {
        console.error("[batch-social] Errore ricevuto:", data.message);
        setDialogConfig({
          title: "Errore Scansione",
          description: "Errore: " + data.message,
          actionText: "OK",
        });
        setIsBatchScanning(false);
        eventSource.close();
      }
    };

    eventSource.onerror = (err) => {
      console.error("[batch-social] Errore connessione EventSource:", err);
      setIsBatchScanning(false);
      eventSource.close();
    };
  };

  const handleBatchSocialScan = async () => {
    // Pick first 50 that have NEVER been scanned
    const toScan = filtered.filter((b) => !b.last_social_scan_at).slice(0, 50);

    if (toScan.length === 0) {
      setDialogConfig({
        title: "Nessun Risultato",
        description: "Nessun business da scansionare nei risultati correnti.",
        actionText: "OK",
      });
      return;
    }

    setDialogConfig({
      title: "Avvia Scansione Social",
      description: `Avviare la scansione social per ${toScan.length} attività? Potrebbe richiedere qualche minuto.`,
      actionText: "Avvia Scansione",
      cancelText: "Annulla",
      onAction: () => startBatchSocialScan(toScan),
    });
  };

  const handleExport = () => {
    // Usa un link temporaneo per il download invece di window.open che può essere bloccato dai popup
    const url = `${API_URL}/api/businesses/export`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "businesses.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const toggleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
    } else {
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  const handleBatchDelete = () => {
    if (onDeleteBatch && selectedIds.length > 0) {
      setItemToDelete("batch");
    }
  };

  const handleBatchAddToGroup = async (groupId) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch(`${API_URL}/api/groups/${groupId}/batch-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessIds: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        onRefresh();
      }
    } catch (error) {
      console.error("Error batch adding to group:", error);
    }
  };

  const confirmDelete = () => {
    if (itemToDelete === "batch") {
      onDeleteBatch(selectedIds);
      setSelectedIds([]);
    } else if (itemToDelete) {
      onDelete(itemToDelete);
      // Remove from selectedIds just in case
      setSelectedIds((prev) => prev.filter((id) => id !== itemToDelete));
    }
    setItemToDelete(null);
  };

  return (
    <div className="business-table-wrapper" ref={tableRef}>
      {/* Toolbar */}
      <div className="business-table-toolbar">
        <div className="business-table-stats">
          <Badge variant="outline" className="badge-count">
            {filtered.length} risultati
          </Badge>
          {localSearch && (
            <Badge variant="secondary" className="badge-filtered">
              filtrati da {businesses.length}
            </Badge>
          )}
        </div>
        <div className="business-table-actions">
          <div className="relative flex items-center w-full group">
            <AnimatePresence mode="wait">
              {localSearch ? (
                <motion.button
                  key="clear-table"
                  initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
                  transition={{ duration: 0.15 }}
                  type="button"
                  onClick={() => {
                    setLocalSearch("");
                    setDebouncedSearch("");
                  }}
                  className="absolute left-[14px] z-10 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-0 border-none bg-transparent"
                  title="Cancella ricerca"
                >
                  <XCircle className="w-4 h-4" />
                </motion.button>
              ) : (
                <motion.div
                  key="search-table"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-[14px] z-10 pointer-events-none"
                >
                  <Search className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
            <Input
              id="table-search-input"
              type="text"
              placeholder="Cerca per nome, città, telefono..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setSelectedIds([]);
              }}
              className="table-search-input pl-10 pr-4 transition-all duration-300 focus:pl-11"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setSelectedIds([]);
            }}
          >
            <SelectTrigger className="w-[180px] h-[42px] border-border bg-transparent text-sm">
              <SelectValue placeholder="Stato" />
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
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <Select onValueChange={handleBatchAddToGroup}>
                <SelectTrigger className="h-9 w-[180px] bg-primary/10 border-primary/20 text-primary font-medium">
                  <div className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-primary" />
                    <span>Aggiungi a Gruppo</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {groups.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground italic text-center">
                      Crea un gruppo nel pannello di ricerca
                    </div>
                  ) : (
                    groups.map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          {group.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchDelete}
                className="toolbar-btn text-destructive-foreground h-9"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Elimina {selectedIds.length}
              </Button>
            </div>
          )}
          <Button
            id="refresh-btn"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="toolbar-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Aggiorna
          </Button>
          <Button
            id="export-csv-btn"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={businesses.length === 0}
            className="toolbar-btn"
          >
            <Download className="w-3.5 h-3.5" />
            Esporta CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchSocialScan}
            disabled={isBatchScanning || filtered.length === 0}
            className={`toolbar-btn ${isBatchScanning ? "animate-pulse border-primary" : ""}`}
          >
            {isBatchScanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <Instagram className="w-3.5 h-3.5 mr-1" />
            )}
            {isBatchScanning ? "In corso..." : "Scan"}
          </Button>
        </div>
      </div>

      {isBatchScanning && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">{batchProgress}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              // Note: This only stops local UI, backend keeps running unless we implement abort
              setIsBatchScanning(false);
            }}
          >
            Nascondi
          </Button>
        </div>
      )}

      {/* Table or empty state */}
      {filtered.length === 0 ? (
        <div className="business-table-empty">
          <Building2 className="w-12 h-12 opacity-20 mb-3" />
          <p>
            {businesses.length === 0
              ? "Nessun business salvato. Usa il pannello di ricerca per iniziare."
              : "Nessun risultato per questa ricerca."}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <Table className="business-table">
            <TableHeader>
              <TableRow className="table-header-row">
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={
                      paginatedResults.length > 0 &&
                      selectedIds.length >= paginatedResults.length &&
                      paginatedResults.every((b) => selectedIds.includes(b.id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const newIds = [
                          ...new Set([
                            ...selectedIds,
                            ...paginatedResults.map((b) => b.id),
                          ]),
                        ];
                        setSelectedIds(newIds);
                      } else {
                        const paginatedIds = new Set(
                          paginatedResults.map((b) => b.id),
                        );
                        setSelectedIds((prev) =>
                          prev.filter((id) => !paginatedIds.has(id)),
                        );
                      }
                    }}
                    aria-label="Seleziona pagina"
                  />
                </TableHead>
                <SortableHead
                  label="Nome"
                  k="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  label="Area"
                  k="area"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  label="Stato"
                  k="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />

                <SortableHead
                  label="Recensioni"
                  k="review_count"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  label="Rating"
                  k="rating"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <TableHead>Telefono</TableHead>
                <TableHead className="text-center">Email</TableHead>
                <TableHead className="text-center">Social</TableHead>
                <TableHead>Sito Web</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody className="relative">
              <AnimatePresence mode="popLayout" custom={direction}>
                {paginatedResults.map((b, i) => {
                  const displayStatus = STATUS_COLORS[b.status]
                    ? b.status
                    : "Da Contattare";
                  return (
                    <MotionTableRow
                      key={b.id}
                      custom={{ direction, index: i }}
                      variants={rowVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onClick={() => handleOpenDetails(b)}
                      className="table-row hover:bg-muted/30 transition-all duration-300 group hover:-translate-y-[2px] hover:shadow-sm"
                    >
                      <TableCell
                        className="w-12 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.includes(b.id)}
                          onCheckedChange={() => toggleSelectRow(b.id)}
                          aria-label={`Seleziona ${b.name}`}
                        />
                      </TableCell>
                      <TableCell className="cell-name">
                        <div className="flex items-center gap-2">
                          <span className="business-name">{b.name}</span>
                          {b.is_claimed === 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 px-1 py-0 text-amber-500 border-amber-500 bg-amber-500/10 whitespace-nowrap"
                            >
                              Non Rivendicata
                            </Badge>
                          )}
                        </div>
                        {b.address && (
                          <span className="business-address">{b.address}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {b.area || "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={displayStatus}
                          onValueChange={(val) => onStatusUpdate(b.id, val)}
                        >
                          <SelectTrigger
                            className={`h-8 w-[135px] px-2 text-xs font-medium border-0 bg-transparent hover:bg-muted ${STATUS_COLORS[displayStatus]}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Da Contattare">
                              Da Contattare
                            </SelectItem>
                            <SelectItem value="Inviata Mail">
                              Inviata Mail
                            </SelectItem>
                            <SelectItem value="In Trattativa">
                              In Trattativa
                            </SelectItem>
                            <SelectItem value="Vinto (Cliente)">
                              Vinto (Cliente)
                            </SelectItem>
                            <SelectItem value="Perso">Perso</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell>
                        {b.review_count !== null ? (
                          <Badge
                            className={
                              b.review_count < 10
                                ? "badge-danger"
                                : "badge-accent"
                            }
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            {b.review_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {b.rating ? (
                          <span className="rating">
                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                            {b.rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {b.phone ? (
                          <div className="flex items-center gap-3">
                            <a
                              href={`tel:${b.phone}`}
                              className="table-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-3.5 h-3.5" />
                              {b.phone}
                            </a>
                            <a
                              href={formatWhatsappUrl(b.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#25D366] hover:text-[#128C7E] transition-colors"
                              title="Invia messaggio su WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {b.email ? (
                          <a
                            href={`mailto:${b.email}`}
                            title={b.email}
                            className="text-primary hover:text-primary/80 transition-colors inline-flex p-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </TableCell>
                      {/* Social Media */}
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center justify-center gap-1.5">
                            {b.facebook_url && (
                              <a
                                href={formatUrl(b.facebook_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Apri pagina Facebook"
                                className="text-[#1877F2] hover:text-[#0e5fc7] transition-colors"
                              >
                                <Facebook className="w-4 h-4" />
                              </a>
                            )}
                            {b.instagram_url && (
                              <a
                                href={formatUrl(b.instagram_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Apri profilo Instagram"
                                className="text-[#E1306C] hover:text-[#b5265a] transition-colors"
                              >
                                <Instagram className="w-4 h-4" />
                              </a>
                            )}
                            {!b.facebook_url && !b.instagram_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={scanningIds.includes(b.id)}
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setScanningIds((prev) => [...prev, b.id]);
                                  try {
                                    const res = await fetch(
                                      `${API_URL}/api/businesses/${b.id}/scan-social`,
                                      { method: "POST" },
                                    );
                                    const data = await res.json();
                                    if (data.success) {
                                      onRefresh();
                                    }
                                  } catch {
                                    // ignore
                                  } finally {
                                    setScanningIds((prev) =>
                                      prev.filter((id) => id !== b.id),
                                    );
                                  }
                                }}
                              >
                                {scanningIds.includes(b.id) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Search className="w-3 h-3 mr-1" />
                                    Cerca
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                          {b.social_last_active && (
                            <span className="text-[10px] text-muted-foreground leading-tight">
                              {b.social_last_active}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {b.website ? (
                          <a
                            href={formatUrl(b.website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`table-link ${isFacebook(b.website) ? "link-facebook" : ""}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isFacebook(b.website) ? (
                              <Facebook className="w-3.5 h-3.5" />
                            ) : (
                              <Globe className="w-3.5 h-3.5" />
                            )}
                            {isFacebook(b.website) ? "Facebook" : "Sito"}
                          </a>
                        ) : (
                          <Badge className="badge-danger">Nessun sito</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          id={`delete-btn-${b.id}`}
                          variant="ghost"
                          size="sm"
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(b.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </MotionTableRow>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={() => setItemToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete === "batch"
                ? `Stai per eliminare definitivamente ${selectedIds.length} elementi. Questa operazione non può essere annullata.`
                : "Stai per eliminare definitivamente questo elemento. L'operazione non può essere annullata."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {itemToDelete === "batch" ? "Elimina tutti" : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* General Dialog */}
      <AlertDialog
        open={!!dialogConfig}
        onOpenChange={(open) => !open && setDialogConfig(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogConfig?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {dialogConfig?.cancelText && (
              <AlertDialogCancel>{dialogConfig.cancelText}</AlertDialogCancel>
            )}
            <AlertDialogAction
              onClick={() => {
                if (dialogConfig?.onAction) dialogConfig.onAction();
                setDialogConfig(null);
              }}
            >
              {dialogConfig?.actionText || "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-4 mt-8 pb-12 border-t border-border pt-8">
          <div className="flex items-center gap-2">
            <Button
              id="prev-page-btn"
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="h-9 w-9"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>

            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, idx) => {
                const page = idx + 1;
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="h-9 min-w-[36px]"
                    >
                      {page}
                    </Button>
                  );
                } else if (
                  (page === currentPage - 2 && page > 1) ||
                  (page === currentPage + 2 && page < totalPages)
                ) {
                  return (
                    <span
                      key={page}
                      className="px-1 text-muted-foreground text-xs"
                    >
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <Button
              id="next-page-btn"
              variant="outline"
              size="icon"
              onClick={() =>
                handlePageChange(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="h-9 w-9"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Pagina {currentPage} di {totalPages} (Mostrando{" "}
            {paginatedResults.length} di {filtered.length} risultati)
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function DetailRow({ icon, label, value, href }) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">
        <span className="detail-label__icon">{icon}</span>
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="detail-value table-link"
        >
          {value}
          <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
        </a>
      ) : (
        <span className="detail-value">{value}</span>
      )}
    </div>
  );
}
