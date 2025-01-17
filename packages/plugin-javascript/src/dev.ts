import {produce} from 'immer';
import {BabelConfig} from '@sewing-kit/plugin-babel';

import {PLUGIN} from './common';

// Just loaded for its hook augmentations
import {} from '@sewing-kit/plugin-webpack';

function addBaseBabelPreset(babelConfig: BabelConfig) {
  return produce(babelConfig, (babelConfig) => {
    babelConfig.presets = babelConfig.presets ?? [];
    babelConfig.presets.push(require.resolve('@sewing-kit/babel-preset'));
  });
}

function addJsExtensions(extensions: readonly string[]) {
  return ['.mjs', '.js', ...extensions];
}

export function devJavaScript({
  hooks,
}: import('@sewing-kit/tasks').DevProjectTask) {
  hooks.webApp.tap(PLUGIN, ({hooks}) => {
    hooks.configure.tap(PLUGIN, (configurationHooks) => {
      configurationHooks.webpackExtensions?.tap(PLUGIN, addJsExtensions);
      configurationHooks.babelConfig?.tap(PLUGIN, addBaseBabelPreset);

      configurationHooks.webpackRules?.tapPromise(PLUGIN, async (rules) => {
        const options = await configurationHooks.babelConfig?.promise({});

        return produce(rules, (rules) => {
          rules.push({
            test: /\.m?js/,
            exclude: /node_modules/,
            loader: 'babel-loader',
            options,
          });
        });
      });
    });
  });

  hooks.service.tap(PLUGIN, ({hooks}) => {
    hooks.configure.tap(PLUGIN, (configurationHooks) => {
      configurationHooks.webpackExtensions?.tap(PLUGIN, addJsExtensions);
      configurationHooks.babelConfig?.tap(PLUGIN, addBaseBabelPreset);

      configurationHooks.webpackRules?.tapPromise(PLUGIN, async (rules) => {
        const options = await configurationHooks.babelConfig?.promise({});

        return produce(rules, (rules) => {
          rules.push({
            test: /\.m?js/,
            exclude: /node_modules/,
            loader: 'babel-loader',
            options,
          });
        });
      });
    });
  });
}
