import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-white text-black',
        secondary: 'border-transparent bg-gray-800 text-white',
        destructive: 'border-transparent bg-red-600 text-white',
        outline: 'text-white border-white/20',
        success: 'border-transparent bg-green-600 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
