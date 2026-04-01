import { useEffect, useRef } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function ProgressLog({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <Card className="progress-log-card">
      <CardHeader className="progress-log__header">
        <div className="progress-log__title-row">
          <Loader2 className="w-4 h-4 animate-spin text-[#00d4aa]" />
          <CardTitle className="progress-log__title">
            Scraping in corso...
          </CardTitle>
        </div>
        <Progress value={null} className="progress-bar" />
      </CardHeader>
      <CardContent>
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
