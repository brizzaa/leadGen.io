import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Users, Mail, MailOpen, TrendingUp, ArrowLeft, Target,
  Building2, FolderOpen, Activity, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const API_URL = import.meta.env.VITE_API_URL || "";

function StatCard({ icon, title, value, subtitle, color = "text-primary" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-3 rounded-full bg-muted">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/analytics/overview`)
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Caricamento analytics...</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center">Errore nel caricamento</div>;

  const statusMap = {};
  for (const s of data.by_status) statusMap[s.status] = s.count;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Dashboard Analytics</h1>
            <p className="text-sm text-muted-foreground">Panoramica delle tue performance</p>
          </div>
        </div>
      </div>

      {/* KPI principali */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users className="w-5 h-5" />} title="Lead Totali" value={data.total} subtitle={`+${data.this_week} questa settimana`} />
        <StatCard icon={<Mail className="w-5 h-5" />} title="Email Inviate" value={data.email.sent} subtitle={`${data.email.open_rate}% open rate`} />
        <StatCard icon={<MailOpen className="w-5 h-5" />} title="Email Aperte" value={data.email.opened} color="text-green-500" />
        <StatCard icon={<Target className="w-5 h-5" />} title="Conversioni" value={data.conversions} subtitle={`${data.conversion_rate}% conversion rate`} color="text-emerald-500" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Funnel CRM */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Pipeline CRM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Da Contattare", key: "Da Contattare", color: "bg-blue-500" },
              { label: "Inviata Mail", key: "Inviata Mail", color: "bg-yellow-500" },
              { label: "In Trattativa", key: "In Trattativa", color: "bg-orange-500" },
              { label: "Vinto (Cliente)", key: "Vinto (Cliente)", color: "bg-green-500" },
              { label: "Perso", key: "Perso", color: "bg-red-500" },
            ].map((s) => {
              const count = statusMap[s.key] || 0;
              const pct = data.total > 0 ? (count / data.total) * 100 : 0;
              return (
                <div key={s.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{s.label}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`${s.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Qualità dati */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> Qualità Dati</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Senza sito web</span>
                <span className="font-medium">{data.data_quality.no_website} / {data.total}</span>
              </div>
              <Progress value={data.total > 0 ? (data.data_quality.no_website / data.total) * 100 : 0} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Con email</span>
                <span className="font-medium">{data.data_quality.has_email} / {data.total}</span>
              </div>
              <Progress value={data.total > 0 ? (data.data_quality.has_email / data.total) * 100 : 0} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Con telefono</span>
                <span className="font-medium">{data.data_quality.has_phone} / {data.total}</span>
              </div>
              <Progress value={data.total > 0 ? (data.data_quality.has_phone / data.total) * 100 : 0} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Top Aree */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5" /> Top Aree</CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun dato</p>
            ) : (
              <div className="space-y-2">
                {data.top_areas.map((a) => (
                  <div key={a.area} className="flex justify-between items-center">
                    <span className="text-sm">{a.area}</span>
                    <span className="text-sm font-medium bg-muted px-2 py-0.5 rounded">{a.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Categorie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Top Categorie</CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun dato</p>
            ) : (
              <div className="space-y-2">
                {data.top_categories.map((c) => (
                  <div key={c.category} className="flex justify-between items-center">
                    <span className="text-sm">{c.category}</span>
                    <span className="text-sm font-medium bg-muted px-2 py-0.5 rounded">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attività recenti */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Attività Recenti</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent_activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna attività recente</p>
          ) : (
            <div className="space-y-3">
              {data.recent_activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium">{a.business_name}</span>
                    <span className="text-muted-foreground"> — {a.message}</span>
                    <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("it-IT")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
