## Description

This PR implements a comprehensive collection of frontend enhancements across multiple issues, improving localization, real-time connectivity, performance, offline capabilities, and new user-facing features.

### Changes
- **Internationalization (i18n):** Configured `next-intl` and added locale translation files (English, French, Spanish).
- **WebSocket Notifications:** Enhanced `useSocket` with heartbeat (ping/pong) and message queuing. Integrated notifications poller.
- **Performance Monitoring:** Integrated Web Vitals monitoring and set up basic tracking events for core metrics.
- **PWA & Push Notifications:** Added Service Worker (`sw.js`), Web App Manifest (`manifest.json`), and custom installation prompts for progressive web app functionality.
- **Group Buy / Cooperative Orders:** New marketplace view for group order aggregation with real-time pool progress updates via WebSocket, empty/expired pool state handling.
- **Investor Portfolio Dashboard:** New portfolio page displaying consolidated investment positions, ROI tracking, cumulative value charts, and comprehensive tests for loading/error/empty states.
- **Sustainability Certifications:** Badge component system for product cards and farmer profiles, with tooltip details showing issuing organization and expiry, accessible markup compliant with axe-core checks.
- **Weather Advisory Widget:** Dashboard widget for farmer location-based weather alerts, integrated with existing map/leaflet components and notification center, includes tests for no-advisory and active-advisory states.

### Resolved Issues
Closes #254
Closes #255
Closes #256
Closes #261
Closes #606
Closes #607
Closes #608
Closes #609
