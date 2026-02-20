from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()

    # 1. Navigate to the app
    print("Navigating to app...")
    page.goto("http://localhost:3000")

    # Click MULTIPLAYER button to enter Lobby
    print("Clicking MULTIPLAYER...")
    # Use get_by_role to be specific
    page.get_by_role("button", name="MULTIPLAYER").click()

    # Wait for the LobbyView to load
    # Look for "AVAILABLE OPERATIONS" text
    page.wait_for_selector("text=AVAILABLE OPERATIONS")
    print("Lobby loaded.")

    # 2. Verify Refresh Button Accessibility
    refresh_btn = page.locator('button[aria-label="Refresh list"]')
    if refresh_btn.count() > 0:
        print("PASS: Refresh button has aria-label='Refresh list'")
    else:
        print("FAIL: Refresh button NOT found with correct aria-label")

    # 3. Verify Empty State Button
    create_btn = page.get_by_text("Create a room to start a new conflict")
    if create_btn.is_visible():
        print("PASS: Empty state button is visible")
        # Take screenshot of empty state
        page.screenshot(path="verification/1_empty_state.png")
    else:
        print("FAIL: Empty state button NOT visible")

    # 4. Interact: Click the empty state button
    print("Clicking empty state button...")
    create_btn.click()

    # 5. Verify Modal Accessibility
    # Wait for modal
    page.wait_for_selector('div[role="dialog"]')

    modal = page.locator('div[role="dialog"]')
    is_modal = modal.get_attribute("aria-modal") == "true"
    labelled_by = modal.get_attribute("aria-labelledby")

    print(f"Modal attributes: role=dialog, aria-modal={is_modal}, aria-labelledby={labelled_by}")

    if is_modal and labelled_by == "create-room-title":
        print("PASS: Modal has correct ARIA attributes")
    else:
        print("FAIL: Modal missing ARIA attributes")

    # Verify Title ID
    title = page.locator(f"#{labelled_by}")
    if title.is_visible() and "Create New Operation" in title.inner_text():
         print("PASS: Modal title is correctly linked")

    # Verify Form Labels
    room_name_input = page.locator("input#room-name")
    room_name_label = page.locator("label[for='room-name']")

    if room_name_input.is_visible() and room_name_label.is_visible():
        print("PASS: Room Name input and label are linked")

    # Take screenshot of modal
    page.screenshot(path="verification/2_modal_open.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
