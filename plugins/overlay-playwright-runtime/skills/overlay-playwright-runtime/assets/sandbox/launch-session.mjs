import { OverlayLiveClient } from "./overlay-client-live.mjs";
import { OverlayClient } from "./overlay-client.mjs";

const DEFAULT_OUTPUT_SUBDIR = "output";
const DEFAULT_WAIT_UNTIL = "domcontentloaded";

function slugify(value) {
  return String(value || "audit")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "audit";
}

function stampNow() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function createSandboxRequire(packageJsonPath) {
  const { createRequire } = await import("node:module");
  return createRequire(packageJsonPath);
}

async function ensureDirectory(pathLike) {
  const fs = await import("node:fs/promises");
  await fs.mkdir(pathLike, { recursive: true });
}

function matchesUrlPattern(pattern, href) {
  if (pattern instanceof RegExp) return pattern.test(href);
  if (typeof pattern === "function") return !!pattern(href);
  return href.includes(String(pattern));
}

function normalizeComparableUrl(value) {
  try {
    const parsed = new URL(String(value));
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${pathname}${parsed.search}`;
  } catch {
    return String(value || "").replace(/\/+$/, "");
  }
}

async function resolvePageLike(target) {
  if (target && typeof target.waitForURL === "function") return target;
  if (target && typeof target.page === "function") return target.page();
  return target;
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

/**
 * Create a managed Playwright sandbox session that injects and controls an accessibility overlay,
 * performs local or authenticated audits, captures visual evidence, and writes audit artifacts.
 *
 * @param {Object} [options] - Optional configuration for the sandbox session.
 * @param {string} [options.globalName="__a11yOverlayInstalled"] - Global variable name used by the injected overlay runtime.
 * @param {number} [options.defaultTimeoutMs=5000] - Default timeout (milliseconds) used for wait operations.
 * @param {string} [options.browserType="chromium"] - Playwright browser launcher name to use (`"chromium"`, `"firefox"`, or `"webkit"`).
 * @param {boolean} [options.headless=false] - Whether to launch the browser in headless mode.
 * @param {{width:number,height:number}} [options.desktopViewport] - Default desktop viewport size.
 * @param {{width:number,height:number}} [options.mobileViewport] - Default mobile viewport size.
 * @param {string} [options.outputDir] - Override output directory for written artifacts.
 * @param {Object} [options.agentUiConfig] - Configuration object used to bootstrap the injected overlay UI.
 *
 * @returns {Object} A session manager exposing sandbox metadata, overlay clients, current state, lifecycle methods,
 *                   page/context helpers, overlay injection helpers, report builders, artifact writers, capture utilities,
 *                   high-level audit entrypoints (auditLocalWeb, auditAuthenticatedWeb, auditDesktopShell), and close().
 */
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
  const fullClient = new OverlayClient({
    globalName,
    defaultTimeoutMs
  });
  const agentUiConfig = options.agentUiConfig || {
    uiMode: "agent",
    helpOpen: false,
    settingsOpen: false,
    mobileSheetOpen: false,
    mobileSheetTab: "layers",
    mobileSheetDetent: "medium"
  };

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

  const resetDesktopContext = async () => {
    if (state.desktopContext) {
      await state.desktopContext.close();
    }
    state.desktopContext = null;
    state.desktopPage = null;
  };

  const resetMobileContext = async () => {
    if (state.mobileContext) {
      await state.mobileContext.close();
    }
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

  const createSessionStorageInstaller = (snapshot = {}) => {
    if (!snapshot || Object.keys(snapshot).length === 0) return undefined;
    return (storageMap) => {
      const values = storageMap[window.location.origin];
      if (!values || typeof values !== "object") return;
      for (const [key, value] of Object.entries(values)) {
        window.sessionStorage.setItem(key, String(value));
      }
    };
  };

  const createAuthenticatedContext = async ({
    viewport,
    isMobile = false,
    hasTouch = false,
    storageState,
    sessionStorage,
    contextOptions = {}
  } = {}) => {
    await ensureBrowser();
    const context = await state.browser.newContext({
      viewport,
      ...(isMobile ? { isMobile: true, hasTouch: hasTouch !== false } : {}),
      ...(storageState ? { storageState } : {}),
      ...contextOptions
    });
    if (sessionStorage && Object.keys(sessionStorage).length) {
      await context.addInitScript(createSessionStorageInstaller(sessionStorage), sessionStorage);
    }
    return context;
  };

  const resolveActionTarget = (page, descriptor) => {
    if (!descriptor || typeof descriptor !== "object") {
      throw new Error("Expected an action descriptor object.");
    }
    if (descriptor.selector) return page.locator(descriptor.selector);
    if (descriptor.label) return page.getByLabel(descriptor.label, descriptor.options || {});
    if (descriptor.placeholder) return page.getByPlaceholder(descriptor.placeholder, descriptor.options || {});
    if (descriptor.text) return page.getByText(descriptor.text, descriptor.options || {});
    if (descriptor.role) {
      return page.getByRole(descriptor.role, {
        ...(descriptor.name ? { name: descriptor.name } : {}),
        ...(descriptor.options || {})
      });
    }
    throw new Error("Action descriptor must include selector, label, placeholder, text, or role.");
  };

  const captureSessionStorage = async (page, origins) => {
    const activeOrigin = await page.evaluate(() => window.location.origin);
    const wantedOrigins = Array.isArray(origins) && origins.length ? new Set(origins.map((value) => String(value))) : new Set([activeOrigin]);
    const values = await page.evaluate(() => {
      const entries = {};
      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);
        entries[key] = window.sessionStorage.getItem(key);
      }
      return {
        origin: window.location.origin,
        entries
      };
    });
    if (!wantedOrigins.has(values.origin)) {
      return {};
    }
    return {
      [values.origin]: values.entries
    };
  };

  const captureAuthenticatedState = async (page, auth = {}) => {
    const includeIndexedDB = auth.includeIndexedDB === true;
    const storageState = await page.context().storageState({
      ...(includeIndexedDB ? { indexedDB: true } : {})
    });
    const sessionStorage = auth.captureSessionStorage
      ? await captureSessionStorage(page, Array.isArray(auth.sessionStorageOrigins) ? auth.sessionStorageOrigins : undefined)
      : undefined;
    return {
      storageState,
      ...(sessionStorage ? { sessionStorage } : {})
    };
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
      bootstrapConfig: agentUiConfig,
      timeoutMs
    });
    if (preset) {
      await liveClient.applyPreset(target, preset, {
        announce,
        ui: agentUiConfig
      });
    } else {
      await liveClient.configureUi(target, agentUiConfig);
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
    const visualEvidence = await captureVisualEvidence(target, {
      path,
      type,
      quality,
      captureMode: fullPage ? "full-page" : "viewport"
    });
    return visualEvidence.primaryPath;
  };

  const captureVisualEvidence = async (target, {
    path,
    type = "jpeg",
    quality = 85,
    captureMode,
    fullPage = false,
    maxSlices,
    overlapPx,
    stepPx,
    scrollSettlingMs,
    startAt
  } = {}) => {
    const { dirname, resolve } = await import("node:path");
    const filePath = path || resolve(paths.outputDir, `overlay-shot-${Date.now()}.${type === "png" ? "png" : "jpg"}`);
    const resolvedCaptureMode = captureMode || (fullPage ? "full-page" : "viewport");
    await ensureDirectory(dirname(filePath));
    return fullClient.captureVisualEvidence(target, {
      filePath,
      screenshotType: type,
      captureMode: resolvedCaptureMode,
      fullPage,
      includeScreenshotBytes: false,
      maxSlices,
      overlapPx,
      stepPx,
      scrollSettlingMs,
      startAt,
      quality
    });
  };

  const waitForReady = async (target, readiness = {}) => {
    const strategy = readiness?.strategy || "none";
    const timeout = Number.isFinite(readiness?.timeoutMs) ? readiness.timeoutMs : defaultTimeoutMs;
    const pageLike = await resolvePageLike(target);

    if (strategy === "none") {
      return { strategy, ok: true };
    }

    if (strategy === "dom-marker") {
      if (!readiness.selector) {
        throw new Error("waitForReady(dom-marker) requires readiness.selector.");
      }
      await pageLike.waitForSelector(readiness.selector, {
        state: readiness.state || "attached",
        timeout
      });
      return { strategy, ok: true, selector: readiness.selector };
    }

    if (strategy === "selector-visible") {
      if (!readiness.selector) {
        throw new Error("waitForReady(selector-visible) requires readiness.selector.");
      }
      await pageLike.waitForSelector(readiness.selector, {
        state: "visible",
        timeout
      });
      return { strategy, ok: true, selector: readiness.selector };
    }

    if (strategy === "route-match") {
      if (!readiness.pattern) {
        throw new Error("waitForReady(route-match) requires readiness.pattern.");
      }
      const pattern = readiness.pattern;
      await pageLike.waitForURL((url) => {
        const href = String(url);
        return matchesUrlPattern(pattern, href);
      }, { timeout });
      return { strategy, ok: true };
    }

    if (strategy === "custom-wait") {
      if (typeof readiness.wait !== "function") {
        throw new Error("waitForReady(custom-wait) requires readiness.wait.");
      }
      await readiness.wait(pageLike, {
        timeoutMs: timeout
      });
      return { strategy, ok: true };
    }

    throw new Error(`Unknown readiness strategy: ${strategy}`);
  };

  const validateAuthenticatedState = async (page, validation = {}, fallbackReadiness) => {
    const timeoutMs = Number.isFinite(validation.timeoutMs) ? validation.timeoutMs : defaultTimeoutMs;
    if (validation.postAuthUrl) {
      await page.waitForURL((url) => matchesUrlPattern(validation.postAuthUrl, String(url)), {
        timeout: timeoutMs
      });
    }
    if (validation.readySelector) {
      await page.waitForSelector(validation.readySelector, {
        state: "visible",
        timeout: timeoutMs
      });
    }
    if (validation.forbiddenSelector) {
      const forbidden = page.locator(validation.forbiddenSelector);
      const visible = await forbidden.isVisible().catch(() => false);
      if (visible) {
        throw new Error(`Authenticated flow failed: forbidden selector became visible (${validation.forbiddenSelector}).`);
      }
    }
    if (typeof validation.postAuthCheck === "function") {
      await validation.postAuthCheck(page, {
        timeoutMs
      });
    }
    if (validation.readiness) {
      await waitForReady(page, validation.readiness);
    } else if (fallbackReadiness && fallbackReadiness.strategy && fallbackReadiness.strategy !== "none") {
      await waitForReady(page, fallbackReadiness);
    }
    return { ok: true };
  };

  const performAuthentication = async (page, auth = {}, fallbackUrl) => {
    const mode = auth.mode || "reuse-existing-session";
    const timeoutMs = Number.isFinite(auth.timeoutMs) ? auth.timeoutMs : defaultTimeoutMs;
    const authUrl = auth.url || fallbackUrl;

    if (mode === "reuse-existing-session") {
      if (authUrl) {
        await page.goto(authUrl, { waitUntil: auth.waitUntil || DEFAULT_WAIT_UNTIL });
      }
      return { mode };
    }

    if (mode === "url-token") {
      if (!authUrl) {
        throw new Error("Authentication mode url-token requires auth.url or a fallback audit url.");
      }
      await page.goto(authUrl, { waitUntil: auth.waitUntil || DEFAULT_WAIT_UNTIL });
      return { mode, authUrl };
    }

    if (mode === "form-fill") {
      if (!authUrl) {
        throw new Error("Authentication mode form-fill requires auth.url or a fallback audit url.");
      }
      await page.goto(authUrl, { waitUntil: auth.waitUntil || DEFAULT_WAIT_UNTIL });
      if (!Array.isArray(auth.fields) || !auth.fields.length) {
        throw new Error("Authentication mode form-fill requires auth.fields.");
      }
      for (const field of auth.fields) {
        const locator = resolveActionTarget(page, field);
        await locator.fill(String(field.value ?? ""), {
          timeout: Number.isFinite(field.timeoutMs) ? field.timeoutMs : timeoutMs
        });
      }
      if (auth.submit) {
        const submitTarget = resolveActionTarget(page, auth.submit);
        await submitTarget.click({
          timeout: Number.isFinite(auth.submit.timeoutMs) ? auth.submit.timeoutMs : timeoutMs
        });
      } else if (auth.submitWithEnter) {
        const lastField = auth.fields[auth.fields.length - 1];
        const submitField = resolveActionTarget(page, lastField);
        await submitField.press("Enter", { timeout: timeoutMs });
      } else {
        throw new Error("Authentication mode form-fill requires auth.submit or auth.submitWithEnter.");
      }
      return { mode, authUrl };
    }

    if (mode === "custom") {
      if (typeof auth.run !== "function") {
        throw new Error("Authentication mode custom requires auth.run.");
      }
      await auth.run(page, {
        timeoutMs,
        waitForReady,
        resolveActionTarget
      });
      return { mode };
    }

    throw new Error(`Unknown authentication mode: ${mode}`);
  };

  const createAuthenticatedMobilePage = async ({
    url,
    waitUntil = DEFAULT_WAIT_UNTIL,
    viewport = defaultMobileViewport,
    storageState,
    sessionStorage,
    contextOptions = {},
    pageOptions = {}
  } = {}) => {
    await resetMobileContext();
    state.mobileContext = await createAuthenticatedContext({
      viewport,
      isMobile: true,
      hasTouch: true,
      storageState,
      sessionStorage,
      contextOptions
    });
    state.mobilePage = await state.mobileContext.newPage(pageOptions);
    if (url) {
      await state.mobilePage.goto(url, { waitUntil });
    }
    return state.mobilePage;
  };

  const writeAuditArtifacts = async ({
    desktopPage,
    mobilePage,
    scope = "all",
    artifactDir,
    artifactName,
    url,
    includeMobile = true,
    desktop = {},
    mobile = {},
    reportContext = {},
    extraArtifacts = {}
  }) => {
    const { join } = await import("node:path");
    const outputStem = artifactName || `${slugify(url)}-a11y-${stampNow()}`;
    const dir = artifactDir || join(paths.outputDir, outputStem);
    await ensureDirectory(dir);

    const artifacts = await fullClient.writeAuditArtifactSet(desktopPage, {
      dir,
      scope,
      mobileTarget: includeMobile && mobilePage ? mobilePage : undefined,
      screenshotPage: desktopPage,
      mobileScreenshotPage: includeMobile ? mobilePage || undefined : undefined,
      screenshotType: desktop.screenshotType || mobile?.screenshotType || "jpeg",
      captureMode: desktop.captureMode || (desktop.fullPage === true ? "full-page" : "scroll-slices"),
      mobileCaptureMode: mobile.captureMode || (mobile.fullPage === true ? "full-page" : "scroll-slices"),
      fullPage: desktop.fullPage,
      mobileFullPage: mobile.fullPage,
      reportContext: {
        target_name: reportContext.target_name || undefined,
        primary_url: reportContext.primary_url || url,
        audit_mode: reportContext.audit_mode || (includeMobile && mobilePage ? "audit-local-web" : "audit-local-web-desktop-only"),
        browser_and_os: reportContext.browser_and_os || "Playwright sandbox session",
        audited_surfaces: reportContext.audited_surfaces || (includeMobile && mobilePage ? `Desktop and mobile views of ${url}` : `Desktop view of ${url}`),
        sample_strategy: reportContext.sample_strategy || "Flow-based sampled audit of the tested surface.",
        ...reportContext
      }
    });

    return {
      dir,
      artifacts,
      extraArtifacts
    };
  };

  const auditLocalWeb = async ({
    url,
    runtimeScriptPath,
    scope = "all",
    artifactDir,
    artifactName,
    desktop = {},
    mobile = {},
    preset = "agent-capture",
    mobilePreset = "mobile",
    includeMobile = mobile !== false && mobile?.enabled !== false,
    readiness = { strategy: "none" },
    mobileReadiness,
    reportContext = {},
    waitUntil = DEFAULT_WAIT_UNTIL
  } = {}) => {
    if (!url) {
      throw new Error("auditLocalWeb requires a target url.");
    }
    if (!runtimeScriptPath) {
      throw new Error("auditLocalWeb requires runtimeScriptPath.");
    }

    const desktopPage = await ensureDesktopPage({
      url,
      waitUntil,
      viewport: desktop.viewport || defaultDesktopViewport,
      contextOptions: desktop.contextOptions || {},
      pageOptions: desktop.pageOptions || {}
    });
    await waitForReady(desktopPage, readiness);
    await ensureOverlay(desktopPage, {
      runtimeScriptPath,
      preset,
      announce: false,
      timeoutMs: desktop.timeoutMs ?? defaultTimeoutMs,
      force: desktop.force === true
    });

    let mobilePage = null;
    if (includeMobile) {
      mobilePage = await ensureMobilePage({
        url,
        waitUntil,
        viewport: mobile.viewport || defaultMobileViewport,
        contextOptions: mobile.contextOptions || {},
        pageOptions: mobile.pageOptions || {}
      });
      await waitForReady(mobilePage, mobileReadiness || readiness);
      await ensureOverlay(mobilePage, {
        runtimeScriptPath,
        preset: mobilePreset,
        announce: false,
        timeoutMs: mobile.timeoutMs ?? defaultTimeoutMs,
        force: mobile.force === true
      });
    }

    const { dir, artifacts } = await writeAuditArtifacts({
      desktopPage,
      mobilePage,
      scope,
      artifactDir,
      artifactName,
      url,
      includeMobile,
      desktop,
      mobile,
      reportContext
    });

    return {
      dir,
      desktopPage,
      ...(mobilePage ? { mobilePage } : {}),
      artifacts
    };
  };

  const auditAuthenticatedWeb = async ({
    url,
    runtimeScriptPath,
    auth = {},
    authValidation = {},
    scope = "all",
    artifactDir,
    artifactName,
    desktop = {},
    mobile = {},
    preset = "agent-capture",
    mobilePreset = "mobile",
    includeMobile = mobile !== false && mobile?.enabled !== false,
    readiness = { strategy: "none" },
    mobileReadiness,
    reportContext = {},
    waitUntil = DEFAULT_WAIT_UNTIL
  } = {}) => {
    if (!url) {
      throw new Error("auditAuthenticatedWeb requires a target url.");
    }
    if (!runtimeScriptPath) {
      throw new Error("auditAuthenticatedWeb requires runtimeScriptPath.");
    }

    const shouldResetDesktopContext = auth.mode === "reuse-existing-session"
      ? auth.resetContext === true
      : auth.resetContext !== false;
    if (shouldResetDesktopContext) {
      await resetDesktopContext();
    }
    const desktopPage = await ensureDesktopPage({
      url: auth.mode === "reuse-existing-session" ? url : undefined,
      waitUntil,
      viewport: desktop.viewport || defaultDesktopViewport,
      contextOptions: desktop.contextOptions || {},
      pageOptions: desktop.pageOptions || {}
    });

    const authResult = await performAuthentication(desktopPage, auth, url);
    await validateAuthenticatedState(desktopPage, authValidation, readiness);
    const authState = await captureAuthenticatedState(desktopPage, auth);

    if (
      auth.navigateToUrlAfterAuth !== false &&
      normalizeComparableUrl(desktopPage.url()) !== normalizeComparableUrl(url)
    ) {
      await desktopPage.goto(url, { waitUntil });
    }
    await waitForReady(desktopPage, readiness);
    await ensureOverlay(desktopPage, {
      runtimeScriptPath,
      preset,
      announce: false,
      timeoutMs: desktop.timeoutMs ?? defaultTimeoutMs,
      force: desktop.force === true
    });

    let mobilePage = null;
    if (includeMobile) {
      mobilePage = await createAuthenticatedMobilePage({
        url: mobile.url || url,
        waitUntil,
        viewport: mobile.viewport || defaultMobileViewport,
        storageState: authState.storageState,
        sessionStorage: authState.sessionStorage,
        contextOptions: mobile.contextOptions || {},
        pageOptions: mobile.pageOptions || {}
      });
      await waitForReady(mobilePage, mobileReadiness || readiness);
      await ensureOverlay(mobilePage, {
        runtimeScriptPath,
        preset: mobilePreset,
        announce: false,
        timeoutMs: mobile.timeoutMs ?? defaultTimeoutMs,
        force: mobile.force === true
      });
    }

    const { join } = await import("node:path");
    const { writeFile } = await import("node:fs/promises");
    const { dir, artifacts } = await writeAuditArtifacts({
      desktopPage,
      mobilePage,
      scope,
      artifactDir,
      artifactName,
      url,
      includeMobile,
      desktop,
      mobile,
      reportContext: {
        auth_state: reportContext.auth_state || auth.mode || "authenticated",
        audit_mode: reportContext.audit_mode || "audit-authenticated-web",
        ...reportContext
      }
    });

    const authStatePath = join(dir, "auth-state.json");
    await writeFile(authStatePath, `${JSON.stringify(authState.storageState, null, 2)}\n`, "utf8");

    let sessionStoragePath;
    if (authState.sessionStorage && Object.keys(authState.sessionStorage).length) {
      sessionStoragePath = join(dir, "session-storage.json");
      await writeFile(sessionStoragePath, `${JSON.stringify(authState.sessionStorage, null, 2)}\n`, "utf8");
    }

    return {
      dir,
      desktopPage,
      ...(mobilePage ? { mobilePage } : {}),
      artifacts,
      auth: {
        mode: authResult.mode,
        authStatePath,
        ...(sessionStoragePath ? { sessionStoragePath } : {})
      }
    };
  };

  const auditDesktopShell = async ({
    desktopPage,
    mobilePage,
    runtimeScriptPath,
    scope = "all",
    artifactDir,
    artifactName,
    desktop = {},
    mobile = {},
    preset = "agent-capture",
    mobilePreset = "mobile",
    includeMobile = mobilePage != null && mobile !== false && mobile?.enabled !== false,
    readiness = { strategy: "none" },
    mobileReadiness,
    reportContext = {},
    url
  } = {}) => {
    if (!desktopPage) {
      throw new Error("auditDesktopShell requires a desktopPage.");
    }
    if (!runtimeScriptPath) {
      throw new Error("auditDesktopShell requires runtimeScriptPath.");
    }

    const primaryUrl = url || desktopPage.url?.() || "desktop-shell";

    await waitForReady(desktopPage, readiness);
    await ensureOverlay(desktopPage, {
      runtimeScriptPath,
      preset,
      announce: false,
      timeoutMs: desktop.timeoutMs ?? defaultTimeoutMs,
      force: desktop.force === true
    });

    if (includeMobile && mobilePage) {
      await waitForReady(mobilePage, mobileReadiness || readiness);
      await ensureOverlay(mobilePage, {
        runtimeScriptPath,
        preset: mobilePreset,
        announce: false,
        timeoutMs: mobile.timeoutMs ?? defaultTimeoutMs,
        force: mobile.force === true
      });
    }

    const { dir, artifacts } = await writeAuditArtifacts({
      desktopPage,
      mobilePage,
      scope,
      artifactDir,
      artifactName,
      url: primaryUrl,
      includeMobile: Boolean(includeMobile && mobilePage),
      desktop,
      mobile,
      reportContext: {
        audit_mode: reportContext.audit_mode || "audit-desktop-shell",
        browser_and_os: reportContext.browser_and_os || "Playwright-attached desktop shell session",
        sample_strategy: reportContext.sample_strategy || "Flow-based sampled audit of the attached desktop shell surface.",
        ...reportContext
      }
    });

    return {
      dir,
      desktopPage,
      ...(mobilePage ? { mobilePage } : {}),
      artifacts
    };
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
    waitForReady,
    ensureOverlay,
    getContract,
    setLayerMode,
    setAnnotationMode,
    buildReport,
    buildJsonReport,
    buildHtmlReport,
    buildAuditBundle,
    writeAuditArtifactSet: (...args) => fullClient.writeAuditArtifactSet(...args),
    annotateNote,
    annotateArrow,
    saveSession,
    clearSavedSession,
    getSessionSnapshot,
    writeScreenshot,
    captureVisualEvidence,
    auditLocalWeb,
    auditAuthenticatedWeb,
    auditDesktopShell,
    close
  };
}
