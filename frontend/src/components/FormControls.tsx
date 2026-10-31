import type { ComponentProps } from "react";
import { Input, Select, Textarea } from "@fluentui/react-components";

type UnderlineInputProps = Omit<ComponentProps<typeof Input>, "appearance">;
type UnderlineSelectProps = Omit<ComponentProps<typeof Select>, "appearance">;
type UnderlineTextareaProps = Omit<ComponentProps<typeof Textarea>, "appearance">;

function mergeClassName(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export function UnderlineInput({ className, ...props }: UnderlineInputProps) {
  return <Input appearance="underline" className={mergeClassName("form-control", className)} {...props} />;
}

export function UnderlineSelect({ className, ...props }: UnderlineSelectProps) {
  return <Select appearance="underline" className={mergeClassName("form-control", className)} {...props} />;
}

export function UnderlineTextarea({ className, ...props }: UnderlineTextareaProps) {
  return <Textarea className={mergeClassName("form-control form-textarea", className)} {...props} />;
}
