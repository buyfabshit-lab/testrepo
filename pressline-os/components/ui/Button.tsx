import type { ButtonHTMLAttributes } from "react";

type Variant = "outline" | "solid" | "blood" | "ghost";
type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, string> = {
  sm: "!px-2.5 !py-1 !text-[.65rem]",
  md: "",
  lg: "!px-5 !py-3 !text-sm",
  xl: "!px-6 !py-5 !text-xl w-full justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant = "outline", size = "md", loading = false, className = "", children, disabled, ...rest }: ButtonProps) {
  const v = variant === "solid" ? "btn btn-solid" : variant === "blood" ? "btn btn-blood" : variant === "ghost" ? "btn !border-transparent" : "btn";
  return (
    <button className={`${v} ${SIZES[size]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}
