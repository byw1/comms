'use client';

import { FileText, Images, Link2, Paperclip } from 'lucide-react';
import { relativeTime } from '@/lib/format';

export interface GalleryData {
  photos: { id: string; fileName: string | null; at: string }[];
  files: {
    id: string;
    fileName: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    at: string;
  }[];
  links: { url: string; at: string; fromThem: boolean }[];
}

function fmtSize(bytes: number | null): string | null {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function SectionHead({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count: number }) {
  return (
    <p className="type-micro mb-2 flex items-center gap-1.5 text-muted-foreground/60">
      <Icon className="h-3 w-3" />
      {label}
      <span className="tabular normal-case tracking-normal">({count})</span>
    </p>
  );
}

/**
 * The whole thread's media in one place — every photo as a grid, every file
 * and link as a list. The way Messages and Spark do it: when someone says
 * "they texted me the invoice at some point", this tab is the answer.
 */
export function ThreadGallery({ data }: { data: GalleryData }) {
  const empty = data.photos.length === 0 && data.files.length === 0 && data.links.length === 0;

  if (empty) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-muted-foreground">
          <Images className="h-4.5 w-4.5" />
        </div>
        <p className="text-[13px] font-medium">Nothing shared yet</p>
        <p className="text-[11.5px] text-muted-foreground">
          Photos, files and links from this conversation will collect here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-4">
      {data.photos.length > 0 && (
        <section>
          <SectionHead icon={Images} label="Photos" count={data.photos.length} />
          <div className="grid grid-cols-3 gap-1">
            {data.photos.map((a) => (
              <a
                key={a.id}
                href={`/api/attachments/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-lg border"
                title={a.fileName ?? undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/attachments/${a.id}`}
                  alt={a.fileName ?? 'Shared photo'}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 ease-smooth group-hover:scale-105"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {data.files.length > 0 && (
        <section>
          <SectionHead icon={Paperclip} label="Files" count={data.files.length} />
          <div className="space-y-1">
            {data.files.map((f) => (
              <a
                key={f.id}
                href={`/api/attachments/${f.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors hover:bg-accent"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">
                    {f.fileName ?? 'Attachment'}
                  </span>
                  <span className="block text-[10.5px] text-muted-foreground">
                    {[fmtSize(f.sizeBytes), relativeTime(f.at)].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {data.links.length > 0 && (
        <section>
          <SectionHead icon={Link2} label="Links" count={data.links.length} />
          <div className="space-y-1">
            {data.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border px-2.5 py-2 transition-colors hover:bg-accent"
              >
                <span className="block truncate text-[12.5px] font-medium text-brand">
                  {hostOf(l.url)}
                </span>
                <span className="block truncate text-[10.5px] text-muted-foreground">{l.url}</span>
                <span className="block text-[10.5px] text-muted-foreground/70">
                  {l.fromThem ? 'from them' : 'from you'} · {relativeTime(l.at)}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
