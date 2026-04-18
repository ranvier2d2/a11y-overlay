# Submission Checklist

## Live URLs

- Repo: `https://github.com/ranvier2d2/a11y-overlay`
- Site: `https://ranvier2d2.github.io/a11y-overlay/`
- Privacy policy: `https://ranvier2d2.github.io/a11y-overlay/privacy.html`

## Build commands

```bash
python3 scripts/generate_icons.py
python3 scripts/generate_store_assets.py
python3 scripts/build_release.py
```

Chrome package output:

```text
dist/a11y-overlay-chrome-v0.1.0.zip
```

Optional Firefox package:

```bash
FIREFOX_EXTENSION_ID='a11y-overlay@yourdomain.com' python3 scripts/build_release.py --firefox
```

## Chrome Web Store

Dashboard:

```text
https://chrome.google.com/webstore/devconsole/
```

Before upload:

- Make sure the Chrome Web Store developer account is registered and has 2-Step Verification enabled.
- Confirm the account can publish extensions.

Upload:

- Package: `dist/a11y-overlay-chrome-v0.1.0.zip`
- At least one screenshot is required. Use the files in `store-assets/screenshots/`.
- Use the copy in `store-assets/STORE_LISTING.md`.
- Privacy policy URL: `https://ranvier2d2.github.io/a11y-overlay/privacy.html`

Recommended Chrome screenshots:

- `store-assets/screenshots/chrome-01-landing-hero.png`
- `store-assets/screenshots/chrome-02-overlay-default.png`
- `store-assets/screenshots/chrome-03-overlay-focus.png`
- `store-assets/screenshots/chrome-04-landing-full.png`

## Microsoft Edge Add-ons

Developer dashboard:

```text
https://developer.microsoft.com/en-us/microsoft-edge/extensions
```

Upload:

- Package: `dist/a11y-overlay-chrome-v0.1.0.zip`
- Logo: `store-assets/edge/edge-logo-300.png`
- Small promotional tile: `store-assets/edge/edge-small-promotional-tile-440x280.png`
- Large promotional tile: `store-assets/edge/edge-large-promotional-tile-1400x560.png`
- Screenshots: files in `store-assets/screenshots/`
- Privacy policy URL: `https://ranvier2d2.github.io/a11y-overlay/privacy.html`

## Manual answers you may still need in store UI

- Category: Developer tools
- Single purpose: Inject a local overlay into the current page to visualize landmarks, headings, focus order, layout depth, repeating components, and related accessibility structure.
- Data collection: none
- Data sale: no
- Remote code: no
- Analytics: no
- Ads: no
