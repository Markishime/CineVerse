"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "framer-motion";
import type { ReactNode } from "react";
import {
  fadeUp,
  inViewOnce,
  scaleIn,
  staggerContainer,
  staggerItem,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

type RevealProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: ReactNode;
  delay?: number;
  variant?: "fadeUp" | "fadeIn" | "scaleIn";
  /** Animate when scrolled into view (default true) */
  inView?: boolean;
};

const variantsMap = {
  fadeUp,
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } },
  },
  scaleIn,
};

/** Scroll/mount reveal wrapper used across catalog, home, detail, etc. */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "fadeUp",
  inView = true,
  ...rest
}: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  const v = variantsMap[variant];

  return (
    <motion.div
      className={className}
      variants={v}
      initial="hidden"
      {...(inView
        ? { whileInView: "visible", viewport: inViewOnce }
        : { animate: "visible" })}
      transition={{ delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Parent for staggered children (use with RevealItem) */
export function RevealStagger({
  children,
  className,
  inView = true,
}: {
  children: React.ReactNode;
  className?: string;
  inView?: boolean;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      {...(inView
        ? { whileInView: "visible", viewport: inViewOnce }
        : { animate: "visible" })}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div className={cn(className)} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
