
import os
import sys
from playwright.sync_api import sync_playwright

def verify_fix_regression():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Assuming server on 8000
        try:
            page.goto("http://localhost:8000")
            page.wait_for_timeout(2000)

            # I can't interact with ProductManager without auth, but I can check if the file syntax is valid (no console errors)
            page.on("console", lambda msg: print(f"Console: {msg.text}"))
            page.on("pageerror", lambda exc: print(f"Page Error: {exc}"))

            page.screenshot(path="verification/verification_products.png")
            print("Screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_fix_regression()
