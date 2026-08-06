'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Check,
  ChevronRight,
  Laptop,
  Download,
  ShieldCheck,
  KeyRound,
  Globe,
  Link2,
  PartyPopper,
  ExternalLink,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyBlueBubbles, connectBlueBubbles } from '@/server/actions/connections';
import { cn } from '@/lib/utils';

/*
 * Guided BlueBubbles setup.
 *
 * Design rules, because the audience is explicitly non-technical:
 *  - ONE step visible at a time. A wall of instructions is what scares people off.
 *  - No jargon in the copy. "Web address", not "tunnel URL"; "let it read your
 *    messages", not "grant Full Disk Access".
 *  - Progress persists, because step 2 happens on a different machine and may
 *    take a while — they will close this tab.
 *  - The last step verifies live and explains failures in plain English.
 */

const STORAGE_KEY = 'comms-bb-setup-step';

interface Step {
  key: string;
  icon: React.ElementType;
  title: string;
  /** Rendered inside the open step. */
  body: React.ReactNode;
  /** Label for the continue button. */
  cta?: string;
}

export function BlueBubblesWizard({ hasExisting = false }: { hasExisting?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();

  // Connection form (final step)
  const [name, setName] = useState('iMessage');
  const [serverUrl, setServerUrl] = useState('');
  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState<{ privateApi: boolean; version?: string } | null>(null);
  const [problem, setProblem] = useState<{ message: string; hint: string } | null>(null);

  // Restore where they left off — step 2 happens on another machine.
  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY) ?? '0');
    if (Number.isFinite(saved) && saved > 0) setStep(saved);
  }, []);

  function goTo(n: number) {
    setStep(n);
    localStorage.setItem(STORAGE_KEY, String(n));
  }

  function check() {
    setProblem(null);
    setVerified(null);
    start(async () => {
      const res = await verifyBlueBubbles({ serverUrl, password });
      if (res.ok) {
        setVerified({ privateApi: res.privateApi, version: res.serverVersion });
      } else {
        setProblem({ message: res.message, hint: res.hint });
      }
    });
  }

  function finish() {
    start(async () => {
      const res = await connectBlueBubbles({ name, serverUrl, password });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
      toast.success('Connected! Your messages are on their way in.');
      goTo(STEPS.length - 1);
      router.refresh();
    });
  }

  const STEPS: Step[] = [
    {
      key: 'mac',
      icon: Laptop,
      title: 'Get a Mac ready',
      cta: "My Mac is ready",
      body: (
        <div className="space-y-3">
          <p>
            Comms talks to iMessage through a Mac you own. That Mac does the actual sending and
            receiving, so it needs to stay on.
          </p>
          <ul className="space-y-2">
            {[
              'Pick a Mac that can stay plugged in and awake — a Mac mini in a corner is ideal.',
              'Sign it into the Apple ID whose iMessage number your team will share (Messages app → Settings → iMessage).',
              'Stop it sleeping: System Settings → Lock Screen → set "Turn display off" to Never on power.',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <Callout>
            If the Mac sleeps or loses internet, messages stop arriving until it wakes up. Comms
            will alert you the moment that happens.
          </Callout>
        </div>
      ),
    },
    {
      key: 'install',
      icon: Download,
      title: 'Install BlueBubbles on that Mac',
      cta: "I've installed it",
      body: (
        <div className="space-y-3">
          <p>
            BlueBubbles is the free app that lets Comms talk to iMessage. Do this part{' '}
            <strong>on the Mac itself</strong>.
          </p>
          <ol className="space-y-2">
            {[
              <>
                Download the installer from{' '}
                <a
                  href="https://github.com/BlueBubblesApp/bluebubbles-server/releases/latest"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2"
                >
                  the BlueBubbles releases page
                  <ExternalLink className="h-3 w-3" />
                </a>{' '}
                — pick the file ending in <Code>.dmg</Code>.
              </>,
              <>
                Open the downloaded file, then drag the BlueBubbles icon into your Applications
                folder.
              </>,
              <>
                <strong>Right-click</strong> the app and choose <Code>Open</Code>. Double-clicking
                shows a scary &ldquo;unidentified developer&rdquo; warning — right-clicking gives
                you an Open button instead.
              </>,
            ].map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="tabular mt-px w-4 shrink-0 font-medium text-muted-foreground">
                  {i + 1}.
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      ),
    },
    {
      key: 'permissions',
      icon: ShieldCheck,
      title: 'Let it read your messages',
      cta: "I've given permission",
      body: (
        <div className="space-y-3">
          <p>
            BlueBubbles will walk you through a permissions screen when it first opens. Say yes to
            everything it asks for — it cannot see your messages otherwise.
          </p>
          <p>
            The important one is called <strong>Full Disk Access</strong>. BlueBubbles opens the
            right settings panel for you; you just flip the switch next to BlueBubbles and enter
            your Mac password.
          </p>
          <Callout>
            This sounds scarier than it is. It only lets BlueBubbles read the Messages database
            that&apos;s already on your Mac. Nothing leaves your Mac except through the connection
            you set up here.
          </Callout>
        </div>
      ),
    },
    {
      key: 'password',
      icon: KeyRound,
      title: 'Choose a password',
      cta: "I've set my password",
      body: (
        <div className="space-y-3">
          <p>
            In BlueBubbles, find the password box and set one. This is a{' '}
            <strong>brand-new password you invent</strong> — not your Apple ID password.
          </p>
          <p>Click the save icon next to it, then write it down. You&apos;ll paste it in a moment.</p>
          <Callout>
            Make it a long one. Anyone with this password and your web address could read and send
            your messages.
          </Callout>
        </div>
      ),
    },
    {
      key: 'address',
      icon: Globe,
      title: 'Turn on its web address',
      cta: "I've got the address",
      body: (
        <div className="space-y-3">
          <p>
            Your Mac needs an address on the internet so Comms can reach it. BlueBubbles creates one
            for you — you don&apos;t need to set anything up with your router.
          </p>
          <ol className="space-y-2">
            {[
              <>
                In BlueBubbles, find the connection settings and pick a service. <Code>Cloudflare</Code>{' '}
                is the default and works fine.
              </>,
              <>
                It will show you a web address starting with <Code>https://</Code>. Copy the whole
                thing.
              </>,
            ].map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="tabular mt-px w-4 shrink-0 font-medium text-muted-foreground">
                  {i + 1}.
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <Callout tone="warn">
            <strong>Worth knowing:</strong> with Cloudflare this address changes every time
            BlueBubbles restarts. When that happens, messages stop and Comms shows you a red
            banner — click &ldquo;Fix connection&rdquo; and paste the new address. Takes ten
            seconds. If you&apos;d rather it never change, ask us about ngrok or zrok with a fixed
            address.
          </Callout>
        </div>
      ),
    },
    {
      key: 'connect',
      icon: Link2,
      title: 'Connect it to Comms',
      body: (
        <div className="space-y-3.5">
          <p>Last step. Paste what BlueBubbles gave you.</p>

          {hasExisting && (
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Name this number</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Support line"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Web address from BlueBubbles</Label>
            <Input
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value);
                setVerified(null);
                setProblem(null);
              }}
              placeholder="https://something.trycloudflare.com"
              spellCheck={false}
              autoCapitalize="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">The password you chose</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setVerified(null);
                setProblem(null);
              }}
              placeholder="••••••••"
              spellCheck={false}
              autoCapitalize="off"
            />
          </div>

          {problem && (
            <div className="rounded-lg border border-destructive/25 bg-destructive-muted p-3">
              <p className="flex items-start gap-2 text-[13px] font-medium text-destructive">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                {problem.message}
              </p>
              <p className="mt-1.5 pl-[22px] text-[12.5px] leading-relaxed text-muted-foreground">
                {problem.hint}
              </p>
            </div>
          )}

          {verified && (
            <div className="rounded-lg border border-success/25 bg-success-muted p-3">
              <p className="flex items-center gap-2 text-[13px] font-medium text-success">
                <Check className="h-3.5 w-3.5 shrink-0" />
                Your Mac answered — everything looks right.
              </p>
              <p className="mt-1.5 pl-[22px] text-[12.5px] leading-relaxed text-muted-foreground">
                {verified.privateApi
                  ? 'Advanced features are available too: reactions, typing indicators, and edited messages.'
                  : 'Basic mode: sending and receiving will work. Reactions and typing indicators need the BlueBubbles Private API, which you can turn on later.'}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {!verified ? (
              <Button
                onClick={check}
                loading={pending}
                disabled={!serverUrl.trim() || !password.trim()}
              >
                Check connection
              </Button>
            ) : (
              <Button onClick={finish} loading={pending}>
                Finish setup
              </Button>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'done',
      icon: PartyPopper,
      title: "You're live",
      body: (
        <div className="space-y-3">
          <p>
            Comms is now connected to your iMessage number. Your recent conversations are being
            pulled in — they&apos;ll appear in the inbox within a minute or two.
          </p>
          <p className="font-medium">Two things worth knowing:</p>
          <ul className="space-y-2">
            {[
              'Leave that Mac on and awake. If it sleeps, messages stop until it wakes up — and we\'ll show you a red banner the moment we notice.',
              'Press ? anywhere in Comms to see the keyboard shortcuts. j and k move between conversations, e closes one.',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-1">
            <a href="/inbox">Go to my inbox</a>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-1.5">
      {STEPS.map((s, i) => {
        const done = i < step;
        const open = i === step;
        const Icon = s.icon;

        return (
          <div
            key={s.key}
            className={cn(
              'overflow-hidden rounded-xl border transition-colors',
              open ? 'border-border-strong bg-surface shadow-sm' : 'bg-surface-sunken',
            )}
          >
            <button
              type="button"
              onClick={() => (done || open ? goTo(i) : undefined)}
              disabled={!done && !open}
              className={cn(
                'flex w-full items-center gap-3 px-3.5 py-3 text-left',
                (done || open) && 'cursor-pointer',
              )}
            >
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold transition-colors',
                  done
                    ? 'bg-primary text-primary-foreground'
                    : open
                      ? 'border-2 border-foreground text-foreground'
                      : 'border text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  open ? 'text-foreground' : 'text-muted-foreground',
                )}
              />
              <span
                className={cn(
                  'flex-1 text-[13.5px]',
                  open ? 'font-semibold' : done ? 'text-muted-foreground' : 'text-muted-foreground',
                )}
              >
                {s.title}
              </span>
              {done && <span className="text-[11px] text-muted-foreground">Done</span>}
            </button>

            {open && (
              <div className="space-y-4 border-t px-3.5 py-4 pl-[54px] text-[13.5px] leading-relaxed">
                {s.body}
                {s.cta && (
                  <Button variant="outline" size="sm" onClick={() => goTo(i + 1)}>
                    {s.cta}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border bg-secondary px-1 py-px font-mono text-[12px]">{children}</code>
  );
}

function Callout({
  children,
  tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'warn';
}) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-lg border p-2.5 text-[12.5px] leading-relaxed',
        tone === 'warn'
          ? 'border-warning/30 bg-warning-muted'
          : 'border-border bg-surface-sunken text-muted-foreground',
      )}
    >
      <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
