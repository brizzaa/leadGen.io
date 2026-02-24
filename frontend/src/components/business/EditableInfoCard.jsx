import React, { useState } from "react";
import { Edit2, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function EditableInfoCard({
  icon,
  label,
  value,
  isSaving,
  onSave,
  placeholder,
  href,
  type = "text",
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const handleToggleEdit = () => {
    if (isEditing) {
      setIsEditing(false);
      setEditValue(value || "");
    } else {
      setIsEditing(true);
      setEditValue(value || "");
    }
  };

  const handleSave = async () => {
    const success = await onSave(editValue);
    if (success !== false) {
      setIsEditing(false);
    }
  };

  const content = (
    <div className="flex flex-col gap-1 p-5 rounded-xl border border-border/50 bg-card shadow-sm hover:border-primary/20 hover:shadow-md transition-all duration-300 group hover:-translate-y-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="text-primary/70 group-hover:text-primary group-hover:scale-110 transition-all duration-300">
            {icon && React.cloneElement(icon, { className: "w-4 h-4" })}
          </div>
          <span className="text-xs font-medium uppercase tracking-wider">
            {label}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          onClick={handleToggleEdit}
        >
          {isEditing ? (
            <X className="w-3 h-3" />
          ) : (
            <Edit2 className="w-3 h-3" />
          )}
        </Button>
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm bg-background/50 focus-visible:ring-1 focus-visible:ring-primary"
            placeholder={placeholder}
            type={type}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setIsEditing(false);
            }}
          />
          <Button
            size="icon"
            disabled={isSaving}
            onClick={handleSave}
            className="h-8 w-8 shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
          </Button>
        </div>
      ) : value ? (
        href ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : "_self"}
            rel="noopener noreferrer"
            className="text-sm font-medium break-words hover:underline"
          >
            {value}
          </a>
        ) : (
          <div className="text-sm font-medium break-words">{value}</div>
        )
      ) : (
        <div className="text-sm font-medium text-muted-foreground">—</div>
      )}
    </div>
  );

  return content;
}
