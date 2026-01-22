# InkWell Mobile - Future Ideas & Roadmap

> Last Updated: January 7, 2026

## 🌍 Internationalization (i18n)

### Multi-Language Support
- [ ] Add language detection/selection in Settings
- [ ] Support for Spanish, French, German, Japanese, Mandarin (prioritize based on user base)
- [ ] Translate all UI strings
- [ ] Consider AI prompts/reflections in user's native language
- [ ] RTL (right-to-left) support for Arabic, Hebrew

### Implementation Notes
- Use `react-native-localize` or `i18next` for translations
- Store language preference in AsyncStorage + Firestore user profile
- Sophy prompts would need localized prompt engineering

---

## 📱 Tablet Support (iPad)

### iPad Optimized Layout
- [ ] Responsive layouts for larger screens
- [ ] Two-column view for journal entries
- [ ] Side-by-side Manifest/Journal view
- [ ] Floating action buttons repositioned for tablet ergonomics

### Apple Pencil Integration
- [ ] Handwriting input for journal entries
- [ ] Sketch/doodle attachments
- [ ] Handwriting-to-text conversion (on-device ML)
- [ ] Pressure-sensitive drawing for emotional expression

### Implementation Notes
- Use `useWindowDimensions()` for responsive breakpoints
- PencilKit via native module for handwriting
- Consider `react-native-sketch-canvas` for drawing

---

## 🎯 Features Discussed (Not Yet Implemented)

### Voice Features (InkOutLoud)
- [x] Basic voice recording (implemented)
- [ ] Voice-to-text transcription with timestamps
- [ ] Voice memo playback in Past Entries
- [ ] Voice analysis for emotional tone (Plus feature)

### AI Enhancements
- [x] AI gating (3 calls/day free tier) ✅
- [ ] Conversation history with Sophy (multi-turn)
- [ ] Personalized prompts based on journal history
- [ ] Weekly AI-generated insights summary

### Export & Backup
- [x] Export data to JSON (Plus feature) ✅
- [ ] Export to PDF with formatting
- [ ] Scheduled automatic backups
- [ ] Import from other journaling apps

### Social/Sharing
- [ ] Share individual entries (with privacy controls)
- [ ] Practitioner shared journal view
- [ ] Anonymous community prompts

---

## 🔧 Technical Improvements

### Performance
- [ ] Lazy loading for Past Entries (pagination)
- [ ] Image compression before upload
- [ ] Offline mode with sync queue
- [ ] Background sync for entries

### Security
- [ ] Biometric lock (Face ID / Touch ID)
- [ ] App lock PIN
- [ ] End-to-end encryption option
- [ ] Auto-lock timeout setting

### Notifications
- [x] Push notification infrastructure ✅
- [ ] Daily journaling reminders (customizable time)
- [ ] WISH progress check-ins
- [ ] Coach reply notifications

---

## 📊 Analytics & Insights

### User Insights
- [ ] Journaling streak tracking
- [ ] Mood tracking over time
- [ ] Most used prompts

### Admin Needs
- [ ] In-app crash reporting (Sentry/Crashlytics)
- [ ] User engagement metrics
- [ ] Feature usage analytics

---

## 🚀 Release Milestones

### v1.0 (Current - TestFlight Ready)
- [x] Core journaling functionality
- [x] Manifest/WISH system
- [x] Sophy AI integration
- [x] RevenueCat subscriptions (Plus/Connect)
- [x] Light/Dark/System theme
- [x] AI gating (3/day free)
- [x] Export feature (Plus)
- [x] Push notifications setup

### v1.1 (Post-Launch)
- [ ] Bug fixes from TestFlight feedback
- [ ] iPad compatibility mode
- [ ] Daily reminder notifications
- [ ] Biometric app lock

### v1.2 (Growth)
- [ ] Multi-language support (Spanish first)
- [ ] Voice transcription improvements
- [ ] PDF export

### v2.0 (Major Update)
- [ ] iPad-optimized layouts
- [ ] Apple Pencil support
- [ ] Offline mode
- [ ] Advanced AI insights

---

## 📝 Notes

- **Admin Dashboard (Web)**: 
  - Basic: `https://www.inkwelljournal.io/admin.html`
  - Enhanced: `https://www.inkwelljournal.io/admin-enhanced.html`

- **Current App Status**: Ready for TestFlight testing

- **Priority Order**: 
  1. TestFlight release
  2. Bug fixes from feedback
  3. iPad basic support
  4. Multi-language (based on user requests)
  5. Apple Pencil (v2.0)

---

*Add new ideas below this line:*

