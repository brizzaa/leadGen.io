import React from "react";
import { Facebook, Instagram, Share2, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function SocialSection({ business }) {
  const socials = [
    {
      id: "facebook",
      icon: <Facebook className="w-5 h-5" />,
      url: business.facebook_url,
      label: "Facebook",
      color: "hover:text-[#1877F2] hover:bg-[#1877F2]/10",
    },
    {
      id: "instagram",
      icon: <Instagram className="w-5 h-5" />,
      url: business.instagram_url,
      label: "Instagram",
      color: "hover:text-[#E4405F] hover:bg-[#E4405F]/10",
    },
  ].filter((s) => s.url);

  if (socials.length === 0 && !business.maps_url) return null;

  return (
    <TooltipProvider>
      <div className="p-5 rounded-xl border border-border/50 bg-card shadow-sm hover:border-primary/20 hover:shadow-md transition-all duration-300 group hover:-translate-y-1 h-full flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="text-primary/70 group-hover:text-primary group-hover:scale-110 transition-all duration-300">
                <Share2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider">
                Social & Links
              </span>
            </div>

            {business.maps_url && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={business.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary/70 hover:text-primary transition-all duration-300 hover:scale-110"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Apri con Maps</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {socials.length > 0 ? (
              socials.map((social) => (
                <Tooltip key={social.id}>
                  <TooltipTrigger asChild>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-2.5 rounded-xl border border-border/50 transition-all duration-300 ${social.color} bg-background/50 hover:scale-110`}
                    >
                      {React.cloneElement(social.icon, {
                        className: "w-4 h-4",
                      })}
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs break-all">
                    {social.url}
                  </TooltipContent>
                </Tooltip>
              ))
            ) : (
              <p className="text-[10px] text-muted-foreground/60 italic uppercase tracking-tight">
                Nessun profilo rilevato
              </p>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
