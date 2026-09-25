import React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & React.RefAttributes<React.ElementRef<typeof LabelPrimitive.Root>>>} */
const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
