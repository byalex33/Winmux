import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

export interface PromptRequest {
  title: string;
  description: string;
  initial: string;
  submitLabel: string;
  resolve: (value?: string) => void;
}

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
}

export function PromptDialog({
  request,
  finish,
}: {
  request: PromptRequest;
  finish: (value?: string) => void;
}) {
  const [value, setValue] = useState(request.initial);
  return (
    <Dialog open onOpenChange={(open) => !open && finish()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription>{request.description}</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          aria-label={request.title}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim()) finish(value.trim());
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => finish()}>
            Cancel
          </Button>
          <Button disabled={!value.trim()} onClick={() => finish(value.trim())}>
            {request.submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  request,
  finish,
}: {
  request: ConfirmRequest;
  finish: (value: boolean) => void;
}) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && finish(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request.title}</AlertDialogTitle>
          <AlertDialogDescription>{request.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant={request.destructive ? "destructive" : "default"}
            onClick={() => finish(true)}
          >
            {request.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
