#606 [Frontend] Cooperative / group-buy UI
Repo Avatar
Cylo-Traders/Agrocylo-Global
Problem
There's no client surface for group-buy order aggregation; buyers currently
order individually only.

Acceptance criteria
New market view showing open group orders with progress toward threshold
and a "join pool" action reusing CartDrawer patterns.
Real-time pool-progress updates via existing WS notification channel.
Empty/expired-pool states handled.

#607 [Frontend] Investor portfolio dashboard
Repo Avatar
Cylo-Traders/Agrocylo-Global
Problem
Campaign investors (via agro-production/client/src/app/campaigns) have no
consolidated view of their positions and returns across campaigns.

Acceptance criteria
New portfolio page consuming the investor portfolio analytics API,
listing active/settled campaigns, amounts, and ROI.
Chart of cumulative contributed vs. returned value.
Tests for loading/error/empty states.

#608 [Frontend] Sustainability & certification badges
Repo Avatar
Cylo-Traders/Agrocylo-Global
Problem
Product and profile listings have no way to surface verified sustainability
claims once the certification issuance service exists.

Acceptance criteria
Badge component on product cards/market/[productId] and farmer
profile/[userId] pages, sourced from the certification endpoint.
Tooltip/detail view showing issuing org and expiry.
Accessible markup (consistent with existing @axe-core/playwright checks).

#609 [Frontend] Weather advisory widget for farmer dashboard
Repo Avatar
Cylo-Traders/Agrocylo-Global
Problem
No client surface exists for a weather-alert backend service, leaving
farmers to discover adverse conditions only through generic notifications.

Acceptance criteria
Dashboard widget showing current advisory status per farmer location
(reusing existing map/leaflet integration).
Links into the existing notification center for historical alerts.
Tests for no-advisory and active-advisory states.