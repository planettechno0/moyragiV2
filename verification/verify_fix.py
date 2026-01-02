
import os
import sys
from playwright.sync_api import sync_playwright

def verify_fix():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load the index.html file directly
        # Since it's a static file using ES modules, we need to serve it or use file:// if CORS allows.
        # However, ES modules usually require a server.
        # Let's try to serve it with python http.server in background?
        # Or assume we can just load it.
        # Given the environment, I'll use python http.server on a random port.

        # But first, let's try to verify if the white screen is gone.
        # If I can see the "Login" or "App" container (even if d-none), it means JS loaded.
        # If JS fails, usually we see nothing or an error in console.

        # NOTE: I cannot easily start a background server in this script block without managing it.
        # So I will assume the user or I will start it separately.
        # But I need to do it myself.

        print("Please ensure a server is running. I will assume port 8000 for this test.")

        try:
            page.goto("http://localhost:8000")

            # Wait for a moment for JS to execute
            page.wait_for_timeout(2000)

            # Check for console errors (captured via event listener usually, but here we just check visibility)
            # If the app loads, #authContainer or #appContainer should be present in DOM.
            # Initially they are d-none.
            # But if JS crashes, they remain d-none.
            # If JS runs, auth.init() should remove d-none from one of them.

            # Let's check if 'ui.js' error is gone.
            # We can't easily check console logs in this script without attaching a listener.

            page.on("console", lambda msg: print(f"Console: {msg.text}"))
            page.on("pageerror", lambda exc: print(f"Page Error: {exc}"))

            # Take a screenshot
            if not os.path.exists("verification"):
                os.makedirs("verification")

            page.screenshot(path="verification/verification.png")
            print("Screenshot saved to verification/verification.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_fix()
