# Design Guidelines for React Authentication Application

## Design Approach: Professional Design System

**Selected Approach:** Clean, utility-focused design system inspired by modern SaaS authentication patterns (Linear, Vercel, Stripe)

**Justification:** Authentication pages prioritize security perception, clarity, and efficiency over visual experimentation. Users need confidence and ease-of-use, not creative flourishes.

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Background: 0 0% 98%
- Card Background: 0 0% 100%
- Primary: 222 47% 11% (deep slate/charcoal)
- Text Primary: 222 47% 11%
- Text Secondary: 215 16% 47%
- Border: 214 32% 91%
- Input Background: 0 0% 100%
- Error: 0 84% 60%

**Dark Mode:**
- Background: 222 47% 11%
- Card Background: 217 33% 17%
- Primary: 210 40% 98%
- Text Primary: 210 40% 98%
- Text Secondary: 215 20% 65%
- Border: 217 33% 25%
- Input Background: 217 33% 17%
- Error: 0 72% 65%

### B. Typography

**Font Family:**
- Primary: 'Inter' via Google Fonts CDN
- Fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif

**Hierarchy:**
- Page Title: text-3xl font-bold (30px)
- Section Heading: text-2xl font-semibold (24px)
- Body Text: text-base (16px)
- Label Text: text-sm font-medium (14px)
- Helper/Error Text: text-sm (14px)

### C. Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 consistently
- Form field spacing: space-y-6
- Card padding: p-8 (desktop), p-6 (mobile)
- Section margins: mt-8, mb-4
- Input padding: px-4 py-3

**Layout Structure:**
- Centered authentication card pattern
- Max width: max-w-md (28rem/448px)
- Full viewport height centering with min-h-screen flex items-center justify-center
- Responsive breakpoints: mobile-first, adjust at md: (768px)

### D. Component Library

**Form Inputs:**
- Border radius: rounded-lg (0.5rem)
- Border: 1px solid border color
- Focus state: 2px ring in primary color with ring-offset-2
- Height: h-12 for comfortable touch targets
- Font size: text-base for inputs
- Transitions: transition-colors duration-200

**Buttons:**
- Primary CTA: Full width, h-12, rounded-lg, font-medium
- Background: Primary color with white text (light mode), inverted (dark mode)
- Hover: Subtle opacity change (hover:opacity-90)
- Disabled: opacity-50 cursor-not-allowed

**Card Container:**
- Background: Card background color
- Border: 1px border in light mode, none in dark mode
- Shadow: shadow-xl (light mode), shadow-2xl (dark mode)
- Border radius: rounded-2xl (1rem)

**Navigation Elements:**
- Text links: Underline on hover, primary color
- "Already have account?" / "Need account?" links below main form
- Route switching with smooth text-sm centered below button

**Error States:**
- Display inline below input with error color
- Icon: Use Heroicons for error/warning indicators
- Border: Change input border to error color on validation failure

### E. Page-Specific Components

**Signup Page (/signup):**
- Page title: "Create your account"
- Subtitle: "Get started with your free account" (text-secondary)
- Fields: Full Name, Email, Password (in that order)
- Password strength indicator: Progress bar below password field
- Submit button: "Sign up" or "Create account"
- Bottom link: "Already have an account? Log in"

**Login Page (/login):**
- Page title: "Welcome back"
- Subtitle: "Enter your credentials to continue" (text-secondary)
- Fields: Email, Password
- "Forgot password?" link aligned right below password field
- Submit button: "Sign in" or "Log in"
- Bottom link: "Don't have an account? Sign up"

**Shared Elements:**
- Logo/Brand name at top of card (text-2xl font-bold, mb-8)
- Consistent vertical rhythm throughout forms
- Touch-friendly sizing (minimum 44px touch targets)

### F. Animations

**Minimal, purposeful only:**
- Input focus: Smooth ring appearance (transition-all duration-200)
- Route transitions: Simple fade (if using Framer Motion)
- Button interactions: opacity transitions only

### G. Accessibility

- Proper label associations with htmlFor attributes
- ARIA labels for icon-only elements
- Focus visible states with clear outlines
- Keyboard navigation support
- Error announcements for screen readers

## Implementation Notes

- Use Heroicons for minimal iconography (eye icon for password reveal, error icons)
- No background images or illustrations needed—focus on form clarity
- Maintain identical card structure between /signup and /login for consistency
- Form inputs should have clear placeholder text and proper type attributes
- Responsive: Stack full-width on mobile, centered card on desktop