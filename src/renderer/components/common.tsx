import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Check, X } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';
import clsx from 'clsx';

export function IconButton({
  label,
  children,
  className,
  onClick,
  disabled
}: PropsWithChildren<{ label: string; className?: string; onClick?: () => void; disabled?: boolean }>) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" className={clsx('icon-button', className)} aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Content className="tooltip" sideOffset={7}>{label}<Tooltip.Arrow className="tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'medium'
}: PropsWithChildren<{
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  footer?: ReactNode;
  size?: 'small' | 'medium' | 'large' | 'wide';
}>) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={clsx('dialog-content', `dialog-${size}`)}>
          <header className="dialog-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description>{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild><button className="icon-button" aria-label="关闭"><X size={18} /></button></Dialog.Close>
          </header>
          <div className="dialog-body">{children}</div>
          {footer && <footer className="dialog-footer">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function StatusPill({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'blue' | 'amber' | 'red' | 'green' | 'purple' }>) {
  return <span className={clsx('status-pill', `status-${tone}`)}>{children}</span>;
}

export function EmptyState({ icon, title, detail }: { icon?: ReactNode; title: string; detail: string }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <Check size={22} />}</div><h3>{title}</h3><p>{detail}</p></div>;
}

export function Field({ label, hint, children }: PropsWithChildren<{ label: string; hint?: string }>) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string | null): string {
  if (!value) return '从未';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
