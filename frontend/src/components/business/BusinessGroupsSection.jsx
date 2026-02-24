import { Plus, X, FolderPlus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function BusinessGroupsSection({
  businessId,
  allGroups,
  currentGroups,
  onRefresh,
}) {
  const addGroup = async (groupId) => {
    try {
      const res = await fetch(`${API_URL}/api/groups/business/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (res.ok) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const removeGroup = async (groupId) => {
    try {
      const res = await fetch(
        `${API_URL}/api/groups/business/${businessId}/${groupId}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const availableGroups = allGroups.filter(
    (g) => !currentGroups.find((cg) => cg.id === g.id),
  );

  return (
    <div className="p-5 rounded-xl border border-border/50 bg-card shadow-sm hover:border-primary/20 hover:shadow-md transition-all duration-300 group hover:-translate-y-1 h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="text-primary/70 group-hover:text-primary group-hover:scale-110 transition-all duration-300">
            <Tag className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wider">
            Gruppi / Liste
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <FolderPlus className="w-3.5 h-3.5" />
              Aggiungi
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {availableGroups.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground italic">
                Nessun altro gruppo disponibile
              </div>
            ) : (
              availableGroups.map((group) => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => addGroup(group.id)}
                  className="gap-2 cursor-pointer"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap gap-2">
        {currentGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nessun gruppo assegnato a questa attività
          </p>
        ) : (
          currentGroups.map((group) => (
            <Badge
              key={group.id}
              variant="secondary"
              className="pl-2 gap-1.5 py-1 pr-1 bg-background border-border/50 hover:bg-muted transition-colors group"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              <span className="text-xs font-medium">{group.name}</span>
              <button
                onClick={() => removeGroup(group.id)}
                className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Rimuovi dal gruppo"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
