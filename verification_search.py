from playwright.sync_api import sync_playwright

def verify_search_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html")

        # Force show the app container to bypass auth for UI verification
        page.evaluate("document.getElementById('authContainer').classList.add('d-none')")
        page.evaluate("document.getElementById('appContainer').classList.remove('d-none')")
        page.evaluate("document.getElementById('dashboardView').classList.remove('d-none')")

        # Now wait for search input
        page.wait_for_selector("#searchInput")
        page.wait_for_selector("#searchBtn")

        # Type something
        page.fill("#searchInput", "Test Store")

        # Click search
        page.click("#searchBtn")

        # Wait a bit
        page.wait_for_timeout(2000)

        # Take screenshot
        page.screenshot(path="verification/search_ui.png")

        browser.close()

if __name__ == "__main__":
    verify_search_ui()
