import {createCommand} from './common';

export const dev = createCommand(
  {
    '--source-maps': Boolean,
    '--skip': [String],
    '--skip-pre': [String],
    '--skip-post': [String],
  },
  async (
    {
      '--source-maps': sourceMaps,
      '--skip': skip,
      '--skip-pre': skipPre,
      '--skip-post': skipPost,
    },
    context,
  ) => {
    const {runDev} = await import('@sewing-kit/core');
    await runDev(context, {sourceMaps, skip, skipPre, skipPost});
  },
);
