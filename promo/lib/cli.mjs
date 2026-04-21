import { parseArgs } from 'node:util';

function normalizeList(values) {
  return (values || [])
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parsePromoArgs(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      profile: {
        type: 'string',
        short: 'p'
      },
      scene: {
        type: 'string',
        multiple: true
      },
      cut: {
        type: 'string',
        multiple: true
      },
      list: {
        type: 'boolean'
      },
      verbose: {
        type: 'boolean',
        short: 'v'
      }
    },
    allowPositionals: false
  });

  return {
    profileName: values.profile || 'draft',
    sceneIds: normalizeList(values.scene),
    cutIds: normalizeList(values.cut),
    list: !!values.list,
    verbose: !!values.verbose
  };
}
