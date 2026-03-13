# RingMe Pro — TODO

## Core Infrastructure
- [x] Port package.json with all v5.2 dependencies (twilio, react-native-sse, expo-linear-gradient, etc.)
- [x] Port drizzle/schema.ts with all tables
- [x] Port server/db.ts with all database functions
- [x] Port server/routers.ts with all tRPC procedures
- [x] Port server/sse.ts for real-time messaging
- [x] Port server/twilio.ts with Twilio helper functions
- [x] Port server/webhooks.ts with webhook handlers
- [x] Port hooks/use-sse-messages.ts (Android-safe SSE)
- [x] Port hooks/use-push-notifications.ts
- [x] Port lib/auth-context.tsx
- [x] Port lib/trpc.ts
- [x] Port constants/theme.ts with PixiePop colors

## Auth Screens
- [x] app/(auth)/splash.tsx — Animated PixiePop splash with app icon
- [x] app/(auth)/onboarding.tsx — 3-slide feature walkthrough
- [x] app/(auth)/login.tsx — Email/password login with app icon
- [x] app/(auth)/signup.tsx — New account creation with app icon
- [x] app/(auth)/_layout.tsx

## Main Tabs
- [x] app/(tabs)/index.tsx — Messages inbox with AI summary
- [x] app/(tabs)/calls.tsx — Call log + T9 dialpad + SPAM badges
- [x] app/(tabs)/burners.tsx — Burner numbers + settings modal
- [x] app/(tabs)/contacts.tsx — Address book + device import
- [x] app/(tabs)/settings.tsx — Settings hub
- [x] app/(tabs)/_layout.tsx — 5-tab layout

## Chat Screens
- [x] app/chat/[id].tsx — Chat thread with AI replies + group support
- [x] app/chat/new.tsx — New conversation
- [x] app/chat/group-new.tsx — New group conversation

## Call Screens
- [x] app/call/active.tsx — Active call controls + recording

## Number Select Flow
- [x] app/number-select/country.tsx
- [x] app/number-select/numbers.tsx
- [x] app/number-select/buy.tsx

## Settings Sub-screens
- [x] app/settings/blocked-numbers.tsx
- [x] app/settings/dnd-schedule.tsx
- [x] app/settings/port-number.tsx
- [x] app/settings/upgrade.tsx
- [x] app/settings/voicemail-greeting.tsx
- [x] app/settings/webhook-setup.tsx

## Root Layout
- [x] app/_layout.tsx — Root navigator with auth state

## Branding
- [x] Generate PixiePop app logo (phone + lightning bolt on dark purple)
- [x] Update app.config.ts with PixiePop theme + contacts/image-picker plugins
- [x] Update theme.config.js with PixiePop colors
- [x] Update tailwind.config.js

## Build Bible v5.3 Fixes (20 Fixes)
- [x] FIX 1: SSE onConnected/onDisconnected + pause polling when connected
- [x] FIX 2: Free tier 100 SMS/month enforcement with USAGE_LIMIT_REACHED error
- [x] FIX 3: VoIP calling hook (useVoIPCall) with graceful fallback
- [x] FIX 4: Comprehensive test suite (115 tests passing)
- [x] FIX 5: RevenueCat plugin in app.config.ts
- [x] FIX 6: FlatList + React.memo in Messages tab
- [x] FIX 7: Group sender name + color labels (numberToColor utility)
- [x] FIX 8: Call duration formatting on call log rows
- [x] FIX 9: Number selector area code live search
- [x] FIX 10: DB health indicator in Settings
- [x] FIX 11: Burn Now with 48hr early-burn warning
- [x] FIX 12: Delete voicemail action
- [x] FIX 13: Swipe-to-reply gesture in chat
- [x] FIX 14: Message read receipts (sent/delivered/read indicators)
- [x] FIX 15: Complete signup → number-select → main app flow
- [x] FIX 16: Push notification quick-reply categories
- [x] FIX 17: Alphabetical contact index bar
- [x] FIX 18: Export My Data screen
- [x] FIX 19: Webhook self-test button
- [x] FIX 20: SETUP.md production deployment guide (200+ lines)

## Infrastructure
- [x] Set up Twilio credentials via Secrets panel
- [ ] Set up RevenueCat credentials via Secrets panel
- [ ] Run database migration (db:push)
- [ ] Verify QR code works for Expo Go preview

## Follow-up Features
- [x] Set up Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, API_BASE_URL)
- [x] Run database migration (db:push)
- [x] AI-powered smart reply suggestions in chat screen (3 chips above keyboard) — already implemented
- [ ] Set up Twilio credentials via Secrets panel
- [x] Add message search screen (full-text search across conversations)
- [x] Publish prep (checkpoint for Publish button)
- [x] Generate QR code for Expo Go preview
