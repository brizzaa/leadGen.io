import React from "react";
import {
  FileText,
  CalendarDays,
  Calendar as CalendarIcon,
  Loader2,
  Save,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function CRMSection({
  notes,
  onNotesChange,
  nextContact,
  onNextContactChange,
  onSave,
  isSaving,
}) {
  return (
    <section className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 text-lg font-semibold mb-6 text-primary">
        <FileText className="w-5 h-5" />
        CRM & Note
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-2">
          <label className="text-sm text-muted-foreground font-medium flex items-center gap-2">
            Note Storiche
          </label>
          <textarea
            className="w-full text-sm bg-background border border-input rounded-xl p-4 min-h-[120px] focus:ring-2 focus:ring-primary focus:outline-none resize-none"
            placeholder="Scrivi qui gli aggiornamenti sulle telefonate, interessi, obiezioni..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Prossimo Contatto
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal bg-background h-10 rounded-xl border-input",
                    !nextContact && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nextContact ? (
                    format(new Date(nextContact), "PPP", { locale: it })
                  ) : (
                    <span>Seleziona una data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={nextContact ? new Date(nextContact) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      onNextContactChange(format(date, "yyyy-MM-dd"));
                    } else {
                      onNextContactChange("");
                    }
                  }}
                  initialFocus
                  locale={it}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="w-full gap-2 rounded-xl h-11"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salva Modifiche
          </Button>
        </div>
      </div>
    </section>
  );
}
