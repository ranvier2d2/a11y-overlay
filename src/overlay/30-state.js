  // ---------- state ----------
  /** @type {OverlayState} */
  const state = {
    layerMode: 'conformance',
    landmark: true,
    heading: true,
    interact: false,
    form: false,
    target: false,
    alt: true,
    repeat: false,
    focus: false,
    depth: false,
    grid: false,
    helpOpen: true,
    settingsOpen: false,
    mobileSheetOpen: false,
    mobileSheetTab: 'layers',
    mobileSheetDetent: 'medium',
    exportBusy: false,
    exportNotice: '',
    exportNoticeTone: 'muted',
    touchProfile: 'web-default'
  };
  let exportNoticeTimer = 0;
  let sessionPersistTimer = 0;
  let sessionReady = false;
  let sessionReadyWaiters = [];
  let annotationCounter = 0;
  let dragState = null;
  const inspector = {
    selection: null
  };
  const annotations = {
    mode: 'idle',
    selected: null,
    editingNoteId: null,
    pendingArrowStart: null,
    pendingArrowPreview: null,
    notes: [],
    arrows: []
  };
  const SLICES = [
    { key: 'landmark', kbd: 'L', label: 'Landmarks', color: COLOR.landmark, minLayer: 'conformance', findingType: 'standard' },
    { key: 'heading',  kbd: 'H', label: 'Headings',  color: COLOR.heading,  minLayer: 'conformance', findingType: 'standard' },
    { key: 'interact', kbd: 'I', label: 'Interact',  color: COLOR.interact, minLayer: 'conformance', findingType: 'standard' },
    { key: 'form',     kbd: 'M', label: 'Forms',     color: COLOR.form,     minLayer: 'conformance', findingType: 'mixed' },
    { key: 'target',   kbd: 'T', label: 'Targets',   color: COLOR.target,   minLayer: 'conformance', findingType: 'standard' },
    { key: 'alt',      kbd: 'A', label: 'Images',    color: COLOR.alt,      minLayer: 'conformance', findingType: 'mixed' },
    { key: 'repeat',   kbd: 'R', label: 'Repeats',   color: COLOR.repeat,   minLayer: 'review',      findingType: 'heuristic' },
    { key: 'focus',    kbd: 'F', label: 'Tab order', color: COLOR.focus,    minLayer: 'conformance', findingType: 'standard' },
    { key: 'depth',    kbd: 'D', label: 'Depth',     color: COLOR.depth1,   minLayer: 'review',      findingType: 'heuristic' },
    { key: 'grid',     kbd: 'G', label: 'Grid',      color: COLOR.grid,     minLayer: 'review',      findingType: 'heuristic' }
  ];
  const SLICE_BY_KEY = Object.fromEntries(SLICES.map((slice) => [slice.key, slice]));
  const PRESETS = [
    {
      id: 'content',
      label: 'Content',
      description: 'Headings, landmarks, and image semantics',
      layerMode: 'conformance',
      touchProfile: 'web-default',
      enabledSlices: {
        landmark: true,
        heading: true,
        interact: false,
        form: false,
        target: false,
        alt: true,
        repeat: false,
        focus: false,
        depth: false,
        grid: false
      }
    },
    {
      id: 'navigation',
      label: 'Navigation',
      description: 'Regions, controls, and tab flow',
      layerMode: 'conformance',
      touchProfile: 'web-default',
      enabledSlices: {
        landmark: true,
        heading: false,
        interact: true,
        form: false,
        target: false,
        alt: false,
        repeat: false,
        focus: true,
        depth: false,
        grid: false
      }
    },
    {
      id: 'forms',
      label: 'Forms',
      description: 'Names, focusability, and target affordance',
      layerMode: 'conformance',
      touchProfile: 'web-default',
      enabledSlices: {
        landmark: false,
        heading: false,
        interact: true,
        form: true,
        target: true,
        alt: false,
        repeat: false,
        focus: true,
        depth: false,
        grid: false
      }
    },
    {
      id: 'mobile',
      label: 'Mobile',
      description: 'Touch targets with platform advisory profiles',
      layerMode: 'conformance',
      touchProfile: 'both',
      enabledSlices: {
        landmark: false,
        heading: false,
        interact: true,
        form: false,
        target: true,
        alt: false,
        repeat: false,
        focus: true,
        depth: false,
        grid: false
      }
    },
    {
      id: 'agent-capture',
      label: 'Agent',
      description: 'Dense structural capture for screenshots and automation',
      layerMode: 'review',
      touchProfile: 'both',
      enabledSlices: {
        landmark: true,
        heading: true,
        interact: true,
        form: true,
        target: true,
        alt: true,
        repeat: true,
        focus: true,
        depth: true,
        grid: true
      }
    }
  ];
  const PRESET_BY_ID = Object.fromEntries(PRESETS.map((preset) => [preset.id, preset]));

  /**
   * @typedef {Object} OverlayPreset
   * @property {string} id
   * @property {string} label
   * @property {string} description
   * @property {'conformance'|'review'} layerMode
   * @property {'web-default'|'apple-44pt'|'android-48dp'|'both'} touchProfile
   * @property {Record<string, boolean>} enabledSlices
   */

  /**
   * @typedef {Object} OverlayState
   * @property {'conformance'|'review'} layerMode
   * @property {boolean} landmark
   * @property {boolean} heading
   * @property {boolean} interact
   * @property {boolean} form
   * @property {boolean} target
   * @property {boolean} alt
   * @property {boolean} repeat
   * @property {boolean} focus
   * @property {boolean} depth
   * @property {boolean} grid
   * @property {boolean} helpOpen
   * @property {boolean} settingsOpen
   * @property {boolean} mobileSheetOpen
   * @property {'layers'|'inspect'|'annotate'|'more'} mobileSheetTab
   * @property {'peek'|'medium'|'full'} mobileSheetDetent
   * @property {boolean} exportBusy
   * @property {string} exportNotice
   * @property {string} exportNoticeTone
   * @property {'web-default'|'apple-44pt'|'android-48dp'|'both'} touchProfile
   */

  /**
   * @typedef {Object} OverlayAnnotationNote
   * @property {string} id
   * @property {number} x
   * @property {number} y
   * @property {string} text
   */

  /**
   * @typedef {Object} OverlayAnnotationArrow
   * @property {string} id
   * @property {number} x1
   * @property {number} y1
   * @property {number} x2
   * @property {number} y2
   */

  /**
   * @typedef {Object} OverlaySessionSnapshot
   * @property {number} version
   * @property {string} url
   * @property {string} savedAt
   * @property {'conformance'|'review'} layerMode
   * @property {'web-default'|'apple-44pt'|'android-48dp'|'both'} touchProfile
   * @property {Record<string, boolean>} enabledSlices
   * @property {{notes: OverlayAnnotationNote[], arrows: OverlayAnnotationArrow[], selected: ({type: string, id: string}|null)}} annotations
   * @property {{selector: string, meta: Object, label: string, color: string}|null} inspector
   */
