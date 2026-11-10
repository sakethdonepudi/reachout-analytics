"use client";

import type { ReactNode } from "react";
import { Dialog } from "./dialog";

export function Sheet({ open, onClose, title, description, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      placement="bottom"
      className="sm:max-w-lg"
    >
      {children}
    </Dialog>
  );
}
