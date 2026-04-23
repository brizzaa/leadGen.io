import { useState } from "react";
import { RefreshCw, Download, X, Loader2, Globe, Copy, Check, Code, Eye } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  return fetch(url, { ...options, headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

export default function WebsitePreviewDialog({
  open,
  onClose,
  html,
  businessName,
  businessId,
  onRegenerate,
  isRegenerating,
  onHtmlChange,
  onPublished,
}) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedHtml, setEditedHtml] = useState("");

  if (!open) return null;

  const currentHtml = editMode ? editedHtml : html;

  const handleToggleEdit = () => {
    if (!editMode) {
      setEditedHtml(html);
    } else if (onHtmlChange) {
      onHtmlChange(editedHtml);
    }
    setEditMode(!editMode);
  };

  const handleDownload = () => {
    const blob = new Blob([currentHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const slug = businessName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30)
      .replace(/-$/, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-sito.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    try {
      const res = await authFetch(`${API_URL}/api/businesses/${businessId}/publish-website`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ html: currentHtml }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore sconosciuto");
      setPublishedUrl(data.url);
      onPublished?.(data.url, data.screenshotUrl ?? null);
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="shrink-0 flex flex-col border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="h-14 flex items-center justify-between px-4">
          <span className="text-sm font-semibold truncate max-w-[40%]">
            {businessName} — Sito Vetrina
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleEdit}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                editMode
                  ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "border-border hover:bg-muted"
              }`}
            >
              {editMode ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
              {editMode ? "Anteprima" : "Modifica HTML"}
            </button>
            <button
              onClick={onRegenerate}
              disabled={isRegenerating || isPublishing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              {isRegenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Rigenera
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Scarica
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing || isRegenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#00ad9f] text-white hover:bg-[#009b8e] transition-colors disabled:opacity-50"
            >
              {isPublishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              {isPublishing ? "Pubblicando..." : "Pubblica su Netlify"}
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {publishedUrl && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border-t border-green-500/20 text-xs">
            <span className="text-green-600 dark:text-green-400 font-medium">Pubblicato:</span>
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-700 dark:text-green-300 underline underline-offset-2 truncate max-w-xs hover:no-underline"
            >
              {publishedUrl}
            </a>
            <button
              onClick={handleCopy}
              className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-green-500/30 hover:bg-green-500/10 transition-colors text-green-700 dark:text-green-300"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copiato" : "Copia"}
            </button>
          </div>
        )}

        {publishError && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-xs text-red-600 dark:text-red-400">
            Errore: {publishError}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {editMode ? (
          <div className="flex h-full">
            {/* Editor */}
            <textarea
              value={editedHtml}
              onChange={(e) => setEditedHtml(e.target.value)}
              className="w-1/2 h-full p-4 font-mono text-xs bg-zinc-950 text-zinc-200 border-r border-border resize-none focus:outline-none"
              spellCheck={false}
            />
            {/* Live preview */}
            <div className="w-1/2 h-full overflow-hidden">
              <iframe
                srcDoc={editedHtml}
                title="Live Preview"
                className="w-full h-full border-0"
                sandbox="allow-scripts"
              />
            </div>
          </div>
        ) : (
          <iframe
            srcDoc={html}
            title="Website Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts"
          />
        )}
      </div>
    </div>
  );
}
