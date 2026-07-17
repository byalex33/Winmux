import {
  Activity,
  Folder,
  PanelTop,
  Settings,
  SquareTerminal,
  Waypoints,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  filterCommands,
  type Command as AppCommand,
  type CommandContext,
} from "../commands";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "./ui/command";

interface Props {
  commands: AppCommand[];
  context: CommandContext;
  onClose: () => void;
}

const groups = [
  ["Folders", Folder],
  ["Terminals", SquareTerminal],
  ["Panes", PanelTop],
  ["Navigation", Waypoints],
  ["Activity", Activity],
  ["Settings", Settings],
] as const;

const groupFor = (id: string): (typeof groups)[number][0] => {
  if (id.startsWith("folder.")) return "Folders";
  if (id.startsWith("terminal.")) return "Terminals";
  if (id.startsWith("pane.")) return "Panes";
  if (id.startsWith("settings.")) return "Settings";
  if (id.startsWith("activity.") || id.startsWith("notifications."))
    return "Activity";
  return "Navigation";
};

export default function CommandPalette({ commands, context, onClose }: Props) {
  const [query, setQuery] = useState("");
  const matches = useMemo(
    () => filterCommands(commands, query),
    [commands, query],
  );
  const run = (command: AppCommand) => {
    onClose();
    command.run(context);
  };
  return (
    <CommandDialog open onOpenChange={(open) => !open && onClose()}>
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Type a command"
          aria-label="Search commands"
        />
        <CommandList>
          <CommandEmpty>No matching commands</CommandEmpty>
          {groups.map(([group, GroupIcon]) => {
            const commands = matches.filter(({ id }) => groupFor(id) === group);
            if (!commands.length) return null;
            return (
              <CommandGroup key={group} heading={group}>
                {commands.map((command) => (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    onSelect={() => run(command)}
                  >
                    <GroupIcon />
                    <span>{command.title}</span>
                    {command.shortcut && (
                      <CommandShortcut>{command.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
