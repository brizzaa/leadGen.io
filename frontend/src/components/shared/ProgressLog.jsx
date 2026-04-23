import { useEffect, useRef } from "react";
import { Loader2, ChevronRight, Database, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProgressLog({ messages, insertedCount = 0, recentInserted = [] }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, recentInserted]);

  if (messages.length === 0 && insertedCount === 0) return null;

  return (
    <Card className="progress-log-card">
      <CardHeader className="progress-log__header pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#00d4aa]" />
            <CardTitle className="progress-log__title">Scraping in corso...</CardTitle>
          </div>
          {insertedCount > 0 && (
            <div className="flex items-center gap-1.5 bg-[#00d4aa]/10 text-[#00d4aa] rounded-full px-3 py-1">
              <Database className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{insertedCount} inseriti</span>
            </div>
          )}
        </div>

        {/* Live feed ultimi inseriti */}
        {recentInserted.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {recentInserted.map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs"
                style={{ opacity: 1 - i * 0.18 }}
              >
                <CheckCircle2 className="w-3 h-3 text-[#00d4aa] shrink-0" />
                <span className="font-medium truncate">{b.name}</span>
                {b.category && (
                  <span className="text-muted-foreground shrink-0">— {b.category}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="progress-log__messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className="progress-log__message"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <ChevronRight className="w-3.5 h-3.5 text-[#00d4aa] shrink-0 mt-0.5" />
              <span>{msg}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </CardContent>
    </Card>
  );
}
