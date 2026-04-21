import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleCuts } from './assemble.mjs';
import { captureScenes } from './capture.mjs';
import { parsePromoArgs } from './lib/cli.mjs';

function isDirectRun(importMetaUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(importMetaUrl);
}

export async function renderPromo({
  profileName = 'draft',
  sceneIds = [],
  cutIds = [],
  verbose = false
} = {}) {
  const captureResult = await captureScenes({
    profileName,
    sceneIds,
    cutIds,
    verbose
  });
  const cutManifests = await assembleCuts({
    profileName,
    cutIds,
    verbose
  });
  return {
    captureResult,
    cutManifests
  };
}

async function main() {
  const args = parsePromoArgs();
  const result = await renderPromo(args);
  console.log(
    `Rendered ${result.captureResult.scenes.length} scene(s) and ${result.cutManifests.length} cut(s) for profile "${args.profileName}".`
  );
}

if (isDirectRun(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
