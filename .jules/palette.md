## 2025-05-27 - Improving Dialog Accessibility

**Learning:** Nuxt UI components like `UButton` and `UInput` pass attributes down to the underlying HTML elements. Adding `aria-label` to icon-only buttons and `id`/`for` associations to form inputs is straightforward and improves accessibility.
**Action:** When working on dialogs, always check for `aria-label` on close buttons and ensure all form inputs have associated labels with `for` attributes. Also, use `autofocus` on the primary input for better keyboard UX.
