# FeedWell-Edge Workflow Discipline

## Critical: AFTER EVERY CHANGE SET

### 1. Version Bump (App Code Changes Only)
When app code in `src/`, `app/`, or native files changes:
- Update `src/config/version.js` → `APP_VERSION.version` (semantic: major.minor.patch)
- Update `package.json` → `version` field
- Update `app.json` → `expo.version` field
- `package-lock.json` auto-updates via `npm install` if needed
- `android/app/build.gradle` syncs versionCode (increment by 1) and versionName

**Note**: Documentation-only changes (paper, README, guide) do NOT trigger version bump.

### 2. Documentation Review & Updates
After completing any change:
- **If paper `docs/paper/main.tex` modified**: Review for consistency with app behavior, update README and approach guide if methodology affected
- **If README modified**: Ensure approach section, efficiency targets, and workflow steps stay synchronized with codebase
- **If visual guide `docs/guide/approach-blueprint.html` modified**: Verify phase roadmap aligns with current implementation status and research direction

### 3. Paper PDF Export
Every time `docs/paper/main.tex` is edited:
```bash
cd docs/paper
pdflatex -interaction=nonstopmode main.tex
# Result: main.pdf (verify 5-page output)
```
Commit and push the updated PDF.

### 4. Android APK Build & Install
When app code changes:
```bash
cd android
.\gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```
If connected device available:
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### 5. Commit & Push (Always)
After completing steps 1-4 (as applicable):
```bash
git add -A
git commit -m "type: description

- bullet point 1
- bullet point 2"

git push origin main
```

**Commit message types**:
- `feat:` - New feature or behavioral change
- `docs:` - Documentation, paper, guide updates (no code change)
- `refactor:` - Code restructure (no behavior change)
- `fix:` - Bug fix
- `chore:` - Build, config, workflow updates

---

## Workflow Checklist Template

Use this for complex changes spanning multiple components:

```
[ ] App code modified? → Bump version in all 4 files
[ ] Paper modified? → pdflatex export + commit PDF
[ ] README/guide modified? → Verify alignment with implementation
[ ] App behavior changed? → Check if paper methodology needs update
[ ] Ready to commit? → Verify no uncommitted changes: git status
[ ] Commit message clear? → Include type (feat/docs/fix/refactor) and bullet points
[ ] Push successful? → Verify remote branch updated
```

---

## Current Project State (v2.0.2)

- **App Version**: 2.0.2 (buildNumber: 1, stage: 'RC')
- **Phase**: A (local event pipeline + lightweight continual learner)
- **Next Phase**: B (µNAS architecture search + BNN quantization)
- **Research Track**: Efficiency Cascade (target: <5MB, <50ms inference, <100ms update)
- **Git Remote**: https://github.com/SepehrMohammady/FeedWell-Edge.git
- **Git Email**: SMohammady@outlook.com

---

## Important Notes

- Never use `npx expo prebuild` (manual gradle build required)
- ADB path: `$env:ANDROID_HOME\platform-tools\adb.exe` (should be in PATH)
- LaTeX errors: Ensure `pdflatex` installed; check `main.tex` syntax if PDF export fails
- Git workflow: Always branch for experimental work; commit to main after validation
- Documentation first: Update paper/README *before* code implementation to clarify goals
