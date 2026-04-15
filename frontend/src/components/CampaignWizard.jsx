import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  X, ChevronRight, ChevronLeft, Rocket, Zap, Globe, Send,
  CheckCircle, XCircle, Loader2
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  return fetch(url, { ...options, headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

const AI_STRATEGIES = [
  { value: "auto", label: "Auto", desc: "Sceglie la strategia migliore per ogni business" },
  { value: "social_only", label: "Social Only", desc: "Per chi ha solo Facebook/Instagram" },
  { value: "weak_website", label: "Sito Debole", desc: "Per chi ha un sito datato" },
  { value: "ai_strategy", label: "AI Strategy", desc: "Analisi approfondita personalizzata" },
];

const TEMPLATES = [
  { value: "auto", label: "Auto", desc: "Scelto in base ai dati del business", icon: "🤖" },
  { value: "local-pro", label: "Local Pro", desc: "Servizi locali e artigiani", icon: "🔧" },
  { value: "digital-presence", label: "Digital Presence", desc: "Business senza sito efficace", icon: "🌐" },
  { value: "social-first", label: "Social First", desc: "Business solo-social", icon: "📱" },
];

const STEPS = ["Review", "Strategia AI", "Landing Page", "Invio"];

export default function CampaignWizard({ open, onClose, selectedBusinesses, onCampaignComplete }) {
  const [step, setStep] = useState(0);
  const [businesses, setBusinesses] = useState(selectedBusinesses || []);
  const [aiStrategy, setAiStrategy] = useState("auto");
  const [templateName, setTemplateName] = useState("auto");
  const [campaignId, setCampaignId] = useState(null);
  const [progress, setProgress] = useState([]); // [{businessId, name, status, landingUrl, error}]
  const [summary, setSummary] = useState(null); // {total, sent, failed}
  const [isRunning, setIsRunning] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (open) {
      setBusinesses(selectedBusinesses || []);
      setStep(0);
      setCampaignId(null);
      setProgress([]);
      setSummary(null);
      setIsRunning(false);
      setAiStrategy("auto");
      setTemplateName("auto");
    }
  }, [open, selectedBusinesses]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const removeBusiness = (id) =>
    setBusinesses((prev) => prev.filter((b) => b.id !== id));

  const startCampaign = async () => {
    setIsRunning(true);
    setProgress([]);
    setSummary(null);

    try {
      const res = await authFetch(`${API_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessIds: businesses.map((b) => b.id),
          aiStrategy,
          templateName,
        }),
      });
      const { campaignId: id } = await res.json();
      setCampaignId(id);

      // Connetti SSE
      const es = new EventSource(`${API_URL}/api/campaigns/${id}/progress`);
      eventSourceRef.current = es;

      es.addEventListener("progress", (e) => {
        const data = JSON.parse(e.data);
        setProgress((prev) => [...prev, data]);
      });

      es.addEventListener("complete", (e) => {
        const data = JSON.parse(e.data);
        setSummary(data);
        setIsRunning(false);
        es.close();
        onCampaignComplete?.();
      });

      es.onerror = () => {
        setIsRunning(false);
        es.close();
      };
    } catch (err) {
      console.error("[campaign]", err);
      setIsRunning(false);
    }
  };

  const retryFailed = async () => {
    const failedIds = progress
      .filter((p) => p.status === "failed")
      .map((p) => p.businessId);
    if (failedIds.length === 0) return;

    const failedBusinesses = businesses.filter((b) => failedIds.includes(b.id));
    setProgress([]);
    setSummary(null);

    const prevBusinesses = businesses;
    setBusinesses(failedBusinesses);

    // Riavvia con i soli business falliti
    setIsRunning(true);
    try {
      const res = await authFetch(`${API_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessIds: failedIds,
          aiStrategy,
          templateName,
        }),
      });
      const { campaignId: id } = await res.json();
      setCampaignId(id);

      const es = new EventSource(`${API_URL}/api/campaigns/${id}/progress`);
      eventSourceRef.current = es;

      es.addEventListener("progress", (e) => {
        setProgress((prev) => [...prev, JSON.parse(e.data)]);
      });
      es.addEventListener("complete", (e) => {
        setSummary(JSON.parse(e.data));
        setIsRunning(false);
        es.close();
        onCampaignComplete?.();
      });
      es.onerror = () => { setIsRunning(false); es.close(); };
    } catch {
      setIsRunning(false);
      setBusinesses(prevBusinesses);
    }
  };

  const canGoNext = () => {
    if (step === 0) return businesses.length > 0;
    return true;
  };

  const slideVariants = {
    enter: { opacity: 0, x: 30 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[#00d4aa]" />
            Avvia Campagna
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i < step ? "bg-[#00d4aa] text-black" : i === step ? "bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]" : "bg-muted text-muted-foreground"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-[#00d4aa]" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            {/* Step 0: Review */}
            {step === 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  {businesses.length} business selezionati. Rimuovi quelli da escludere.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {businesses.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{b.name}</span>
                        {b.area && <span className="text-muted-foreground ml-2 text-xs">{b.area}</span>}
                        {!b.email && <Badge variant="outline" className="ml-2 text-xs text-yellow-500 border-yellow-500/30">Senza email</Badge>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeBusiness(b.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                {businesses.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Nessun business rimasto. Torna indietro per aggiungerne.</p>
                )}
              </div>
            )}

            {/* Step 1: Strategia AI */}
            {step === 1 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">Scegli la strategia per generare le email.</p>
                {AI_STRATEGIES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setAiStrategy(s.value)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${aiStrategy === s.value ? "border-[#00d4aa] bg-[#00d4aa]/10" : "border-border hover:border-[#00d4aa]/40"}`}
                  >
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Landing Page */}
            {step === 2 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">Scegli il template della landing page.</p>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTemplateName(t.value)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${templateName === t.value ? "border-[#00d4aa] bg-[#00d4aa]/10" : "border-border hover:border-[#00d4aa]/40"}`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Invio */}
            {step === 3 && (
              <div>
                {!isRunning && !summary && (
                  <div className="text-center py-6">
                    <Send className="w-12 h-12 text-[#00d4aa] mx-auto mb-4" />
                    <p className="text-lg font-semibold mb-1">Pronto per l'invio</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Verranno elaborate <strong>{businesses.length} aziende</strong> in sequenza.
                    </p>
                    <Button onClick={startCampaign} className="bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 font-bold">
                      <Rocket className="w-4 h-4 mr-2" />
                      Avvia ora
                    </Button>
                  </div>
                )}

                {(isRunning || progress.length > 0) && !summary && (
                  <div>
                    <Progress
                      value={(progress.length / businesses.length) * 100}
                      className="mb-4 h-2"
                    />
                    <p className="text-xs text-muted-foreground mb-3">
                      {progress.length} / {businesses.length} elaborate
                    </p>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {progress.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                          {p.status === "sent"
                            ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                          <span className="flex-1 truncate">{p.name || `ID ${p.businessId}`}</span>
                          {p.landingUrl && (
                            <a href={p.landingUrl} target="_blank" rel="noopener noreferrer" className="text-[#00d4aa] text-xs hover:underline">
                              <Globe className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {p.error && <span className="text-red-400 text-xs truncate max-w-[120px]">{p.error}</span>}
                        </div>
                      ))}
                      {isRunning && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Elaborazione in corso...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {summary && (
                  <div className="text-center py-4">
                    <div className={`text-4xl font-black mb-2 ${summary.failed === 0 ? "text-emerald-500" : "text-yellow-500"}`}>
                      {summary.sent}/{summary.total}
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">
                      Email inviate con successo
                      {summary.failed > 0 && ` · ${summary.failed} fallite`}
                    </p>
                    {summary.failed > 0 && (
                      <Button variant="outline" size="sm" onClick={retryFailed} className="mr-2">
                        Riprova i falliti ({summary.failed})
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={onClose}>
                      Chiudi
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        {!(step === 3 && (isRunning || summary)) && (
          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => step > 0 ? setStep(step - 1) : onClose()}
              disabled={isRunning}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {step === 0 ? "Annulla" : "Indietro"}
            </Button>
            {step < 3 && (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canGoNext()}
                className="bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 font-semibold"
              >
                Avanti
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}