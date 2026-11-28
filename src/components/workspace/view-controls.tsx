"use client";
import type { SelectHTMLAttributes, ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, X } from "lucide-react";
import styles from "./view-controls.module.css";

/** Keeps native keyboard/typeahead behavior while sharing one visual treatment. */
export function StudioSelect({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={styles.select}>
      <select {...props}>{children}</select>
      <ChevronDown size={14} aria-hidden="true" />
    </span>
  );
}
export function ToolPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.trigger}>
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
          sideOffset={8}
          collisionPadding={16}
          align="start"
        >
          <div className={styles.heading}>
            <strong>{label}</strong>
            <Popover.Close aria-label={`Close ${label}`}>
              <X size={16} />
            </Popover.Close>
          </div>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
