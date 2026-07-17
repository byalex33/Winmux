import {
  Activity,
  Bell,
  Eye,
  Keyboard,
  Settings2,
  SlidersHorizontal,
  SquareTerminal,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { OverrideSetting, TerminalSettings } from "../types";
import type { WorkspaceStore } from "../useWorkspaceStore";
import AppearanceSettings from "./settings/AppearanceSettings";
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
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

const envText = (env: Record<string, string>) =>
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
const parseEnv = (value: string): Record<string, string> =>
  Object.fromEntries(
    value
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ])
      .filter(([key]) => key),
  );

function SettingSwitch({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <div>
        <label htmlFor={id}>{label}</label>
        {description && <p>{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const tabItems = [
  ["appearance", Eye, "Appearance"],
  ["terminal", SquareTerminal, "Terminal"],
  ["profiles", SlidersHorizontal, "Shell profiles"],
  ["activity", Activity, "Activity"],
  ["notifications", Bell, "Notifications"],
  ["behaviour", Settings2, "Behaviour"],
  ["shortcuts", Keyboard, "Keyboard shortcuts"],
] as const;

export default function SettingsDialog({
  store,
  onClose,
}: {
  store: WorkspaceStore;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(
    store.state.settings.defaultProfileId,
  );
  const [deleteProfileId, setDeleteProfileId] = useState<string>();
  const selected =
    store.state.profiles.find(({ id }) => id === selectedId) ??
    store.state.profiles[0]!;
  const settings = store.state.settings;
  const updateBoolean = (key: keyof TerminalSettings) => (checked: boolean) =>
    store.updateSettings({ [key]: checked });
  const updateOverride = (
    key: "tracking" | "shellIntegration" | "waitingDetection",
    value: OverrideSetting,
  ) =>
    store.updateSettings({
      profileActivityOverrides: {
        ...settings.profileActivityOverrides,
        [selected.id]: {
          tracking:
            settings.profileActivityOverrides[selected.id]?.tracking ??
            "inherit",
          shellIntegration:
            settings.profileActivityOverrides[selected.id]?.shellIntegration ??
            "inherit",
          waitingDetection:
            settings.profileActivityOverrides[selected.id]?.waitingDetection ??
            "inherit",
          [key]: value,
        },
      },
    });
  const add = () => setSelectedId(store.createProfile());
  const duplicate = () => setSelectedId(store.duplicateProfile(selected.id));
  const fieldInvalid = !selected.name.trim() || !selected.command.trim();

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="settings-dialog" showCloseButton>
          <DialogHeader className="settings-header">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Winmux appearance, terminals, activity, and behaviour.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            defaultValue="appearance"
            orientation="vertical"
            className="settings-tabs"
          >
            <TabsList className="settings-nav" aria-label="Settings sections">
              {tabItems.map(([value, Icon, label]) => (
                <TabsTrigger key={value} value={value}>
                  <Icon /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollArea className="settings-content">
              <TabsContent value="appearance">
                <AppearanceSettings store={store} />
              </TabsContent>
              <TabsContent value="terminal">
                <div className="settings-section">
                  <div>
                    <h3>Terminal</h3>
                    <p>
                      Changes apply to live terminals without recreating their
                      sessions.
                    </p>
                  </div>
                  <div className="setting-field">
                    <label>Default shell profile</label>
                    <Select
                      value={settings.defaultProfileId}
                      onValueChange={(defaultProfileId) =>
                        store.updateSettings({ defaultProfileId })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {store.state.profiles
                          .filter(
                            ({ enabled, available }) => enabled && available,
                          )
                          .map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="setting-field">
                    <label htmlFor="font-family">Font family</label>
                    <Input
                      id="font-family"
                      value={settings.fontFamily}
                      onChange={(event) =>
                        store.updateSettings({ fontFamily: event.target.value })
                      }
                    />
                  </div>
                  <div className="settings-grid">
                    <div className="setting-field">
                      <label>
                        Font size <output>{settings.fontSize}px</output>
                      </label>
                      <Slider
                        min={8}
                        max={32}
                        step={1}
                        value={[settings.fontSize]}
                        onValueChange={([fontSize]) =>
                          store.updateSettings({ fontSize })
                        }
                      />
                    </div>
                    <div className="setting-field">
                      <label>
                        Line height{" "}
                        <output>{settings.lineHeight.toFixed(1)}</output>
                      </label>
                      <Slider
                        min={0.8}
                        max={2}
                        step={0.1}
                        value={[settings.lineHeight]}
                        onValueChange={([lineHeight]) =>
                          store.updateSettings({ lineHeight })
                        }
                      />
                    </div>
                    <div className="setting-field">
                      <label>Cursor style</label>
                      <Select
                        value={settings.cursorStyle}
                        onValueChange={(cursorStyle) =>
                          store.updateSettings({
                            cursorStyle:
                              cursorStyle as typeof settings.cursorStyle,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="block">Block</SelectItem>
                          <SelectItem value="underline">Underline</SelectItem>
                          <SelectItem value="bar">Bar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="setting-field">
                      <label htmlFor="scrollback">Scrollback</label>
                      <Input
                        id="scrollback"
                        type="number"
                        min={100}
                        max={100000}
                        value={settings.scrollback}
                        onChange={(event) =>
                          store.updateSettings({
                            scrollback: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <SettingSwitch
                    id="cursor-blink"
                    label="Cursor blinking"
                    checked={settings.cursorBlink}
                    onChange={updateBoolean("cursorBlink")}
                  />
                  <div
                    className="terminal-preview"
                    style={{
                      fontFamily: settings.fontFamily,
                      fontSize: settings.fontSize,
                      lineHeight: settings.lineHeight,
                    }}
                    aria-label="Terminal appearance preview"
                  >
                    <span className="preview-prompt">PS C:\Winmux&gt;</span> npm
                    run build
                    <br />
                    <span className="preview-success">✓</span> built in 1.24s
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="profiles">
                <div className="settings-section profiles-section">
                  <div className="section-heading">
                    <div>
                      <h3>Shell profiles</h3>
                      <p>
                        Built-in profiles are detected locally; custom profiles
                        remain editable.
                      </p>
                    </div>
                    <Button size="sm" onClick={add}>
                      New profile
                    </Button>
                  </div>
                  <div className="profile-layout">
                    <div className="profile-list">
                      {store.state.profiles.map((profile) => (
                        <button
                          key={profile.id}
                          data-selected={profile.id === selected.id}
                          onClick={() => setSelectedId(profile.id)}
                        >
                          <span>{profile.name}</span>
                          <span>
                            {profile.builtIn && (
                              <Badge variant="outline">Built-in</Badge>
                            )}
                            {profile.builtIn && profile.available && (
                              <Badge variant="secondary">Detected</Badge>
                            )}
                            {!profile.builtIn && (
                              <Badge variant="secondary">Custom</Badge>
                            )}
                            {!profile.available && (
                              <Badge variant="destructive">Unavailable</Badge>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="profile-editor">
                      <div className="setting-field">
                        <label htmlFor="profile-name">Display name</label>
                        <Input
                          id="profile-name"
                          aria-invalid={!selected.name.trim()}
                          value={selected.name}
                          onChange={(event) =>
                            store.updateProfile(selected.id, {
                              name: event.target.value,
                            })
                          }
                        />
                        {!selected.name.trim() && (
                          <p className="field-error">
                            A display name is required.
                          </p>
                        )}
                      </div>
                      <div className="setting-field">
                        <label htmlFor="profile-command">
                          Executable or command
                        </label>
                        <Input
                          id="profile-command"
                          aria-invalid={!selected.command.trim()}
                          value={selected.command}
                          onChange={(event) =>
                            store.updateProfile(selected.id, {
                              command: event.target.value,
                            })
                          }
                        />
                        {!selected.command.trim() && (
                          <p className="field-error">A command is required.</p>
                        )}
                      </div>
                      <div className="setting-field">
                        <label htmlFor="profile-args">
                          Arguments <small>one per line</small>
                        </label>
                        <Textarea
                          id="profile-args"
                          value={selected.args.join("\n")}
                          onChange={(event) =>
                            store.updateProfile(selected.id, {
                              args: event.target.value
                                .split("\n")
                                .filter(Boolean),
                            })
                          }
                        />
                      </div>
                      <div className="setting-field">
                        <label htmlFor="profile-cwd">Starting directory</label>
                        <Input
                          id="profile-cwd"
                          value={selected.cwd ?? ""}
                          onChange={(event) =>
                            store.updateProfile(selected.id, {
                              cwd: event.target.value || undefined,
                            })
                          }
                        />
                      </div>
                      <div className="setting-field">
                        <label htmlFor="profile-env">
                          Environment <small>KEY=value, one per line</small>
                        </label>
                        <Textarea
                          id="profile-env"
                          value={envText(selected.env)}
                          onChange={(event) =>
                            store.updateProfile(selected.id, {
                              env: parseEnv(event.target.value),
                            })
                          }
                        />
                      </div>
                      <SettingSwitch
                        id="profile-enabled"
                        label="Enabled"
                        checked={selected.enabled}
                        onChange={(enabled) =>
                          store.updateProfile(selected.id, { enabled })
                        }
                      />
                      <SettingSwitch
                        id="profile-menu"
                        label="Show in new-terminal menu"
                        checked={selected.showInMenu}
                        onChange={(showInMenu) =>
                          store.updateProfile(selected.id, { showInMenu })
                        }
                      />
                      <Separator />
                      <h4>Activity overrides</h4>
                      {(
                        [
                          "tracking",
                          "shellIntegration",
                          "waitingDetection",
                        ] as const
                      ).map((key) => (
                        <div className="setting-field" key={key}>
                          <label>
                            {key === "tracking"
                              ? "Activity tracking"
                              : key === "shellIntegration"
                                ? "Shell integration"
                                : "Waiting detection"}
                          </label>
                          <Select
                            value={
                              settings.profileActivityOverrides[selected.id]?.[
                                key
                              ] ?? "inherit"
                            }
                            onValueChange={(value) =>
                              updateOverride(key, value as OverrideSetting)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">
                                Use global setting
                              </SelectItem>
                              <SelectItem value="enabled">Enabled</SelectItem>
                              <SelectItem value="disabled">Disabled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                      <div className="settings-actions">
                        <Button variant="outline" size="sm" onClick={duplicate}>
                          Duplicate
                        </Button>
                        <span />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={fieldInvalid}
                          onClick={() => toast.success("Shell profile saved")}
                        >
                          Save
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={Boolean(selected.builtIn)}
                          onClick={() => setDeleteProfileId(selected.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="activity">
                <div className="settings-section">
                  <div>
                    <h3>Activity</h3>
                    <p>
                      Shell integration is optional and never edits shell
                      profile files.
                    </p>
                  </div>
                  <SettingSwitch
                    id="activity-tracking"
                    label="Activity tracking"
                    checked={settings.activityTracking}
                    onChange={updateBoolean("activityTracking")}
                  />
                  <SettingSwitch
                    id="shell-integration"
                    label="Shell integration"
                    checked={settings.shellIntegration}
                    onChange={updateBoolean("shellIntegration")}
                  />
                  <SettingSwitch
                    id="waiting-detection"
                    label="Waiting-for-input detection"
                    checked={settings.waitingDetection}
                    onChange={updateBoolean("waitingDetection")}
                  />
                  <div className="settings-grid">
                    <div className="setting-field">
                      <label htmlFor="minimum-duration">
                        Completion minimum (seconds)
                      </label>
                      <Input
                        id="minimum-duration"
                        type="number"
                        min={0}
                        max={3600}
                        value={settings.minimumCommandDuration}
                        onChange={(event) =>
                          store.updateSettings({
                            minimumCommandDuration: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="setting-field">
                      <label htmlFor="clear-delay">
                        Clear completed after (seconds)
                      </label>
                      <Input
                        id="clear-delay"
                        type="number"
                        min={0}
                        max={3600}
                        value={settings.completedClearDelay}
                        onChange={(event) =>
                          store.updateSettings({
                            completedClearDelay: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="setting-field">
                      <label htmlFor="waiting-silence">
                        Waiting silence (seconds)
                      </label>
                      <Input
                        id="waiting-silence"
                        type="number"
                        min={1}
                        max={300}
                        value={settings.waitingSilenceSeconds}
                        onChange={(event) =>
                          store.updateSettings({
                            waitingSilenceSeconds: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="notifications">
                <div className="settings-section">
                  <div>
                    <h3>Notifications</h3>
                    <p>
                      Native Windows notifications are shown only for meaningful
                      background activity.
                    </p>
                  </div>
                  <SettingSwitch
                    id="notifications"
                    label="Native notifications"
                    checked={settings.notificationsEnabled}
                    onChange={(checked) => {
                      store.updateSettings({ notificationsEnabled: checked });
                      toast.success(
                        `Notifications ${checked ? "enabled" : "disabled"}`,
                      );
                    }}
                  />
                  <SettingSwitch
                    id="completion-notifications"
                    label="Completion notifications"
                    checked={settings.completionNotifications}
                    onChange={updateBoolean("completionNotifications")}
                  />
                  <SettingSwitch
                    id="failure-notifications"
                    label="Failure notifications"
                    checked={settings.failureNotifications}
                    onChange={updateBoolean("failureNotifications")}
                  />
                  <SettingSwitch
                    id="waiting-notifications"
                    label="Waiting notifications"
                    checked={settings.waitingNotifications}
                    onChange={updateBoolean("waitingNotifications")}
                  />
                  <SettingSwitch
                    id="command-name"
                    label="Include sanitized command name"
                    checked={settings.notificationCommandName}
                    onChange={updateBoolean("notificationCommandName")}
                  />
                  <div className="setting-field">
                    <label>Bell behaviour</label>
                    <Select
                      value={settings.bellBehavior}
                      onValueChange={(bellBehavior) =>
                        store.updateSettings({
                          bellBehavior:
                            bellBehavior as typeof settings.bellBehavior,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disabled">Disabled</SelectItem>
                        <SelectItem value="visual">
                          Visual indicator only
                        </SelectItem>
                        <SelectItem value="notify">
                          Notify when unfocused
                        </SelectItem>
                        <SelectItem value="sound">
                          Visual indicator and sound
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="behaviour">
                <div className="settings-section">
                  <div>
                    <h3>Behaviour</h3>
                    <p>Desktop interaction and persistence preferences.</p>
                  </div>
                  <SettingSwitch
                    id="copy-selection"
                    label="Copy on selection"
                    checked={settings.copyOnSelection}
                    onChange={updateBoolean("copyOnSelection")}
                  />
                  <SettingSwitch
                    id="confirm-running"
                    label="Confirm before closing a running foreground process"
                    checked={settings.confirmCloseRunning}
                    onChange={updateBoolean("confirmCloseRunning")}
                  />
                  <SettingSwitch
                    id="restore-layouts"
                    label="Restore previous folder layouts on launch"
                    checked={settings.restoreLayouts}
                    onChange={updateBoolean("restoreLayouts")}
                  />
                </div>
              </TabsContent>
              <TabsContent value="shortcuts">
                <div className="settings-section shortcut-list">
                  <div>
                    <h3>Keyboard shortcuts</h3>
                    <p>
                      Keyboard-first navigation remains available throughout
                      Winmux.
                    </p>
                  </div>
                  {[
                    ["Command palette", "Ctrl+Shift+P"],
                    ["New terminal", "Ctrl+Shift+T"],
                    ["Create folder", "Ctrl+Shift+N"],
                    ["Split right", "Ctrl+Shift+D"],
                    ["Split down", "Ctrl+Shift+E"],
                    ["Close pane", "Ctrl+Shift+W"],
                    ["Terminal search", "Ctrl+F"],
                    ["Switch folders", "Ctrl+1…9"],
                  ].map(([label, shortcut]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <kbd>{shortcut}</kbd>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleteProfileId)}
        onOpenChange={(open) => !open && setDeleteProfileId(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete shell profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the custom profile. Existing live terminals are not
              restarted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteProfileId) store.deleteProfile(deleteProfileId);
                setDeleteProfileId(undefined);
              }}
            >
              Delete profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
