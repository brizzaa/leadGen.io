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
    <div className="p-6 rounded-xl border border-border/50 bg-card shadow-sm space-y-4 h-full flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Share2 className="w-5 h-5" />
          <h3 className="text-sm uppercase tracking-wider">Social & Links</h3>
        </div>

        {socials.length > 0 ? (
          <div className="flex gap-3">
            <TooltipProvider>
              {socials.map((social) => (
                <Tooltip key={social.id}>
                  <TooltipTrigger asChild>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-3 rounded-xl border border-border/50 transition-all duration-300 ${social.color} bg-background/50 hover:scale-110`}
                    >
                      {social.icon}
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs break-all">
                    {social.url}
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Nessun profilo social rilevato
          </p>
        )}
      </div>

      {business.maps_url && (
        <a
          href={business.maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline mt-4 group"
        >
          <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          Apri su Google Maps
        </a>
      )}
    </div>
  );
}
