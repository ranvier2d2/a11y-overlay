  // ---------- constants ----------
  const NS = 'a11yov';
  const Z = 2147483000;
  const VERSION = '0.1.17';
  const TOUCH_PROFILE_STORAGE_KEY = 'a11y-overlay-touch-profile';
  const SESSION_STORAGE_PREFIX = 'a11y-overlay-session::';
  const SESSION_STORAGE_VERSION = 1;
  const SESSION_PERSIST_MS = 180;

  const COLOR = {
    landmark: '#f59e0b',    // amber
    heading:  '#22d3ee',    // cyan
    interact: '#a3e635',    // lime
    form:     '#14b8a6',    // teal
    target:   '#f97316',    // orange
    alt:      '#fb7185',    // rose (error)
    repeat:   '#a78bfa',    // violet
    focus:    '#60a5fa',    // blue
    grid:     '#64748b',    // slate — neutral, low-contrast grid
    noteBg:   '#fef08a',
    noteBorder: '#facc15',
    noteText: '#422006',
    annotate: '#f97316',
    annotateSelected: '#fb7185',
    depth0:   '#94a3b8',
    depth1:   '#38bdf8',
    depth2:   '#34d399',
    depth3:   '#fbbf24',
    depth4:   '#f472b6',
    depth5:   '#c084fc'
  };

  const LANDMARK_TAGS = ['header','nav','main','section','footer','aside','form','article'];
  const HEADING_SEL = 'h1,h2,h3,h4,h5,h6';
  const INTERACT_SEL = 'a[href],button,input,textarea,select,[role=button],[role=link],[tabindex]:not([tabindex="-1"])';

  // display values that participate in block-level layout (grid view cares about these)
  const BLOCK_DISPLAYS = new Set([
    'block', 'flex', 'grid', 'inline-block', 'inline-flex', 'inline-grid',
    'flow-root', 'list-item', 'table', 'table-row', 'table-cell', 'table-row-group',
    'table-header-group', 'table-footer-group', 'table-column', 'table-column-group',
    'table-caption'
  ]);
  function getExtensionRuntime() {
    try {
      if (typeof chrome !== 'object' || !chrome || !chrome.runtime) {
        return null;
      }
      if (
        typeof chrome.runtime.getManifest !== 'function' ||
        typeof chrome.runtime.sendMessage !== 'function'
      ) {
        return null;
      }
      if (!chrome.runtime.id || !chrome.runtime.getManifest()) {
        return null;
      }
      return chrome.runtime;
    } catch (_error) {
      return null;
    }
  }

  const EXTENSION_RUNTIME = getExtensionRuntime();
  const CAN_EXPORT_FROM_EXTENSION = !!EXTENSION_RUNTIME;
  const EXPORT_MESSAGE = 'a11y-overlay-export-png';
  const OPEN_EXPORT_WINDOW_MESSAGE = 'a11y-overlay-open-export-window';
  const GET_VIEWPORT_CAPTURE_MESSAGE = 'a11y-overlay-get-viewport-capture';
  const EXPORT_NOTICE_MS = 2800;
  const REPORT_SCHEMA_VERSION = 1;
  const AUTOMATION_CONTRACT_VERSION = 2;

  // elements that are mostly noise in a grid view
  const GRID_SKIP = new Set(['HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'BR', 'HR']);
