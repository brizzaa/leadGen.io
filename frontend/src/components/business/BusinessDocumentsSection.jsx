import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Image,
  Upload,
  Trash2,
  Download,
  Loader2,
  Eye,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL || "";

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function BusinessDocumentsSection({ businessId }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_URL}/api/documents/${businessId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error("Error fetching documents:", e);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const res = await fetch(`${API_URL}/api/documents/${businessId}`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (e) {
      console.error("Upload error:", e);
    } finally {
      setIsUploading(false);
      // Resetta l'input file
      e.target.value = "";
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm("Sei sicuro di voler eliminare questo documento?")) return;

    try {
      const res = await fetch(`${API_URL}/api/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocuments(documents.filter((d) => d.id !== docId));
      }
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  return (
    <section className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm flex flex-col mt-4">
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-secondary/20">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <FileText className="w-4 h-4 text-primary" />
          Mappatura Documenti (PDF / File)
        </div>
        <div className="relative">
          <input
            type="file"
            id={`upload-doc-${businessId}`}
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          />
          <label htmlFor={`upload-doc-${businessId}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 cursor-pointer h-8 text-xs font-medium"
              asChild
              disabled={isUploading}
            >
              <span>
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Aggiungi
              </span>
            </Button>
          </label>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground opacity-60">
            <FileText className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-medium">Nessun documento caricato</p>
            <p className="text-xs">
              Carica qui i PDF, preventivi, o listini associati al cliente.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {documents.map((doc) => {
              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name);
              return (
                <li
                  key={doc.id}
                  className="relative flex flex-col rounded-lg border border-border/50 bg-background/50 overflow-hidden hover:border-primary/50 transition-colors group shadow-sm"
                >
                  {/* File Preview Area */}
                  <div className="aspect-square w-full bg-muted/30 relative flex items-center justify-center overflow-hidden">
                    {isImage ? (
                      <img
                        src={`${API_URL}${doc.url}`}
                        alt={doc.file_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <FileText className="w-10 h-10 text-primary/40" />
                    )}

                    {/* Overlay Actions on Hover */}
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-200">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-9 w-9 shadow-sm hover:scale-110 transition-transform"
                        onClick={() => setPreviewDoc(doc)}
                        title="Anteprima"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-9 w-9 shadow-sm hover:scale-110 transition-transform"
                        onClick={() => handleDelete(doc.id)}
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* File Info */}
                  <div className="p-3 border-t border-border/50 flex flex-col min-w-0">
                    <span
                      className="text-sm font-medium truncate"
                      title={doc.file_name}
                    >
                      {doc.file_name}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {formatBytes(doc.file_size)} •{" "}
                      {new Date(doc.uploaded_at).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setPreviewDoc(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl h-full max-h-[90vh] bg-background border border-border/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Info Header Modal */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/30 shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-1.5 rounded bg-primary/10 text-primary">
                    {/\.(jpg|jpeg|png|gif|webp)$/i.test(
                      previewDoc.file_name,
                    ) ? (
                      <Image className="w-4 h-4" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-sm font-semibold truncate"
                      title={previewDoc.file_name}
                    >
                      {previewDoc.file_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(previewDoc.file_size)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2"
                    asChild
                  >
                    <a
                      href={`${API_URL}${previewDoc.url}`}
                      download={previewDoc.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        Scarica Originale
                      </span>
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-muted"
                    onClick={() => setPreviewDoc(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Contenuto Preview */}
              <div className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center p-4 relative min-h-0">
                {/\.(jpg|jpeg|png|gif|webp)$/i.test(previewDoc.file_name) ? (
                  <img
                    src={`${API_URL}${previewDoc.url}`}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain rounded-md shadow-sm"
                  />
                ) : /\.(pdf)$/i.test(previewDoc.file_name) ? (
                  <iframe
                    src={`${API_URL}${previewDoc.url}`}
                    className="w-full h-full rounded-md shadow-sm bg-white"
                    title={previewDoc.file_name}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center opacity-70">
                    <FileText className="w-16 h-16 mb-4 text-muted-foreground opacity-50" />
                    <p className="font-medium text-foreground">
                      Anteprima non disponibile
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center px-4">
                      Il browser non supporta la visualizzazione diretta di
                      questo formato di file. Utilizza il pulsante scarica per
                      visualizzarlo.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
