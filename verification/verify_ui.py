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

        # Click Settings to see Telegram inputs
        page.get_by_role("link", name="تنظیمات").click()
        page.wait_for_selector("#telegramBotToken", state="visible")
        page.screenshot(path="verification/settings.png")

        # Close Settings
        page.get_by_role("button", name="Close").click()

        # Click Orders View to see "Send to Telegram" button
        page.locator("#ordersViewBtn").click()
        page.wait_for_selector("#sendToTelegramBtn", state="visible")
        page.screenshot(path="verification/orders.png")

        browser.close()

if __name__ == "__main__":
    run()
