# Users & Usage

## Personas

### Maya — Agency Project Manager (primary persona, the buyer)
- **Background**: Runs delivery for 5–15 client websites at a digital agency. Manages content, marketing, and minor configuration on Strapi-powered sites. Coordinates with developers but doesn't write code herself.
- **Context**: Picks the tools her clients will use. Cares deeply about repeatability — the same patterns get applied across many client projects. Time pressure is constant; anything she can template once and reuse on the next project is gold.
- **Current workaround**: Either asks a dev to hand-roll a contact form collection type for each client (slow, custom every time), or installs a separate SaaS like Typeform/Tally and pastes an embed code (works, but cuts the client's submissions off from the rest of their Strapi data and adds a bill).
- **Tech comfort**: Comfortable with admin UIs, no-code/low-code tools, plugin marketplaces. Not comfortable writing JavaScript or editing Strapi schemas directly. Has technical vocabulary but draws the line at code.

### Chen — Client Marketer (secondary persona, the daily user)
- **Background**: In-house marketer or content lead at one of Maya's clients. Lives in the Strapi admin daily — writing posts, updating pages, managing media. Owns lead capture and audience growth.
- **Context**: Forms are mission-critical. Contact forms drive sales conversations, newsletter signups grow the list, occasional surveys inform strategy. Submissions need to be reviewed promptly and routed to the right place (sales team's inbox, Slack channel, CRM).
- **Current workaround**: Same as Maya before the plugin existed — either bug a developer or use a separate SaaS. Often reviews submissions in a Gmail folder or a Typeform dashboard, disconnected from where the actual content marketing work happens.
- **Tech comfort**: Comfortable with admin tools, drag-and-drop builders, basic conditional logic. Not a coder. Will absolutely try to build new forms herself if the UI lets her, and gets frustrated when she has to file a ticket with the agency for a simple field change.

### Devin — Developer (tertiary persona, the extender and recommender)
- **Background**: The dev who set up the Strapi project. May be at the agency or at the client. Comes back periodically to ship features and keep the build green.
- **Context**: Wants forms to "just work" so it isn't his problem. When forms *are* his problem, he wants a clean way to extend — registering custom field types from his project code, hooking into the submission lifecycle for custom integrations, defining forms programmatically rather than via UI. Lives with Claude/Cursor open in his editor every day; expects schemas and APIs to be designed for AI consumption, not just human reading.
- **Why he's also the recommender**: Even though he's the tertiary user, *he picks the plugin*. If the schema is messy, the extension surface is forked-spaghetti, or the docs assume only no-code users exist, he won't recommend it — and Maya/Chen never end up installing it.
- **Current workaround**: Hand-rolling form solutions on every project. Tired of it.
- **Tech comfort**: High. Comfortable with Strapi plugin architecture, TypeScript, REST/GraphQL APIs, webhooks, MCP servers. Will read the docs and extend the plugin if the extension surface is clean. Will absolutely use the "Copy as AI prompt" affordance to bootstrap framework-native form components in his editor.

## Jobs-to-be-done

### Maya (agency PM)
- When **starting a new client project**, Maya wants to **get the standard set of forms** (contact, newsletter, lead-gen) **built and embedded fast**, so she can **focus delivery time on what's actually unique about the client** rather than reinventing form plumbing.
- When **a client describes a form in plain language** ("we need a form to capture event RSVPs with name, email, dietary restrictions, and a plus-one toggle"), Maya wants to **type that description into the AI builder and get a working draft**, so she can **skip the field-by-field clicking** and spend her time on review and customization.
- When **a previous client's form pattern works well**, Maya wants to **clone or template it across new projects**, so she can **build on what's already proven instead of starting from scratch**.
- When **handing a project off to a client**, Maya wants to **trust the client can self-serve form changes**, so she **isn't pulled back into low-value support tickets**.

### Chen (client marketer)
- When **a new campaign needs a landing page form**, Chen wants to **build and ship the form herself in minutes**, so she **doesn't lose two days waiting on the agency** for a small change.
- When **she has a clear idea of what she needs** but doesn't want to drag-and-drop every field, Chen wants to **describe the form to the AI builder** ("a webinar registration form with name, email, company, role, and a question they want answered"), so she can **get a working draft instantly and just tweak it**.
- When **a submission comes in**, Chen wants to **see it instantly in the Strapi admin**, with **the right people notified** (sales gets leads, support gets contact-form messages), so **no leads slip through the cracks**.
- When **leadership asks "how many sign-ups this month?"**, Chen wants to **filter, search, and export submissions**, so she **can answer with data instead of a guess**.

### Devin (developer)
- When **a client needs a custom integration** (proprietary CRM, internal API), Devin wants to **hook into the plugin's submission lifecycle**, so he can **add the integration without forking the plugin**.
- When **a project needs a field type the plugin doesn't ship with** (e.g., a custom address picker, a tagged-input field, a signature pad), Devin wants to **register a custom field type from his project's own code**, so the **field is automatically available to Maya and Chen in the visual builder and the AI builder** — no plugin fork required.
- When **a project requires forms to be defined in code** (for version control, code review, environment promotion), Devin wants to **define forms programmatically** alongside the visual builder, so the **same plugin works for both teams' workflows**.
- When **building a custom-styled frontend form** for a Next.js or Astro client site, Devin wants to **use the "Copy as AI prompt" action in the admin** to get a Claude-ready prompt and generate a framework-native component in his editor, so he can **ship a polished, branded form in 10 minutes** without writing it from scratch and without being constrained to whatever the embed snippet's default styling provides.

## Primary user journey

The journey has three phases — initial setup (Maya), ongoing use (Chen), and extension (Devin). The product has to nail all three: Maya's experience drives installation, Chen's drives daily satisfaction and renewal, and Devin's drives technical recommendation and unlock.

### Phase 1 — Initial setup (Maya, agency PM)
1. **Discovery**: Maya hears about the plugin via Strapi's marketplace, agency Slack/Discord communities, or a Strapi blog post / official endorsement. She installs it on a new client project.
2. **AI configuration (one-time, optional)**: She drops in her agency's existing Claude API key (or points the plugin at a local Ollama instance the agency already runs). This is a 30-second one-time step — she may also skip it and use the visual builder only.
3. **First form**: Two paths, both work:
   - *Visual path*: She picks a "Contact Form" template, customizes it (changes the brand name, tweaks fields), and saves. ~5 minutes.
   - *AI path*: She types "build me a contact form for an architecture firm — name, email, company, project type dropdown (residential/commercial/renovation), and a multi-line message field" into the AI builder. A draft appears in the visual builder. She tweaks two field labels and saves. ~90 seconds.
4. **Embed**: She copies the embed snippet — a 2-line `<script>` tag plus a `<div data-strapi-form="contact">` — and either pastes it into the client's frontend herself (if it's a Webflow or static HTML site) or sends it to Devin for the Next.js site. The form goes live.
5. **Aha moment**: She sees the first test submission land in the Strapi admin alongside the rest of the client's content — no separate dashboard, no separate login. The notification email she set up arrives in the right inbox.
6. **Cloning**: On the next client project, she opens the plugin and either clones a template from a previous project or duplicates a saved blueprint (Pro). Setup is now closer to 2 minutes — and even faster with the AI builder for one-off variations.
7. **Handoff** (when handing off): She sets the client up with admin access and walks them through reviewing submissions, editing forms, and using the AI builder to add new ones. The handoff is uneventful — that's the win.

### Phase 2 — Ongoing use (Chen, client marketer)
1. **Daily check-in**: Chen logs into Strapi to manage content. The forms plugin shows a count of new submissions in the sidebar. She clicks through, reviews leads, marks the spam/done.
2. **Self-serve edit**: Marketing wants to add a "company size" dropdown to the lead-gen form for a new campaign. Chen opens the form in the visual builder, drags in a dropdown field, sets the options, saves. The change is live. No agency ticket required.
3. **New form via AI**: For a one-off campaign, Chen opens the AI chat builder and types "webinar registration form: full name, work email, company, role dropdown (engineer/PM/exec/other), and what they hope to learn." A draft form appears in the visual builder in seconds. She tweaks the title and the success message, saves, copies the embed snippet, pastes it on the campaign landing page. Total time: under 5 minutes — most of which was spent thinking about the campaign, not clicking field configurations.
4. **Reporting**: At month-end, Chen filters submissions by date and source, exports a CSV, sends it to leadership. Done.

### Phase 3 — Extension and customization (Devin, developer)
Devin's involvement is intermittent but consequential. He doesn't live in the plugin daily, but his choices unlock or block what Maya and Chen can do.

1. **Project setup**: Devin scaffolds the Strapi project, installs the plugin, and configures the AI provider with the team's preferred LLM (Claude API key, or a self-hosted Ollama endpoint). He commits the plugin config to the repo.
2. **Custom field type registration**: This particular client needs an "address autocomplete" field tied to their internal location database. Devin writes a small TypeScript module in the project's source tree that registers a custom field type — its config schema, its render hint, and its validation. After a restart, Maya sees "Address Autocomplete" available in the visual builder's field palette and the AI builder's vocabulary. He's done — no fork, no PR upstream.
3. **Custom integration**: The client uses an internal CRM with a proprietary REST API. Generic webhooks don't quite fit. Devin hooks into the plugin's submission lifecycle from his project code, formats the payload his CRM expects, and ships. Maya never knows it exists; she just knows submissions show up in the CRM.
4. **Framework-native frontend (when needed)**: For the high-design landing page that needs to match the brand exactly (where the embed snippet's CSS hooks aren't enough), Devin opens the form in the Strapi admin, clicks "Copy as AI prompt," and pastes the result into Claude or Cursor. He gets a Next.js + Tailwind component back, drops it into his codebase, and ships. The form posts to the same Strapi endpoint as the embed snippet would have — only the rendering layer is custom.
5. **Future (Pro phase 2 — MCP server)**: When the MCP server ships, Devin connects Claude Desktop to his Strapi instance and creates new form schemas via natural-language conversation directly from his desktop, without opening the Strapi admin at all. This is the eventual end state of the schema-first principle: the schema is so well-defined that any MCP-aware AI client becomes a valid authoring surface.

## Core loop

The plugin has **three distinct loops**, one per persona — and the product must serve all three:

### Maya's loop (project-based, recurring per client)
1. New client project starts.
2. Install/enable the plugin, configure AI provider (one-time per project).
3. Build the standard forms — visual builder for fine control, AI builder for speed.
4. Embed via the embed snippet (or hand off the schema to Devin for custom-frontend cases).
5. Ship and hand off (or continue managing).

**What pulls Maya back**: every new client project. Every time it's faster than last time. Every time a client doesn't ask her to add a field because they did it themselves.

### Chen's loop (daily/weekly, ongoing)
1. Log into Strapi admin.
2. See new submissions in the forms section.
3. Review, route, or export them.
4. Occasionally edit a form (visual builder) or build a new one (AI builder, then refine in visual).

**What pulls Chen back**: real submissions arriving every day. Real campaigns needing forms. The fact that everything is in one place — content, audience data, and submissions — instead of scattered across Strapi + Typeform + email. The fact that she can describe a form in natural language and ship it without ever filing a ticket.

### Devin's loop (intermittent, per project or per request)
1. Get a request he can't fulfill with stock features (custom field type, custom integration, custom frontend styling).
2. Open the plugin's extension surface (custom field registration API, submission lifecycle hooks, "Copy as AI prompt" affordance, or raw schema endpoint).
3. Add the extension or generate the custom code, ship, move on.

**What pulls Devin back**: every time the extension surface is clean enough that "this is the request" → "this is shipped" takes minutes instead of an afternoon. Every time he doesn't have to fork the plugin. Every time the schema is well-designed enough that Claude/Cursor produces good code from it on the first try.

## Design implications from the personas

A few things that fall out of the user picture and should carry into Stage 3 (requirements):

- **Templates and cloning are first-class**, not a "v2 feature." Maya's whole value prop depends on repeatability across projects.
- **The visual builder has to be genuinely good for Chen** — not just a dev convenience. If Chen can't add a dropdown field herself, she loses self-serve and the agency loses their handoff dream.
- **The AI builder is a force multiplier for both Maya and Chen** — it doesn't replace the visual builder, it accelerates onto it. AI generates a draft; the visual builder is where it gets refined and saved. The two surfaces have to interoperate seamlessly because the schema underneath is the same.
- **Submissions UX matters as much as the builder.** Chen lives in the submissions list daily. Filter, search, export, mark-as-read, and notification config all need real attention.
- **The dev extension surface matters even though Devin is tertiary** — he's the recommender. Custom field type registration must work without forking. The "Copy as AI prompt" affordance must produce prompts that actually generate good code. The schema must be designed for AI consumption from day one.
- **Schema quality is the load-bearing artifact across all three personas.** Maya's AI builder, Chen's edits, Devin's custom field types and AI-generated frontends all depend on the same canonical schema being well-designed. A messy schema breaks the whole product simultaneously.
- **Handoff is a feature.** Permissions, role separation, "this form is locked / this form is editable by the client" — agencies need control over what their clients can break.
