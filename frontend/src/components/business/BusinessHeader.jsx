import React from "react";
import { ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModeToggle } from "@/components/ModeToggle";

const STATUS_COLORS = {
  "Da Contattare": "bg-gray-500/10 text-gray-500 border-gray-500/20",
  "Inviata Mail": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "In Trattativa": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  "Vinto (Cliente)": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Perso: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function BusinessHeader({
  business,
  status,
  onStatusUpdate,
  onOptOut,
  onUndoOptOut,
  onBack,
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {business.name}
            </h1>
            <span className="text-xs text-muted-foreground">
              {business.category} • {business.area}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={status} onValueChange={onStatusUpdate}>
            <SelectTrigger
              className={`w-[150px] h-9 px-3 text-sm font-medium focus:ring-2 focus:ring-primary ${STATUS_COLORS[status]} transition-colors`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Da Contattare">Da Contattare</SelectItem>
              <SelectItem value="Inviata Mail">Inviata Mail</SelectItem>
              <SelectItem value="In Trattativa">In Trattativa</SelectItem>
              <SelectItem value="Vinto (Cliente)">Vinto (Cliente)</SelectItem>
              <SelectItem value="Perso">Perso</SelectItem>
            </SelectContent>
          </Select>

          {business.is_blacklisted ? (
            <div className="flex items-center gap-2">
              <Badge
                variant="destructive"
                className="h-9 px-4 uppercase text-[10px] tracking-wider"
              >
                Opt-out attivo
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndoOptOut}
                className="h-9 px-3 text-xs text-muted-foreground hover:text-primary"
              >
                Annulla
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onOptOut}
              className="h-9 px-4 text-xs text-red-500 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40"
            >
              Opt-out
            </Button>
          )}
          <div className="ml-1">
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
