from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Load local file
        page.goto("file://" + os.path.abspath("index.html"))

        # Take screenshot of Dashboard (Filters)
        page.screenshot(path="verification/dashboard.png")

        # Try generic selector if role fails
        # page.get_by_role("link", name="تنظیمات").click()
        page.locator("[data-bs-target=\"#settingsModal\"]").click()

        # page.wait_for_selector("#telegramBotToken", state="visible")
        page.wait_for_timeout(1000) # Wait for animation
        page.screenshot(path="verification/settings.png")

        browser.close()

if __name__ == "__main__":
    run()
