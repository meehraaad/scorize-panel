import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import i18n from '@/lib/i18n';
import type { Namespace } from '@/lib/i18n/config';

/**
 * A lazily loaded page: each page is its own chunk, so a phone only downloads the code for the
 * page it opens. The page's dictionary namespaces load in parallel with its code, not after it.
 */
export function lazyPage(
  load: () => Promise<{ default: ComponentType }>,
  namespaces: Namespace[] = [],
): Pick<RouteObject, 'lazy'> {
  return {
    lazy: async () => {
      const [module] = await Promise.all([load(), i18n.loadNamespaces(namespaces)]);
      return { Component: module.default };
    },
  };
}
