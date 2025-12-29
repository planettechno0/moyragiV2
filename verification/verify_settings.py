from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 720})

        # Load local file
        page.goto("file://" + os.path.abspath("index.html"))

        # Force app visible
        page.evaluate("document.getElementById(\"appContainer\").classList.remove(\"d-none\")")
        page.evaluate("document.getElementById(\"authContainer\").classList.add(\"d-none\")")

        # Open Settings Modal
        page.locator("[data-bs-target=\"#settingsModal\"]").click()
        page.wait_for_timeout(500)

        # Take screenshot of Settings
        page.screenshot(path="verification/settings_modal.png")

        browser.close()

if __name__ == "__main__":
    run()
