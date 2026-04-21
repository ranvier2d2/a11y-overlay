#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures"


def wait_for_overlay(page) -> None:
    page.wait_for_function("() => !!window.__a11yOverlayInstalled")


def verify_audit_fixture(page) -> None:
    page.goto((FIXTURES / "audit-fixture.html").as_uri(), wait_until="load")
    wait_for_overlay(page)
    page.evaluate("() => window.__a11yOverlayInstalled.state.touchProfile = 'both'")

    kinds = page.evaluate(
        "() => window.__a11yOverlayInstalled.collectDetections().map((entry) => entry.kind)"
    )
    expected = {
        "landmark",
        "heading",
        "alt-missing",
        "alt-empty-suspicious",
        "form-label-missing",
        "target-too-small",
    }
    missing = sorted(expected.difference(kinds))
    if missing:
        raise AssertionError(f"audit fixture is missing findings: {missing}")

    report = page.evaluate(
        """
        () => {
          const api = window.__a11yOverlayInstalled;
          if (!api.state.form) api.toggle('form');
          if (!api.state.target) api.toggle('target');
          return api.buildReport('json', { scope: 'all' });
        }
        """
    )
    report_kinds = {item["kind"] for item in report["findings"]}
    if not expected.issubset(report_kinds):
        raise AssertionError("report JSON did not include the expected audit findings")
    if not report["actions"] or report["actions"][0]["bucket"] != "fix-now":
        raise AssertionError("report JSON did not include bucketed actionable summary data")
    buckets = {action["bucket"] for action in report["actions"]}
    if "fix-now" not in buckets or "review" not in buckets:
        raise AssertionError("report JSON did not classify actions into the expected execution buckets")

    html_report = page.evaluate(
        "() => window.__a11yOverlayInstalled.buildReport('html', { scope: 'all' })"
    )
    if "<html" not in html_report.lower() or "a11y-overlay report" not in html_report or "Fix now" not in html_report or "Review" not in html_report or "fixes now" not in html_report:
        raise AssertionError("HTML report builder did not return a valid report document")

    audit_bundle = page.evaluate(
        "() => window.__a11yOverlayInstalled.buildAuditBundle({ scope: 'all' })"
    )
    if "a11y-overlay audit bundle" not in audit_bundle or "a11y-overlay-report-data" not in audit_bundle or "Fix now" not in audit_bundle or "Review" not in audit_bundle or "fixes now" not in audit_bundle:
        raise AssertionError("audit bundle builder did not return the expected standalone bundle")


def verify_session_fixture(page) -> None:
    fixture_url = (FIXTURES / "session-fixture.html").as_uri()
    page.goto(fixture_url, wait_until="load")
    wait_for_overlay(page)

    page.evaluate(
        """
        async () => {
          const api = window.__a11yOverlayInstalled;
          await api.clearSavedSession();
          api.setLayerMode('review');
          if (!api.state.repeat) api.toggle('repeat');
          api.annotations.notes.push({
            id: 'note-3',
            x: 220,
            y: 260,
            text: 'Saved note'
          });
          api.annotations.arrows.push({
            id: 'arrow-7',
            x1: 260,
            y1: 320,
            x2: 340,
            y2: 360
          });
          api.render();
          await api.saveSession();
        }
        """
    )

    page.reload(wait_until="load")
    wait_for_overlay(page)
    page.wait_for_function(
        """
        () => {
          const api = window.__a11yOverlayInstalled;
          return api.state.layerMode === 'review' &&
            api.annotations.notes.some((note) => note.id === 'note-3') &&
            api.annotations.arrows.some((arrow) => arrow.id === 'arrow-7');
        }
        """
    )

    restored = page.evaluate(
        """
        () => {
          const api = window.__a11yOverlayInstalled;
          return {
            layerMode: api.state.layerMode,
            repeat: api.state.repeat,
            noteCount: api.annotations.notes.length,
            arrowCount: api.annotations.arrows.length,
            noteText: api.annotations.notes[0] ? api.annotations.notes[0].text : ''
          };
        }
        """
    )

    if restored["layerMode"] != "review":
        raise AssertionError(f"expected review mode after reload, got {restored['layerMode']}")
    if not restored["repeat"]:
        raise AssertionError("expected repeat slice to stay enabled after reload")
    if restored["noteCount"] != 1 or restored["noteText"] != "Saved note":
        raise AssertionError("expected saved annotations to restore after reload")
    if restored["arrowCount"] != 1:
        raise AssertionError("expected saved arrows to restore after reload")

    created = page.evaluate(
        """
        () => {
          const api = window.__a11yOverlayInstalled;
          const capture = document
            .getElementById('a11yov-host')
            .shadowRoot
            .getElementById('annotation-capture');
          const pointerDown = (x, y) => capture.dispatchEvent(new PointerEvent('pointerdown', {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true
          }));

          api.setAnnotationMode('note');
          pointerDown(360, 320);
          api.setAnnotationMode('arrow');
          pointerDown(420, 360);
          pointerDown(500, 420);

          return {
            noteIds: api.annotations.notes.map((note) => note.id),
            arrowIds: api.annotations.arrows.map((arrow) => arrow.id)
          };
        }
        """
    )
    if "note-8" not in created["noteIds"] or len(created["noteIds"]) != len(set(created["noteIds"])):
        raise AssertionError(f"restored note ids did not advance the annotation counter: {created['noteIds']}")
    if "arrow-9" not in created["arrowIds"] or len(created["arrowIds"]) != len(set(created["arrowIds"])):
        raise AssertionError(f"restored arrow ids did not advance the annotation counter: {created['arrowIds']}")


