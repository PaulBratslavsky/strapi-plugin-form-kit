# Strapi Forms

## One-liner
A native Strapi plugin that lets marketing and content teams build, embed, and manage forms — from drag-and-drop creation to submission review to integrations — without leaving the Strapi admin.

## The problem
Strapi is the headless CMS of choice for modern teams, but the moment a marketing or content person needs a contact form, signup form, or survey, the experience falls apart:

- **For marketers**: there is no native form builder. They either beg a developer for a one-off implementation or sign up for a separate SaaS like Typeform or Tally — adding cost, a second login, and a disconnect from the rest of their content.
- **For developers**: every Strapi project ends up with a hand-rolled form solution — a custom collection type, a custom controller, a custom email service, a custom validation layer. It's wasted effort repeated on every project.
- **For the data**: form submissions live in a separate SaaS, disconnected from the content and audience data already inside Strapi. No single source of truth, no easy joins, no way to act on submissions in the same admin where everything else happens.

WordPress solved this a decade ago — WPForms, Gravity Forms, Fluent Forms, and Forminator turned forms into a first-class content type managed by the same people who manage the rest of the site. Strapi has no equivalent. This product fills that gap.

## The value
A marketer or content manager can:

1. **Build** a form visually inside the Strapi admin — drag-and-drop fields, conditional logic, multi-step flows, no developer required.
2. **Embed** it on the frontend — the form is exposed via Strapi's API, and there's a lightweight component / snippet that renders it on any frontend stack (React, Next.js, Astro, vanilla JS).
3. **Collect** submissions inside Strapi — every entry lives alongside the rest of the CMS data, viewable, filterable, and exportable from the admin.
4. **Route** submissions wherever they need to go — email notifications, Slack, webhooks, CRM, marketing automation tools.

Developers get the same product from the other side: every form is also a schema-defined Strapi resource. Everything the visual builder produces can be defined, version-controlled, and extended in code. No lock-in, no black box.

The "before" is: marketers ask devs for a form, devs build a custom one, submissions go to email or a separate tool, nobody has a unified view. The "after" is: a marketer ships a working form in 10 minutes, submissions flow through Strapi, and the dev team never has to touch it unless they want to extend it.

## Product category
Headless CMS plugin — specifically a **content-creation and data-collection extension** for Strapi. Sits in the same category as WordPress form plugins (WPForms, Gravity Forms) but adapted for the headless, API-first, developer-friendly world Strapi lives in.

## What success looks like
A year in:

- The plugin is **the default install** on new Strapi projects when forms are needed — the way WPForms is for WordPress.
- Strapi the company has **officially endorsed or acquired the plugin** (or at minimum lists it as a featured/recommended plugin in their marketplace).
- The Strapi community treats forms as a solved problem — nobody is hand-rolling a contact form collection type from scratch anymore.
- Marketing and content teams using Strapi have a tool they actually like, not a workaround they tolerate.
- Developers see it as native enough that it feels like part of Strapi itself, not a third-party bolt-on.

## Why this can win (drawing from WordPress lessons)
The WP form plugin market shows what matters:

- **Visual builder + templates** is table stakes — WPForms, Fluent Forms, Forminator all win on this.
- **Conditional logic and multi-step** are the features that separate "toys" from "real tools."
- **Integrations are the moat** — Zapier/webhooks plus a few first-class native integrations (email, Slack, the top CRMs) is what people pay for.
- **Performance matters** — the plugins that win don't bloat the host site. For Strapi, this means clean APIs and a tiny frontend runtime.
- **Free tier with paid upgrades** is the proven business model — Forminator and WPForms Lite both demonstrate this works.

The Strapi-specific edge: because Strapi is API-first, forms become *data* in a way they can't on WordPress. That's a structural advantage worth leaning into.
