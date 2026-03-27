import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-shadow disabled:pointer-events-none disabled:opacity-64 sm:text-sm [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 px-3 sm:h-8",
        lg: "h-10 px-3.5 sm:h-9",
        sm: "h-8 gap-1.5 px-2.5 sm:h-7",
        icon: "size-9 sm:size-8",
      },
      variant: {
        default:
          "border-zinc-900 bg-zinc-900 text-white shadow-sm hover:bg-zinc-800",
        destructive:
          "border-red-600 bg-red-600 text-white shadow-sm hover:bg-red-500",
        outline:
          "border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50",
        secondary:
          "border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
        ghost:
          "border-transparent text-zinc-900 hover:bg-zinc-100",
        link: "border-transparent underline-offset-4 hover:underline",
      },
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
