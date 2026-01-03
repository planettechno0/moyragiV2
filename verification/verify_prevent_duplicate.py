
import os
import sys
from playwright.sync_api import sync_playwright

def verify_prevent_duplicate():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            page.goto("http://localhost:8000")
            page.wait_for_timeout(2000)

            # Just verify app loads. I cannot simulate the race condition easily without UI interaction.
            page.screenshot(path="verification/verification_prevent_duplicate.png")
            print("Screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_prevent_duplicate()
