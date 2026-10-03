import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../src/auth/auth.decorators';
import { REQUIRED_PERMISSIONS_KEY } from '../src/authorization/require-permission.decorator';
import { API_PREFIX } from '../src/bootstrap';

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Full path with the global prefix, e.g. /api/v1/documents/:id */
  path: string;
  isPublic: boolean;
  /** Capabilities required by @RequirePermission (handler overrides class). */
  permissions: string[];
}

const METHODS: Partial<Record<RequestMethod, Route['method']>> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

const join = (...parts: string[]) =>
  `/${parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/')}`;

/**
 * Every HTTP route the running application exposes, read from the same decorator metadata the
 * global guard uses. Security tests iterate over this list, so a newly added endpoint is covered
 * by them automatically — nobody has to remember to add it.
 */
export function listRoutes(app: INestApplication): Route[] {
  const scanner = new MetadataScanner();
  const routes: Route[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const instance = wrapper.instance as object | undefined;
      const type = wrapper.metatype as (abstract new (...args: never[]) => unknown) | null;
      if (!instance || !type) continue;
      const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
      const basePaths = [Reflect.getMetadata(PATH_METADATA, type) as string | string[] | undefined].flat();
      for (const name of scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name] as object;
        const method = METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
        const handlerPaths = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
        if (!method || handlerPaths === undefined) continue;
        const read = <T>(key: string) =>
          (Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, type)) as T | undefined;
        for (const base of basePaths) {
          for (const sub of [handlerPaths].flat()) {
            routes.push({
              method,
              path: join(API_PREFIX, base ?? '', sub),
              isPublic: read<boolean>(IS_PUBLIC_KEY) === true,
              permissions: read<string[]>(REQUIRED_PERMISSIONS_KEY) ?? [],
            });
          }
        }
      }
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export const routeName = (route: Pick<Route, 'method' | 'path'>) => `${route.method} ${route.path}`;
