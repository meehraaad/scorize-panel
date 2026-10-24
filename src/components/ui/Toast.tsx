import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast, useToasts, type ToastData, type ToastKind } from '@/lib/toast';
import { Icon, type IconName } from './Icon';

const RING = 2 * Math.PI * 19;

const TILE: Record<ToastKind, { icon: IconName; className: string }> = {
  uploading: { icon: 'upload', className: 'text-on-hero' },
  paused: { icon: 'pause', className: 'text-on-hero-2' },
  success: { icon: 'check', className: 'bg-live/20 text-live' },
  error: { icon: 'alert', className: 'bg-hero-danger/20 text-hero-danger' },
  warn: { icon: 'fileX', className: 'bg-hero-current/20 text-hero-current' },
  info: { icon: 'info', className: 'bg-hero-raised text-on-hero' },
};

/**
 * One toast (canvas "Scorize Seller Panel" › اعلان بارگذاری): ink card in both themes, a ring
 * around the icon while a file uploads, at most one action. Screen readers hear it when it appears
 * and when its title changes (an upload finishing or failing), never every percent: errors and
 * warnings interrupt, the rest wait.
 */
export function Toast({ item, onClose }: { item: ToastData; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [expanded, setExpanded] = useState(true);
  const tile = TILE[item.kind];
  const ring = item.kind === 'uploading' || item.kind === 'paused';
  const progress = Math.max(0, Math.min(1, item.progress ?? 0));
  const files = item.files ?? [];
  const urgent = item.kind === 'error' || item.kind === 'warn';

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      onMouseEnter={() => toast.hold(item.id)}
      onMouseLeave={() => toast.release(item.id)}
      onFocus={() => toast.hold(item.id)}
      onBlur={() => toast.release(item.id)}
      className="pointer-events-auto flex w-full animate-toast-in flex-col gap-2.5 rounded-card-sm bg-toast py-3 ps-3.5 pe-2 text-on-hero shadow-toast"
    >
      <div className="flex items-center gap-3">
        <span
          className={`relative flex size-11 flex-none items-center justify-center rounded-full ${tile.className}`}
        >
          {ring && (
            <svg
              width="44"
              height="44"
              viewBox="0 0 44 44"
              aria-hidden="true"
              className="absolute inset-0"
            >
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="none"
                strokeWidth="3"
                className="stroke-hero-line"
              />
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - progress)}
                transform="rotate(-90 22 22)"
                className={`transition-[stroke-dashoffset] duration-200 ease-linear ${item.kind === 'paused' ? 'stroke-on-hero-3' : 'stroke-hero-accent'}`}
              />
            </svg>
          )}
          <Icon name={tile.icon} size={ring ? 18 : 20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="m-0 truncate text-[15px] leading-6 font-semibold [unicode-bidi:plaintext]">
            {item.title}
          </p>
          {item.meta && (
            <p
              aria-hidden={item.kind === 'uploading'}
              className="m-0 text-[13px] leading-6 text-on-hero-2"
            >
              {item.meta}
            </p>
          )}
        </div>
        {files.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={t(expanded ? 'toast.hideFiles' : 'toast.showFiles')}
            onClick={() => setExpanded(!expanded)}
            className="inline-flex size-11 flex-none items-center justify-center rounded-full text-on-hero-2 hover:bg-hero-raised hover:text-on-hero focus-visible:outline-on-hero"
          >
            <Icon name="chevronDown" size={18} className={expanded ? 'rotate-180' : ''} />
          </button>
        )}
        <button
          type="button"
          aria-label={item.closeLabel ?? t('toast.close')}
          onClick={onClose}
          className="inline-flex size-11 flex-none items-center justify-center rounded-full text-on-hero-2 hover:bg-hero-raised hover:text-on-hero focus-visible:outline-on-hero"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {files.length > 0 && expanded && (
        <ul className="m-0 me-1.5 list-none rounded-icon bg-hero-raised px-3 py-0.5">
          {files.map((file, index) => (
            <li
              // Files keep their order for the toast's life.
              key={`${String(index)}-${file.name}`}
              className="flex min-h-10 items-center gap-2.5 text-[13px] [&+&]:shadow-[inset_0_1px_0_var(--hero-line)]"
            >
              <Icon name="document" size={16} className="flex-none text-on-hero-3" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              {file.state === 'done' && (
                <span className="inline-flex items-center gap-1 font-semibold text-live">
                  <Icon name="check" size={14} />
                  {t('toast.fileDone')}
                </span>
              )}
              {file.state === 'up' && (
                <span
                  aria-hidden="true"
                  className="inline-flex items-center gap-2 font-semibold text-hero-accent"
                >
                  <span className="inline-block h-1 w-14 overflow-hidden rounded-full bg-hero-line">
                    <span
                      className="block h-full rounded-full bg-hero-accent"
                      style={{ width: `${String(Math.round((file.progress ?? 0) * 100))}%` }}
                    />
                  </span>
                  {t('toast.percent', { value: f.number(Math.round((file.progress ?? 0) * 100)) })}
                </span>
              )}
              {file.state === 'wait' && (
                <span className="text-on-hero-2">{t('toast.fileWaiting')}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {item.action && (
        <div className="flex flex-wrap gap-2 ps-14">
          <button
            type="button"
            onClick={item.action.run}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-hero-raised px-[18px] text-sm font-semibold text-on-hero hover:bg-hero-line focus-visible:outline-on-hero"
          >
            {item.kind === 'error' && <Icon name="retry" size={16} />}
            {item.action.label}
          </button>
        </div>
      )}
    </div>
  );
}

/** The open modal <dialog>, if any: everything outside it is inert, so toasts must render inside. */
function topModal() {
  const open = [...document.querySelectorAll('dialog[open]')];
  return (
    open
      .filter((dialog) => {
        try {
          return dialog.matches(':modal');
        } catch {
          return true;
        }
      })
      .at(-1) ?? null
  );
}

function useModalHost() {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    const check = () => setHost(topModal());
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);
  return host;
}

/**
 * Mount once (App): shows the toasts at the bottom, end side from lg up and full width above the
 * tab bar on phones. While a modal dialog is open it moves inside it, above the dialog's buttons.
 */
export function Toaster() {
  const { t } = useTranslation();
  const toasts = useToasts();
  const host = useModalHost();

  const close = (item: ToastData) => {
    item.onClose?.();
    toast.dismiss(item.id);
  };

  const bottom = host
    ? 'bottom-[calc(96px+env(safe-area-inset-bottom))] lg:bottom-28'
    : 'bottom-[calc(76px+env(safe-area-inset-bottom))] lg:bottom-6';

  const view = (
    <section
      aria-label={t('toast.region')}
      className={`pointer-events-none fixed inset-x-3 z-50 flex flex-col gap-2.5 lg:start-auto lg:end-6 lg:w-[420px] ${bottom}`}
    >
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onClose={() => close(item)} />
      ))}
    </section>
  );

  return host ? createPortal(view, host) : view;
}
