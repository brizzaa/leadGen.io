import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Facebook,
  ExternalLink,
  Loader2,
  Hash,
  Zap,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import "../App.css";

// New Components
import BusinessHeader from "@/components/business/BusinessHeader";
import EditableInfoCard from "@/components/business/EditableInfoCard";
import CRMSection from "@/components/business/CRMSection";
import AIGeneratorSection from "@/components/business/AIGeneratorSection";
import SocialSection from "@/components/business/SocialSection";
import BusinessGroupsSection from "@/components/business/BusinessGroupsSection";
import ActivityTimeline from "@/components/business/ActivityTimeline";
import BusinessDocumentsSection from "@/components/business/BusinessDocumentsSection";
import WebsitePreviewDialog from "@/components/business/WebsitePreviewDialog";
import { isMobilePhone, buildWhatsAppUrl } from "@/lib/phoneCountries";

const API_URL = import.meta.env.VITE_API_URL || "";

function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  return fetch(url, { ...options, headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}
const isFacebook = (url) => url && url.toLowerCase().includes("facebook.com");

const formatUrl = (url) => {
  if (!url) return "#";
  let cleanUrl = url.replace(/[\uE000-\uF8FF]/g, "").trim();

  // Decodifica url da duckduckgo per evitare errore nginx
  try {
    const urlObj = new URL(cleanUrl);
    if (urlObj.hostname.includes("duckduckgo.com")) {
      const uddg = urlObj.searchParams.get("uddg");
      if (uddg) {
        cleanUrl = decodeURIComponent(uddg);
      }
    }
  } catch {
    // ignora errori di parsing
  }

  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }
  return encodeURI(cleanUrl);
};

