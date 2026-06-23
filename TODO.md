## Task TODO - Museum/Auctions/Collections separation + remove fake data

- [x] Step 1: Update `js/api.js` so Collections/Museum rendering is showcase-only (no bidding/selling controls) and profile cabinet doesn’t link to selling.
- [x] Step 2: Update `assets/js/item.js` so auction item details are backend-driven only; remove localStorage mock bidding/sim users.
- [x] Step 3: Update `js/home.js` to remove `loadMockData()` usage and fake communities; switch to backend-backed content with empty states.
- [x] Step 4: Update `js/search.js` to remove fake collectors/communities sections and ensure it uses backend search only.
- [x] Step 5: Verify Auctions page shows ONLY active auctions from `/api/auctions` and never renders museum items.
- [x] Step 6: Verify empty states: Collections empty, Auctions empty, Communities empty.
- [x] Step 7: Smoke test navigation flows (collections/profile/auctions/item detail/search).
