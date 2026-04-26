import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export function Button({ variant = "secondary", size = "md", icon, iconRight, children, className = "", ...rest }: Props) {
  const sizeClass = size === "sm" ? "btn-sm" : "";
  return (
    <button className={`${variantClass[variant]} ${sizeClass} ${className}`} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
