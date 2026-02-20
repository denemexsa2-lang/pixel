
## 2026-02-20 - Accessible Modals and Empty States
**Learning:** The app uses custom div-based modals without ARIA roles, making them invisible to screen readers. Also, empty states were static text, missing an opportunity for direct action.
**Action:** When encountering custom modals, always add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`. Transform empty states into actionable pathways.
