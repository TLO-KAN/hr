import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  label?: string;
  containerClassName?: string;
};

const NON_FLOATING_TYPES = new Set([
  "hidden",
  "file",
  "checkbox",
  "radio",
  "range",
  "color",
  "button",
  "submit",
  "reset",
  "image",
]);

const toLabel = (value?: string) => {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const OutlinedFloatingInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, label, type = "text", placeholder, name, id, ...props }, ref) => {
    if (type === "hidden") {
      return <input type={type} className={className} ref={ref} name={name} id={id} placeholder={placeholder} {...props} />;
    }

    const supportsStaticLabel = !NON_FLOATING_TYPES.has(type);
    const resolvedLabel =
      label ||
      (typeof placeholder === "string" && placeholder.trim().length > 0 ? placeholder : toLabel(name || id));
    const staticLabel = supportsStaticLabel ? resolvedLabel : "";

    return (
      <div className={cn("relative w-full", containerClassName)}>
        <input
          type={type}
          id={id}
          name={name}
          className={cn(
            "peer flex h-12 w-full rounded-[6px] border border-[#d1d5dc] bg-background px-3 pb-2 pt-5 text-base text-[#000000] transition-[border-color,box-shadow] duration-200 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#000000] placeholder:text-muted-foreground focus-visible:border-[#000000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm",
            className,
          )}
          ref={ref}
          placeholder={placeholder}
          {...props}
        />
        {staticLabel ? (
          <span
            className="pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 bg-background px-1 text-[11px] font-medium leading-none text-[#000000]"
          >
            {staticLabel}
          </span>
        ) : null}
      </div>
    );
  },
);
OutlinedFloatingInput.displayName = "OutlinedFloatingInput";

const Input = OutlinedFloatingInput;
Input.displayName = "Input";

export { Input, OutlinedFloatingInput };
