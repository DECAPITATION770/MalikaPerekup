import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge configured with our custom font-size tokens.
 *
 * Without this, twMerge treats custom sizes like `text-body` / `text-label`
 * as belonging to the same `text-*` group as colour utilities
 * (`text-white`, `text-bg`, `text-[rgb(...)]`). When a cva variant put a
 * colour *before* the size (`...text-white ... text-body`), twMerge kept the
 * last one and silently dropped the colour — every Button rendered with the
 * inherited text colour instead of its variant colour. Registering the
 * custom sizes in the `font-size` group keeps colour and size independent.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'micro',
            'caption',
            'hint',
            'label',
            'body',
            'body-lg',
            'body-xl',
            'subhead',
            'title-sm',
            'title',
            'title-lg',
            'display',
          ],
        },
      ],
    },
  },
});

/** Combine Tailwind class strings, resolving conflicts via `tailwind-merge`. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
