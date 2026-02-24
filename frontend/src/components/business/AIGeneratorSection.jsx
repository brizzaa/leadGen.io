import React from "react";
import { Zap, Facebook, Loader2, Copy, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AIGeneratorSection({
  business,
  promptType,
  onPromptTypeChange,
  onGenerate,
  isGenerating,
  generatedEmail,
  onGeneratedEmailChange,
  emailSubject,
  onEmailSubjectChange,
  onSend,
  isSending,
  emailSentSuccess,
}) {
  return (
    <section className="relative overflow-hidden bg-card border border-border/50 rounded-2xl p-6 shadow-sm group">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
        <Zap className="w-48 h-48" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-primary">
            Generatore Mail/Messaggio AI
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Crea un messaggio a freddo (email o social) studiato appositamente
            per le mancanze di questo business.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Select value={promptType} onValueChange={onPromptTypeChange}>
              <SelectTrigger className="w-[200px] h-9 text-xs bg-background border-primary/20">
                <SelectValue placeholder="Scegli strategia..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai_strategy">Analisi Strategica</SelectItem>
                <SelectItem value="social_only">Solo Social (IG/FB)</SelectItem>
                <SelectItem value="weak_website">Sito Web Debole</SelectItem>
                <SelectItem value="generic">Generico/Libero</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 rounded-xl h-9 px-4 text-xs font-semibold whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analisi...
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3 fill-white flex-shrink-0" />
                  Genera
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {generatedEmail && (
        <div className="mt-6 border-t border-border/50 pt-6 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-4">
            {!business.email && (
              <div className="p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-sm flex items-center gap-2">
                <Facebook className="w-4 h-4" /> Nessuna email? Puoi usare
                questo testo per un messaggio su Facebook o Instagram.
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground font-medium flex items-center gap-2 mb-2">
                Oggetto (solo per Email)
              </label>
              <Input
                value={emailSubject}
                onChange={(e) => onEmailSubjectChange(e.target.value)}
                className="bg-background"
                spellCheck="false"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                  Corpo del Messaggio
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-2 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => navigator.clipboard.writeText(generatedEmail)}
                >
                  <Copy className="w-3.5 h-3.5" /> Copia testo
                </Button>
              </div>
              <textarea
                className="w-full text-sm bg-muted/30 border border-primary/20 rounded-xl p-5 min-h-[250px] focus:ring-2 focus:ring-primary focus:outline-none resize-y selection:bg-primary/20"
                value={generatedEmail}
                onChange={(e) => onGeneratedEmailChange(e.target.value)}
                spellCheck="false"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={onSend}
                disabled={isSending || emailSentSuccess}
                className={`gap-2 rounded-xl h-11 px-8 ${
                  emailSentSuccess
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : ""
                }`}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Invio in
                    corso...
                  </>
                ) : emailSentSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Inviata con successo!
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Invia tramite Gmail
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
