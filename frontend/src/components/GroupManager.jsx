import { useState } from "react";
import { Plus, Folder, X, Palette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const API_URL = import.meta.env.VITE_API_URL || "";

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#64748b",
];

export default function GroupManager({ groups, onRefresh }) {
  const [isOpen, setIsOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName.trim(),
          color: selectedColor,
        }),
      });

      if (res.ok) {
        setNewGroupName("");
        onRefresh();
      }
    } catch (error) {
      console.error("Error creating group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm("Sei sicuro di voler eliminare questo gruppo?")) return;

    try {
      const res = await fetch(`${API_URL}/api/groups/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Folder className="w-4 h-4" />
          Gestisci Gruppi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gestione Gruppi</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nuovo Gruppo</Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  placeholder="Nome gruppo..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Colore</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      selectedColor === color
                        ? "border-primary scale-110 shadow-sm"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </form>

          <div className="space-y-3">
            <Label>Gruppi Esistenti</Label>
            <div className="max-height-[200px] overflow-y-auto space-y-2 pr-2">
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nessun gruppo creato
                </p>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/50 group"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-sm font-medium">{group.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
