# Lumen Design & Product Guidelines

## 1. Visual Identity & Design Principles

Lumen is designed to foster deep focus, clarity, and intellectual calm. The interface prioritizes content readability and quick academic utility over visual noise or decorative distraction.

- **Minimalist & Intentional:** Every UI element must serve a direct functional purpose. Avoid superfluous gradients, unnecessary banners, or excessive animations that distract the student.
- **Academic Elegance:** Surfaces feel refined and tactile, mirroring modern, high-end editorial and academic tools.

---

## 2. Color System & Multi-Theme Architecture

Lumen provides native, first-class support for three distinct color palettes:

1. **Light Theme:**
   - Background: Crisp, subtle neutral whites/creams (`#F8F9FA`, `#FFFFFF`) designed to reduce glare under daylight reading conditions.
   - Text & Surfaces: Deep charcoal and ink black for optimal reading contrast.
2. **Dark Theme:**
   - Background: Soft, balanced dark charcoal (`#121212`, `#1E1E1E`) preventing eye strain during late-night study sessions.
   - Accents: Desaturated pastel hues that maintain contrast without causing halo effects.
3. **AMOLED True Black Theme:**
   - Background: Pitch-black (`#000000`) for absolute contrast and maximum battery preservation on OLED mobile displays.

---

## 3. Typography & Spacing System

- **Grid System:** Strict 8-point base grid (8dp, 16dp, 24dp, 32dp) ensuring visual rhythm across all screens and modals.
- **Typography Scale:** System fonts (San Francisco on iOS, Roboto on Android) with strict hierarchical sizing:
  - Display: 28-32sp (Bold) - Screen titles and dashboard headers.
  - Heading: 20-24sp (SemiBold) - Card headers, modal titles.
  - Body: 14-16sp (Regular/Medium) - Primary text, lists, and forms.
  - Caption: 11-13sp (Regular) - Timestamps, helper badges, microcopy.
- **Touch Targets:** Strict minimum interactive touch target of 44x44dp for all buttons, chips, calendar cells, and clock picker handles to prevent input friction.

---

## 4. Voice, Tone & Content Guidelines

- **Mentor-Like & Objective:** The tone is calm, professional, and supportive. Lumen speaks like a capable academic advisor—never condescending, overly cheerful, or alarming.
- **Actionable Error Messaging:** Never display raw system errors or cryptic codes. State clearly what happened and provide an immediate corrective path (e.g., *"Não foi possível salvar o evento. Verifique se a data final é posterior à data inicial."*).
- **Graceful Empty States:** Empty screens must never appear broken or deserted. Provide an encouraging visual hint and a prominent primary action (e.g., *"Nenhuma aula cadastrada ainda. Toque em '+' para montar sua grade horária."*).

---

## 5. Accessibility & Inclusivity (WCAG 2.1 AA)

- **Contrast Ratios:** Maintain minimum 4.5:1 contrast for normal text and 3:1 for large text across all three themes.
- **Screen Reader Readiness:** All interactive icons and buttons must include descriptive `accessibilityLabel` and `accessibilityRole` attributes.
- **Haptic Feedback:** Provide subtle tactile feedback (`Haptics.impactAsync(Light/Medium)`) for tactile controls such as the interactive clock picker, task completion toggles, and attendance counters.