export default function BusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [business, setBusiness] = useState(null);
  const [alertConfig, setAlertConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editNotes, setEditNotes] = useState("");
  const [editNextContact, setEditNextContact] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState(
    "Proposta di Collaborazione",
  );
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);
  const [isSavingVat, setIsSavingVat] = useState(false);
  const [isGeneratingWebsite, setIsGeneratingWebsite] = useState(false);
  const [generatedWebsiteHtml, setGeneratedWebsiteHtml] = useState(null);
  const [websiteStyle, setWebsiteStyle] = useState("auto");
  const [websiteEngine, setWebsiteEngine] = useState("auto");
  const [usedEngine, setUsedEngine] = useState(null);
  const [publishedSiteUrl, setPublishedSiteUrl] = useState(null);
  const [publishedScreenshotUrl, setPublishedScreenshotUrl] = useState(null);
  const [isSendingSite, setIsSendingSite] = useState(false);
  const [siteSentSuccess, setSiteSentSuccess] = useState(false);

  const [allGroups, setAllGroups] = useState([]);
  const [businessGroups, setBusinessGroups] = useState([]);

  // Status state
  const [status, setStatus] = useState("Da Contattare");
  const [promptType, setPromptType] = useState("social_only");

  const [followUpsEnabled, setFollowUpsEnabled] = useState(false);
  const [isTogglingFollowUps, setIsTogglingFollowUps] = useState(false);

  const fetchBusiness = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBusiness(data);
        setEditNotes(data.notes || "");
        setEditNextContact(data.next_contact || "");
        setStatus(data.status || "Da Contattare");
        setFollowUpsEnabled(!!data.follow_ups_enabled);

        // Auto-select prompt type based on data
        if (
          !data.website ||
          data.website.includes("facebook.com") ||
          data.website.includes("instagram.com")
        ) {
          setPromptType("social_only");
        } else {
          setPromptType("weak_website");
        }
      } else {
        console.error("Business not found");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/groups`);
      if (res.ok) {
        const data = await res.json();
        setAllGroups(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchBusinessGroups = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/groups/business/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBusinessGroups(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    fetchBusiness();
    fetchGroups();
    fetchBusinessGroups();
  }, [fetchBusiness, fetchGroups, fetchBusinessGroups]);

  const handleSaveDetails = async () => {
    setIsSavingDetails(true);
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editNotes,
          next_contact: editNextContact,
        }),
      });
      if (res.ok) {
        // detail saved
      }
    } catch (e) {
      console.error(e);
    }
    setIsSavingDetails(false);
  };

  const handleSaveEmail = async (emailToSave) => {
    if (!emailToSave) return;
    setIsSavingEmail(true);
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSave }),
      });
      if (res.ok) {
        fetchBusiness();
      } else {
        setAlertConfig({
          title: "Errore",
          description: "Errore durante il salvataggio dell'email.",
        });
      }
    } catch (e) {
      console.error(e);
      setAlertConfig({
        title: "Errore",
        description: "Errore di connessione al server",
      });
    }
    setIsSavingEmail(false);
  };

  const handleSavePhone = async (phoneToSave) => {
    setIsSavingPhone(true);
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}/phone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneToSave }),
      });
      if (res.ok) {
        fetchBusiness();
      } else {
        setAlertConfig({
          title: "Errore",
          description: "Errore durante il salvataggio del numero.",
        });
      }
    } catch (e) {
      console.error(e);
      setAlertConfig({
        title: "Errore",
        description: "Errore di connessione al server",
      });
    }
    setIsSavingPhone(false);
  };

  const handleSaveVat = async (vatToSave) => {
    setIsSavingVat(true);
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}/vat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat_number: vatToSave }),
      });
      if (res.ok) {
        fetchBusiness();
      } else {
        setAlertConfig({
          title: "Errore",
          description: "Errore durante il salvataggio della P.IVA.",
        });
      }
    } catch (e) {
      console.error(e);
      setAlertConfig({
        title: "Errore",
        description: "Errore di connessione al server",
      });
    }
    setIsSavingVat(false);
  };

  const handleSaveWebsite = async (websiteToSave) => {
    setIsSavingWebsite(true);
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}/website`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: websiteToSave }),
      });
      if (res.ok) {
        fetchBusiness();
      } else {
        setAlertConfig({
          title: "Errore",
          description: "Errore durante il salvataggio del sito web.",
        });
      }
    } catch (e) {
      console.error(e);
      setAlertConfig({
        title: "Errore",
        description: "Errore di connessione al server",
      });
    }
    setIsSavingWebsite(false);
  };

  const handleGenerateEmail = async () => {
    setIsGeneratingEmail(true);
    setEmailSentSuccess(false);
    try {
      const res = await authFetch(
        `${API_URL}/api/businesses/${id}/generate-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: promptType }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setGeneratedEmail(data.generatedEmail);
        if (data.subject) {
          setEmailSubject(data.subject);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsGeneratingEmail(false);
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    setEmailSentSuccess(false);
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedEmail,
          toEmail: business.email,
          subject: emailSubject,
          websiteUrl: publishedSiteUrl || null,
          screenshotUrl: publishedScreenshotUrl || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailSentSuccess(true);
        setStatus("Inviata Mail");
        fetchBusiness();
      } else {
        setAlertConfig({
          title: "Errore Invio",
          description: data.error || "Errore sconosciuto durante l'invio",
        });
      }
    } catch (e) {
      console.error(e);
      setAlertConfig({
        title: "Errore",
        description: "Errore di connessione al server",
      });
    }
    setIsSendingEmail(false);
  };

  const handleStatusUpdate = async (newStatus) => {
    setStatus(newStatus);
    try {
      await authFetch(`${API_URL}/api/businesses/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchBusiness();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOptOut = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}/opt-out`, {
        method: "PATCH",
      });
      if (res.ok) {
        setAlertConfig({
          title: "Opt-out Registrato",
          description:
            "L'utente è stato rimosso correttamente dalle liste di contatto.",
        });
        fetchBusiness();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUndoOptOut = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}/undo-opt-out`, {
        method: "PATCH",
      });
      if (res.ok) {
        setAlertConfig({
          title: "Opt-out Annullato",
          description: "L'utente è stato riattivato e può essere ricontattato.",
        });
        fetchBusiness();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFollowUps = async () => {
    setIsTogglingFollowUps(true);
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${id}/toggle-followups`, {
        method: "PATCH",
      });
      if (res.ok) {
        const data = await res.json();
        setFollowUpsEnabled(!!data.follow_ups_enabled);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTogglingFollowUps(false);
    }
  };

  // Returns best available outreach channel for the business
  function getOutreachChannel(biz) {
    if (biz.email) return { type: "email", label: "Email", value: biz.email };
    const rawPhone = biz.phone?.replace(/\D/g, "");
    if (rawPhone) return { type: "whatsapp", label: "WhatsApp", value: rawPhone };
    if (biz.facebook_url) return { type: "facebook", label: "Facebook DM", value: biz.facebook_url };
    if (biz.instagram_url) return { type: "instagram", label: "Instagram DM", value: biz.instagram_url };
    return null;
  }

  const handleSendSite = async () => {
    const channel = getOutreachChannel(business);
    if (!channel || !publishedSiteUrl) return;
    setIsSendingSite(true);
    setSiteSentSuccess(false);
    try {
      if (channel.type === "email") {
        const res = await authFetch(`${API_URL}/api/businesses/${id}/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generatedEmail: `Ciao,\n\nHo realizzato un sito web per la tua attività — puoi vederlo qui:\n${publishedSiteUrl}\n\nFammi sapere cosa ne pensi, nessun impegno.\n\n${process.env.MY_NAME || "Luca Brizzante"}`,
            toEmail: business.email,
            subject: `Ho creato un sito per ${business.name}`,
            websiteUrl: publishedSiteUrl,
            screenshotUrl: publishedScreenshotUrl,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setSiteSentSuccess(true);
      } else if (channel.type === "whatsapp") {
        const text = encodeURIComponent(
          `Ciao! Ho realizzato un sito web per ${business.name}:\n${publishedSiteUrl}\n\nFammi sapere cosa ne pensi!`
        );
        window.open(`https://wa.me/${channel.value}?text=${text}`, "_blank");
        setSiteSentSuccess(true);
      } else {
        window.open(channel.value, "_blank");
        setSiteSentSuccess(true);
      }
    } catch (e) {
      setAlertConfig({ title: "Errore invio", description: e.message });
    } finally {
      setIsSendingSite(false);
    }
  };

  const handleGenerateWebsite = async () => {
    setIsGeneratingWebsite(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/businesses/${id}/generate-website`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ style: websiteStyle, engine: websiteEngine }),
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedWebsiteHtml(data.html);
        setUsedEngine(data.engine);
      } else {
        setAlertConfig({
          title: "Errore Generazione",
          description: data.error || "Errore sconosciuto durante la generazione del sito",
        });
      }
    } catch (e) {
      console.error(e);
      setAlertConfig({
        title: "Errore",
        description: "Errore di connessione al server",
      });
    }
    setIsGeneratingWebsite(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold">Business non trovato</h2>
        <Button onClick={() => navigate("/")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna alla Dashboard
        </Button>
      </div>
    );
  }

  const STATUS_COLORS = {
    "Da Contattare": "bg-gray-500/10 text-gray-500 border-gray-500/20",
    "Inviata Mail": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "In Trattativa": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    "Vinto (Cliente)":
      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    Perso: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 animate-in fade-in duration-500">
      <BusinessHeader
        business={business}
        status={status}
        onStatusUpdate={handleStatusUpdate}
        onOptOut={handleOptOut}
        onUndoOptOut={handleUndoOptOut}
        onBack={() => navigate("/")}
      />

      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-8 animate-in slide-in-from-bottom-4 duration-700 fade-in">
        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <InfoCard
            icon={<MapPin />}
            label="Indirizzo"
            value={business.address}
          />

          <EditableInfoCard
            icon={<Phone />}
            label="Telefono"
            value={business.phone}
            isSaving={isSavingPhone}
            onSave={async (newPhone) => {
              await handleSavePhone(newPhone);
              return true;
            }}
            placeholder="Inserisci telefono (separati da virgola per multipli)"
            type="tel"
            href={business.phone ? `tel:${business.phone}` : null}
            footer={
              isMobilePhone(business.phone, business.country_code || "IT") ? (
                <a
                  href={buildWhatsAppUrl(business.phone, business, undefined, business.country_code || "IT")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-medium transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Contatta su WhatsApp
                </a>
              ) : null
            }
          />

          <EditableInfoCard
            icon={<Mail />}
            label="Email"
            value={business.email}
            isSaving={isSavingEmail}
            onSave={async (newEmail) => {
              await handleSaveEmail(newEmail);
              return true;
            }}
            placeholder="Inserisci email (separate da virgola per multiple)"
            type="email"
            href={business.email ? `mailto:${business.email}` : null}
          />

          <EditableInfoCard
            icon={isFacebook(business.website) ? <Facebook /> : <Globe />}
            label="Sito Web"
            value={
              isFacebook(business.website) ? "Facebook Page" : business.website
            }
            isSaving={isSavingWebsite}
            onSave={async (newWebsite) => {
              await handleSaveWebsite(newWebsite);
              return true;
            }}
            placeholder="Inserisci sito web (separati da virgola per multipli)"
            type="text"
            href={business.website ? formatUrl(business.website) : null}
          />

          <InfoCard
            icon={<Star className="fill-yellow-400 text-yellow-400" />}
            label="Rating & Recensioni"
            value={`${business.rating ? business.rating.toFixed(1) + " / 5" : "N/A"} • ${business.review_count !== null ? business.review_count : "0"} rec.`}
          />

          {business.lead_score != null && (
            <InfoCard
              icon={<Zap className={business.lead_score >= 60 ? "text-green-500" : business.lead_score >= 35 ? "text-yellow-500" : "text-muted-foreground"} />}
              label="Lead Score"
              value={
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        business.lead_score >= 60 ? "bg-green-500" :
                        business.lead_score >= 35 ? "bg-yellow-500" :
                        "bg-muted-foreground/40"
                      }`}
                      style={{ width: `${business.lead_score}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold ${
                    business.lead_score >= 60 ? "text-green-500" :
                    business.lead_score >= 35 ? "text-yellow-500" :
                    "text-muted-foreground"
                  }`}>
                    {business.lead_score}/100
                  </span>
                </div>
              }
            />
          )}

          <EditableInfoCard
            icon={<Hash />}
            label="Partita IVA"
            value={business.vat_number}
            isSaving={isSavingVat}
            onSave={async (newVat) => {
              await handleSaveVat(newVat);
              return true;
            }}
            placeholder="Es. 01234567890 (11 cifre)"
            type="text"
          />

          <SocialSection business={business} />
          <BusinessGroupsSection
            businessId={id}
            allGroups={allGroups}
            currentGroups={businessGroups}
            onRefresh={fetchBusinessGroups}
          />
        </div>

        {/* Website Generator */}
        <div className="flex flex-col gap-3 p-6 rounded-xl border border-border/50 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Sito Vetrina AI
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Genera un sito vetrina completo e personalizzato con l'AI
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={websiteEngine}
                onChange={(e) => setWebsiteEngine(e.target.value)}
                disabled={isGeneratingWebsite}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="auto">Engine: Auto</option>
                <option value="stitch">Stitch (Google)</option>
                <option value="gemini_3_pro">Gemini 3.1 Pro ✨</option>
                <option value="gemini_pro">Gemini 2.5 Pro</option>
                <option value="gemini_flash">Gemini 2.5 Flash</option>
                <option value="gemini_flash_lite">Gemini 2.5 Flash Lite</option>
              </select>
              <select
                value={websiteStyle}
                onChange={(e) => setWebsiteStyle(e.target.value)}
                disabled={isGeneratingWebsite}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="auto">Stile: Auto</option>
                <option value="elegant">Elegante</option>
                <option value="bold">Audace</option>
                <option value="warm">Caldo</option>
                <option value="professional">Professionale</option>
                <option value="creative">Creativo</option>
              </select>
              <Button
                onClick={handleGenerateWebsite}
                disabled={isGeneratingWebsite}
                className="bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 font-semibold"
              >
                {isGeneratingWebsite ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {isGeneratingWebsite ? "Generazione..." : "Genera Sito"}
              </Button>
            </div>
            {usedEngine && !isGeneratingWebsite && (
              <span className="text-[10px] text-muted-foreground mt-1">
                Generato con: {{
                  stitch: "Stitch",
                  gemini_3_pro: "Gemini 3.1 Pro",
                  gemini_pro: "Gemini 2.5 Pro",
                  gemini_flash: "Gemini 2.5 Flash",
                  gemini_flash_lite: "Gemini 2.5 Flash Lite",
                }[usedEngine] ?? usedEngine}
              </span>
            )}
          </div>

          {/* Published site — outreach row */}
          {publishedSiteUrl && (() => {
            const channel = getOutreachChannel(business);
            const channelIcon = {
              email: <Mail className="w-3.5 h-3.5" />,
              whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
              facebook: <Facebook className="w-3.5 h-3.5" />,
              instagram: <ExternalLink className="w-3.5 h-3.5" />,
            }[channel?.type];

            return (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                  <a href={publishedSiteUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary truncate hover:underline max-w-[220px]">
                    {publishedSiteUrl}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  {channel ? (
                    <>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        {channelIcon} {channel.label}
                      </span>
                      <Button
                        size="sm"
                        onClick={handleSendSite}
                        disabled={isSendingSite || siteSentSuccess}
                        className="h-7 text-xs bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 font-semibold"
                      >
                        {isSendingSite ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        {siteSentSuccess ? "Inviato ✓" : "Invia sito"}
                      </Button>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Nessun canale disponibile</span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <CRMSection
          notes={editNotes}
          onNotesChange={setEditNotes}
          nextContact={editNextContact}
          onNextContactChange={setEditNextContact}
          onSave={handleSaveDetails}
          isSaving={isSavingDetails}
          followUpsEnabled={followUpsEnabled}
          onToggleFollowUps={handleToggleFollowUps}
          isTogglingFollowUps={isTogglingFollowUps}
        />

        <ActivityTimeline businessId={id} />
        <BusinessDocumentsSection businessId={id} />

        <AIGeneratorSection
          business={business}
          promptType={promptType}
          onPromptTypeChange={setPromptType}
          onGenerate={handleGenerateEmail}
          isGenerating={isGeneratingEmail}
          generatedEmail={generatedEmail}
          onGeneratedEmailChange={setGeneratedEmail}
          emailSubject={emailSubject}
          onEmailSubjectChange={setEmailSubject}
          onSend={handleSendEmail}
          isSending={isSendingEmail}
          emailSentSuccess={emailSentSuccess}
        />
      </main>

      <AlertDialog
        open={!!alertConfig}
        onOpenChange={() => setAlertConfig(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertConfig?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertConfig(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WebsitePreviewDialog
        open={generatedWebsiteHtml !== null}
        onClose={() => setGeneratedWebsiteHtml(null)}
        html={generatedWebsiteHtml || ""}
        businessName={business.name}
        businessId={business.id}
        onRegenerate={handleGenerateWebsite}
        isRegenerating={isGeneratingWebsite}
        onPublished={(url, screenshotUrl) => {
          setPublishedSiteUrl(url);
          setPublishedScreenshotUrl(screenshotUrl);
        }}
      />
    </div>
  );
}

function InfoCard({ icon, label, value, href }) {
  const content = (
    <div className="flex flex-col gap-1 p-5 rounded-xl border border-border/50 bg-card shadow-sm hover:border-primary/20 hover:shadow-md transition-all duration-300 group hover:-translate-y-1">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <div className="text-primary/70 group-hover:text-primary group-hover:scale-110 transition-all duration-300">
          {icon && React.cloneElement(icon, { className: "w-4 h-4" })}
        </div>
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-sm font-medium break-words">{value || "—"}</div>
    </div>
  );

  if (href && value) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : "_self"}
        rel="noopener noreferrer"
        className="block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-xl"
      >
        {content}
      </a>
    );
  }

  return content;
}
