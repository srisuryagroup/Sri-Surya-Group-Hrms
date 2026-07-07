import { Link } from "@tanstack/react-router";
import { Sun } from "lucide-react";

export function Logo({ size = "md", showText = true }: { size?: "sm" | "md" | "lg"; showText?: boolean }) {
  const dim = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <Link to="/dashboard" className="inline-flex items-center gap-2.5">
      <span
        className={`${dim} inline-flex items-center justify-center rounded-xl bg-gradient-surya text-primary-foreground surya-glow`}
      >
        <Sun className="h-1/2 w-1/2" strokeWidth={2.5} />
      </span>
      {showText && (
        <span className="flex flex-col leading-tight">
          <span className={`${text} font-bold tracking-tight text-foreground`}>Sri Surya</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Group HRMS
          </span>
        </span>
      )}
    </Link>
  );
}
