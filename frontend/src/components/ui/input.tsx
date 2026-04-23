import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  label?: React.ReactNode;
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

const renderLabelContent = (label: React.ReactNode) => {
  if (typeof label !== "string") return label;

  const match = label.trim().match(/^(.*?)(\s*\*)$/);
  if (!match) return label;

  return (
    <>
      {match[1]}
      <span className="ml-1 text-red-500">*</span>
    </>
  );
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
            "peer flex h-12 w-full rounded-[6px] border border-input bg-background px-3 pb-2 pt-5 text-base text-foreground transition-[border-color,box-shadow] duration-200 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm",
            className,
          )}
          ref={ref}
          placeholder={placeholder}
          {...props}
        />
        {staticLabel ? (
          <span
            className="pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 bg-background px-1 text-[11px] font-medium leading-none text-foreground"
          >
            {renderLabelContent(staticLabel)}
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
