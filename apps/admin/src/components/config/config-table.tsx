"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { upsertConfig, deleteConfig } from "@/app/(admin)/config/actions";

interface ConfigEntry {
  key: string;
  value: unknown;
  expires_at: string | null;
  updated_at: string | null;
}

interface ConfigTableProps {
  configs: ConfigEntry[];
}

function truncateJson(value: unknown, maxLen = 60): string {
  const str = JSON.stringify(value);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

function formatDatetime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConfigTable({ configs }: ConfigTableProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editExpires, setEditExpires] = useState("");
  const [deleteKey, setDeleteKey] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openNew() {
    setIsNew(true);
    setEditKey("");
    setEditValue("{}");
    setEditExpires("");
    setJsonError(null);
    setEditOpen(true);
  }

  function openEdit(entry: ConfigEntry) {
    setIsNew(false);
    setEditKey(entry.key);
    setEditValue(JSON.stringify(entry.value, null, 2));
    setEditExpires(entry.expires_at ?? "");
    setJsonError(null);
    setEditOpen(true);
  }

  function openDelete(key: string) {
    setDeleteKey(key);
    setDeleteOpen(true);
  }

  function validateJson(val: string): boolean {
    try {
      JSON.parse(val);
      setJsonError(null);
      return true;
    } catch (e: any) {
      setJsonError(e.message ?? "Invalid JSON");
      return false;
    }
  }

  function handleSave() {
    if (!validateJson(editValue)) return;

    startTransition(async () => {
      const result = await upsertConfig(
        editKey,
        editValue,
        editExpires || undefined
      );
      if (result.success) {
        toast.success(isNew ? "Config entry created" : "Config entry updated");
        setEditOpen(false);
      } else {
        toast.error(result.error ?? "Failed to save config");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteConfig(deleteKey);
      if (result.success) {
        toast.success(`Deleted "${deleteKey}"`);
        setDeleteOpen(false);
      } else {
        toast.error(result.error ?? "Failed to delete config");
      }
    });
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">
                Configuration Entries
              </CardTitle>
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {configs.length}
              </Badge>
            </div>
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {configs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <Settings className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                No configuration entries yet
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={openNew}
              >
                Create your first entry
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="pl-6">Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Expires At</TableHead>
                  <TableHead>Updated At</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((entry) => (
                  <TableRow
                    key={entry.key}
                    className="border-border/30 hover:bg-muted/30"
                  >
                    <TableCell className="pl-6">
                      <code className="text-sm font-mono text-indigo-400">
                        {entry.key}
                      </code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                        {truncateJson(entry.value)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDatetime(entry.expires_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDatetime(entry.updated_at)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(entry)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => openDelete(entry.key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Add Config Entry" : "Edit Config Entry"}
            </DialogTitle>
            <DialogDescription>
              {isNew
                ? "Create a new runtime configuration entry."
                : `Editing "${editKey}".`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="config-key">Key</Label>
              <Input
                id="config-key"
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                readOnly={!isNew}
                placeholder="e.g. feature_flags.new_dashboard"
                className={!isNew ? "opacity-60" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="config-value">Value (JSON)</Label>
              <Textarea
                id="config-value"
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  if (jsonError) validateJson(e.target.value);
                }}
                onBlur={() => validateJson(editValue)}
                placeholder='{"enabled": true}'
                className="font-mono text-sm min-h-[120px]"
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="config-expires">Expires At (optional)</Label>
              <Input
                id="config-expires"
                type="datetime-local"
                value={editExpires}
                onChange={(e) => setEditExpires(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isNew ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Config Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <code className="font-mono text-foreground">{deleteKey}</code>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
