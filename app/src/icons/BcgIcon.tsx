import type { ComponentType, SVGProps } from "react";
import * as Icons from "./bcg";

/**
 * BcgIcon — uniform sizing + className wrapper around the BCG icon set.
 *
 * Two ways to use BCG icons in surface code:
 *
 *   1. Direct named import (preferred for most call sites):
 *        import { LightBulb } from "@app/icons/bcg";
 *        <LightBulb width={20} height={20} className="text-brand-700" />
 *
 *   2. Picked-by-name via this wrapper (for code that branches on a
 *      string name, e.g. a registry of block types):
 *        <BcgIcon name="LightBulb" size={20} className="text-brand-700" />
 *
 * The wrapper inherits currentColor on every BCG SVG, so Tailwind text
 * classes work out of the box.
 *
 * Hybrid policy with lucide-react: BCG icons for content-domain
 * illustrations (case study slot, block library tiles, dashboard
 * entry cards, learning-outcome categories). lucide-react stays for
 * UI affordances (Plus / X / Edit / ChevronRight / Settings / etc.).
 */
export type BcgIconName = keyof typeof Icons;

interface BcgIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: BcgIconName;
  size?: number | string;
}

export function BcgIcon({ name, size = 20, ...rest }: BcgIconProps) {
  const Icon = Icons[name] as ComponentType<SVGProps<SVGSVGElement>>;
  return <Icon width={size} height={size} {...rest} />;
}
