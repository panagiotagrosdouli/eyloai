import { toast as sonnerToast } from 'sonner';

/**
 * @param {{title?: any, description?: any, variant?: string, [key: string]: any}} [toastOptions]
 */
function notify({ title, description, variant, ...options } = {}) {
  const message = title || description || '';
  const detail = title && description ? { description, ...options } : options;

  if (variant === 'destructive') {
    return sonnerToast.error(message, detail);
  }

  return sonnerToast(message, detail);
}

/** @param {{title?: any, description?: any, variant?: string, [key: string]: any}} options */
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
