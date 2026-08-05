'use client';

import { motion, AnimatePresence, type Transition, type Variants } from 'framer-motion';

/*
 * The app's motion vocabulary. framer-motion was already a dependency but had
 * zero imports; everything animated via one-off CSS keyframes. Centralising the
 * curves here keeps timing consistent — the main thing that separates motion
 * that feels designed from motion that feels random.
 *
 * Rules of thumb used throughout:
 *   - Enter with a small upward drift; never scale from 0.
 *   - Exits are ~40% faster than entrances; leaving should not cost the user time.
 *   - Springs for anything spatial, eased tweens for anything about opacity.
 */

/** Spatial motion — panels, bubbles, popovers. Overshoots very slightly. */
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 };

/** Softer spring for larger surfaces where overshoot would look bouncy. */
export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 30 };

/** Non-spatial changes: opacity, colour, cross-fades. */
export const ease: Transition = { duration: 0.22, ease: [0.32, 0.72, 0, 1] };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring },
  exit: { opacity: 0, y: -4, transition: { duration: 0.14, ease: [0.32, 0.72, 0, 1] } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: ease },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 4 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12 } },
};

/**
 * Parent variant that cascades children in sequence. Keep the stagger small —
 * anything above ~40ms per item feels sluggish on a list of any length.
 */
export function staggerParent(stagger = 0.028, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

export { motion, AnimatePresence };
