import { OverlayLiveClient } from "./overlay-client-live.mjs";

const DEFAULT_OUTPUT_SUBDIR = "output";
const DEFAULT_WAIT_UNTIL = "domcontentloaded";

async function createSandboxRequire(packageJsonPath) {
  const { createRequire } = await import("node:module");
  return createRequire(packageJsonPath);
}

async function ensureDirectory(pathLike) {
  const fs = await import("node:fs/promises");
  await fs.mkdir(pathLike, { recursive: true });
}

async function resolveSandboxPaths(baseImportUrl, outputDirOverride) {
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");

  const modulePath = fileURLToPath(baseImportUrl);
  const sandboxRoot = dirname(modulePath);
  const packageJsonPath = resolve(sandboxRoot, "package.json");
  const outputDir = outputDirOverride || resolve(sandboxRoot, DEFAULT_OUTPUT_SUBDIR);

  return {
    sandboxRoot,
    packageJsonPath,
    outputDir
  };
}

export async function createOverlaySandboxSession(options = {}) {
  const globalName = options.globalName || "__a11yOverlayInstalled";
  const defaultTimeoutMs = Number.isFinite(options.defaultTimeoutMs) ? options.defaultTimeoutMs : 5000;
  const browserType = options.browserType || "chromium";
  const headless = options.headless ?? false;
  const defaultDesktopViewport = options.desktopViewport || { width: 1600, height: 900 };
  const defaultMobileViewport = options.mobileViewport || { width: 390, height: 844 };
  const defaultOutputDir = options.outputDir;

  const paths = await resolveSandboxPaths(import.meta.url, defaultOutputDir);
  await ensureDirectory(paths.outputDir);

  const sandboxRequire = await createSandboxRequire(paths.packageJsonPath);
  const playwright = sandboxRequire("playwright");
  const browserLauncher = playwright[browserType];
  if (!browserLauncher) {
    throw new Error(`Playwright browser type not available in sandbox: ${browserType}`);
  }
  const liveClient = new OverlayLiveClient({
    globalName,
    defaultTimeoutMs
  });

  const state = {
    browser: null,
    desktopContext: null,
    desktopPage: null,
    mobileContext: null,
    mobilePage: null
  };

  const resetHandles = () => {
    state.desktopContext = null;
    state.desktopPage = null;
    state.mobileContext = null;
    state.mobilePage = null;
  };

  const ensureBrowser = async (launchOptions = {}) => {
    if (state.browser && !state.browser.isConnected()) {
      state.browser = null;
      resetHandles();
    }
    if (!state.browser) {
      state.browser = await browserLauncher.launch({
        headless,
        ...launchOptions
      });
    }
    return state.browser;
  };

  const ensureDesktopPage = async ({
    url,
    viewport = defaultDesktopViewport,
    waitUntil = DEFAULT_WAIT_UNTIL,
    contextOptions = {},
    pageOptions = {}
  } = {}) => {
    if (state.desktopPage?.isClosed()) {
      state.desktopPage = null;
      state.desktopContext = null;
    }
    await ensureBrowser();
    if (!state.desktopContext) {
      state.desktopContext = await state.browser.newContext({
        viewport,
        ...contextOptions
      });
    }
    if (!state.desktopPage) {
      state.desktopPage = await state.desktopContext.newPage(pageOptions);
    }
    if (url) {
      await state.desktopPage.goto(url, { waitUntil });
    }
    return state.desktopPage;
  };

  const ensureMobilePage = async ({
    url,
    viewport = defaultMobileViewport,
    waitUntil = DEFAULT_WAIT_UNTIL,
    contextOptions = {},
    pageOptions = {}
  } = {}) => {
    if (state.mobilePage?.isClosed()) {
      state.mobilePage = null;
      state.mobileContext = null;
    }
    await ensureBrowser();
    if (!state.mobileContext) {
      state.mobileContext = await state.browser.newContext({
        viewport,
        isMobile: true,
        hasTouch: true,
        ...contextOptions
      });
    }
    if (!state.mobilePage) {
      state.mobilePage = await state.mobileContext.newPage(pageOptions);
    }
    if (url) {
      await state.mobilePage.goto(url, { waitUntil });
    }
    return state.mobilePage;
  };

  const ensureOverlay = async (target, {
    runtimeScriptPath,
    preset = "agent-capture",
    announce = false,
    timeoutMs = defaultTimeoutMs,
    force = false
    } = {}) => {
    if (!runtimeScriptPath) {
      throw new Error("ensureOverlay requires runtimeScriptPath.");
    }
    const contract = await liveClient.inject(target, {
      force,
      scriptPath: runtimeScriptPath,
      timeoutMs
    });
    if (preset) {
      await liveClient.applyPreset(target, preset, { announce });
    }
    return contract;
  };

  const buildReport = (...args) => liveClient.buildReport(...args);
  const buildJsonReport = (target, options = {}) => liveClient.buildReport(target, "json", options);
  const buildHtmlReport = (target, options = {}) => liveClient.buildReport(target, "html", options);
  const buildAuditBundle = (...args) => liveClient.buildAuditBundle(...args);
  const getContract = (...args) => liveClient.getContract(...args);
  const setLayerMode = (...args) => liveClient.setLayerMode(...args);
  const setAnnotationMode = (...args) => liveClient.setAnnotationMode(...args);
  const saveSession = (...args) => liveClient.saveSession(...args);
  const clearSavedSession = (...args) => liveClient.clearSavedSession(...args);
  const getSessionSnapshot = (...args) => liveClient.getSessionSnapshot(...args);
  const annotateNote = (...args) => liveClient.annotateNote(...args);
  const annotateArrow = (...args) => liveClient.annotateArrow(...args);
  const isInstalled = (...args) => liveClient.isInstalled(...args);
  const waitForRuntime = (...args) => liveClient.waitForRuntime(...args);

  const writeScreenshot = async (target, {
    path,
    type = "jpeg",
    quality = 85,
    fullPage = false
  } = {}) => {
    const { resolve } = await import("node:path");
    const screenshotPath = path || resolve(paths.outputDir, `overlay-shot-${Date.now()}.${type === "png" ? "png" : "jpg"}`);
    await ensureDirectory(paths.outputDir);
    await target.screenshot({
      path: screenshotPath,
      type,
      quality: type === "jpeg" ? quality : undefined,
      fullPage
    });
    return screenshotPath;
  };

  const close = async () => {
    if (state.browser) {
      await state.browser.close();
    }
    state.browser = null;
    resetHandles();
  };

  return {
    sandboxRoot: paths.sandboxRoot,
    outputDir: paths.outputDir,
    globalName,
    liveClient,
    state,
    ensureBrowser,
    ensureDesktopPage,
    ensureMobilePage,
    isInstalled,
    waitForRuntime,
    ensureOverlay,
    getContract,
    setLayerMode,
    setAnnotationMode,
    buildReport,
    buildJsonReport,
    buildHtmlReport,
    buildAuditBundle,
    annotateNote,
    annotateArrow,
    saveSession,
    clearSavedSession,
    getSessionSnapshot,
    writeScreenshot,
    close
  };
}
