import { ChevronDown, Plus, SquareTerminal } from "lucide-react";
import type { ShellProfile } from "../types";
import IconButton from "./IconButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface Props {
  profiles: ShellProfile[];
  defaultProfileId: string;
  onCreate: (profileId?: string) => void;
}

export default function ProfileMenu({
  profiles,
  defaultProfileId,
  onCreate,
}: Props) {
  const visible = profiles.filter(
    ({ enabled, showInMenu }) => enabled && showInMenu,
  );
  return (
    <div className="new-terminal-menu">
      <IconButton
        label="New terminal"
        variant="ghost"
        size="icon-sm"
        onClick={() => onCreate(defaultProfileId)}
      >
        <Plus />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            label="Choose shell profile"
            variant="ghost"
            size="icon-xs"
          >
            <ChevronDown />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel>New terminal</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {visible.map((profile) => (
            <DropdownMenuItem
              key={profile.id}
              disabled={!profile.available}
              onSelect={() => onCreate(profile.id)}
            >
              <SquareTerminal />
              <span>{profile.name}</span>
              {!profile.available && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  Unavailable
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
