import {AsyncSeriesWaterfallHook, AsyncSeriesHook} from 'tapable';
import {
  BuildServiceHooks,
  BuildServiceConfigurationHooks,
  BuildWebAppHooks,
  BuildWebAppConfigurationHooks,
  BuildPackageHooks,
  BuildPackageConfigurationHooks,
} from '@sewing-kit/hooks';
import {
  BuildTaskOptions,
  BuildWorkspaceTaskHooks,
  BuildProjectTaskHooks,
} from '@sewing-kit/tasks';
import {run, createStep, Step, Loggable, LogLevel} from '@sewing-kit/ui';

import {
  TaskContext,
  createWorkspaceTasksAndApplyPlugins,
  createProjectTasksAndApplyPlugins,
} from './common';

type ArrayElement<T> = T extends (infer U)[] ? U : never;

export async function runBuild(
  {workspace, delegate, ui}: TaskContext,
  options: BuildTaskOptions,
) {
  const {build} = await createWorkspaceTasksAndApplyPlugins(
    workspace,
    delegate,
  );

  const buildTaskHooks: BuildWorkspaceTaskHooks = {
    configure: new AsyncSeriesHook(['hooks']),
    pre: new AsyncSeriesWaterfallHook(['steps', 'details']),
    post: new AsyncSeriesWaterfallHook(['steps', 'details']),
  };

  await build.promise({
    hooks: buildTaskHooks,
    options,
    workspace,
  });

  const webAppSteps = await Promise.all(
    workspace.webApps.map(async (webApp) => {
      const {build} = await createProjectTasksAndApplyPlugins(
        webApp,
        workspace,
        delegate,
      );

      const buildTaskHooks: BuildProjectTaskHooks = {
        project: new AsyncSeriesHook(['project', 'projectBuildHooks']),
        package: new AsyncSeriesHook(['pkg', 'packageBuildHooks']),
        webApp: new AsyncSeriesHook(['app', 'webAppBuildHooks']),
        service: new AsyncSeriesHook(['service', 'serviceBuildHooks']),
      };

      await build.promise({
        options,
        hooks: buildTaskHooks,
        workspace,
      });

      const hooks: BuildWebAppHooks = {
        variants: new AsyncSeriesWaterfallHook(['variants']),
        steps: new AsyncSeriesWaterfallHook(['steps', 'details', 'context']),
        context: new AsyncSeriesWaterfallHook(['context']),
        configure: new AsyncSeriesHook(['configuration', 'variant']),
      };

      await buildTaskHooks.project.promise({project: webApp, hooks});
      await buildTaskHooks.webApp.promise({webApp, hooks});

      const variants = await hooks.variants.promise([]);

      const stepsForVariant = async (
        variant: ArrayElement<typeof variants>,
      ) => {
        const configurationHooks: BuildWebAppConfigurationHooks = {};

        await hooks.configure.promise(configurationHooks, variant);

        const context = await hooks.context.promise({});

        return hooks.steps.promise(
          [],
          {
            variant,
            config: configurationHooks,
          },
          context,
        );
      };

      const steps =
        variants.length > 1
          ? await Promise.all(
              variants.map(async (variant) => {
                return createStepFromNestedSteps({
                  steps: await stepsForVariant(variant),
                  label: (fmt) =>
                    fmt`Build {emphasis ${stringifyVariant(
                      variant,
                    )}} web app variant`,
                });
              }),
            )
          : [
              createStepFromNestedSteps({
                steps: await stepsForVariant({}),
                label: (fmt) => fmt`Build web app`,
              }),
            ];

      return {webApp, steps};
    }),
  );

  const serviceSteps = await Promise.all(
    workspace.services.map(async (service) => {
      const {build} = await createProjectTasksAndApplyPlugins(
        service,
        workspace,
        delegate,
      );

      const buildTaskHooks: BuildProjectTaskHooks = {
        project: new AsyncSeriesHook(['project', 'projectBuildHooks']),
        package: new AsyncSeriesHook(['pkg', 'packageBuildHooks']),
        webApp: new AsyncSeriesHook(['app', 'webAppBuildHooks']),
        service: new AsyncSeriesHook(['service', 'serviceBuildHooks']),
      };

      await build.promise({
        options,
        hooks: buildTaskHooks,
        workspace,
      });

      const hooks: BuildServiceHooks = {
        steps: new AsyncSeriesWaterfallHook(['steps', 'details', 'context']),
        context: new AsyncSeriesWaterfallHook(['context']),
        configure: new AsyncSeriesHook(['configuration']),
      };

      await buildTaskHooks.project.promise({project: service, hooks});
      await buildTaskHooks.service.promise({service, hooks});

      const configurationHooks: BuildServiceConfigurationHooks = {};

      await hooks.configure.promise(configurationHooks);

      const context = await hooks.context.promise({});

      const steps = await hooks.steps.promise(
        [],
        {
          config: configurationHooks,
        },
        context,
      );

      return {service, steps};
    }),
  );

  const packageSteps = await Promise.all(
    workspace.packages.map(async (pkg) => {
      const {build} = await createProjectTasksAndApplyPlugins(
        pkg,
        workspace,
        delegate,
      );

      const buildTaskHooks: BuildProjectTaskHooks = {
        project: new AsyncSeriesHook(['project', 'projectBuildHooks']),
        package: new AsyncSeriesHook(['pkg', 'packageBuildHooks']),
        webApp: new AsyncSeriesHook(['app', 'webAppBuildHooks']),
        service: new AsyncSeriesHook(['service', 'serviceBuildHooks']),
      };

      await build.promise({
        options,
        hooks: buildTaskHooks,
        workspace,
      });

      const hooks: BuildPackageHooks = {
        variants: new AsyncSeriesWaterfallHook(['variants']),
        steps: new AsyncSeriesWaterfallHook(['steps', 'details', 'context']),
        context: new AsyncSeriesWaterfallHook(['context']),
        configure: new AsyncSeriesHook(['buildTarget', 'variant']),
      };

      await buildTaskHooks.project.promise({project: pkg, hooks});
      await buildTaskHooks.package.promise({pkg, hooks});

      const variants = await hooks.variants.promise([]);

      const steps = await Promise.all(
        variants.map(async (variant) => {
          const configurationHooks: BuildPackageConfigurationHooks = {};

          await hooks.configure.promise(configurationHooks, variant);

          const context = await hooks.context.promise({});

          const steps = await hooks.steps.promise(
            [],
            {
              variant,
              config: configurationHooks,
            },
            context,
          );

          return createStepFromNestedSteps({
            steps,
            label: (fmt) =>
              fmt`Build {emphasis ${stringifyVariant(
                variant,
              )}} package variant`,
          });
        }),
      );

      return {pkg, steps};
    }),
  );

  const configurationHooks = {};
  await buildTaskHooks.configure.promise(configurationHooks);

  const [pre, post] = await Promise.all([
    buildTaskHooks.pre.promise([], {configuration: configurationHooks}),
    buildTaskHooks.post.promise([], {configuration: configurationHooks}),
  ]);

  const {skip, skipPre, skipPost} = options;

  await run(ui, async (runner) => {
    runner.title('build');

    await runner.pre(pre, skipPre);

    runner.separator();

    for (const {webApp, steps} of webAppSteps) {
      await runner.steps(steps, {id: webApp.name, skip});
    }

    for (const {pkg, steps} of packageSteps) {
      await runner.steps(steps, {id: pkg.name, skip});
    }

    for (const {service, steps} of serviceSteps) {
      await runner.steps(steps, {id: service.name, skip});
    }

    await runner.post(post, skipPost);

    runner.epilogue((fmt) => fmt`{success build completed successfully!}`);
  });
}

function stringifyVariant(variant: object) {
  return Object.entries(variant)
    .map(([key, value]) => {
      return value === true ? key : `${key}: ${value}`;
    })
    .join(', ');
}

function createStepFromNestedSteps({
  steps,
  label,
}: {
  readonly steps: readonly Step[];
  readonly label: Loggable;
}) {
  return createStep({label}, async (stepRunner) => {
    await Promise.all(
      steps.map(async (step) => {
        if (step.label) {
          stepRunner.log(
            (fmt) => fmt`starting sub-step: {info ${step.label!}}`,
            {
              level: LogLevel.Debug,
            },
          );
        } else {
          stepRunner.log(`starting unlabeled sub-step`, {
            level: LogLevel.Debug,
          });
        }

        await step.run(stepRunner);
      }),
    );
  });
}
