import {
  lazy,
  createProjectPlugin,
  createWorkspacePlugin,
} from '@sewing-kit/plugins';

import {PLUGIN} from './common';

export const typeScriptProjectPlugin = createProjectPlugin({
  id: PLUGIN,
  run({test, build, dev}) {
    test.tapPromise(
      PLUGIN,
      lazy(async () => (await import('./test')).testTypeScript),
    );

    build.tapPromise(
      PLUGIN,
      lazy(async () => (await import('./build')).buildTypeScript),
    );

    dev.tapPromise(
      PLUGIN,
      lazy(async () => (await import('./dev')).devTypeScript),
    );
  },
});

export const typeScriptWorkspacePlugin = createWorkspacePlugin({
  id: PLUGIN,
  run({typeCheck, lint, build}) {
    lint.tapPromise(
      PLUGIN,
      lazy(async () => (await import('./lint')).lintTypeScript),
    );

    build.tapPromise(
      PLUGIN,
      lazy(
        async () =>
          (await import('./type-check')).buildWorkspaceThroughTypeCheck,
      ),
    );

    typeCheck.tapPromise(
      PLUGIN,
      lazy(async () => (await import('./type-check')).typeCheckTypeScript),
    );
  },
});
