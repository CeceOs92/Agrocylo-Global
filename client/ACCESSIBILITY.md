# Accessibility

This app is maintained to WCAG 2.1 AA standards as a baseline.

## What we check

- Keyboard navigation through all primary flows
- Visible focus styles on interactive elements
- Screen reader labels for icon-only controls
- Reduced-motion support for users who prefer less animation
- Mobile touch target sizing and responsive layouts
- Automated axe coverage on representative public pages

## Local checks

Run these from `client/`:

```bash
npm run lint
npm run build
npm run test:a11y
```

## Implementation notes

- Use semantic HTML first, then ARIA only when needed.
- Keep interactive controls at least `44px` square when possible.
- Ensure dialogs, sheets, and drawers return focus and close with `Escape`.
- Prefer descriptive link text and labels over icon-only controls.
- Honor `prefers-reduced-motion` and avoid motion that is only decorative.
