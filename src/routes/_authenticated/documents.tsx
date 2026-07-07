import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Loader2, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents — Sri Surya Group HRMS" }] }),
  component: DocumentsPage,
});

const DOC_TYPES = ["Aadhaar", "PAN", "Resume", "Offer Letter", "Certificate", "Profile Photo", "Other"];

function DocumentsPage() {
  const { user, isManager } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("Aadhaar");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => ((await supabase.from("documents").select("*").order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("hrms-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("hrms-files").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error: insErr } = await supabase.from("documents").insert({
        doc_type: docType,
        file_name: file.name,
        file_url: signed?.signedUrl ?? path,
        file_size: file.size,
        uploaded_by: user.id,
        owner_type: "company",
      });
      if (insErr) throw insErr;
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["documents"] });
      setOpen(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload and manage employee documents, contracts and certificates."
        actions={
          <Button onClick={() => setOpen(true)} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
            <Upload className="mr-1.5 h-4 w-4" />Upload Document
          </Button>
        }
      />

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (rows ?? []).length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Upload identity documents, contracts, resumes and certificates." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows!.map((d: any) => (
                  <TableRow key={d.id} className="border-border/40">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{d.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{d.doc_type}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : "—"}</TableCell>
                    <TableCell className="text-sm">{format(new Date(d.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild><a href={d.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a></Button>
                        {(isManager || d.uploaded_by === user?.id) && (
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMut.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Document type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">File</Label>
              <Input ref={fileRef} type="file" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpload} disabled={uploading} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
