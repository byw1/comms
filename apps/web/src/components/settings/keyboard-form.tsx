'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, Plus, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { BindingKeys } from '@/components/app/keyboard-shortcuts';
import { updateKeymap } from '@/server/actions/profile';
import {
  DEFAULT_ENTER_SENDS,
  DEFAULT_PRESET,
  KEY_ACTIONS,
  PRESETS,
  chordFromEvent,
  diffFromPreset,
  findConflicts,
  isMacPlatform,
  resolveEnterSends,
  resolveKeymap,
  type KeyActionGroup,
  type KeyActionId,
  type Keymap,
  type KeymapPreference,
  type PresetId,
} from '@/lib/keymap';
import { cn } from '@/lib/utils';

/**
 * Rebinding is done by RECORDING, not by typing a string: the user presses the
 * keys they want and we store exactly the chord our matcher will later see.
 * Anything else creates bindings that look right and never fire.
 */
export function KeyboardForm({ preference }: { preference: KeymapPreference | null }) {
  const [preset, setPreset] = useState<PresetId>(
    (preference?.preset as PresetId) in PRESETS
      ? (preference!.preset as PresetId)
      : DEFAULT_PRESET,
  );
  const [keymap, setKeymap] = useState<Keymap>(() => resolveKeymap(preference));
  const [enterSends, setEnterSends] = useState(() => resolveEnterSends(preference));
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState<KeyActionId | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, start] = useTransition();

  const isMac = isMacPlatform();
  const conflicts = useMemo(() => findConflicts(keymap), [keymap]);
  const conflictedActions = useMemo(
    () => new Set(conflicts.flatMap((c) => c.actions)),
    [conflicts],
  );

  // Capture the next keypress as the new binding. Bound at the window with
  // capture so nothing — including the app's own shortcut listener — sees it.
  const recordingRef = useRef<KeyActionId | null>(null);
  recordingRef.current = recording;
  useEffect(() => {
    if (!recording) return;

    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      const action = recordingRef.current;
      if (!action) return;

      if (e.key === 'Escape') {
        setRecording(null);
        return;
      }
      const chord = chordFromEvent(e, isMac);
      if (!chord) return; // a modifier on its own — keep waiting

      setKeymap((prev) => ({ ...prev, [action]: [...(prev[action] ?? []), chord] }));
      setDirty(true);
      setRecording(null);
    }

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, isMac]);

  function applyPreset(id: PresetId) {
    setPreset(id);
    setKeymap(PRESETS[id].keymap);
    setDirty(true);
  }

  function removeBinding(action: KeyActionId, binding: string) {
    setKeymap((prev) => ({
      ...prev,
      [action]: (prev[action] ?? []).filter((b) => b !== binding),
    }));
    setDirty(true);
  }

  function resetAction(action: KeyActionId) {
    setKeymap((prev) => ({ ...prev, [action]: PRESETS[preset].keymap[action] ?? [] }));
    setDirty(true);
  }

  function save() {
    start(async () => {
      const res = await updateKeymap({
        preset,
        overrides: diffFromPreset(preset, keymap) as Record<string, string[]>,
        enterSends,
      });
      if (res.ok) {
        setDirty(false);
        toast.success('Shortcuts saved');
      } else {
        toast.error(res.error);
      }
    });
  }

  const q = query.trim().toLowerCase();
  const visible = KEY_ACTIONS.filter(
    (a) =>
      !q ||
      a.label.toLowerCase().includes(q) ||
      (keymap[a.id] ?? []).some((b) => b.toLowerCase().includes(q)),
  );
  const groups = visible.reduce<Record<string, typeof KEY_ACTIONS>>((acc, a) => {
    acc[a.group] = [...(acc[a.group] ?? []), a];
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Preset</h3>
          <p className="text-[13px] text-muted-foreground">
            A starting point modelled on the app you already have in muscle memory. Every key stays
            editable afterwards.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors hover:bg-accent/60',
                preset === id && 'border-foreground bg-accent/40',
              )}
            >
              <span className="flex items-center justify-between text-[13px] font-medium">
                {PRESETS[id].label}
                {preset === id && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="mt-1 block text-[11.5px] leading-snug text-muted-foreground">
                {PRESETS[id].description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex items-start justify-between gap-4 rounded-xl border p-3">
        <div>
          <p className="text-[13px] font-medium">Enter sends the message</p>
          <p className="text-[12px] text-muted-foreground">
            {enterSends
              ? 'Shift + Enter inserts a new line.'
              : 'Enter inserts a new line; ⌘ + Enter sends.'}
          </p>
        </div>
        <Switch
          checked={enterSends}
          onCheckedChange={(v) => {
            setEnterSends(v);
            setDirty(true);
          }}
        />
      </section>

      {conflicts.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-[12.5px]">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <div>
            <p className="font-medium">
              {conflicts.length === 1 ? 'One shortcut conflicts' : `${conflicts.length} shortcuts conflict`}
            </p>
            <p className="text-muted-foreground">
              Two actions share a key, or one key is the start of another sequence. Only the first
              will fire.
            </p>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search actions…"
          className="h-9"
        />

        <div className="space-y-5">
          {(Object.keys(groups) as KeyActionGroup[]).map((group) => (
            <div key={group}>
              <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group}
              </p>
              <div className="divide-y rounded-xl border">
                {groups[group]!.map((action) => {
                  const bindings = keymap[action.id] ?? [];
                  const isRecording = recording === action.id;
                  const conflicted = conflictedActions.has(action.id);
                  return (
                    <div
                      key={action.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            'text-[13px]',
                            conflicted && 'text-amber-700 dark:text-amber-500',
                          )}
                        >
                          {action.label}
                        </p>
                        {action.hint && (
                          <p className="text-[11.5px] text-muted-foreground">{action.hint}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {bindings.map((binding) => (
                          <span
                            key={binding}
                            className="group flex items-center gap-1 rounded-lg border bg-secondary/60 py-0.5 pl-1.5 pr-0.5"
                          >
                            <BindingKeys binding={binding} isMac={isMac} />
                            <button
                              type="button"
                              aria-label={`Remove ${binding}`}
                              onClick={() => removeBinding(action.id, binding)}
                              className="grid h-5 w-5 place-items-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}

                        {bindings.length === 0 && !isRecording && (
                          <span className="text-[11.5px] text-muted-foreground/60">Not set</span>
                        )}

                        {isRecording ? (
                          <span className="animate-pulse rounded-lg border border-foreground px-2 py-1 text-[11.5px]">
                            Press keys… <span className="text-muted-foreground">Esc to cancel</span>
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[12px]"
                            onClick={() => setRecording(action.id)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Reset ${action.label}`}
                          className="h-7 w-7 p-0 text-muted-foreground"
                          onClick={() => resetAction(action.id)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save shortcuts'}
        </Button>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setKeymap(resolveKeymap(preference));
              setEnterSends(resolveEnterSends(preference));
              setPreset((preference?.preset as PresetId) ?? DEFAULT_PRESET);
              setDirty(false);
            }}
            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Discard changes
          </button>
        )}
      </div>
    </div>
  );
}

export const KEYBOARD_FORM_DEFAULTS = { DEFAULT_PRESET, DEFAULT_ENTER_SENDS };
