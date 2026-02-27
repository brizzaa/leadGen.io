import { useMemo, useEffect } from "react";
import { useMap, MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  ExternalLink,
  Globe,
  Phone,
  Eye,
  Star,
  MessageSquare,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { useNavigate } from "react-router-dom";

/**
 * Componente interno che chiama invalidateSize() alla montatura.
 * Deve stare dentro <MapContainer> per accedere all'istanza Leaflet via useMap().
 * Risolve il problema dei tile non caricati quando la mappa viene mostrata
 * dopo essere stata nascosta (es. switching da tabella/kanban a mappa).
 */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function BusinessMap({ businesses }) {
  const navigate = useNavigate();

  // Estrae le coordinate dall'URL di Google Maps se sono presenti
  const businessesWithCoords = useMemo(() => {
    return businesses
      .map((b) => {
        let lat = null;
        let lng = null;
        if (b.maps_url) {
          // Cerca pattern tipo !3d45.0846961!4d11.7822507
          const match3d = b.maps_url.match(/!3d([-\d.]+)/);
          const match4d = b.maps_url.match(/!4d([-\d.]+)/);

          if (match3d && match4d) {
            lat = parseFloat(match3d[1]);
            lng = parseFloat(match4d[1]);
          } else {
            // Prova a cercare pattern /@45.123,11.234
            const matchAt = b.maps_url.match(/@([-\d.]+),([-\d.]+)/);
            if (matchAt) {
              lat = parseFloat(matchAt[1]);
              lng = parseFloat(matchAt[2]);
            }
          }
        }
        return { ...b, lat, lng };
      })
      .filter(
        (b) =>
          b.lat !== null && b.lng !== null && !isNaN(b.lat) && !isNaN(b.lng),
      );
  }, [businesses]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Da Contattare":
        return "#94a3b8"; // slate-400
      case "Inviata Mail":
        return "#60a5fa"; // blue-400
      case "In Trattativa":
        return "#fbbf24"; // amber-400
      case "Vinto (Cliente)":
        return "#34d399"; // emerald-400
      case "Perso":
        return "#f87171"; // red-400
      default:
        return "#94a3b8";
    }
  };

  const createIcon = (status) => {
    const color = getStatusColor(status);
    const iconMarkup = renderToStaticMarkup(
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill={color}
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.015))" }}
      >
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" fill="white" stroke="none" />
      </svg>,
    );
    return L.divIcon({
      html: iconMarkup,
      className: "custom-leaflet-icon",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  };

  const center = useMemo(() => {
    if (businessesWithCoords.length === 0) {
      return [41.902782, 12.496366]; // Roma di default
    }
    const sumLat = businessesWithCoords.reduce((sum, b) => sum + b.lat, 0);
    const sumLng = businessesWithCoords.reduce((sum, b) => sum + b.lng, 0);
    return [
      sumLat / businessesWithCoords.length,
      sumLng / businessesWithCoords.length,
    ];
  }, [businessesWithCoords]);

  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border border-border shadow-sm relative z-0 leaflet-container-wrapper">
      <MapContainer
        center={center}
        zoom={businessesWithCoords.length === 0 ? 5 : 12}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <MapResizer />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {businessesWithCoords.map((business, index) => (
          <Marker
            key={`marker-${business.id}-${index}`}
            position={[business.lat, business.lng]}
            icon={createIcon(business.status)}
          >
            <Popup className="custom-popup">
              <div className="flex flex-col w-[300px] overflow-hidden">
                {/* Status Bar */}
                <div
                  className="h-1.5 w-full shrink-0"
                  style={{ backgroundColor: getStatusColor(business.status) }}
                />

                <div className="p-5 flex flex-col gap-4">
                  {/* Top Row: Status & Rating (with space for close button) */}
                  <div className="flex flex-col gap-2.5 pr-6">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
                        style={{
                          backgroundColor:
                            getStatusColor(business.status) + "15",
                          color: getStatusColor(business.status),
                          borderColor: getStatusColor(business.status) + "30",
                        }}
                      >
                        {business.status}
                      </span>
                    </div>

                    <h3 className="font-bold text-lg leading-tight text-foreground">
                      {business.name}
                    </h3>

                    {business.rating && (
                      <div className="flex items-center gap-1.5 text-amber-500 font-bold text-sm">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < Math.floor(business.rating)
                                  ? "fill-amber-500"
                                  : "fill-muted text-muted"
                              }`}
                            />
                          ))}
                        </div>
                        <span>{business.rating.toFixed(1)}</span>
                        <span className="text-muted-foreground font-normal text-xs">
                          ({business.review_count || 0} recensioni)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="flex flex-col gap-3 pt-4 border-t border-border/60">
                    <div className="flex items-start gap-3 text-[13px] text-muted-foreground leading-relaxed">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary/70" />
                      <span>
                        {business.address || "Indirizzo non disponibile"}
                      </span>
                    </div>

                    {business.phone && (
                      <div className="flex items-center gap-3 text-[13px]">
                        <Phone className="w-4 h-4 shrink-0 text-primary/70" />
                        <span className="text-foreground font-medium">
                          {business.phone}
                        </span>
                      </div>
                    )}

                    {business.website && (
                      <a
                        href={business.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-[13px] text-primary hover:text-primary/80 transition-colors group"
                      >
                        <Globe className="w-4 h-4 shrink-0 text-primary/70" />
                        <span className="truncate max-w-[200px] font-medium">
                          {new URL(business.website).hostname.replace(
                            "www.",
                            "",
                          )}
                        </span>
                        <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sessionStorage.setItem("returnToSearch", business.name);
                        navigate(`/business/${business.id}`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-primary/20"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Visualizza Scheda
                    </button>
                    {business.maps_url && (
                      <a
                        href={business.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg transition-all"
                        title="Apri in Google Maps"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
