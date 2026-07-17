import { toast as sonnerToast } from 'sonner';

function notify({ title, description, variant, ...options } = {}) {
  const message = title || description || '';
  const detail = title && description ? { description, ...options } : options;

  if (variant === 'destructive') {
    return sonnerToast.error(message, detail);
  }

  return sonnerToast(message, detail);
}

export function toast(options) {
  return notify(options);
}

export function useToast() {
  return {
    toast: notify,
    dismiss: sonnerToast.dismiss,
    toasts: [],
  };
}

export default useToast;
