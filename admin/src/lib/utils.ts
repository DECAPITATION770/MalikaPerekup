import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

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
            'subhead',
            'title-sm',
            'title',
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
