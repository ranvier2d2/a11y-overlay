#!/usr/bin/env python3
from __future__ import annotations

import json
import socketserver
import threading
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


@contextmanager
def local_server(root: Path):
    handler = partial(QuietHandler, directory=str(root))
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as httpd:
      port = httpd.server_address[1]
      thread = threading.Thread(target=httpd.serve_forever, daemon=True)
      thread.start()
      try:
        yield f"http://127.0.0.1:{port}"
      finally:
        httpd.shutdown()
        thread.join(timeout=2)


def audit_page(page, overlay_path: Path, scope: str = "all"):
    page.add_script_tag(path=str(overlay_path))
    page.wait_for_function("() => !!window.__a11yOverlayInstalled")
    return page.evaluate(f"() => window.__a11yOverlayInstalled.buildReport('json', {{ scope: '{scope}' }})")


def collect_console_errors(messages: list[str]) -> list[str]:
    return [message for message in messages if "favicon.ico" not in message]


def verify_landing(page, base_url: str, overlay_path: Path) -> None:
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.goto(f"{base_url}/landing.html", wait_until="load")
    expect(page).to_have_title("Overlay Runtime for Browser Agents")

    page.keyboard.press("Tab")
    focused = page.evaluate(
        "() => document.activeElement ? { text: (document.activeElement.textContent || '').trim(), href: document.activeElement.getAttribute('href') || '' } : null"
    )
    if not focused or focused["text"] != "Skip to content" or focused["href"] != "#main":
        raise AssertionError("landing page did not focus the skip link first")

    hero_cta = page.get_by_role("link", name="Try the demo").first
    if not hero_cta.is_visible():
        raise AssertionError("landing hero CTA is not visible")

    report = audit_page(page, overlay_path)
    if report["summary"]["severity"].get("error", 0):
        raise AssertionError(f"landing page has overlay error findings: {json.dumps(report['actions'][:5], indent=2)}")

    OUTPUT.mkdir(exist_ok=True)
    page.screenshot(path=str(OUTPUT / "landing-hero-proof.png"), full_page=True)

    filtered_errors = collect_console_errors(console_errors)
    if filtered_errors:
        raise AssertionError(f"landing page logged console errors: {filtered_errors}")


def verify_demo(page, base_url: str) -> None:
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.goto(f"{base_url}/demo.html", wait_until="load")
    expect(page).to_have_title("Overlay Runtime Demo")

    page.wait_for_selector("#statusPill.ready")
    page.wait_for_selector("#contractOutput")

    summary_status = page.locator("#summaryStatus").inner_text().strip()
    if "ready" not in summary_status.lower():
        raise AssertionError(f"demo summary status did not settle to ready: {summary_status}")

    contract = page.locator("#contractOutput").inner_text()
    if "getAutomationContract" not in contract or "agent-capture" not in contract:
        raise AssertionError("demo contract panel did not render the expected method/preset data")

    page.get_by_role("button", name="Build JSON report").click()
    report_output = page.locator("#reportOutput").inner_text()
    if '"summary"' not in report_output or '"actions"' not in report_output:
        raise AssertionError("demo JSON report output did not populate")

    bundle_hidden = page.evaluate("() => document.getElementById('bundleButton')?.hidden")
    if not bundle_hidden:
        raise AssertionError("bundle button should stay hidden when extension runtime is absent")

    OUTPUT.mkdir(exist_ok=True)
    page.locator("#summary").screenshot(path=str(OUTPUT / "demo-summary-proof.png"))

    filtered_errors = collect_console_errors(console_errors)
    if filtered_errors:
        raise AssertionError(f"demo page logged console errors: {filtered_errors}")


def verify_reference(page, base_url: str, overlay_path: Path) -> None:
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.goto(f"{base_url}/reference.html", wait_until="load")
    expect(page).to_have_title("Run Review Console")

    report = audit_page(page, overlay_path)
    errors = report["summary"]["severity"].get("error", 0)
    passes = report["summary"]["severity"].get("pass", 0)
    if errors == 0 or passes == 0:
        raise AssertionError("reference page should intentionally contain both failing and passing accessibility examples")

    expected_kinds = {finding["kind"] for finding in report["findings"]}
    if "target-too-small" not in expected_kinds or "alt-missing" not in expected_kinds or "alt-present" not in expected_kinds:
        raise AssertionError("reference page does not expose the expected deterministic audit findings")

    OUTPUT.mkdir(exist_ok=True)
    page.screenshot(path=str(OUTPUT / "reference-overlay-proof.png"), full_page=True)

    filtered_errors = collect_console_errors(console_errors)
    if filtered_errors:
        raise AssertionError(f"reference page logged console errors: {filtered_errors}")


def main() -> None:
    overlay_path = ROOT / "a11y-overlay.js"
    with local_server(ROOT) as base_url:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 1100})
            try:
                verify_landing(page, base_url, overlay_path)
                verify_demo(page, base_url)
                verify_reference(page, base_url, overlay_path)
                print("site verification passed")
            finally:
                browser.close()


if __name__ == "__main__":
    main()
