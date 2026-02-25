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
import "../App.css";

const API_URL = import.meta.env.VITE_API_URL || "";
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
  const [editEmailValue, setEditEmailValue] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const [editPhoneValue, setEditPhoneValue] = useState("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  const [editWebsiteValue, setEditWebsiteValue] = useState("");
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);

  const [allGroups, setAllGroups] = useState([]);
  const [businessGroups, setBusinessGroups] = useState([]);

  // Status state
  const [status, setStatus] = useState("Da Contattare");
  const [promptType, setPromptType] = useState("social_only");

  const fetchBusiness = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/businesses/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBusiness(data);
        setEditNotes(data.notes || "");
        setEditNextContact(data.next_contact || "");
        setEditEmailValue(data.email || "");
        setEditPhoneValue(data.phone || "");
        setEditWebsiteValue(data.website || "");
        setStatus(data.status || "Da Contattare");

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
      const res = await fetch(`${API_URL}/api/groups`);
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
      const res = await fetch(`${API_URL}/api/groups/business/${id}`);
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
      const res = await fetch(`${API_URL}/api/businesses/${id}/details`, {
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

  const handleSaveEmail = async () => {
    const emailToSave = editEmailValue.trim();
    if (!emailToSave) return;
    setIsSavingEmail(true);
    try {
      const res = await fetch(`${API_URL}/api/businesses/${id}/email`, {
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

  const handleSavePhone = async () => {
    const phoneToSave = editPhoneValue.trim();
    setIsSavingPhone(true);
    try {
      const res = await fetch(`${API_URL}/api/businesses/${id}/phone`, {
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

  const handleSaveWebsite = async () => {
    const websiteToSave = editWebsiteValue.trim();
    setIsSavingWebsite(true);
    try {
      const res = await fetch(`${API_URL}/api/businesses/${id}/website`, {
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
      const res = await fetch(
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
      const res = await fetch(`${API_URL}/api/businesses/${id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedEmail,
          toEmail: business.email,
          subject: emailSubject,
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
      await fetch(`${API_URL}/api/businesses/${id}/status`, {
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
      const res = await fetch(`${API_URL}/api/businesses/${id}/opt-out`, {
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
      const res = await fetch(`${API_URL}/api/businesses/${id}/undo-opt-out`, {
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
              setEditPhoneValue(newPhone);
              await handleSavePhone();
              return true;
            }}
            placeholder="Inserisci telefono"
            type="tel"
            href={business.phone ? `tel:${business.phone}` : null}
          />

          <EditableInfoCard
            icon={<Mail />}
            label="Email"
            value={business.email}
            isSaving={isSavingEmail}
            onSave={async (newEmail) => {
              setEditEmailValue(newEmail);
              await handleSaveEmail();
              return true;
            }}
            placeholder="Inserisci email"
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
              setEditWebsiteValue(newWebsite);
              await handleSaveWebsite();
              return true;
            }}
            placeholder="Inserisci sito web"
            type="url"
            href={business.website ? formatUrl(business.website) : null}
          />

          <InfoCard
            icon={<Star className="fill-yellow-400 text-yellow-400" />}
            label="Rating & Recensioni"
            value={`${business.rating ? business.rating.toFixed(1) + " / 5" : "N/A"} • ${business.review_count !== null ? business.review_count : "0"} rec.`}
          />

          <SocialSection business={business} />
          <BusinessGroupsSection
            businessId={id}
            allGroups={allGroups}
            currentGroups={businessGroups}
            onRefresh={fetchBusinessGroups}
          />
        </div>

        <CRMSection
          notes={editNotes}
          onNotesChange={setEditNotes}
          nextContact={editNextContact}
          onNextContactChange={setEditNextContact}
          onSave={handleSaveDetails}
          isSaving={isSavingDetails}
        />

        <ActivityTimeline businessId={id} />

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
