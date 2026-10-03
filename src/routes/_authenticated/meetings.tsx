import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Video, Plus, Copy, Trash2, Users, Loader2, PlayCircle, LogIn } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({
    meta: [
      { title: "Meetings — Sri Surya Group HRMS" },
      { name: "description", content: "Schedule, start and join video meetings." },
      { property: "og:title", content: "Meetings — Sri Surya Group HRMS" },
      { property: "og:description", content: "Schedule, start and join video meetings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeetingsPage,
});

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  host_name: string;
  room_id: string;
  status: string;
  started_at: string | null;
  meeting_participants: { user_id: string }[] | null;
};
type Person = { id: string; full_name: string | null; email: string | null };

const JITSI = "https://meet.jit.si/";
const meetingUrl = (room: string) => `${JITSI}${room}`;

function newRoomId(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `SriSurya-${slug || "meeting"}-${rand}`;
}

const schema = z.object({
  title: z.string().trim().min(2, "Title is required").max(120),
  when: z.string().min(1, "Date & time is required"),
  host: z.string().trim().min(2, "Host name is required").max(80),
});

function MeetingsPage() {
  const { user, isAdmin, isManager, roles } = useAuth();
  const canCreate = roles.includes("super_admin") || roles.includes("hr_manager");
  const qc = useQueryClient();

  const meetingsQ = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,scheduled_at,host_name,room_id,status,started_at,meeting_participants(user_id)")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
  });

  const peopleQ = useQuery({
    queryKey: ["meeting-people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email").order("full_name");
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });
  const people = peopleQ.data ?? [];
  const nameOf = (id: string) => {
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown user";
  };

  const startMut = useMutation({
    mutationFn: async (m: Meeting) => {
      const { error } = await supabase
        .from("meetings")
        .update({ status: "live", started_at: new Date().toISOString() })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const endMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").update({ status: "completed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meetings"] }); toast.success("Meeting ended"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meetings"] }); toast.success("Meeting deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = meetingsQ.data ?? [];
  const now = Date.now();
  const isPast = (m: Meeting) =>
    m.status === "completed" || (m.status !== "live" && new Date(m.scheduled_at).getTime() < now - 3 * 3600_000);
  const upcoming = all.filter((m) => !isPast(m)).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const history = all.filter(isPast);

  const open = (m: Meeting) => window.open(meetingUrl(m.room_id), "_blank", "noopener,noreferrer");

  const renderList = (list: Meeting[], past: boolean) => {
    if (meetingsQ.isLoading) {
      return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
    }
    if (meetingsQ.error) {
      return <EmptyState icon={Video} title="Couldn't load meetings" description={(meetingsQ.error as Error).message} />;
    }
    if (list.length === 0) {
      return (
        <EmptyState
          icon={Video}
          title={past ? "No past meetings" : "No upcoming meetings"}
          description={canCreate ? "Create a meeting to get started." : "Meetings you are invited to will appear here."}
        />
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((m) => {
          const participants = m.meeting_participants ?? [];
          const d = new Date(m.scheduled_at);
          return (
            <Card key={m.id} className="glass-card border-border/40">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-foreground">{m.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · Host: {m.host_name}
                    </p>
                  </div>
                  <Badge variant={m.status === "live" ? "default" : "secondary"} className="shrink-0 capitalize">
                    {m.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{meetingUrl(m.room_id)}</span>
                  <button
                    type="button"
                    aria-label="Copy meeting link"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => { navigator.clipboard.writeText(meetingUrl(m.room_id)); toast.success("Link copied"); }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!past && canCreate && m.status !== "live" && (
                    <Button size="sm" className="bg-gradient-surya text-primary-foreground hover:opacity-90"
                      onClick={() => { open(m); startMut.mutate(m); }}>
                      <PlayCircle className="mr-1.5 h-4 w-4" />Start Meeting
                    </Button>
                  )}
                  {!past && (
                    <Button size="sm" variant="outline" onClick={() => open(m)}>
                      <LogIn className="mr-1.5 h-4 w-4" />Join Meeting
                    </Button>
                  )}
                  {!past && canCreate && m.status === "live" && (
                    <Button size="sm" variant="ghost" onClick={() => endMut.mutate(m.id)}>End</Button>
                  )}
                  <ParticipantsDialog names={participants.map((p) => nameOf(p.user_id))} />
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive"
                      aria-label="Delete meeting"
                      onClick={() => { if (confirm("Delete this meeting?")) deleteMut.mutate(m.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        description={isManager ? "Schedule and run video meetings with your team." : "Join the video meetings you're invited to."}
        actions={canCreate && user ? <CreateMeetingDialog people={people} userId={user.id} /> : null}
      />
      <Tabs defaultValue="upcoming">
        <TabsList className="bg-secondary/60">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">{renderList(upcoming, false)}</TabsContent>
        <TabsContent value="history" className="mt-4">{renderList(history, true)}</TabsContent>
      </Tabs>
    </div>
  );
}

function ParticipantsDialog({ names }: { names: string[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Users className="mr-1.5 h-4 w-4" />{names.length}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Participants</DialogTitle></DialogHeader>
        {names.length === 0 ? (
          <p className="text-sm text-muted-foreground">No participants assigned.</p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {names.map((n, i) => <li key={i} className="rounded-md bg-secondary/40 px-3 py-2">{n}</li>)}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateMeetingDialog({ people, userId }: { people: Person[]; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [host, setHost] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [roomId, setRoomId] = useState("");
  const [search, setSearch] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const r = schema.safeParse({ title, when, host });
      if (!r.success) throw new Error(r.error.issues[0].message);
      const room = roomId || newRoomId(r.data.title);
      const id = crypto.randomUUID();
      const { error } = await supabase.from("meetings").insert({
        id,
        title: r.data.title,
        scheduled_at: new Date(r.data.when).toISOString(),
        host_name: r.data.host,
        room_id: room,
        created_by: userId,
      });
      if (error) throw error;
      const ids = Array.from(new Set([...selected, userId]));
      const { error: pErr } = await supabase
        .from("meeting_participants")
        .insert(ids.map((u) => ({ meeting_id: id, user_id: u })));
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting created");
      setOpen(false);
      setTitle(""); setWhen(""); setHost(""); setSelected([]); setRoomId(""); setSearch("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = people.filter((p) =>
    `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
          <Plus className="mr-1.5 h-4 w-4" />New Meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Create new meeting</DialogTitle></DialogHeader>
        <form id="meeting-form" onSubmit={(e: FormEvent) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Meeting title</Label>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-when">Date & time</Label>
              <Input id="m-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-host">Host name</Label>
              <Input id="m-host" value={host} onChange={(e) => setHost(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Meeting link</Label>
            <div className="flex gap-2">
              <Input readOnly value={roomId ? meetingUrl(roomId) : ""} placeholder="Generated automatically" className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={() => setRoomId(newRoomId(title))}>Generate</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Participants ({selected.length})</Label>
            <Input placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/40 p-2">
              {filtered.length === 0 && <p className="p-2 text-xs text-muted-foreground">No people found.</p>}
              {filtered.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/40">
                  <Checkbox
                    checked={selected.includes(p.id)}
                    onCheckedChange={(c) =>
                      setSelected((s) => (c ? [...s, p.id] : s.filter((x) => x !== p.id)))
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{p.full_name || p.email}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{p.email}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="meeting-form" disabled={mut.isPending} className="bg-gradient-surya text-primary-foreground hover:opacity-90">
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
