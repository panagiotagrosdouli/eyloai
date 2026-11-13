import * as Primitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export const Dialog = Primitive.Root;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;

export function DialogContent({ children, className = '' }) {
  return <Primitive.Portal>
    <Primitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <Primitive.Content className={`fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl sm:p-7 ${className}`}>
      {children}
      <Primitive.Close className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg border border-border bg-card" aria-label="Close editor"><X size={16} aria-hidden="true" /></Primitive.Close>
    </Primitive.Content>
  </Primitive.Portal>;
}
