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

        # 1. Clean Dashboard
        page.screenshot(path="verification/clean_dashboard.png")

        # 2. Filter Modal
        page.click("button[data-bs-target=\"#filterModal\"]")
        page.wait_for_timeout(500)
        page.screenshot(path="verification/filter_modal.png")
        page.click("button[data-bs-dismiss=\"modal\"]") # Close it

        # 3. Orders View (New Telegram Input)
        page.evaluate("document.getElementById(\"ordersView\").classList.remove(\"d-none\")")
        page.evaluate("document.getElementById(\"dashboardView\").classList.add(\"d-none\")")
        page.screenshot(path="verification/orders_view.png")

        # 4. Visits View (Renamed + Telegram Input)
        page.evaluate("document.getElementById(\"ordersView\").classList.add(\"d-none\")")
        page.evaluate("document.getElementById(\"managementView\").classList.remove(\"d-none\")")
        page.click("#tab-visits-btn")
        page.wait_for_timeout(200)
        page.screenshot(path="verification/visits_view.png")

        browser.close()

if __name__ == "__main__":
    run()