def verify_extension_storage_restore_order(browser) -> None:
    fixture_url = (FIXTURES / "session-fixture.html").as_uri()
    context = browser.new_context(viewport={"width": 1440, "height": 1100})
    page = context.new_page()
    page.add_init_script(
        """
        (() => {
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          globalThis.chrome = {
            storage: {
              local: {
                async get(keys) {
                  const key = Array.isArray(keys) ? keys[0] : keys;
                  if (key === 'a11y-overlay-touch-profile') {
                    await sleep(80);
                    return { [key]: 'apple-44pt' };
                  }
                  if (String(key).startsWith('a11y-overlay-session::')) {
                    await sleep(1);
                    return {
                      [key]: {
                        version: 1,
                        layerMode: 'review',
                        touchProfile: 'both',
                        enabledSlices: { repeat: true },
                        annotations: { notes: [], arrows: [] }
                      }
                    };
                  }
                  return {};
                },
                async set() {},
                async remove() {}
              }
            }
          };
        })();
        """
    )

    try:
        page.goto(fixture_url, wait_until="load")
        wait_for_overlay(page)
        page.wait_for_function(
            """
            () => {
              const api = window.__a11yOverlayInstalled;
              return api.state.layerMode === 'review' &&
                api.state.touchProfile === 'both' &&
                api.state.repeat === true;
            }
            """
        )
    finally:
        context.close()


def verify_presets(page) -> None:
    fixture_url = (FIXTURES / "session-fixture.html").as_uri()
    page.goto(fixture_url, wait_until="load")
    wait_for_overlay(page)

    mobile = page.evaluate(
        """
        () => {
          const api = window.__a11yOverlayInstalled;
          api.applyPreset('mobile', { announce: false });
          return {
            layerMode: api.state.layerMode,
            touchProfile: api.state.touchProfile,
            enabled: {
              interact: api.state.interact,
              target: api.state.target,
              focus: api.state.focus,
              alt: api.state.alt
            }
          };
        }
        """
    )
    if mobile["layerMode"] != "conformance" or mobile["touchProfile"] != "both":
        raise AssertionError("mobile preset did not apply the expected mode/profile")
    if not (mobile["enabled"]["interact"] and mobile["enabled"]["target"] and mobile["enabled"]["focus"]):
        raise AssertionError("mobile preset did not enable the expected slices")
    if mobile["enabled"]["alt"]:
        raise AssertionError("mobile preset should leave the image slice off")

    agent = page.evaluate(
        """
        () => {
          const api = window.__a11yOverlayInstalled;
          api.applyPreset('agent-capture', { announce: false });
          return {
            layerMode: api.state.layerMode,
            touchProfile: api.state.touchProfile,
            enabled: Object.fromEntries(
              ['landmark','heading','interact','form','target','alt','repeat','focus','depth','grid']
                .map((key) => [key, !!api.state[key]])
            )
          };
        }
        """
    )
    if agent["layerMode"] != "review" or agent["touchProfile"] != "both":
        raise AssertionError("agent preset did not apply the expected mode/profile")
    if not all(agent["enabled"].values()):
        raise AssertionError("agent preset should enable every core slice")


def verify_automation_contract(page) -> None:
    fixture_url = (FIXTURES / "session-fixture.html").as_uri()
    page.goto(fixture_url, wait_until="load")
    wait_for_overlay(page)

    contract = page.evaluate(
        "() => window.__a11yOverlayInstalled.getAutomationContract()"
    )
    if contract["contractVersion"] != 1 or contract["reportSchemaVersion"] != 1:
        raise AssertionError("automation contract versioning is missing or incorrect")

    method_names = set(contract["methods"].keys())
    required_methods = {
        "collectDetections",
        "buildReport",
        "buildAuditBundle",
        "downloadReport",
        "downloadAuditBundle",
        "listPresets",
        "applyPreset",
        "saveSession",
        "clearSavedSession",
        "getSessionSnapshot",
        "getAutomationContract",
    }
    missing = sorted(required_methods.difference(method_names))
    if missing:
        raise AssertionError(f"automation contract is missing methods: {missing}")

    preset_ids = {preset["id"] for preset in contract["presets"]}
    if "agent-capture" not in preset_ids or "forms" not in preset_ids:
        raise AssertionError("automation contract did not expose the expected presets")


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1100})
        try:
            verify_audit_fixture(page)
            verify_session_fixture(page)
            verify_extension_storage_restore_order(browser)
            verify_presets(page)
            verify_automation_contract(page)
            print("overlay verification passed")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
