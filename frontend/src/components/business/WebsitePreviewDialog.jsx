import { RefreshCw, Download, X, Loader2 } from "lucide-react";

export default function WebsitePreviewDialog({
  open,
  onClose,
  html,
  businessName,
  onRegenerate,
  isRegenerating,
}) {
  if (!open) return null;

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border bg-background/80 backdrop-blur-sm">
        <span className="text-sm font-semibold truncate max-w-[50%]">
          {businessName} — Sito Vetrina
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Scarica HTML
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Iframe Preview */}
      <div className="flex-1 overflow-hidden">
        <iframe
          srcDoc={html}
          title="Website Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}
