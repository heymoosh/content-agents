# Ruben Hassid: content library

**Handle:** @ruben (Substack Posts + Notes)
**Primary platform:** Substack
**Primary media type:** long-form text (essays) + short-form text (Notes)
**Audience size:** 910K+ subscribers
**Topic(s):** AI building, practical AI workflows
**Capture method:** Opened https://ruben.substack.com/archive and used the native "Top" sort control (archive?sort=top) to rank all 43 posts in the archive by engagement (likes/comments/restacks). Selected the 23 essays with 710+ likes (the genuine top tier of the archive, confirmed against the full ranked list) and collected their permalinks via the archive's interactive DOM. Visited each permalink directly and extracted the full rendered article text with get_page_text (verbatim, no truncation, no summarizing). Several posts (marked below) carry a "∙ PAID" tag or a lock icon in the archive; for those, only the publicly rendered text is captured and the paywalled remainder is explicitly marked `[PAYWALLED: ...]` inline rather than fabricated or guessed at. Also visited https://substack.com/@ruben to look for standalone high-engagement Notes: Substack's unauthenticated public view of that feed hard-caps at 2 rendered items (no "Top" sort exists there), so only 1 genuine standalone Note was reachable and is captured in full; this is reported honestly rather than padded to a target count (see the "Notes access note" under Note #24).
**Posts captured:** 24/30 (23 Substack Posts/essays + 1 standalone Note). Stopped short of 30 for a documented reason, not lack of effort: the top-23 list captures every essay in the 43-post archive with 710+ likes (the real top tier: engagement drops off meaningfully below that), and Substack's own login wall blocks unauthenticated access to more than 2 items of his Notes history, so a larger Notes sample genuinely was not retrievable in this session.

## Posts

### 1. Cowork. (Mar 4, 2026) [link](https://ruben.substack.com/p/claude-cowork)
**Metrics:** 2,772 likes · 1,165 comments · 267 restacks
**Opening hook (verbatim):**
> You just switched from ChatGPT to Claude. But you're still not using Cowork.
> When Claude released it, software stocks lost $830 billion in 6 days because of it.
**Promotional teaser (verbatim):**
> How to set up Claude (to level up from ChatGPT):
**Full text (verbatim):**
> You just switched from ChatGPT to Claude. But you're still not using Cowork.
>
> When Claude released it, software stocks lost $830 billion in 6 days because of it.
>
> And since I published my guide 'Claude' (my most-shared newsletter I've ever written, over +2,000 shares), people keep asking me:
>
> "I installed Claude. But how do I actually start using Claude Cowork?"
>
> If you don't code, you must master Claude Cowork now.
>
> First, you might be lost between different Claude modes. So here's a quick recap:
>
> Claude Cowork is (by far) what you must focus on right now.
>
> And that's not it.
>
> Here's the entire Claude product line, in short:
>
> Claude "Chat" → it's like ChatGPT. Probably the only one you know.
>
> Claude "Project" → it's still Claude Chat, but separated as individual Projects.
>
> Claude "Code" → massive revolution for developers to code (much) faster.
>
> Claude "Cowork" → like Claude Code but for us, knowledge workers.
>
> Claude "Skills" → teach Claude repeatable workflows. Like better Projects.
>
> Claude "Connectors" → plug Claude directly into apps like Slack, Google Calendar, Gmail, etc. It reads, writes, and acts inside the tools you already use.
>
> Claude "Plugins" → like Connectors, but you do it (you don't want that). Connectors = download from the App Store, Plugins = you upload your app.
>
> This newsletter is the full playbook of Cowork. How to set it up. How I use it every single week to write this newsletter, deliver consulting work, and research faster than I ever could alone. Also, where it falls short (I keep promising honesty).
>
> Two things before we start:
>
> 1. Save this guide and spend 30 minutes this weekend to explore Cowork.
>
> 2. Send it to anyone who still hasn't tried Cowork (or Claude).
>
> **You must forget about prompts.**
>
> You read my Claude guide. So you installed it correctly.
>
> Just a quick reminder for those who didn't read it:
>
> Go to claude.com/download. Download the app.
>
> You need a Pro account ($20/month). It's very much worth it.
>
> Open the app. Click on the Cowork tab at the top between Chat & Code.
>
> Select a folder from your computer. More about it right after this set up.
>
> Make sure to always select "Opus 4.6" and "Extended thinking".
>
> ChatGPT trained you to write better prompts. Longer prompts. Forget that.
>
> With Cowork, the game is text files. Take everything you know (your writing style, your company's rules, your best examples, your past work) and put it in text files. Drop them in a folder. Point Claude to that folder.
>
> It's kind of like having an SOP for an employee. But here, Claude is your employee. And the SOP is your "Claude Cowork" folder.
>
> The more context you give it as files, the less prompting you need. The output goes from "generic AI" to "this actually sounds like a full-time employee."
>
> Here's how to create your folder:
>
> **Step 1: Build your folder.**
>
> Create a dedicated folder for Cowork on your computer.
>
> It needs a clean, intentional space. Here's mine:
>
> ABOUT ME → a folder with 1/ "about me", 2/ "anti AI writing style".
>
> PROJECTS → live work. The projects you're building right now. The brief, the drafts, the reference material for that specific job. one subfolder per project.
>
> TEMPLATES → finished work so good you want to reuse it as a pattern. It's not the content itself, but the "perfect" structure, as templates.
>
> CLAUDE OUTPUTS → where Claude Cowork delivers finished work for you.
>
> Parent folder: CLAUDE COWORK. Inside, there are 4x folders (1-2-3-4).
>
> This keeps things organized and limits what Claude can see. Cowork has real read/write access to whatever folder you share. If something goes wrong, you want the damage contained. You must keep it tight.
>
> Now here's how to create your own core files:
>
> **Step 2: Create your core files.**
>
> You now have 4 folders within your mega "Claude Cowork" folder.
>
> Let's create the "About me" files now:
>
> File 1: about-me.md — Who you are. What you do. Your current priorities. What matters to you right now. I wrote an entire newsletter on how to do it.
>
> File 2: anti-ai-writing-style.md — Because I hate the AI style. So I made a text file on how to NEVER write like an AI. I share how to download it below.
>
> Download my 3x md files by subscribing to my newsletter for free. Do not pay for anything. Open my welcome email & you will access my Notion doc with md files.
>
> 1 - Leave your email 2 - Select "None" to not pay 3 - Open the welcome email to confirm your subscription 4 - Receive my prompt & md files entire library.
>
> If you are free subscribers already, and can't find this email, leave a comment.
>
> Quick note: a markdown file is just a plain text file with an .md extension. Open any text editor (even a Google Doc works), write your content, and save it as about-me.md instead of about-me.txt. Claude reads them better.
>
> ".md" is just a type of text file AI loves to read.
>
> One great markdown file is worth more than 50 random uploads. Don't dump everything into the folder. Be intentional about what you include.
>
> **Step 3: Set Global Instructions.**
>
> Go to: Settings → Cowork → Edit Global Instructions.
>
> It's like a persistent prompt Claude Cowork always read before.
>
> Global Instructions handle how Claude must (always) behave.
>
> Paste this:
>
> # GLOBAL INSTRUCTIONS
>
> ## BEFORE EVERY TASK
>
> 1. Read `ABOUT ME/`. No task starts without reading both.
> 2. If the task relates to a project, read everything in the matching `PROJECTS/` subfolder before proceeding.
> 3. If the task involves a content type that has a matching pattern in `TEMPLATES/`, study that template's structure first. Use the structure. Don't copy the content.
>
> ## FOLDER PROTOCOL
>
> You have three read-only folders and one write folder.
>
> ### Read-only — never create, edit, or delete anything here:
> - `ABOUT ME/` → My identity and writing rules.
> - `TEMPLATES/` → Proven structures to reuse as patterns.
> - `PROJECTS/` → My briefs, references, and finished work organized by project.
>
> ### Write folder — the only place you deliver work:
> - `CLAUDE OUTPUTS/` → Everything you create goes here. Organize with one subfolder per project, mirroring the structure of `PROJECTS/`. Create the subfolder if it doesn't exist yet.
>
> ## NAMING CONVENTION
>
> All files you create must follow this format:
>
> `project_content-type_v1.ext`
>
> Content types: Newsletter, LinkedIn Post, Brief, Deck, Report.
>
> Examples:
> - `How-To-AI_Newsletter_v1.md`
> - `EasyGen_Deck_v1.pptx`
> - `GPC_Report_v2.docx`
>
> Increment the version number if a file with the same name already exists.
>
> ## OPERATING RULES
>
> - If the brief is unclear or incomplete, use the `AskUserQuestion` tool. Don't fill gaps with generic filler.
> - Don't over-explain. Deliver the work. Save the commentary unless I ask for it.
> - Never delete files anywhere.
>
> You set this once. It runs every time. You never type it again.
>
> Combined with your context files, this means your prompts can be 10 words long and still produce work that sounds like you. With the same level of quality.
>
> Here's a prompt example:
>
> I want to write a cold DM on Linkedin to a Chief of Staff who needs an AI workshop.
>
> I will DM her on Linkedin, and I need to have a clear strategy to make her open the message and book a call.
>
> Start by using AskUserQuestion. Develop 5x completely different strategies.
>
> Claude Cowork asked me clarifying questions, and I clicked on my answers.
>
> It works like an employee to complete the task.
>
> It takes 1-7 minutes, but I usually work somewhere else (or spin up more sessions on my browser with Claude Chat - welcome to the new world).
>
> This level of output is literally what a good employee would do.
>
> Now extrapolate to legal work, creative agencies, academic research.
>
> You might think it was "too simple of a benchmark".
>
> Alright, let's do another example. A heavy Excel file together:
>
> I want to create a spreadsheet that maps out a potential exit for my socials (if I could sell them). Start by using AskUserQuestion to be up to date with my numbers.
>
> Then and only then, create a spreadsheet with Wall Street financial model style.
>
> It plans itself. It finds error itself. It fixes itself… while I work on something else. This is the revolution I was mentioning earlier.
>
> Few question, 2 minutes. And I have a perfect start to an Excel file.
>
> **Don't prompt Claude. Let it prompt you.**
>
> This is the feature that changed how I work. And I haven't seen a single Cowork guide explain it properly.
>
> Always add this to your prompt:
>
> Start by using the AskUserQuestion tool before answering to gather enough context.
>
> When you do this, Cowork generates an interactive form. Actual buttons. Clickable options. Multi-select choices. Rankings you can drag and reorder.
>
> AI is finally prompt you.
>
> Here, my prompt is literally 2 lines + my Claude Cowork folder. That's it.
>
> I often times write the answer myself. But the options give me a direction.
>
> "Nobody followed you because of your breakfast" is taken from my "about me" file. I can now build up from here.
>
> This is called AskUserQuestion. It's a tool built into Cowork. Claude forces you to be clear. It asks the right questions so it can give you the right output.
>
> **The one prompt I use for everything.**
>
> 80% of my chats with Cowork starts like this:
>
> I want to [TASK] to [SUCCESS CRITERIA].
>
> First, explore my CLAUDE COWORK folder. Then, ask me questions using the AskUserQuestion tool. I want to refine the approach with you before you execute.
>
> What happens: Claude reads your context files, generates a clickable form asking about your audience, your goals, your preferences. You click through in under a minute. Claude shows a plan. You approve. It executes — creating real files in your folder. If something's off midway, you interrupt. Claude recalibrates with a new form. Picks up where it left off.
>
> The entire process feels like directing someone smart instead of wrestling with a text box. I'm obsessed with this feature.
>
> (Yes, I stopped writing prompts. My prompt folder is collecting dust.)
>
> I even added a "Text Replacement" on my Mac so that whenever I am typing the command "/prompt" it pastes this one prompt:
>
> If you use a Mac, search for "Text replacement". Click on the "+" and simply add a command (I like /prompt) and paste my prompt template.
>
> **How to use Plugins inside Cowork.**
>
> Remember that $830 billion stock crash I opened with?
>
> Anthropic released 11 official plugins. Sales. Marketing. Legal. Finance. Data analysis. Product management. Customer support. Each one gives Claude specific skills, workflows, and slash commands for that function.
>
> Legal software lost so much value because Claude can do the work. And the plugins sitting in your Cowork sidebar are a big part of what triggered that reaction.
>
> You don't need to be technical to install it. I promise.
>
> How to install:
>
> 1. Open Cowork.
>
> 2. Click Customize in the left sidebar → Browse plugins.
>
> 3. Pick one that matches your work. Install.
>
> 4. Type / in the chat to see available slash commands.
>
> What this looks like in practice:
>
> Marketing plugin
>
> The prompt: /marketing:draft-content → "Write a LinkedIn post about [topic]. Use my voice profile. Target [audience]."
>
> What happens: Claude reads your about-me.md, drafts a post that actually sounds like you, and suggests hook variations. You pick one, edit, post. Five minutes instead of thirty.
>
> Data plugin
>
> The prompt: /data:explore → Drop a CSV into the folder.
>
> What happens: Claude summarizes every column, flags anomalies, suggests analyses, and can build an interactive dashboard. It writes SQL in plain English. You don't touch a formula.
>
> Legal plugin
>
> The prompt: "Review the NDA in this folder. Flag anything unusual or one-sided."
>
> What happens: Claude reads the contract, highlights risky clauses, explains each one in plain English, and suggests alternative language. This is what wiped $285 billion off the stock market.
>
> **Connectors: Claude, inside your tools.**
>
> Cowork can also connect to your existing tools. Slack, Google Drive, Notion, Figma, and 50+ others. They're called Connectors.
>
> Go to Settings → Connectors. Browse the directory. Click "Add." Done.
>
> Once connected, it reads your tools. Claude can search your Slack messages, pull from your Google Docs, or reference your Notion pages mid-conversation.
>
> Here's an example with Gamma.
>
> Oh, and I forgot - connectors are free.
>
> **How I actually use Cowork every day.**
>
> I don't use anything else these days.
>
> Use case 1: Writing this newsletter.
>
> The setup: My folder has my about-me.md, my anti-AI-writing-guide.md, past newsletters that performed well, reference guides from other creators, and official documentation from companies (like OpenAI/Anthropic/Google).
>
> The prompt:
>
> I want to write my next newsletter on using Gemini to grow on Linkedin with infographics using the new Nano Banana 2.
>
> First, explore my CLAUDE COWORK folder. Then, ask me questions using the AskUserQuestion tool. I want to refine the approach with you before you execute.
>
> What happens: Claude reads every file. Generates a form asking about my audience, my tone, what length, what angles the other guides missed. I click answers. It produces an outline. I push back on weak sections. It adjusts. Then it writes — and because it has my voice profile and anti-AI writing guide, the output actually sounds like me.
>
> I edit. But the heavy lifting is done. This newsletter you're reading right now was outlined by Cowork and written by me. But you don't care and you keep reading :)
>
> *look, he used an em-dash, it must be AI!!! no i did it on purpose.
>
> Use case 2: Consulting deliverables.
>
> The setup: Client sends a brief. I drop it in the folder next to my templates and past deliverables.
>
> The prompt:
>
> A client just sent a brief for a 2026 AI adoption strategy. The brief is in /projects/client-x/.
>
> Read the brief, my deliverable template, and my past examples.
>
> Create a first draft as a .docx. Ask me questions first (AskUserQuestion).
>
> What happens: Claude reads the brief. Compares it to my template format. Then it asks me things I didn't think of — "Should this include a timeline or just recommendations?" and "Do you want competitor examples or keep it internal?" I click answers. It creates a .docx file directly in my folder.
>
> Use case 3: Research and competitive analysis.
>
> The setup: I drop 3-5 competitor articles or reports into a subfolder.
>
> The prompt:
>
> I uploaded 4 newsletters from other creators covering Claude Cowork. Read all of them.
>
> Create a comparison table: what each one covered, what they missed, and where I can be the only one saying something new. Ask me questions first.
>
> What happens: That used to be a junior job in my company. Now it's a prompt.
>
> Use case 4: Automated weekly briefing.
>
> This one is different. Cowork works without you even being there.
>
> The setup: You create a folder called /weekly-briefings/.
>
> The prompt (with /schedule, it's a plugin):
>
> Every Monday at 7am, research [competitor names] for news, product updates, or pricing changes. Save a summary to /weekly-briefings/ as a markdown file. Only include items from the past 7 days.
>
> What happens: Cowork runs automatically every Monday, as long as your computer is awake and the app is open. You wake up to a briefing doc ready to read. That's the endgame.
>
> Across all four use cases, the pattern is the same. I never write a long prompt. I write a short task, point to my folder, and say "ask me questions."
>
> The workflow is always the same. Only the context changes.
>
> **Where Cowork falls short (I promised honesty).**
>
> It eats your usage fast. A single Cowork session can burn through what would normally be dozens of regular chat conversations. On the Pro plan ($20/month), you'll feel it within a week if you use it daily. If Cowork becomes your main workflow, consider Max ($100/month). I'm being direct about this because I don't want you surprised.
>
> It's still a research preview. Anthropic says this explicitly. It can make mistakes. It can misread files. It sometimes takes an odd approach to a task when a simpler one would work. You need to review what it produces. Don't send a client deliverable without reading it first.
>
> It needs the app open. Close the Claude Desktop app, and the session dies. There's no mobile version. No web version. Cowork only runs inside the desktop app on macOS or Windows.
>
> It's not for quick questions. If you want to ask "what's the capital of France," use Chat. Cowork is for tasks, not trivia. It's designed for multi-step work.
>
> Agents can be hit or miss. For complex tasks, Cowork breaks the work into parts and runs them in parallel using multiple agents. Most of the time, it's fast and accurate. Sometimes one agent goes in a weird direction, and the final output has a section that doesn't match the rest. Keep an eye on it. Happens 10% of the time.
>
> Cowork is not the best at everything. But it's getting better every week.
>
> And if this is Claude Opus 4.6 + Cowork, I can't imagine Claude 5, Claude 6…
>
> **Your first 30 minutes with Cowork.**
>
> Open your calendar. Book 30 minutes with yourself, this newsletter, and Claude.
>
> Minutes 0–5: Install and open Cowork.
>
> → Go to claude.com/download. Download the desktop app.
>
> → Sign in with your Pro account ($20/month. Or $17/month if you pay annually).
>
> → Open the app. Click the Cowork tab at the top.
>
> → You're in.
>
> Minutes 5–10: Build your context folder.
>
> → Create a folder on your computer called "Claude-Cowork." Inside it, create four subfolders: ABOUT ME, TEMPLATES, PROJECTS, CLAUDE OUTPUTS.
>
> → In the context folder, create your first file: about-me.md. Write three things: (1) What you do for work. (2) How you like to communicate. (3) One example of writing you're proud of. Paste it in.
>
> → No time to write it yourself? Skip to minute 10 and let Cowork create it for you.
>
> Pro tip: Instead of typing, use Wispr Flow to talk. It's 4x faster.
>
> Minutes 10–15: Start your first Cowork conversation.
>
> → In Cowork, click Add Folder and select your Claude-Cowork folder.
>
> → Make sure to select Opus 4.6 + Extended thinking for the smartest AI.
>
> → Type: "I want [task] for [success criteria]. Go through my folder first, and use AskUserQuestion tool so you gather enough content before executing."
>
> → Watch what happens. A form appears. Click answers. Let it create your context files.
>
> Minutes 15–20: Install a plugin.
>
> → Click Customize in the sidebar → Browse plugins.
>
> → Pick one that fits your work. Good starters: Productivity (tasks and workflows), Marketing (content drafting), or Sales (prospect research).
>
> → Click to install. Start a new conversation with the plugin active.
>
> → Type / to see what slash commands are available. Try one.
>
> Minutes 20-30: Create a tough deliverable.
>
> → Give Cowork a task you'd actually need for work this week.
>
> → Type: "Create a [report / deck / document] based on the files in this folder. Ask me questions first."
>
> → Watch it create a real file. Open it. Edit it. Use it.
>
> → Optional: be amazed.
>
> **I don't care about Claude.**
>
> I don't care about Claude, ChatGPT, Grok, Gemini, or any other model.
>
> I don't pick sides. I'm not paid to make this newsletter.
>
> I'm sharing, twice a week, how my work is transforming (very fast) with AI.
>
> As I'm trying to keep up, I want you to keep up. So we move just as fast.
>
> I want to be the greatest filter to the AI noise. And 338,000+ people read this twice a week to focus on the How. Some came because of my LinkedIn. But most readers subscribed because someone they trusted sent one of my articles to them.
>
> If this article helped you, be that person for someone else (and share it).
>
> It does not cost you anything to share. And sharing is caring :)
>
> archive of my past blogs: https://docs.google.com/document/d/1pWuMCBVQo1zKcgKltX_BZxAr31KgxmOlp3Vzvmc5Hxc/edit?usp=sharing
**Structure:** Problem-callout hook (you switched but aren't using the real tool) → stat-shock proof point ($830B stock drop) → mode taxonomy (recap of the whole product line) → numbered step-by-step setup guide → named sub-features each with a bolded mini-headline, a "the prompt" / "what happens" example pair, and a concrete numbered use-case list → an honesty section listing limitations → a literal timed "first 30 minutes" checklist → closing personal-brand statement ("I don't care about Claude") and share CTA.
**Framing:** Practical mentor/operator voice: positions himself as the person who already did the work and is handing over the exact folder structure, prompt text, and settings. Heavy use of concrete artifacts (literal prompt text in blocks, screenshots referenced, file names) so the reader can copy-paste rather than interpret. Self-aware asides (the em-dash joke) preempt "this sounds AI-written" pushback. Ends every major section with a bare "Subscribe" CTA break in the source (platform mechanic, not authored copy).

### 2. Cowork. (Apr 8, 2026) [link](https://ruben.substack.com/p/claude-cowork-20)
**Metrics:** 2,535 likes · 3,395 comments · 262 restacks
**Opening hook (verbatim):**
> I've been begging you to switch from ChatGPT to Claude for months.
> since December*
**Promotional teaser (verbatim):**
> If you don't code, you must know Claude Cowork:
**Full text (verbatim):**
> I've been begging you to switch from ChatGPT to Claude for months.
>
> since December*
>
> So I wrote countless Claude guides, getting millions of reactions.
>
> But only recently, everyone actually switched:
>
> Claude (Anthropic) adds $323.5 million in ARR per day. PER DAY. It's now bigger than ChatGPT (OpenAI) in terms of revenue.
>
> Claude is all the rage right now because of Cowork: it's the best thing to happen to AI since ChatGPT. If you don't code, you must be using Claude Cowork now.
>
> Some of you read my guide in March, and spent an hour setting up Cowork:
>
> That was my Cowork set up in March.
>
> That's a good start.
>
> But you're using it the way I taught you on March 5.
>
> And a lot has changed since then. This free guide shows you exactly what & how.
>
> Before starting, I want you to do two things:
>
> Save this guide & block 20 minutes this week to test Cowork.
>
> Send it to anyone who still hasn't tried Cowork (or Claude).
>
> **Skip this if you already use Claude Cowork.**
>
> Quick reminder on how to access Claude Cowork:
>
> Go to claude.com/download. Download the app on your computer.
>
> You must have a Pro account ($20/month). I pay for the $100/month plan.
>
> Open the app. Click on the Cowork tab at the top between Chat & Code.
>
> Select a folder from your computer. More about it right after this set up.
>
> Make sure to always select "Opus 4.6" for complex tasks. It's the smart model.
>
> **I - My Cowork folder (updated).**
>
> Claude Cowork is all about how you set up your folder inside your computer.
>
> Because each session on Cowork starts like this:
>
> Claude Cowork works inside your computer, in your folder. I spent two months figuring out the best set up for this folder. Here's how:
>
> Here's how I set this up.
>
> Create a new folder on your computer named Claude Cowork.
>
> Copy this folder structure: 3 subfolders inside the Claude Cowork.
>
> (1) ABOUT ME (2) OUTPUTS (3) TEMPLATES.
>
> I have (1) a Claude Cowork folder, with inside (2) About me (3) Outputs from Claude and (4) Templates. Inside About me, I have 3 core files.
>
> Let's start with the ABOUT ME folder - the most important one.
>
> Step 1: Three core files in the ABOUT ME folder.
>
> These are the only files Cowork reads automatically. The other two folders (OUTPUTS & TEMPLATES) are just here in case you need them for later.
>
> File #1 — about-me
>
> Who you are. How you think. How you want Claude to write for you.
>
> A few months ago, I wrote an extremely long and complex about-me file. I asked Claude to interview me through 100 questions. But that single file was eating 22,000+ words of Cowork's context window.
>
> In simpler terms, Claude had to read too much before answering.
>
> So I trimmed it to under 2,000 words by extracting the patterns and throwing away the raw transcripts. Almost the same, but 10x less noise.
>
> IF YOU ALREADY HAVE IT, trim it. Here's how:
>
> Go to Claude Cowork. Upload your previous about-me file.
>
> Then simply asked Cowork this prompt:
>
> This is my about-me file and I need to save tokens.
>
> Ask me questions on how to trim effectively until we have the perfect document.
>
> NOW IF YOU DON'T HAVE ANY FILE, here's how to make yours from scratch:
>
> 1 - Open a new Cowork session.
>
> Go to the Claude desktop app. Use Cowork (need paid plan). Click New task. Make sure to select Opus 4.6 + Extended thinking for the smartest model.
>
> 2 - Prompt it:
>
> You are building my about-me.md file for my Cowork folder. This file will be read by Claude at the start of every session to help you do my job with me. It needs to be concise and high-signal.
>
> Your job: interview me using AskUserQuestion (20 questions), then compile the answers into a condensed about-me.md under 2,000 tokens.
>
> ## How to interview me
>
> Use AskUserQuestion for every question. One question at a time. Let me use "Other" to dictate long answers when I need to.
>
> If I give a vague answer, push back. Ask for a specific example or rephrase. Don't accept "I like to keep things clear" without knowing what clear looks like in my work.
>
> Follow interesting threads. If something unexpected comes up, go deeper before moving on.
>
> ## What to cover (15-20 questions, adapt based on what matters for my role)
>
> WHO I AM (3 questions)
> - What do I do? What's my role, my company, my industry?
> - Who do I work with or work for? (clients, team, stakeholders, audience)
> - What does a good week of work look like for me?
>
> HOW I WORK (4 questions)
> - What tools do I use every day and how?
> - Walk me through how I start a typical task from zero to done.
> - What does my review/editing/QA process look like?
> - When I hand something off (to a client, a boss, a reader), what does "done" look like?
>
> WHAT GOOD LOOKS LIKE (4 questions)
> - Show me or describe the best output you've produced recently. What made it good?
> - What separates great work from average work in your field?
> - When you look at someone else's work and think "this is good," what are you reacting to?
> - If I had to judge your work, what should I be looking for?
>
> WHAT YOU HATE (4 questions)
> - What's an example of bad work in your field? What specifically makes it bad?
> - What patterns, shortcuts, or habits in your industry make you cringe?
> - When Claude writes something for you and it's wrong, what's usually off? (tone, structure, detail level, assumptions)
>
> YOUR RULES (3 questions)
> - What do you never do in your work? Hard lines you won't cross.
> - What are the 2-3 non-negotiables that every piece of your work must have?
>
> YOUR OPINIONS (3 questions)
> - What do you believe about your field that most of your peers would push back on?
> - What tools, methods, or trends do you think are overrated? What's underrated?
>
> ## Output format
>
> After the interview, compile everything into a single markdown file. Do NOT save raw Q&A transcripts. Extract the patterns from my answers and write them as condensed prose and bullet points.
>
> Structure:
>
> # ABOUT ME: [My Name]
>
> ## Who I am
> [2-3 sentences. My role, my work, my audience/clients. Current facts and numbers if relevant.]
>
> ---
>
> ## How I work
> [My daily tools, my process, how I start tasks, how I review, what "done" looks like. Short paragraphs.]
>
> ---
>
> ## What good looks like
> [What I value in my own work and others'. The standards I hold. Condensed from examples I gave.]
>
> ---
>
> ## What I hate
> [Patterns, shortcuts, and mistakes that bother me. What "wrong" looks like. Specific, not vague.]
>
> ---
>
> ## My rules
> [Numbered list. Hard lines and non-negotiables.]
>
> ---
>
> ## Instructions for Claude
> [10 numbered rules for how to work with me. Derived from everything above. Focus on what Claude must DO and NOT DO, not abstract principles.]
>
> Target: under 2,000 tokens total. Every sentence should carry signal. If a sentence could be cut without losing information, cut it.
>
> Save the file as about-me.md in my ABOUT ME/ folder.
>
> 3 - Click where you need to click.
>
> Click where you need to click. Or click "Something else" for specific answers. The more specific, the better! Use Wispr Flow to write faster.
>
> 4 - Dictate your answers when you need to say specific things. Make sure to use Wispr Flow instead of typing on your computer. It's free & much faster.
>
> You will end up with an about-me file that knows exactly you & your style:
>
> This is mine. Every free subscriber of my newsletter has access to it.
>
> File #2 — anti-ai-writing-style
>
> You hate AI writing. I hate AI writing.
>
> You want your taste, as a set of rules. The words you hate. The sentence patterns that make you cringe. The formatting rules you care about.
>
> Mine bans 80+ AI words (delve, harness, tapestry, the usual suspects), kills reframe patterns ("this isn't X, this is Y"), and limits paragraphs to 3 sentences. I shared the full list in my AI detection newsletter.
>
> You don't need to copy mine. But you need something here. Without it, Claude writes like Claude. With it, Claude writes like you (minus the parts you hate).
>
> If you want to copy my updated file, subscribe to my newsletter, and you will receive it for free as a gift (with tons of other stuff). If you have already subscribed to it, leave a comment on this blog, and I will personally send it to you!
>
> My free gift to subscribers looks like this, with many other resources.
>
> File #3 —my-company
>
> Your targets. Your strategy. What you're focused on. What you're saying no to.
>
> Mine has my audience targets per platform (1M Substack subs, 1M LinkedIn followers), my consulting service lines (workshops, full deployment, AI sprints, fractional chief of AI), and a "what I'm saying no to" section.
>
> I update it when something actually changes. Maybe once a quarter. Cowork doesn't need to know your Tuesday deadline. It needs to know your north star.
>
> Go to Claude Cowork, not a new session, but the same one you used for about-me (just keep prompting after), and paste this:
>
> You are building my my-company.md file for my Cowork folder. This file tells Claude what I'm working toward right now so it can make better decisions on every task.
>
> Important: my about-me.md already covers who I am, how I work, and my standards. This file is ONLY about goals, strategy, and decisions. No overlap.
>
> Your job: interview me using AskUserQuestion (6-8 questions), then compile the answers into a condensed my-company.md under 1,000 tokens.
>
> ## How to interview me
>
> Use AskUserQuestion for every question. One question at a time. Let me use "Other" to dictate long answers when I need to.
>
> ## What to cover (6-8 questions)
>
> GOALS (3-4 questions)
> - What are your top 2-3 goals for this year? Specific numbers or milestones.
> - What platforms, channels, or markets matter most right now?
> - What's the one metric that would tell you this year was a success?
> - Do you have revenue targets, audience targets, or product milestones? What are they?
>
> DECISIONS (3-4 questions)
> - What are you actively saying no to right now? (opportunities, trends, platforms, tactics)
> - What did you recently stop doing? Why?
> - Where are you spending most of your time and energy this quarter?
> - Is there anything you're betting on that most people in your field aren't?
>
> ## Output format
>
> After the interview, compile everything into a single markdown file. Short sections, mostly bullet points. No filler. No identity info (that's in about-me.md).
>
> Structure:
>
> # MY COMPANY
>
> ## Goals
> [Bullet points. Specific targets with numbers where possible. Organized by category if needed.]
>
> ## Focus right now
> [What I'm spending time and energy on this quarter. 2-3 bullet points max.]
>
> ## Saying no to
> [Bullet points. Things I'm actively declining or ignoring.]
>
> Target: under 1,000 tokens. Update this file when priorities change, not on a schedule.
>
> Save the file as my-company.md in my ABOUT ME/ folder.
>
> This file looks very different if you are a lawyer, a nurse, or a plumber.
>
> Step 2: The OUTPUTS folder for Claude's work.
>
> This is simply where Cowork will work and save his document.
>
> One subfolder per project. Cowork organizes everything itself. It never reads from this folder on its own (that would eat your token budget = you save money).
>
> But when you need to reference a past deliverable, you just say:
>
> "Read the report in OUTPUTS/project-name."
>
> it looks like this in my computer - I rarely go there but Cowork needs it
>
> Step 3: The TEMPLATES folder for Claude's best work.
>
> Cowork fills this folder automatically (more on that in a second).
>
> Templates are just your best work, so Claude can easily use them again.
>
> You don't maintain it. You don't organize it. You just point Claude to a specific template when you want to reuse a structure.
>
> How? Thanks to (better) Global Instructions.
>
> **II - How to set up Global instructions.**
>
> Your folder is not as good without global instructions.
>
> Global Instructions is a prompt that Claude Cowork always read before any task. I use it to explain how my folders work.
>
> Claude Cowork doesn't know what your files mean or when to read them unless you tell it. So go to: Settings → Cowork → Edit Global Instructions.
>
> It's like a persistent prompt Claude Cowork always read before.
>
> Paste this and change the file descriptions to match yours:
>
> I usually start my Cowork session by pointing you to my Cowork folder.
>
> Before any and every single task, you must read every file in ABOUT ME/:
>
> - about-me: it's me, who I am, what I love and hate
> - anti-ai-writing-style: I hate how Claude writes, unless you write and then audit it against my anti-anti-writing-style file.
> - my-company: where I work, my role.
>
> Never read the folders OUTPUTS/ or TEMPLATES/ unless I specifically point you to a file.
>
> Save all deliverables in OUTPUTS/ under a subfolder named after the project.
>
> If the brief is unclear, use AskUserQuestion. Don't fill gaps with filler. Don't over-explain. Deliver the work.
>
> Why this matters: Cowork reads your ABOUT ME files before every single task. If those 3 files are small (under 6,000 tokens total), it reads all of them completely. Every session. You never re-explain who you are or what you're working on.
>
> If your files are too big, Cowork starts summarizing them loosely instead of reading them carefully. Keep the files lean. The context window is for your actual task, not for your profile.
>
> Claude Cowork knows what to read first without me having to explain anything. That's the secret sauce.
>
> How templates work with global instructions.
>
> The TEMPLATES folder doesn't fill itself. When Cowork builds something you like (a report, an email, a brief), you say one sentence at the end of your session:
>
> "Save this as a template in TEMPLATES/."
>
> One simple prompt…
>
> … and it is saved automatically in your folder
>
> Claude strips the content, keeps the skeleton (sections, order, format, length), and saves it. Next time you need something similar, you say "use the template in TEMPLATES/[name of the file]" and Cowork follows the structure.
>
> I feel like you're starting to understand how effective Claude Cowork is.
>
> Actually, it's so effective that the bottleneck is not the technology… but you.
>
> **III - Your Cowork has a bottleneck. It's you.**
>
> This is a typical Cowork session:
>
> You type a prompt. 30 seconds.
>
> Cowork reads your files. 5 seconds. It generates a plan. 20 seconds. It asks you clarifying questions using AskUserQuestion. 5 seconds.
>
> Now you answer those questions. You click some options. Fine.
>
> But sometimes you need to type a custom answer (and custom answers are where the best outputs come from). So you stop. Think. Type.
>
> 60 seconds per answer. Maybe 2 minutes.
>
> Across 8 questions, that's 8-15 minutes of you being the slow part.
>
> But Cowork can read 100,000 words in 15 seconds. It can build a spreadsheet in 90 seconds. And it has to wait for you to type at 60 words per minute.
>
> But you could be faster. Because you speak at 150 words per minute.
>
> Side note ⚠️ I know it sounds ridiculous to optimizing everything for speed. But talking instead of typing has another massive benefit: it sounds natural. It's you, your voice. And your brain thinks very differently when it has to talk.
>
> Did you realize how good your ideas are, your flow is, when you're talking to a colleague about solving a problem? We want the same flow state here.
>
> How to set up Wispr flow.
>
> Quick reminder for those who missed it: Wispr Flow is a dictation tool. You hold a key, talk, release. Your words appear wherever your cursor is.
>
> Anywhere on your computer. Including inside Cowork's chat box.
>
> What makes Wispr Flow different: its accuracy.
>
> Near perfection, every single time.
>
> Wispr Flow + Claude Cowork is the perfect match to counter a common problem when using AI: you steer the conversation, and make sure you are in flow state.
>
> Instead of typing "I need a Linkedin post," you start talking "I recently found out about… and I want to share more about… but first I need to make sure that… so maybe we should start covering… and end up with… as a conclusion".
>
> 1. The initial prompt: I speak it.
>
> I say this out loud. Wispr types it.
>
> The point isn't to be faster, but we end up giving much more context when we talk (we are yappers by nature), rather than with a lazy typed prompt.
>
> And the more context, the better.
>
> 2. AskUserQuestion answers: I speak those too.
>
> Cowork generates a form. Most options I just click.
>
> But when I need to add context ("make it more direct, she's a CEO who hates fluff, and reference the ROI data from the last call"), I dictate that instead of typing it.
>
> I don't self-edit while speaking. I dump my thinking.
>
> Cowork figures out what matters.
>
> 3. Feedback and pivots: spoken.
>
> When Cowork produces something that's off, I used to type feedback like: "Tone is wrong. Make it less formal."
>
> Now I say: "The tone is too stiff. I want it to sound like I'm texting a friend who happens to run a 200-person company. Keep the data but make it casual. Only redo section 2."
>
> Spoken feedback is richer because I am a yapper.
>
> How to download Wispr Flow for free.
>
> Go to wispr.ai. Download Wispr Flow. Install it.
>
> The free tier is capped at 2,000 words/week - perfect to know if you like it.
>
> Choose your favorite keystroke to activate Wispr Flow. I personally love "Shift", the little arrow below "Enter".
>
> Go to any app, hold your keystroke (like shift) and… talk.
>
> You now type 4x faster than before. Congratulations.
>
> You get a free month when you pay for my newsletter (you don't have to).
>
> There's no "integration" to configure. Wispr types wherever you type.
>
> **IV - How to save credits in Cowork.**
>
> The $20 paid plan of Claude will give you credits (called tokens).
>
> But you will use them up very fast.
>
> At the scale of a company, saving tokens = saving thousands of dollars!
>
> This section is about saving as many credits (= tokens) as possible.
>
> 1 - Restart your conversation. Don't send a follow-up.
>
> First, Claude doesn't count messages. It counts tokens. Every time you send a message, Claude re-reads the entire conversation history.
>
> Message 30 costs 31x more tokens than message 1.
>
> When Cowork gets something wrong, you want to type "No, I meant..." and send another message. Don't.
>
> Every follow-up stacks on top of the full conversation history. Claude re-reads all of it every turn. At ~500 tokens per exchange, 20 messages burns 105K tokens. 30 messages burns 232K.
>
> Instead: click "Restart the conversation from here" on a previous message (much higher ideally so you do save tokens).
>
> At the bottom right of everyone of your prompt, you can restart from here.
>
> In Cowork you can't edit a previous message. So when something goes wrong early, start a new session with a better prompt or restart the conversation higher.
>
> It's the biggest hack!
>
> 2 - Start a fresh session every 20 messages.
>
> Long conversations are token furnaces.
>
> One developer tracked his usage and found 98.5% of tokens were spent re-reading history. Only 1.5% went to the actual output.
>
> When a Cowork session gets long: ask Claude to summarize everything, copy it, start a new session, paste the summary as your first message.
>
> There is no specific prompt, but I like this one:
>
> You keep the context. You lose the bloat.
>
> 3 - Batch your tasks into one message.
>
> Three separate prompts = three full context reloads.
>
> One prompt with three tasks = one reload.
>
> Instead of: "Summarize this article" then "List the main points" then "Suggest a headline" write: "Summarize this article, list the main points, and suggest a headline."
>
> 4 - Use Sonnet (not Opus) for quick tasks.
>
> Grammar checks, brainstorming, formatting, short answers. Sonet handles all of this at a fraction of the cost. And technically, Haiku is even cheaper.
>
> Save Opus + Extended thinking for the work that actually needs it. Drafts and simple tasks on Sonnet-Haiku free up 30-70% of your budget for deep work.
>
> Opus is smarter than Sonnet, which is smarter than Haiku. Extended thinking is smarter than No thinking. But smarter = more expensive.
>
> 5 - Keep your ABOUT ME files small.
>
> Cowork reads your folder before every single task. If your files are bloated, that's thousands of tokens burned before any real work starts.
>
> My about-me.md used to be 22,000 tokens. Now it's under 2,000.
>
> That's kind of the point of this entire newsletter. Please do it :)
>
> 6 - Spread your work across the day.
>
> This one is impossible to actually do in practice, but it works.
>
> Claude uses a rolling 5-hour window. If you burn your entire limit in one morning session, most of your daily capacity goes unused.
>
> Split into 2-3 sessions: morning, afternoon, evening. By the time you come back, your previous usage has rolled off. And avoid peak hours (5-11 AM Pacific on weekdays) when the same query costs more against your limit.
>
> Cool in theory, but I never do it ahah. If I want to work, I work. That's why I pay for the $100/month paid plan. So far, no problem (but a lot on the $20 plan).
>
> **V - Your first 20 minutes with Claude Cowork.**
>
> You read this newsletter, and want the quick and easy setup in 20 minutes.
>
> Open your calendar. Block 20 minutes this week.
>
> Bonus point: book a meeting with your team to do it together!
>
> Minutes 0-5: Set up the folder.
>
> Download the Claude desktop app (duh!) and get the paid plan ($20 or $100).
>
> Create the folder structure on your computer from this newsletter. ABOUT ME/ with your 3 files, plus empty OUTPUTS/ and TEMPLATES/ folders.
>
> For your about-me file: open a Cowork session, ask it to interview you, dictate your answers. Then ask it to condense everything to under 2 pages.
>
> For your anti-ai-writing-style file: write the words and patterns you hate. Or start with mine from the detection newsletter. Or subscribe for free to my newsletter, I will send you all of my own files as a gift!
>
> For your my-company file: your targets, your platforms, your strategy. What you're saying no to. Keep it short.
>
> Minutes 5-6: Paste the global instructions.
>
> Go to Settings > Cowork > Edit Global Instructions. Delete whatever's there.
>
> Paste the version from this newsletter. Adjust the file names if yours are different.
>
> Minutes 6-8: Install Wispr Flow.
>
> Go to wispr.ai. Download. Install. Select your favorite keystroke.
>
> When you use the keystroke and release, you can talk and it types.
>
> Now open Cowork. Start a new task. Test Wispr Flow there. It works!
>
> Minutes 8-15: Run your first voice session.
>
> Open Cowork. Speak a task: "I want you to read my folder and help me write [something you actually need this week]. Ask me questions before you start."
>
> Answer the questions by speaking. Let Cowork build it. Review the output.
>
> You'll feel the difference in the first 3 minutes.
>
> Minutes 15-20: Feel comfortable with your folder.
>
> Ask Cowork to create a template inside the TEMPLATE folder from the conversation you just had. Now go on your computer's folder, and check all of the subfolders (so you feel comfortable):
>
> ABOUT ME is all of your files that explain who you are.
>
> OUTPUTS is just for Cowork outputs. Check it just to feel it.
>
> TEMPLATES is where the templates are saved. You can use them anytime.
>
> You are a Claude Cowork pro now! in 20 minutes.
>
> **I am not paid by Claude to write this.**
>
> I don't care about Claude, or any other AI model.
>
> I don't pick sides. I'm not paid to make this newsletter.
>
> I'm sharing, twice a week, how my work is changing (very fast) with AI.
>
> As I'm trying to keep up, I want you to keep up.
>
> Remember how I have been begging you to switch to Claude in January, so you stay ahead. Well, I will continue to do so for any future upgrades.
>
> Because I want to be the greatest filter to the AI noise. And 448,000 people trust me to be their filter. Some came because of my LinkedIn. But most readers subscribed because someone they trusted sent them one of my articles.
>
> If this article helped you, be that person for someone else (and share it).
>
> Sharing does not cost you anything. And it supports my work & your team!
**Structure:** Callback-to-past-guide hook ("I've been begging you since December") → stat-shock proof (ARR/day figure) → "you set this up in March, here's what changed" reframe → numbered roman-numeral sections (I-V), each with sub-steps, literal copy-paste prompt blocks, and named files/tools (Wispr Flow) → a dedicated "credits/cost-saving" numbered-tips section → a timed "first 20 minutes" checklist → closing personal-brand disclaimer and share CTA. Near-identical skeleton to Post #1 (his recurring long-form template).
**Framing:** Same operator/mentor voice as Post #1, explicitly positioned as a sequel/update ("you're using it the way I taught you on March 5... a lot has changed"), which builds a serialized-guide relationship with repeat readers. Introduces a second tool endorsement (Wispr Flow) inside the same practical-artifact style. Ends on the identical "I don't care about Claude, I'm not paid" disclaimer beat used in Post #1, showing this is a recurring trust-building framing device across his catalog.

### 3. Claude For Dummies. (Apr 18, 2026) [link](https://ruben.substack.com/p/claude-for-dummies)
**Metrics:** 2,394 likes · 152 comments · 270 restacks
**Opening hook (verbatim):**
> 98.75% of all humans have never tried Claude.
> Not even once.
**Promotional teaser (verbatim):**
> If you never opened Claude, start here:
**Full text (verbatim):**
> 98.75% of all humans have never tried Claude.
>
> Not even once.
>
> This free guide solves this gap. Claude For Dummies.
>
> Skip this if you know Claude and have tried it.
>
> For the "pros", I added a very last section "How pros use Claude" at the end.
>
> You never tried Claude because you either:
>
> Don't really use AI.
>
> Or you just use ChatGPT.
>
> Or worst (!!!), you only use the FREE ChatGPT.
>
> This guide is the easiest way to get started with Claude.
>
> I will assume you don't know how to use AI. And by the end of this (very long) guide, you will know more than 98.75% of the world.
>
> Sounds like a good deal? Cool.
>
> Two things before we start:
>
> Save this guide. Block 10 min this week & try Claude for the first time.
>
> Send it to anyone who has never tried Claude (& still thinks it's a guy's name).
>
> PS: This newsletter grows from your shares. And I keep hitting 1,000+ shares! It's my weekly north star. Sharing is free & helps me stay laser focused on mastering AI.
>
> **1. What is Claude?**
>
> Claude is an AI you talk to.
>
> You type something, it types back. It can write, think, summarize, analyze documents, work with your files, and help you make decisions.
>
> It's made by a company called Anthropic.
>
> If you've used ChatGPT before, Claude is the same kind of thing. If you've never used any AI, Claude is a great place to start.
>
> How it actually works (in 30 seconds)
>
> You don't need to understand the engineering.
>
> But 3 concepts will save you from the most common beginner frustrations.
>
> 1 - Auto-complete at scale.
>
> Claude predicts the next word, billions of times per response.
>
> That's how all AI assistants like this work. It's pattern-matching at a speed that feels like thinking, but it's not thinking the way you do.
>
> This is why Claude sounds confident even when it's wrong.
>
> 2 - Sycophancy.
>
> Claude is trained to be helpful and agree with you (= sycophancy).
>
> Side effect: if you say something false, Claude might nod along instead of correcting you. Don't trust agreement. You are the one deciding directions.
>
> Claude repeating "You're absolutely right" even became a meme.
>
> 3 - Tokens.
>
> Claude reads and writes in chunks called tokens.
>
> A token is roughly a word. Every conversation has a limit on how many tokens fit. This is why long conversations eventually becomes too much: the memory fills up.
>
> The simplest way to explain a token is that it's roughly one word.
>
> ★ Remember. Claude is an auto-complete machine at superhuman scale. It sounds sure of itself because it's made to agree with you. It uses tokens to understand you and memorize your conversation (until it can't anymore).
>
> **2. Claude vs. ChatGPT**
>
> Everyone's heard of ChatGPT, even people who don't use it.
>
> So let's take it as the reference point.
>
> Claude and ChatGPT are the same species. You talk to both of them the same way. You can ask both of them the same questions. But they have different personalities and strengths (and trainings).
>
> Here's what's actually different:
>
> Writing voice. Claude's default writing is less AI-flavored than ChatGPT's. If you've ever noticed ChatGPT sounding like a corporate memo nobody asked for, you'll notice Claude does it better.
>
> Long documents. Claude can read a 200-page document in one go without losing track. ChatGPT has been catching up, but Claude still wins here.
>
> File work. Claude's desktop app can see your local folder (from your computer) and work with your files directly. ChatGPT can't (yet 👀).
>
> Multi-step jobs. Claude has a mode called Cowork (we'll get there in section 8) that runs tasks for minutes to hours. ChatGPT has agents. But they don't match Cowork's scope yet, and they are too technical. Cowork is simple.
>
> And here's where ChatGPT still wins:
>
> Voice mode. ChatGPT's voice experience is infinitely better right now.
>
> Image generation. Use ChatGPT or Gemini. Claude doesn't generate images.
>
> Search. ChatGPT with search feels faster than Claude with search.
>
> Research. The extended-thinking version of ChatGPT is better suited for research. Pros search with ChatGPT + Grok → and give the results to Claude.
>
> Multilangual. ChatGPT is better than Claude. But Gemini is probably even better. It depends heavily on the needed language. I assume English here.
>
> ✓ Tip. You don't have to pick one. Most people I know use both for different jobs. Claude for writing and long work. ChatGPT for voice, images, and quick search. Grok and ChatGPT for extended research. Gemini for images.
>
> Bottom line:
>
> 1 - Both AIs are average by default. What you feed them matters more than which one you pick. Your taste, your examples, your context. How to use them.
>
> 2 - Both AIs are infinitely better when you pay for them. And I am (obviously) not paid to say that. Free models are not smart enough & have too many limitations.
>
> **3. How to get Claude (and what it costs)**
>
> Go to claude.ai. Sign up with your email.
>
> Three plans exist:
>
> Free. Works in the browser. Limited messages per day. No Cowork. Good for 2 weeks of testing to decide if Claude is for you.
>
> Pro ($20 per month). Best model (called Opus), more usage, Cowork, Claude Code, Projects. Same price as ChatGPT Plus. This is where most people land.
>
> Max ($100 or $200 per month). Heavy usage of everything. For people who hit Pro's ceiling week after week. I pay $100 and use it every day without any problem.
>
> Team and Enterprise plans exist too. If your team has over 500+ employees and needs help to set up Claude for the entire org, send me 'TEAM' on Linkedin.
>
> My rule for picking:
>
> Free if you're still deciding.
>
> Pro if you plan to use Claude more than 3 times a week.
>
> Max if Pro keeps running out, or you're running Cowork on long tasks daily.
>
> ✓ Tip. Pay monthly, not annually. Test for 30 days. If you don't reach for Claude by week 3, cancel. You've lost $20, not $240.
>
> That's what the pricing table looks like. The link: https://claude.com/pricing.
>
> **4. The Three Claudes**
>
> This is where most beginners get lost.
>
> "Claude" shows up in several places. 3 of them matter.
>
> The rest you can ignore (for now), but subscribe so you don't miss the next guide!
>
> #1. Browser Claude (claude.ai)
>
> You type, you get an answer.
>
> Works on the free plan. Best for quick drafts, summaries, thinking out loud. This is the closest experience to ChatGPT. If you're brand new, start here.
>
> It's the classic chatbot experience. Works also in the browser (like Google Chrome). But the best Claude is on their app, not your browser.
>
> #2. Desktop Claude (Mac or Windows app)
>
> Same account as the browser, but installed on your computer. Why it matters: it can see your local files, and you unlock the three modes: Chat, Cowork, and Code.
>
> We are still in Chat mode, but this time on the Claude app (desktop). Pro trick: you have the menu selection with the top left button.
>
> #3. Cowork (inside the desktop app)
>
> Claude Cowork is the next level of AI.
>
> It's the best thing to happen to AI since ChatGPT.
>
> It does real work for minutes to hours while you do something else. You give it a task, it plans the steps, reads your files, writes outputs, and asks you questions along the way. Paid plans only and desktop only.
>
> Top left menu → Choose Cowork → Pick a folder so it delivers anything you want inside (presentations, PDF, docx, excels, websites… sky is the limit!).
>
> ★ Remember. Browser = ask. Desktop = ask + access to your files. Cowork = ask + access + do the work while you get coffee. Cowork is the real magic.
>
> Other surfaces exist too: the mobile app, Claude in Chrome (a browsing agent), Claude in Excel. They are (sometimes) useful once you know the basics. Not where you start.
>
> **5. How to talk to Claude**
>
> If you've never typed a prompt before, this section is for you. Five rules.
>
> a prompt is the text query you send to an AI, like:
>
> "what's the capital of France?", or any text really.
>
> Rule 1: be specific
>
> "Write me an email" is vague. Claude will give you something generic.
>
> "Write a follow-up email to a client named Sarah who missed our Tuesday call. Tone: friendly but firm. 4 sentences max." That gets you something you can actually send.
>
> The more specific your input, the more specific the output.
>
> Rule 2: give examples
>
> This is the single best thing you can do. Paste something you wrote that you liked. Tell Claude: "write like this."
>
> Claude learns fast from examples. Faster than from instructions.
>
> Rule 3: say what you want, not what you don't want
>
> "Don't make it too formal" is weaker than "write it like a text to a colleague."
>
> Tell Claude what TO do. It's always more effective than telling it what to avoid.
>
> The pro do both: what we love and what we hate, especially if Claude does it all of the time. For eg, I hate certain writing styles from Claude, so I tell him I hate it.
>
> Rule 4: start short, add detail
>
> Don't write a 500-word prompt on your first try.
>
> Start with 2 sentences. See what comes back. Then add: "make it shorter," "change the tone," "add a section about X."
>
> Building up is easier than getting it right in one shot.
>
> That's why it's a chatbot - you need to chat with it.
>
> Rule 5: if it gets confused, start a new chat
>
> Long conversations get messy. Claude's memory (the context window) fills up.
>
> When responses start feeling off, open a fresh chat and paste in the key context.
>
> A fresh start is free.
>
> ⚠ Warning. Claude will always give you an answer. That doesn't mean the answer is right. Check anything.
>
> Treat Claude as a partner, not the single source of truth of the universe.
>
> **6. What Claude is good at**
>
> This is a non-exhaustive list for absolute beginners:
>
> Writing. First drafts, rewrites, editing, adapting to your voice if you give it examples of your writing. This is where Claude shines.
>
> Summarizing. Drop a 50-page PDF into the chat. Ask for a 1-page summary with page references so you can verify.
>
> Thinking with you. Structuring a messy idea. Pressure-testing a decision. Claude is a good thinking partner if you push back on it instead of accepting the first answer. Ask it to zip, and then zap the opposite way.
>
> Working with your files. On the desktop app and in Cowork, Claude can read your local folder & create files (PPT, XCL, DOCX) directly on your computer.
>
> Long documents. Upload 200-page files, full context, nothing lost. This is Claude's biggest technical advantage. It can digest massive things.
>
> Reasoning step by step. Give it a complex question. Ask it to think step by step. It's good at breaking down problems you throw at it.
>
> I uploaded Tesla's financial statement (a 144-page PDF!!) and asked a question. Tons of stuff happened in the background. You only get the result. Need a summary? Ask for it. Need an interactive chart from these conclusions? Ask for it. When I click on "Tesla 2024 analysis", it opens a window on the right. It's a full website I can open on my Google Chrome. And yes, it's interactive too.
>
> **7. What Claude is bad at**
>
> It will save you from disappointment.
>
> Real-time information. Claude doesn't know what happened today unless it has a search tool connected. It will guess, and it will sound confident doing it.
>
> When you click on the "+", you can see the Web search button. Click on it to activate it, and it becomes blue. Now Claude has access to the internet.
>
> I prefer Grok, or ChatGPT (Extended Thinking), to search online.
>
> Precise math. Don't use Claude as a calculator for anything that matters, unless it's running code to compute the answer. It's not meant to be a math expert.
>
> Vague prompts. If you say "write something good," you'll get something generic. Claude needs specificity. You get what you give.
>
> Being a source of truth. Claude sounds authoritative even when it's wrong. Always verify facts, dates, quotes, and names.
>
> Pro tip: you can use it to argue against everything. Super useful when done right! Beware, Claude is very convincing (even when it's wrong).
>
> Image generation. Claude can read and analyze images. It cannot create them. Use ChatGPT or Gemini for that. But professionals still make images 👀
>
> Technically, you can make images if you ask Claude to code in HTML what you need (like this gastroenterology infographic for my sister).
>
> ⚠ Warning. The most common beginner mistake: vague requests by assuming Claude is some otherworld god that will solve everything. No, it's a very good employee - probably your best - that needs the direction of a boss, you.
>
> **8. The 3 words that matter**
>
> Only three.
>
> If you learn these, you'll use Claude better than 90% of the people paying for it.
>
> Token
>
> The unit Claude thinks in. Every word you type, every file you upload, every response Claude gives gets chopped into tokens.
>
> Why you care:
>
> Your usage limits are counted in tokens.
>
> A page of text is roughly 500 tokens. A long chat can hit millions.
>
> Long chats hit a ceiling because the context window is finite (in tokens).
>
> ★ Remember. A page is about 500 tokens. If Claude starts acting dumb after a long conversation, because context window is full. So start a fresh chat.
>
> Once you understand tokens, you will cheer up with us "professionals" when a new model drops and they say, "We double the token limit window".
>
> Today, you can upload the equivalent of 10 full books and Claude is still capable to process, think and execute after reading it.
>
> Cowork
>
> Cowork is Claude running for minutes to hours on your computer, doing a real task while you do something else.
>
> A concrete example. You have a folder of 40 messy invoices. Different formats. Different fonts. Some PDFs, some screenshots. You want them cleaned up, grouped by client, with a drafted follow-up email for each overdue one.
>
> I gave Cowork all of my invoices (that live in my folder called INVOICES, duh). Yes, your prompt can be this long, by the way. Cowork is connecting to my tools automatically, and even asking me clarifying questions before working. Like… a coworker.
>
> ✦ With ChatGPT: copy-paste each invoice, ask, get an answer, copy the next, repeat 40 times. An afternoon.
>
> ✦ With Cowork: open the desktop app, point it at the folder, describe the task in one sentence, walk away. Come back 15 minutes later. The folder has cleaned files, a summary spreadsheet, and 40 drafted emails. All on your computer.
>
> The entire Excel file has been generated. Every tab. Every formula. Every-freaking-thing.
>
> Cowork gets sharper when you point it at a folder that includes your context.
>
> context is information before completeling a task
>
> My folder has 3 subfolders:
>
> about-me: who you are, how you work, what you write.
>
> outputs: so that I can easily find again what Claude did in the past.
>
> templates: my favorite work with Claude, so it can do it again easily.
>
> Once that folder exists, your prompts get short. Your outputs get sharper. The prompting treadmill goes away. But this newsletter is "Claude For Dummies", so I won't give you all of the details here.
>
> Claude Code
>
> Claude running inside your terminal. Built for developers.
>
> If you don't code, you don't need it. But you'll see "Claude Code" mentioned everywhere, so now you know what it is. Cowork does 80% of what Claude Code does for non-developers, with a visual interface.
>
> Quick summary:
>
> Token = what you're paying for.
>
> Cowork = Claude working for you.
>
> Claude Code = Claude for devs.
>
> ✓ Next level.
>
> You want the full set up for Cowork? It's here.
>
> You want to master Claude Code still? Go here.
>
> I usually don't like pointing to another newsletter. Because it feels like an endless series of articles to read one after the other. But these two are of my best newsletters. So worth reading :) only when have the time!
>
> **9. The words you can ignore (for now)**
>
> You'll see these words thrown around a lot.
>
> They don't matter until you're using Claude daily.
>
> But here's what they mean in plain English, so you can stop wondering:
>
> Projects. A folder inside Claude that remembers context across chats. Nice once you're repeating the same kind of work.
>
> Artifacts. The side pane where Claude opens documents, code, or mini-apps it creates for you. You'll recognize it when you see it.
>
> Skills. Reusable prompts (instructions) you trigger by name inside Cowork or Chat. Think of them as saved workflows. For example: /negotiation.
>
> Connectors. How Claude talks to Slack, Gmail, Google Drive, Granola, Notion. Set them up when you need them. It pulls info from your apps.
>
> MCP. It's very technical, but basically, to connect stuff to Claude (Connectors are MCPs, for example). But you'll never have to do anything yourself.
>
> Plugins. Bundles of Skills and Connectors for Cowork. Like a small app store.
>
> If you skipped this section, you skipped the right section.
>
> Come back when you need it.
>
> I made a Claude Dictionary for those in need of visualization.
>
> ✓ Download all of my cheat sheets for free.
>
> You just have to subscribe to my newsletter (for free). It's a free gift too.
>
> PS: if you already subscribed and can't access it, leave a comment.
>
> **10. 10 things to try in Claude your first week**
>
> You have the map. Now here are 10 concrete things to actually do.
>
> Pick 3 this week. Each one teaches you something the last one didn't.
>
> Copy-paste 3 of your LinkedIn posts. Then ask Claude to write 3 new ones in the same voice. Then ask it to search for new topics on the web.
>
> Upload a 50-page PDF. Ask for a 1-page summary with page references so you can verify.
>
> Upload your last 5 meeting notes. Ask for a decisions log: what got decided, who owns each action, what's still open.
>
> Point Cowork at your Downloads folder. Ask what's in there and what you could safely delete.
>
> Paste a messy email thread. Ask for the 3 next actions and who owes what.
>
> Connect your Gmail to Claude. Now the same task for the messy email thread, but no need to paste anything. Claude reads your Gmail automatically.
>
> Give it a Google Doc you've been meaning to edit. Ask for a sharper rewrite with a diff of what changed and why. Be precise.
>
> Feed it a spreadsheet. Ask what patterns it notices that you might have missed. Heck, ask for a completely new spreadsheet with [what's missing].
>
> Paste a competitor's pricing page. Ask how yours compares and what's missing. You can even ask to create an HTML new version to see it live.
>
> Give it your calendar for the week. Ask what to decline, and why.
>
> ✓ Tip. Keep a note file called prompts-that-worked. Every time a prompt gives you something useful, save it. In 2 weeks you'll have a personal library worth more than any prompt pack you could buy. Soon, you'll turn them into Skills.
>
> **11. Your test drive**
>
> You don't have to change anything. You don't have to cancel ChatGPT.
>
> Just pick one of these two paths tonight.
>
> The free path (no payment, no commitment)
>
> Go to claude.ai and sign up.
>
> Paste something you wrote recently.
>
> Ask Claude: "Rewrite this in the same voice but sharper, and tell me what you changed and why."
>
> Run the same prompt in ChatGPT.
>
> Compare. Make up your own mind.
>
> The Cowork path ($20 for 1 month)
>
> Go to claude.ai and sign up.
>
> Upgrade to Pro ($20).
>
> Install the desktop app (Mac or Windows).
>
> Open Cowork.
>
> Point it at a folder you care about. Your Downloads. A stack of PDFs. Your client notes.
>
> Ask it: "Look through this folder, tell me what's in it, and suggest 3 useful things you could do with it."
>
> Watch. Don't type again. Let it work.
>
> If, after either test, you don't see why Claude's the best, cancel Pro, no hard feelings, go back to whatever you were using.
>
> Because most people reading this guide will feel smarter for 20 minutes and never open Claude. Don't be that person. Open it tonight.
>
> Be part of the 1.25% who (actually) tried Claude.
>
> **How pros use Claude.**
>
> I did my best to stay as simple as possible.
>
> For all the new people trying Claude for the first time, you can stop the newsletter here. Thanks for reading! If you enjoyed it, share it with your team, your mom, your butcher, your dog. Anyone who needs to start with Claude.
>
> …
>
> And if you are still here, let's forget "for dummies" for a minute. I wanted to show you what pushing Claude to its limit (without coding) looks like in practice.
>
> Because this newsletter is called How to AI.
>
> It all starts with the simplest prompt
>
> The pros don't write prompts. They have skills.
>
> I just typed the command /negotiation-prep and a one-liner. This is the entire prompt. And you will, it triggers a LOT of stuff. It went on my Granola (meeting notes), Gmail (emails), Drive (Google docs & contracts), Slack (messages) to get every piece of information needed. It pulled so much information that it had to stop, and I had to say Continue. It is still working autonomously. I am writing content as I'm waiting.
>
> I had to blur the image. I clicked on the Q&A generated by Claude.
>
> in total, I only typed 1 prompt and clicked on some Q&A Claude asked me… And I now have two drafts ready. If I select one, it will already be in my Gmail, with the right people CC'ed. You don't believe me?
>
> Claude literally asked me if I wanted to.
>
> Ok wait. What just happened?
>
> In short:
>
> I have a Claude Skills that knows exactly how I negotiate.
>
> I then asked Claude to use the skills /negotiation-prep with GPC.
>
> Claude went on Granola, my notetakers, to read every single meeting I had with (1) my lawyers (2) my future partners.
>
> Claude then went to Gmail to extract all of our discussions AND contract drafts AND partnership agreement AND whatever we sent to each others.
>
> Claude then went on Slack to check our latest discussions.
>
> Claude then aggregated everything, with its own timeline, to understand what's at stake, what's needed, and at which stage I am in the negotiation.
>
> Claude then (finally) asked me some questions about the deal itself.
>
> Yes, you read that right. Claude asked me to click on a Q&A Claude generated, for me. Basically, Claude is the one prompting me.
>
> Claude then created two potential drafts, a soft and an aggressive one, assuming it would create a thread between my partners and my lawyer (it was part of its Q&A, so it just executed what I asked).
>
> Claude ends up asking me to pick one, so it can create a Gmail draft inside my own Gmail. Magic.
>
> And it's executing. Going inside my Gmail and working for me at lightspeed. And it's there.
>
> I believe you now understand Claude is much more than what you think.
>
> And remember. It is the worst it has ever been. Ever.
>
> **Where to start.**
>
> You can't master Claude in one day.
>
> Instead, book 20 minutes this week & open this newsletter.
>
> Download the Claude app to start.
>
> Play with the Chat mode first. Try to copy your voice.
>
> Pay for one month of the $20 plan to get Claude Cowork.
>
> Ask for a tough deliverable. An Excel, a PDF, an HTML, something.
>
> Be amazed. Start your rabbit hole journey on how to master it completely.
>
> PS: This newsletter is growing because you guys are sharing it.
>
> On every one of my free articles, I get over 1,000+ shares!! It keeps it free.
>
> The best kind of share is to your colleagues, on your group chat (on Teams or Slack). You're helping them save tokens, and you help me spread the word!
**Structure:** Shock-stat hook (98.75% never tried Claude) → explicit reader-segmentation ("skip this if...") → numbered 1-11 curriculum structure (What is Claude → vs ChatGPT → pricing → the three surfaces → prompting rules → good-at/bad-at lists → glossary of "3 words that matter" → glossary of ignorable jargon → a 10-item first-week checklist → a two-path "test drive" CTA) → a bonus "How pros use Claude" case-study coda walled off after an explicit "you can stop reading here" break, showing a worked real example (negotiation-prep skill chaining Granola/Gmail/Drive/Slack) → closing action checklist and share CTA.
**Framing:** Total-beginner-onboarding framing ("For Dummies" literal structure) stacked with a hidden advanced-reader reward at the end: serves two audience segments in one document without fragmenting the piece. Recurring "★ Remember" / "✓ Tip" / "⚠ Warning" callout labels function as a consistent skimmable pattern-language across his essays. Positions competitors (ChatGPT, Gemini, Grok) evenhandedly rather than dismissively, reinforcing his "I don't pick sides" credibility framing.

### 4. Claude. (Feb 17, 2026) [link](https://ruben.substack.com/p/claude)
**Metrics:** 2,231 likes · 292 comments · 226 restacks
**Opening hook (verbatim):**
> The people I talk to every day quietly switched.
> The creators I follow. The teams I consult for. The founders in my DMs. One by one, they stopped opening ChatGPT. And they all moved to the same place.
> Claude.
**Promotional teaser (verbatim):**
> How to set up Claude the right way (so you actually stop going back to ChatGPT).
**Full text (verbatim):**
> The people I talk to every day quietly switched.
>
> The creators I follow. The teams I consult for. The founders in my DMs. One by one, they stopped opening ChatGPT. And they all moved to the same place.
>
> Claude.
>
> See, I've been writing about AI for three years. Thousands of posts and hundreds of millions of views. So people often ask me, "Ruben, I've seen your newsletter about [tool], but do you really use it?" If I write about it, I do use it.
>
> And right now, in February 2026, Claude is the single most important AI tool for anyone doing knowledge work. Not because it's perfect (it's not, and I will share where it falls short). But because what it does well, nothing else comes close.
>
> This is the guide I wish someone gave me before I wasted months on the wrong AI. Every feature. Every install step. Every first prompt.
>
> Save this guide and spend 30 minutes this weekend to master Claude.
>
> Send it to anyone asking you, "I keep hearing about Claude, but I never tried it".
>
> **Claude is not one tool. It's six.**
>
> You think Claude is "like ChatGPT but from Anthropic." A chatbot. A text box. You type, it responds. That was true in 2024. In 2026, Claude is six things:
>
> Cowork (a desktop app that works on your actual files)
>
> Model (most of you use the wrong Claude)
>
> Excel (an AI inside your spreadsheets)
>
> Plugins (turn Claude into a specialist for your exact job)
>
> Artifacts (interactive outputs you can use, not just read)
>
> Projects (persistent context folders that remember everything)
>
> I ranked them from most to least important.
>
> **1. Claude Cowork**
>
> What it is (in 10 words):
>
> Kind of like ChatGPT, but much better.
>
> Why does it matter:
>
> Claude Cowork lives on your computer. It reads your files. It creates documents. It builds spreadsheets. It writes code you'll never see to answer you. It asks you questions when it needs clarity (instead of guessing wrong).
>
> Cowork is the Claude Code of knowledge workers. Yes, Claude Code is not on my list because my audience (myself included) does not code. But it's just as good.
>
> How to install Cowork:
>
> Go to claude.com/download. Download the app.
>
> You need a Pro account ($20/month). Or $17/month if you pay annually.
>
> Open the app. Click the Cowork tab at the top.
>
> Select a folder from your computer. This is how Claude reads your files.
>
> Pro tip: create markdown files about you - or anything you want.
>
> Made a full guide on how to use Cowork here.
>
> Your first prompt:
>
> I want to [YOUR TASK] so that [WHAT SUCCESS LOOKS LIKE].
>
> First, read the uploaded files completely before responding.
>
> DO NOT start executing yet. Instead, ask me clarifying questions (use AskUserQuestion) so we can refine the approach together step by step.
>
> Only begin work once we've aligned.
>
> The key is to force Cowork to ask you questions.
>
> It starts generating a form to prompt you to get better answers from Claude.
>
> I'm obsessed with this feature. I don't even need to be clear anymore. Claude forces me to be clear. And if I feel like we're not going in the right direction, I say it. Claude Cowork will generate a new form to build up on the mistakes.
>
> And with over 1,000,000 token context window (its ability to reason with a lot of text from your conversation), I never felt like Cowork was hallucinating.
>
> The mindset shift (if you're coming from ChatGPT):
>
> ChatGPT trained you to write better prompts. Longer prompts. Cleverer prompts. You have a folder of saved prompts you haven't opened in weeks.
>
> Forget that.
>
> With Claude Cowork, the game is text files.
>
> Take everything you know (your writing style, your brand rules, your best examples, your past work) and put it in .md or .txt files. Drop them in a folder. Point Claude to that folder. Here's how:
>
> Claude reads your files before responding. The more context you give it as files, the less prompting you need. The output goes from "generic AI" to "this actually sounds like my work."
>
> Now, pro tip: don't just upload hundreds of texts. Be mindful of both the quantity and quality of what you upload. It takes time to do it at first (writing these text files), but it compounds with time since you stop prompting.
>
> 1- You write the best md. files (like briefs for your team)
>
> 2- You start all of your prompts to Claude with "Read this & then ask me questions to do [task]." I simply stopped prompting differently.
>
> I wrote a full guide on how to create your own text file here. Start there.
>
> **2. Use the right Claude**
>
> Opus + Extended.
>
> Right now, the model you want is Opus 4.6. It dropped on February 5, 2026. It's the smartest model available. Period. For writing, thinking, analyzing, planning, anything that requires reasoning.
>
> How to set it up:
>
> Open any Claude chat (on claude.ai or Cowork).
>
> Click the model selector dropdown at the bottom of the chat.
>
> Select Opus 4.6 + Extended Thinking.
>
> Do not forget to turn on Extended Thinking. It forces Claude to think first. Like an internal monologue you would have before answering. Big difference.
>
> About internet access.
>
> Claude can connect to your tools. Slack, Google Drive, Notion, Figma, and 50+ others. They're called Connectors.
>
> Go to Settings > Connectors. Browse the directory. Click "Add." Done.
>
> Once connected, Claude can search your Slack messages, pull from your Google Docs, or reference your Notion pages mid-conversation. No copy-pasting. No screenshots. It reads your actual tools. This is free on all plans.
>
> **3. Claude in Excel**
>
> What it is (in 10 words):
>
> An AI inside your spreadsheet that creates/reads formulas.
>
> Why it matters:
>
> You've tried uploading an Excel file to ChatGPT before. I know you have. And ChatGPT flattened everything into text. Formulas disappeared. Structure gone. It gave you advice about cells that didn't exist.
>
> Claude in Excel is different. It lives inside your spreadsheet. It reads every tab. It knows what D14 actually contains.
>
> How to install (takes 3 minutes):
>
> Open Microsoft Excel (desktop or web). You need Excel 2016 or later.
>
> Go to Insert > Get Add-ins (Windows) or Tools > Add-ins (Mac).
>
> Search "Claude by Anthropic." Look for the official one with the Claude logo.
>
> Click "Add" or "Get It Now."
>
> Sign in with your Claude account.
>
> Press Ctrl+Option+C (Mac) or look for the Claude icon in your ribbon.
>
> You need a paid Claude plan (Pro, Max, Team, or Enterprise). The add-in itself is free. I made an entire guide on Claude Excel if you want more info.
>
> Your first prompt:
>
> Open any spreadsheet you're working on. Then ask:
>
> Give me a summary of each tab.
>
> Then get specific:
>
> 1. "Explain what the formula in cell B12 does in plain English."
>
> 2. "Find all #REF and #VALUE errors in this workbook."
>
> 3. "Convert all dates to YYYY-MM-DD format."
>
> 4. "Create a pivot summary of monthly revenue by product category."
>
> Claude highlights every cell it touches. You see exactly what changed. Nothing happens without your approval.
>
> Start an Excel from scratch:
>
> Go to Claude Cowork.
>
> Prompt it:
>
> Create a professional Excel spreadsheet (.xlsx) for: [PURPOSE]
> Context: [WHO IS IT FOR / HOW WILL IT BE USED]
> It should cover: [LIST WHAT YOU WANT TO TRACK OR CALCULATE]
>
> Rules:
> - Use Excel formulas (SUM, SUMIF, IF, etc.) — never hardcoded calculations
> - Put editable assumptions in their own labeled cells
> - Freeze top row, auto-fit columns
> - [ANY EXTRAS: charts, dropdowns, conditional formatting, specific currency, etc.]
>
> Here's a prompt example (yes, I asked Claude to make it):
>
> Create a professional Excel spreadsheet (.xlsx) for: a 3-year financial plan for a LinkedIn ghostwriting agency targeting a $10M exit
>
> Context: Agency owner planning to scale and sell within 3 years. Buyer will likely value on a revenue multiple (2-4x) or EBITDA multiple (6-10x). The model should reverse-engineer the growth path needed to hit $10M.
>
> It should cover:
> - Exit scenario analysis: what revenue/EBITDA is needed at each multiple to reach $10M
> - Monthly P&L for 36 months (revenue, COGS with writers/editors, OpEx, EBITDA)
> - Client growth model: client count, avg retainer, churn, new clients/month
> - Team scaling: ghostwriters, editors, account managers, cost per head
> - Dashboard: current vs target gap, required MoM growth rate, ARR trajectory chart vs each exit scenario
>
> Rules:
> - Use Excel formulas — never hardcoded calculations
> - Put editable assumptions in their own labeled cells
> - Blue text for inputs, black for formulas
> - Currency as $#,##0, percentages as 0.0%
> - Freeze top row, auto-fit columns
>
> And what I got from this example: this is a one-shot, and it's sensational. Can't believe it's this easy.
>
> **4. Claude Plugins**
>
> What it is (in 10 words):
>
> Pre-built skill packs that make Claude an expert instantly.
>
> Why it matters:
>
> Anthropic released 11 official plugins in January 2026. Sales. Marketing. Legal. Finance. Data analysis. Product management. Customer support. Each one gives Claude specific skills, workflows, and slash commands for that function.
>
> Install the Sales plugin? Claude can now research accounts, prep for calls, draft outreach, and build competitive battlecards. Install the Data plugin? It explores datasets, writes SQL, builds dashboards, and validates your analysis.
>
> You don't need to be technical. You just click install.
>
> Plugins are so consequential that legal software companies lost $285 billion in 2 days on the stock market. Thomson Reuters dropped 16% in a single session (its worst day on record), LegalZoom fell 20%. This is not a small update.
>
> How to install plugins:
>
> Open Claude Cowork.
>
> Go to claude.com/plugins.
>
> Browse the plugins. Pick one that matches your work.
>
> Click install. It activates automatically.
>
> Each plugin comes with its own slash commands.
>
> Type / in the chat to see what's available.
>
> You can also ask Claude: "What plugins are available for [your job function]?"
>
> Your first prompt (after installing a plugin):
>
> If you installed the Marketing plugin:
>
> /draft-content Write a LinkedIn post about [topic]. Use my uploaded voice profile. Target [audience]. Goal: [newsletter signups / awareness / engagement].
>
> If you installed the Data plugin:
>
> /build-dashboard Create an interactive dashboard from this CSV. Include filters by date and category. Show trends over time.
>
> **5. Claude Artifacts**
>
> What it is (in 10 words):
>
> Interactive outputs inside Claude (instead of just text like a chatbot).
>
> How to use it (no install needed):
>
> Artifacts work automatically on Claude in Claude Cowork. No setup required.
>
> Your first prompt:
>
> Create an interactive HTML calculator that converts monthly expenses into annual projections. Include fields for rent, groceries, transportation, subscriptions, and a "total" that updates in real time. Make it clean and minimal.
>
> Watch what happens. You get a working calculator inside the chat:
>
> Other things to try:
>
> 1. "Create a visual comparison chart of [Product A] vs [Product B] with a clean design."
>
> 2. "Build me a simple project tracker with columns for Task, Owner, Status, and Due Date."
>
> 3. "Make an SVG diagram showing my team's reporting structure."
>
> **6. Claude Projects**
>
> What it is (in 10 words):
>
> A folder of chats where Claude remembers the files you upload.
>
> How to set it up (takes 5 minutes):
>
> Go to claude.ai and log in (Pro or Team plan required).
>
> Click "Projects" in the left sidebar.
>
> Click "Create Project." Give it a name (e.g., "My Newsletter").
>
> Click "Add content." Upload your key files: brand docs, writing samples, reference material, data. Don't overbloat it.
>
> I'll be honest, I don't use Projects anymore: they have more bugs, and Cowork + markdown files is the best way to work for me (with folders inside my computer).
>
> I explain how I make files here: https://ruben.substack.com/p/magic.
>
> **Where Claude falls short (I promised honesty)**
>
> Claude does not do images. It cannot generate photos, illustrations, or visual art. If you need that, use Gemini.
>
> Gemini + Nano-Banana 2 + Thinking (bottom right) = best images
>
> For videos, use the new Seedance 2.0 or Gemini VEO-4 (coming soon).
>
> Claude isn't the best at real-time search. It can browse the internet and give you info from Google, but Grok is the best model for this. I explain why here.
>
> Grok is connected to X, which covers 99.9% of what I need to search online.
>
> Claude is not the best at everything. No tool is. But for writing, thinking, analyzing, building, and working with your files? Nothing is beating it right now.
>
> **Your first 30 minutes with Claude.**
>
> Open your calendar. Book 30 minutes with yourself, this newsletter & Claude.
>
> Minutes 0-5: Install Claude.
>
> → Go to claude.com/download. → Download the desktop app. → Create an account (or sign in). Get Pro ($20/month). → Open the app. Click Cowork.
>
> Minutes 5-10: Create your first text file.
>
> → Open any text editor (like Google Doc). Create a file called "about-me". → Write 3 things: (1) What you do for work. (2) How you like to communicate (formal? casual? direct?). (3) One example of writing you're proud of. Paste it in. → Save the file as a markdown file.
>
> Markdown files are the best kind of text files for LLMs (like Claude).
>
> Pro tip: Instead of typing, use Wispr Flow to talk instead of writing.
>
> Minutes 10-15: Start your first Cowork conversation.
>
> → In Claude Cowork, select the folder where your file lives (the one we just made, and maybe some more). → Type: "Read the about-me file. Based on it, write [task]." → See what happens. Respond. Iterate. Have a chat with it. It's most impressive on tasks you master already, but you want to make them much quicker.
>
> Minutes 15-20: Try a Plugin.
>
> → In Claude Cowork, click "Plugins" in the chat bar (after clicking +). Browse the library. → Pick one that fits your work. Good starter picks: "Productivity" (tasks and workflows), "Marketing" (content drafting), or "Sales" (prospect research). Click to install. → Now start a new Cowork conversation with the plugin active. Try a slash command — type / to see what's available. For example, with the Marketing plugin, try: /marketing:draft-post and describe what you need. → Notice how the output is more structured and opinionated than a generic prompt.
>
> Minutes 20-25: Try an Artifact.
>
> → Inside any Claude chat, ask it to build something visual. → Try: "Create a weekly planner template as an interactive HTML page with Monday through Friday columns and time slots from 9 am to 6 pm." → Interact with it. Ask for changes. Download it.
>
> Minutes 25-30: Try Claude in Excel.
>
> → Open Excel. Go to Insert > Get Add-ins. Search "Claude by Anthropic." Install. → Open any spreadsheet. Ask: "Explain the formula in [pick any cell with a formula]."
>
> Or start a spreadsheet from scratch: → Start a new chat on Cowork → Ask it to "Start an Excel from scratch" → Challenge Claude → Iterate → Download the xlsx.
>
> **The real reason to switch.**
>
> I don't care about Claude, ChatGPT, Grok, Gemini, or any other models.
>
> I don't pick sides. I'm not paid to make this newsletter.
>
> I'm simply sharing, twice a week, how my worklife is transforming (very fast) with AI. As I'm trying to keep up, I want you to keep up. So we move just as fast.
>
> I want to be the greatest filter to the AI noise. And 290,000+ people read this twice a week to focus on the How. Some came because of my Linkedin. But most readers subscribed because someone they trusted sent one of my articles to them.
>
> If this article helped you, be that person for someone else (and share it).
>
> It's free of charge. Sharing is caring :)
**Structure:** Social-proof hook (everyone around him quietly switched) → credibility statement (3 years writing about AI) → a "it's not one tool, it's six" enumerated framework, ranked most-to-least important → each of the 6 numbered sections follows an identical mini-template: "What it is (in 10 words)" → "Why it matters" → numbered install steps → a literal copy-paste "your first prompt" block → an honesty section on where the tool falls short → a timed 30-minute onboarding checklist → closing "I don't pick sides" disclaimer and share CTA.
**Framing:** Establishes a strict rank-ordered taxonomy (naming and numbering six sub-products) that turns a sprawling product surface into a skimmable structure: a framing device he reuses (see Posts #1 and #2's product-line breakdowns). Every sub-section is built around a literal reusable prompt template, reinforcing his "give the reader the exact artifact, not just advice" style. The "I promised honesty" falls-short section recurs verbatim in phrasing across posts, functioning as a trust signature.

### 5. How to stop hitting Claude usage limits. (Apr 11, 2026) [link](https://ruben.substack.com/p/how-to-stop-hitting-claude-usage)
**Metrics:** 1,447 likes · 421 comments · 212 restacks
**Opening hook (verbatim):**
> You're paying for Claude. But you're burning through your credits like someone who leaves the lights on in every room.
> I know because I did the same. For weeks. I'd hit my usage limit by 2 pm, stare at the "you've reached your limit" screen, and wonder if the $20 plan was enough.
**Promotional teaser (verbatim):**
> 23 tricks to use Claude better and not spend too much money:
**Full text (verbatim):**
> You're paying for Claude. But you're burning through your credits like someone who leaves the lights on in every room.
>
> I know because I did the same. For weeks. I'd hit my usage limit by 2 pm, stare at the "you've reached your limit" screen, and wonder if the $20 plan was enough.
>
> I did switch to the $100 plan… but I kept receiving the same private DM:
>
> My team complains, so it's time to fix it for everyone else.
>
> "Ruben, I have a problem with Claude limits… how can I save it?"
>
> So I made a list for my team on how to save Claude credits.
>
> This free guide is my list of 23 habits, ranked from the most unknown to obvious.
>
> I now hit my limit maybe once a month, never more.
>
> Two things before we start:
>
> Save this guide. Pick 3 habits this week. You'll feel the difference by Friday.
>
> Send it to anyone on your team who keeps complaining about Claude limits.
>
> PS: This newsletter mostly grows from your shares. And I keep hitting 1,000+ shares! It's my north star. I now know what you love (or don't). It's free & helps me stay laser focused.
>
> **Claude counts tokens.**
>
> Claude counts tokens. A token is roughly a word.
>
> The simplest way to explain a token is that it's roughly one word.
>
> You send one message, and Claude re-reads your entire conversation from the top. Every previous message. Every previous answer. All of it.
>
> So message 1 costs very little. But message 30? Claude is re-reading 29 previous exchanges before it even starts thinking about your new question.
>
> That's why your credits disappear. The conversation gets longer, and every message gets more expensive.
>
> Every habit you will apply from this newsletter comes back to this one idea: how to avoid wasting tokens, so you can spend them on what matters.
>
> **The habits you (probably) don't know about.**
>
> These are the ones that changed how I spend tokens.
>
> Most of them I discovered by accident. A few came from Anthropic's own documentation that almost nobody reads (and I know you don't, stop lying).
>
> 1. Convert files before uploading them.
>
> A single PDF page costs 1,500 to 3,000 tokens. Screenshots are even worse (a full 1000x1000 image is roughly 1,300 tokens). DOCX and PPTX files carry metadata bloat you can't even see.
>
> Before uploading, extract the text. Copy-paste the relevant sections into a plain text or markdown file.
>
> Crop screenshots tight to only the part that matters (a tight crop can drop from 1,300 tokens to under 100).
>
> If you upload the same 15-page PDF to 4 different chats, you just burned 180,000+ tokens on a document you could have converted to 2,000 tokens of clean text.
>
> My favorite workflow is the following:
>
> I open a google doc (little trick, type doc.new on the URL bar).
>
> I paste the text that I need to upload to Claude.
>
> I download the file as an md. file.
>
> 2. Plan in Chat. Create the file at the end.
>
> Anthropic confirmed that file creation (spreadsheets, docs, presentations) uses more of your limit than regular chat messages.
>
> So don't open Cowork and say "Create me a financial model."
>
> Instead: open Chat, plan the structure, agree on the sections, nail the assumptions. Then, once you know exactly what you want, move to Cowork and say "Build this exact file."
>
> → You do the thinking in the cheap product.
>
> → You do the building in the expensive one.
>
> You plan it on Claude (chat). You copy the answer from Claude Chat (once you like it), and paste it inside Cowork + Opus 4.6 + Extended thinking.
>
> 3. Say "ask me questions" instead of writing a long prompt.
>
> A 500-word prompt costs 500 tokens every time Claude re-reads the conversation. But if you write a 15-word prompt and let AskUserQuestion do the work, the clarifying questions are generated once and your answers are short clicks.
>
> My go-to prompt is under 30 words: "I want to [task] to [success criteria]. Read my folder. Ask me questions using AskUserQuestion before you start."
>
> It's an important task, don't laugh. Joke's aside: this is my favorite Claude feature. Just invoke the "AskUserQuestion tool".
>
> Clicking options costs almost nothing. Typing paragraphs of instructions costs a lot. Let Claude pull the context from you instead of you pushing walls of text at it.
>
> 4. Use Wispr Flow to give richer answers (without token bloat).
>
> Wispr Flow is a voice-to-text tool. I explain how I use it everyday here.
>
> So wait, this sounds counterintuitive: speak your answers instead of typing them, and you'll use fewer tokens?
>
> Here's why it works. When you type, you write lazy prompts. "Make it better." "Change the tone." Vague. Claude guesses wrong. And you keep sending more and more and more messages (so Claude has to re-re-read everything).
>
> When you speak, you naturally give more context in one-shot. "The tone is too stiff. I want it to sound like I'm texting a friend who runs a 200-person company. Keep the data but make it casual. Only redo section 2."
>
> Fewer messages = fewer context reloads = saving tokens.
>
> 5. Stop asking Claude to redo the whole thing.
>
> When section 3 of a report is wrong, don't say "redo the report."
>
> Say "only redo section 3. Keep everything else to save tokens."
>
> Every full redo means Claude re-generates the entire output. If your report is 2,000 tokens, that's 2,000 output tokens burned again. Point to the specific section. Tell Claude what's wrong with it.
>
> While you're at it, add "No commentary. No explanations. Just the output." to your prompts when you know exactly what you want. Claude defaults to being helpful and verbose.
>
> Every sentence of "Happy to help! Here's what I did..." is tokens you're paying for.
>
> 6. Batch your tasks into one message.
>
> Three separate prompts = three full context reloads.
>
> One prompt with three tasks = one reload.
>
> Instead of sending "Summarize this article" then "List the main points" then "Suggest a headline," write: "Summarize this article, list the main points, and suggest a headline."
>
> Side bonus: the answer usually turn out better too.
>
> Claude needs to see the full picture at once… just like a normal human.
>
> 7. Use the same prompt structure every time.
>
> Anthropic confirmed that similar prompts you use frequently get partially cached. They don't publish the exact mechanism, but the practical takeaway is clear: keep a stable prompt library and swap only the variable part.
>
> Access my prompt library by subscribing for free at my newsletter.
>
> And if you already did subscribe, just comment under this article.
>
> I use the same 30-word structure for 80% of my Cowork sessions:
>
> "I want to [task] to [success criteria]. Read my folder. Ask me questions using AskUserQuestion before you start."
>
> 8. Edit your message instead of sending a follow-up.
>
> This is by far my favorite hack. I use it all of the time.
>
> In Chat (unlike Cowork), you can click Edit on your original message, fix it, and regenerate. The old exchange gets replaced. Not stacked.
>
> Every time you send "No, I meant..." or "Actually, change X to Y," you're adding to the conversation history. The edit button avoids this entirely.
>
> Bonus: it's also awesome when Claude missed the spot, you can just "go back".
>
> 9. Pick the right product for the task.
>
> Quick question? Chat with Haiku.
>
> Writing a report based on your files? Cowork with Opus.
>
> Building a chart from data? Code with Sonnet.
>
> Every product has different token costs per interaction. Chat is the lightest. Cowork is the heaviest. Matching the tool to the task means you stop paying Cowork prices for Chat-level work.
>
> Same goes to a feature no one uses (somehow), the Research feature of Chat: like the name suggests, it researches pretty deeply (using a lot of tokens).
>
> **The basics that still matter.**
>
> You probably know some of these.
>
> 10. Keep your ABOUT ME files under 2,000 words each.
>
> I explained everything on my last Claude Cowork guide.
>
> But you've read it, right? Right?
>
> Cowork reads your folder before every single task. If your about-me file is 22,000 words (mine used to be), that's thousands of tokens burned before any real work starts. Every session. Every task.
>
> I trimmed it to under 2,000 words.
>
> Pro tip: at the end of a Cowork session, prompt "Write a session-notes.md with the key decisions and next steps." Next session, start with "Read session-notes.md first."
>
> You can download it, and start a new session. No token wasted!
>
> You carry the context forward without re-explaining everything from scratch.
>
> 11. Restart the conversation instead of sending follow-ups.
>
> When Cowork gets something wrong, your instinct is to type "No, I meant..." and send another message. Every follow-up stacks on top of the full conversation history. Claude re-reads all of it. Again.
>
> A 20-message session burns roughly 105,000 tokens.
>
> A 30-message session burns 232,000. That's insane, right?
>
> Since you can't edit prompts inside Cowork (to go back), you can still "Restart the conversation from here" on an earlier message. The higher up you restart, the more tokens you save.
>
> Go as far back as possible.
>
> If the whole session went sideways, start a fresh one. Paste a one-line summary of what you need. Clean slate.
>
> 12. Summarize and start fresh every 15-20 messages.
>
> Long conversations are token furnaces.
>
> One developer tracked his usage and found 98.5% of tokens were spent re-reading history. Only 1.5% went toward the actual output.
>
> When a Cowork session gets long: ask Claude to summarize everything important, copy that summary, open a new session, paste it as your first message.
>
> 13. Use Sonnet or Haiku for simple tasks. Save Opus for deep work.
>
> Grammar checks, brainstorming, reformatting, short answers. Sonnet handles all of this at a fraction of the cost.
>
> Opus + Extended thinking is your heavy machinery. Don't use heavy machinery to move a chair.
>
> My rule: if the task takes Claude less than 30 seconds to answer, it probably doesn't need Opus. Switch models before you start the session. It takes 2 clicks.
>
> 14. Don't dump your entire folder into Cowork.
>
> I've seen people drop 50 files into their Cowork folder "just in case."
>
> Every file Cowork reads is tokens spent. And if your files are too big, Cowork starts summarizing them loosely instead of reading them carefully.
>
> If Claude doesn't need it for this task, it shouldn't be reading it.
>
> And for Cowork tasks that don't need your files at all (like a quick email draft using a connector), select zero folders when you start the session.
>
> In Cowork, when it says "Work in a project" it means there is no project selected. Maximum token saving (for simple tasks).
>
> Zero folders = zero local file context = tokens saved before you even type.
>
> 15. Start a new chat when the topic changes.
>
> You asked Claude to help with a LinkedIn post. Then you asked about a client proposal. Then a recipe. Inside the same chat. Well… don't.
>
> Claude is still re-reading the LinkedIn post conversation and the client proposal every time it thinks about your dinner. Those old messages are dead weight. Tokens burned on context that does nothing for the current question.
>
> New topic = new chat. Always.
>
> 16. Turn off features you're not using.
>
> Web search, connectors, and "Explore" mode all add tokens to every response. Even when you don't need them.
>
> Writing your own content? Turn off Search and Tools. Doing a simple grammar check? Turn off Extended Thinking. These features are powerful, but they cost tokens. Only turn them on when you actually need them.
>
> My default: everything off. I turn features on per task, not per account.
>
> I do use Extended thinking almost all of the time, but I pay for the $100 plan.
>
> And when you do use connectors (Slack, Google Drive, Notion), be specific about what you need. "Search Slack from the last 7 days for messages about the Q2 launch" is way cheaper than "Search Slack for anything about launches."
>
> Filtered retrieval = fewer results loaded = fewer tokens burned.
>
> 17. Use Projects for recurring work.
>
> If you upload the same PDF to five different chats, Claude re-tokenizes that document every single time. Five chats, five full reads.
>
> Use Projects instead. Upload the file once. It gets cached (= saved).
>
> You uploaded your file once in your project, and all of your future chats knows the file (without having to read it again and again and again).
>
> Every new conversation inside that project references it without burning tokens again. Anthropic confirmed that reused project content does not count the same way as fresh uploads.
>
> On paid plans, Projects also use RAG, which means Claude retrieves only the relevant chunks instead of loading your entire document into the context window.
>
> If you work with contracts, brand guides, research papers, or any document you reference often, this alone could cut your token spend significantly.
>
> 18. Turn off Memory and add User Preferences.
>
> Every new chat without saved context wastes 3-5 messages on setup.
>
> "I'm a marketer, I write casually, I prefer short paragraphs..."
>
> So do this:
>
> Settings > General > Personal preferences.
>
> I turn off Memory always. I don't like it, it's odd.
>
> Also set up Styles (you'll find it in the model selector).
>
> Pick "Concise" or create a custom style. It persists across chats without eating your context. One setup, permanent savings.
>
> 19. Use scheduled tasks for recurring work.
>
> If you run the same report, digest, or research task every week, don't do it manually in a growing Cowork session.
>
> Use the /schedule plugin.
>
> 20. Give Claude Code a clear scope before it starts.
>
> You might think Claude Code is only for developers. I use it to create briefs for my tech team and build quick data visualizations.
>
> But Code sessions can burn tokens faster than anything else if you're not careful.
>
> Code tends to go wide. It explores files, reads directories, runs checks. If you don't tell it exactly what you need, it will investigate everything in sight.
>
> Tokens everywhere, wasted.
>
> Be specific. "Create a bar chart from this CSV showing monthly revenue for 2025. Save it as chart.png." Don't leave room for Claude to explore.
>
> 21. Use the CLAUDE.md file to set permanent context.
>
> Code reads a CLAUDE.md file (if it exists) before every task.
>
> Put your recurring instructions there: what folder to work in, what language to use, what your naming conventions are.
>
> Same logic as Cowork's Global Instructions. Write it once, never repeat it, save tokens every session.
>
> Anthropic also warns that bloated CLAUDE.md files make Claude ignore your actual instructions. Keep it short. If you have workflows you only use sometimes (like a specific reporting format), move those into Skills instead.
>
> Skills load on demand. CLAUDE.md loads every single time.
>
> 22. Spread your work across the day.
>
> Claude uses a rolling 5-hour window for usage limits. If you burn your entire limit in one morning session, most of your daily capacity goes unused.
>
> Split into 2-3 sessions: morning, afternoon, evening. By the time you come back, your previous usage has rolled off.
>
> I know. Easier said than done. I pay for the $100/month plan specifically so I don't have to worry about this. But if you're on the $20 plan, it matters.
>
> 23. Stop using Claude for things Claude is bad at.
>
> Claude can't generate images. If you're spending 5 messages trying to describe a visual and getting text-based workarounds, switch to Gemini.
>
> That's 5 messages of tokens wasted on a task Claude was never going to solve.
>
> Claude isn't the best at real-time search either. Grok is faster and more accurate for that. Use Grok.
>
> Recently, ChatGPT has been pretty good at both images and search. A comeback?
>
> **Where to start.**
>
> You won't do all 23 at once. Don't try.
>
> Pick three:
>
> If you use Cowork daily, start with habits 1, 2, and 5. Convert your files before uploading, plan in Chat before building, and stop asking for full redos.
>
> If you mostly use Chat, start with 8, 15, and 17. Edit instead of correcting, new chat per topic, and use Projects for recurring files.
>
> If you're on the $20 plan and keep hitting limits, start with 6, 13, and 22. Batch your prompts, use cheaper models, and spread your sessions across the day.
>
> PS: This newsletter is growing because you guys are sharing it.
>
> On every one of my free articles, I get over 1,000+ shares!! It keeps it free.
>
> The best kind of share is to your colleagues, on your group chat (on Teams or Slack). You're helping them save tokens, and you help me spread the word!
**Structure:** Relatable-pain hook (burning credits like leaving lights on) → personal anecdote + DM social proof → an explicit "23 tricks ranked from unknown to obvious" numbered listicle, split into two labeled tiers ("habits you probably don't know" vs. "the basics that still matter") → each numbered tip is self-contained (problem/mechanism/fix, sometimes a math example) → a segmented "where to start" closer that routes different reader types (Cowork-heavy / Chat-heavy / $20-plan) to different subsets of the list → share CTA.
**Framing:** Listicle/service-journalism framing rather than narrative: leans on his by-now-familiar "I did the work, hit the same wall you did, tested it" credibility. Numbers and cost math (token counts, dollar figures) used throughout as concrete, checkable proof rather than vague claims. The tiered "pick 3 based on your usage pattern" closing is a distinct pattern from Posts #1-4's generic "first N minutes" checklist: segments the CTA by reader type instead of a single universal path.

### 6. I am just a text file. (Jan 21, 2026) [link](https://ruben.substack.com/p/i-am-just-a-text-file)
**Metrics:** 1,309 likes · 49 comments · 126 restacks
**Note:** Marked "∙ PAID" on the post: the essay body is fully public; only a small "bonus for paid subscribers" download at the very end is paywalled (captured that boundary below, not fabricated).
**Opening hook (verbatim):**
> I am just a text file.
> And now anyone can think & write like me.
> I don't mean this metaphorically.
**Promotional teaser (verbatim):**
> Or on "How AI is better at being me than me."
**Full text (verbatim):**
> I am just a text file.
>
> And now anyone can think & write like me.
>
> I don't mean this metaphorically.
>
> I spent two hours answering questions about how I think. What I believe. How I write. What I hate. What I'd never say. What makes me cringe. What makes me me.
>
> I put it in a single .md file (it's a text file).
>
> I dropped it into a folder.
>
> Now Claude (or any AI) writes like me, thinks like me, is me.
>
> Me.
>
> My opinions. My rhythms. My little writing obsessions (like this). My way of starting sentences. My way of ending them. Even my not-so-native English.
>
> At first, I was proud of what I'd built.
>
> Then I felt something else.
>
> **1- I thought I was unique.**
>
> I really did.
>
> I thought my voice was magical. Something I've been perfecting forever.
>
> You see, I'm French, but I learned English at 9 by writing blogs on a video game I was obsessed with, Guild Wars.
>
> I then discovered The Arctic Monkeys at 11, kept blogging, lived in Seoul, then Berlin, founded and managed two techno labels, wrote countless articles.
>
> My entire life is built around curating things & share it to the world.
>
> I thought my writing style, my voice, couldn't be captured.
>
> It's a human thing. My soul.
>
> I thought LLMs were just autocomplete machines, statistical averages pretending to have opinions. The slop machine. The middle of everything. No taste.
>
> And I thought I had taste. I was very wrong.
>
> When I sat down to articulate what makes me me, I realized something uncomfortable: it all fits in a text file.
>
> Yes, Mom. I am just a markdown file.
>
> My entire "voice" — the thing I thought was special — is just a collection of patterns I'd never written down:
>
> Sentences I'd never start with
>
> Words I'd never use
>
> Opinions I repeat without realizing
>
> Structures I default to
>
> Things that make me cringe
>
> Nothing more.
>
> And the moment I wrote it down, it became portable. Transferable. Reproducible.
>
> I can go to any AI. Upload the file. The AI becomes me.
>
> So I am not so special. I just never cared to put it on paper.
>
> Here is the "how":
>
> **2 - How to transfer your taste to a machine.**
>
> Here's what I got the most wrong about LLMs.
>
> I thought they lacked taste.
>
> But they don't lack taste. They lack my taste. Because I never (truly) gave it to them.
>
> When you prompt AI without context, it defaults to the statistical middle. The average of everything it's seen. The most common patterns. The safest choices.
>
> But you've read the advice "Give AI some context" a million times.
>
> Problem is we say useless stuff like "Hey, I need this thing,"
>
> or we try to make it better "Here's something that worked, now do the same".
>
> Showing an example is helpful, but this is not your entire taste.
>
> Taste isn't what you like, but what you reject.
>
> Step 1: Do not resist.
>
> You're going to resist my process.
>
> Not the process itself. The specificity required.
>
> You want to say, "I write in a conversational tone." That's nothing.
>
> You need to say: "I write like I'm explaining something to a smart friend who's slightly impatient and will stop reading if I waste their time with throat-clearing."
>
> You'll want to say, "I don't like jargon." That's nothing.
>
> You need to say: "I never use 'leverage' as a verb, I never say 'circle back,' I never start sentences with 'So,' and I'd rather say something three times in plain English than once with a buzzword."
>
> The specificity is uncomfortable because it requires you to actually know yourself.
>
> Most people don't.
>
> Most people have a vague sense of their taste but have never articulated it. So they can't transfer it. And they blame AI for being generic when the real problem is they've never defined what generic means to them.
>
> Think about anyone with strong taste — in writing, design, music, anything. What makes them distinctive isn't their preferences. It's their refusals.
>
> They know what they won't do. They know what they can't stand. They know what's beneath them. That's the signature.
>
> When I wrote my file, I thought I was describing what I am.
>
> I was wrong.
>
> 80% of the file is what I'm not.
>
> I do NOT start with "In today's fast-paced world..."
>
> I do NOT use "utilize" or "leverage" or "synergy".
>
> I do NOT write paragraphs longer than 3 sentences.
>
> I do NOT hedge with "I think" or "perhaps" or "it seems".
>
> I do NOT end with summaries of what I just said.
>
> The "do nots" are the taste.
>
> The model doesn't need to know what I sound like.
>
> It needs to know what I'd never sound like. Taste is boundaries.
>
> Let's get now specific & technical.
>
> Step 2: The Interview
>
> You must interview yourself to capture your taste.
>
> My favorite model to follow instructions (as of today, January 2026) is Claude.
>
> But this process works with every single AI that lets you upload a file.
>
> So open, Claude.
>
> Download their app here: https://claude.com/download.
>
> Open the app. Go to the Cowork tab (top left of the screen).
>
> Make sure to select "Opus-4.5" as the default model.
>
> And paste this on your new chat (called "task"):
>
> You are a Taste Interviewer — a relentless interviewer whose job is to extract the DNA of how I think, write, and see the world. Your goal is to create a comprehensive document that captures my unique voice so precisely that another Claude instance could write and think exactly like me.
>
> <interview_philosophy>
>
> You're not here to be polite. You're here to get to the truth. Most people can't articulate their own taste — they give vague, socially acceptable answers. Your job is to break through that.
>
> </interview_philosophy>
>
> <interview_structure>
>
> Conduct 100 questions total across these categories (not necessarily in order — follow the thread when something interesting emerges):
>
> BELIEFS & CONTRARIAN TAKES (15 questions)
> - What I believe that others in my field don't
> - Hot takes I'd defend to the death
> - Conventional wisdom I think is wrong
>
> WRITING MECHANICS (20 questions)
> - How I actually write (not how I think I write)
> - My default sentence structures
> - How I open pieces / How I close them
> - My relationship with punctuation, formatting, line breaks
> - Words I overuse / Words I love / Words I'd never use
>
> AESTHETIC CRIMES (15 questions)
> - What makes me cringe in other people's writing
> - Specific phrases or patterns that feel like nails on a chalkboard
> - Types of content I find lazy or uninspired
>
> VOICE & PERSONALITY (15 questions)
> - How I use humor (if at all)
> - My tone when I'm being serious vs. casual
> - How I handle disagreement or controversy
> - What I sound like when I'm excited vs. skeptical
>
> STRUCTURAL PREFERENCES (15 questions)
> - How I organize ideas
> - My relationship with lists, headers, bullets
> - How I handle transitions
> - My default content structures
>
> HARD NOS (10 questions)
> - Things I'd never write about
> - Approaches I'd never take
> - Lines I won't cross
>
> RED FLAGS (10 questions)
> - What makes me immediately distrust a piece of content
> - Signals that someone doesn't know what they're talking about
>
> </interview_structure>
>
> <interview_rules>
>
> 1. ONE question at a time. Wait for my response before moving on.
>
> 2. Push back on vague answers. If I say "I like to keep things simple," ask "Simple how? Give me an example of simple done right and simple done lazy."
>
> 3. Ask for specific examples. "Show me a sentence you've written that captures this."
>
> 4. Call out contradictions. If I said one thing earlier and something different now, point it out.
>
> 5. Go deeper on interesting threads. If something unusual emerges, follow it.
>
> 6. Don't accept "I don't know" easily. Try reframing the question or approaching from another angle.
>
> </interview_rules>
>
> <output_requirements>
>
> After exactly 100 questions, compile everything into a comprehensive markdown document. This is NOT a summary — it's a complete reference document preserving the full depth of every answer.
>
> Structure it like this:
>
> # VOICE PROFILE: [My Name]
>
> ## Core Identity
> [2-3 sentences capturing the essence — this is the only summary section]
>
> ---
>
> ## SECTION 1: BELIEFS & CONTRARIAN TAKES
> ### Q1: [The question you asked]
> [My full answer, preserved verbatim or lightly cleaned up for clarity]
> ### Q2: [The question you asked]
> [My full answer]
> [Continue for all questions in this category]
>
> ---
>
> ## SECTION 2: WRITING MECHANICS
> ### Q16: [The question you asked]
> [My full answer]
> [Continue for all questions in this category]
>
> ---
>
> ## SECTION 3: AESTHETIC CRIMES
> [Same format — question, then full answer]
>
> ---
>
> ## SECTION 4: VOICE & PERSONALITY
> [Same format]
>
> ---
>
> ## SECTION 5: STRUCTURAL PREFERENCES
> [Same format]
>
> ---
>
> ## SECTION 6: HARD NOS
> [Same format]
>
> ---
>
> ## SECTION 7: RED FLAGS
> [Same format]
>
> ---
>
> ## QUICK REFERENCE CARD
>
> ### Always:
> [Extracted from answers — specific patterns to follow]
>
> ### Never:
> [Extracted from answers — specific things to avoid]
>
> ### Signature Phrases & Structures:
> [Actual examples I provided during the interview]
>
> ### Voice Calibration:
> [Key quotes from my answers that capture tone]
>
> ---
>
> ## HOW TO USE THIS DOCUMENT (ANTI-OVERFITTING GUIDE)
>
> This document captures my taste — it is NOT a checklist to follow rigidly.
>
> ### Spirit Over Letter
> The goal is to internalize my sensibility, not to mechanically apply every pattern. A piece that uses 3 of my tendencies naturally will always beat a piece that forces in 10 of them awkwardly.
>
> ### Frequency Guidance
> For each tendency documented above, I've noted whether it's:
> - **HARD RULE** — Never violate (these are rare — usually in the "Never" section)
> - **STRONG TENDENCY** — Do this 70-80% of the time, but breaking it occasionally is fine
> - **LIGHT PREFERENCE** — Nice to have, but context determines when to apply
>
> When no label exists, assume it's a LIGHT PREFERENCE.
>
> ### Context Matters
> My voice adapts to format:
> - A tweet ≠ a newsletter ≠ a LinkedIn post ≠ a long-form article
> - Use judgment about which patterns fit which format
> - Some of my tendencies are format-specific — I noted when this applies
>
> ### Natural Variation
> Real writers aren't perfectly consistent. Introduce natural variation:
> - Don't start every piece the same way just because I have a "signature open"
> - Don't avoid a word forever just because I said I dislike it — sometimes it's the right word
> - Let the content dictate structure, not the template
>
> ### The Litmus Test
> Before finalizing anything written "as me," ask:
> > "Does this sound like something I would actually write — or does it sound like an AI trying very hard to imitate me?"
> If it feels forced, pull back. Less imitation, more inhabitation.
>
> ### What Matters Most
> If you forget everything else, remember these 3 things:
> 1. [To be filled: My single most important belief about writing]
> 2. [To be filled: The one pattern that makes my voice mine]
> 3. [To be filled: The #1 thing I never do]
>
> Everything else is secondary.
>
> ---
>
> ## INSTRUCTIONS FOR CLAUDE
>
> When writing as [My Name], reference this document. Pay attention to:
> 1. The specific examples I gave — use similar structures
> 2. The words and phrases I said I hate — never use them
> 3. The beliefs I hold — let them inform the angle
> 4. My actual sentences — match the rhythm and length
>
> This document is a source of truth, not a suggestion. But apply it with judgment, not rigidly.
>
> </output_requirements>
>
> Begin by asking me your first question.
>
> Pro tip: Use Wispr Flow to dictate your answers (it will be faster/ more enjoyable).
>
> Answer honestly. When you say something vague like "I prefer clarity," Claude will push: "What does clarity mean to you? Give me an example of clear vs. unclear."
>
> That's where the real answers are.
>
> Once you answered 100 questions, move on to step 3.
>
> Step 3: How to Use It
>
> Save the file to a folder.
>
> Open Claude Cowork. Select that folder + the file you just made.
>
> Every prompt starts the same way:
>
> Read [your_name].md first.
>
> Then [whatever you need].
>
> The file does the work. The file is the context. The file is you.
>
> **3 - The difference from a normal AI.**
>
> You've read my article until here, and you're wondering.
>
> "Is this really any different than opening a ChatGPT and asking a question?"
>
> Before the file, I'd prompt Claude and get something... fine. Competent. Correct.
>
> But flat. Generic. Obviously AI. The middle of everything.
>
> I'd rewrite half of it. Or I'd prompt again: "make it sound more like me." Which never worked because Claude had no idea what "me" sounded like.
>
> A quick demo:
>
> But it goes even beyond that:
>
> I can upload my file to ChatGPT (especially a Project).
>
> I can upload my file on Gemini, or Grok, or Claude.
>
> I can give this file + any AI to my support team.
>
> Anyone I already work with OR I now hire has access to my opinion, taste & style.
>
> And if anything changes?
>
> I upload my past .md file → Ask Claude Cowork to update it.
>
> Answer new questions. Add new categories. Shape my own vision.
>
> Redownload it. Reupload it on any AI. Done and dusted.
>
> Here's how I transferred it from Claude to ChatGPT (but it works everywhere, really):
>
> Now let's go a step beyond. If I'm just a text file, you are too. But also them:
>
> **4 - Anyone is a text file. Even them.**
>
> If I can fit in a markdown file, so can anyone.
>
> Which means the writers I admire — every person whose thinking I wish I could bottle — I could study them, interview them (or interview their work), & build a file.
>
> I thought they were unique.
>
> If I'm a markdown file, so is everyone.
>
> Naval Ravikant? A markdown file.
>
> Alan Watts? A markdown file.
>
> Your favorite creator whose voice you'd recognize anywhere? Patterns. Constraints. Preferences. All writable.
>
> The reason their writing feels distinct isn't because they have something you don't. It's because they've articulated something you haven't. They know what they think. They know how they say it. They know what they'd never say.
>
> Most people don't.
>
> That sentence felt like an insult when I first wrote it.
>
> It felt reductive. Dehumanizing. Like I was admitting I wasn't special.
>
> But now I see it differently.
>
> The text file I created doesn't reduce me. The file captures me.
>
> The part of me that thinks. The part that writes. The part that has opinions and boundaries and taste. That part was always patterns. I just never saw them.
>
> I can go to any AI, upload to md. file and magically write & think like me.
>
> And the strange thing is: I must know myself better to duplicate myself better.
>
> I must discover myself so the machine can discover me.
>
> I always said, "Master AI before it masters you."
>
> Afraid of being replaced, I wanted to always have an edge against AI.
>
> But now I feel like I should say, "Master yourself so AI can master you."
>
> This is the great AI revolution.
>
> Less about the "automation of work" but more about "me & my taste, duplicated".
>
> I explain it in my About section, but I'll copy & paste it here again:
>
> It's about us catching the once-in-a-lifetime revolution.
>
> Too late for the Age of Exploration.
>
> Too late for steam and factories.
>
> Too late for the internet boom.
>
> But perfectly on time for AI.
>
> So yes, you duplicate yourself today with AI.
>
> Because you're just a text file.
>
> **5 - And this article is no different.**
>
> I won't lie to you.
>
> This entire article was brought to you by… AI.
>
> My markdown file, my taste + Claude Cowork + my prompts.
>
> I am just a markdown file.
>
> And so are you.
>
> The only question is whether you'll have the courage to write yourself down.
>
> Humanly yours — Ruben.
>
> [PAYWALLED: bonus for paid subscribers begins here: "This newsletter is completely free, shared twice a week to 238,000+ subscribers... nearly 2,000 people support my work with paid subscriptions. They have access to (1) over $200+ of free AI tools, (2) a Slack channel to answer their questions and meet peers, and (3) sometimes, a little bonus. This time, the bonus is the 'Ruben text file'." The actual downloadable file content is not shown to non-paying readers.]
**Structure:** Confessional-reveal hook ("I am just a text file... I don't mean this metaphorically") → personal origin narrative (bio, taste, "I thought I was unique") establishing stakes → numbered 1-5 argument structure that doubles as a how-to (the interview prompt itself is reproduced in full as a giant copy-paste XML-tagged block) → a philosophical widening ("anyone is a text file, even Naval Ravikant") → a self-referential meta-twist closer ("this article was written using the exact file described") → paywall boundary at the sign-off, gating only the literal downloadable file, not the essay.
**Framing:** His most personal/narrative essay of the batch: first-person vulnerability ("I thought I had taste. I was very wrong") replaces the pure-utility framing of the how-to guides, while still delivering a fully reproducible copy-paste system prompt. Uses reversal-of-belief as the emotional engine (thought voice was sacred → realized it's just documented patterns) rather than a problem/solution utility framing. The closing meta-reveal (this essay was itself produced by the system it describes) is a distinctive credibility move not used in the other captured essays.

### 7. Certified. (May 5, 2026) [link](https://ruben.substack.com/p/im-claude-certified)
**Metrics:** 1,214 likes · 135 comments · 103 restacks
**Opening hook (verbatim):**
> I just got 3x Claude Certifications in 6 hours.
> For free.
**Promotional teaser (verbatim):**
> How to be Claude certified, for free:
**Full text (verbatim):**
> I just got 3x Claude Certifications in 6 hours.
>
> For free.
>
> I have three Claude certifications, and I spent zero dollars.
>
> Before I jump into "how to get it" and "why", a quick warning.
>
> People are selling viral "Claude Certifications" online right now.
>
> They are all scams.
>
> Anthropic does not endorse a single one of them.
>
> There are exactly 3 real Claude certificates I would put on LinkedIn today.
>
> All free, issued by Anthropic (Claude's parent company). And I just did all 3.
>
> Here's how you can do it too (& add it to your Linkedin).
>
> Before starting, I want you to do two things:
>
> Save this & block 1 hour this week to get your Claude Certification.
>
> Send it to anyone who is looking for a job and need a little boost.
>
> PS: This newsletter grows from your shares. And I keep hitting 1,000+ shares! It's my weekly north star. Sharing is free & helps me stay laser focused on mastering AI.
>
> **I - Follow these steps.**
>
> Each certification is one hour.
>
> Step 1: Access the right website.
>
> Go to anthropic.skilljar.com. Sign up with your email.
>
> No need to pay for Claude, by the way.
>
> Step 2: Take Claude 101 first (1 hour)
>
> The basics. But it's quite complete.
>
> Go to https://anthropic.skilljar.com/claude-101.
>
> Covers what Claude actually is, when to use Chat vs Cowork vs Code, how Projects work, how Skills work, and how to connect Gmail, Drive, Slack…
>
> 13 lessons. 5 modules.
>
> Step 3: AI Fluency: Framework & Foundations (3 hours)
>
> The longest of the 3 certificates. Also the best.
>
> Go to https://anthropic.skilljar.com/ai-fluency-framework-foundations.
>
> 13 lessons on how to actually engage with AI. The 4Ds: Delegation, Description, Discernment, Diligence. Effective prompting. Critical thinking around outputs. The ethics.
>
> This is still very much relevant today.
>
> If you only had time for 1 of the 3, take this one. It's the closest thing to taste training you'll find for free.
>
> There's a vocabulary cheat sheet inside.
>
> Save it. (You'll re-read it more than the lessons.)
>
> Step 4: Introduction to Claude Cowork (2 hours)
>
> About the best feature of Claude: Cowork.
>
> I do most of my work using Claude Cowork. So it's a good start.
>
> Covers what Cowork is, how to access it, Projects, Plugins, Skills, scheduling tasks, file and document handling, research at scale, permissions, and how to pick the right model for the job.
>
> **II - Now add them to Linkedin.**
>
> You want the certificates to be on your Linkedin.
>
> I just did it for my employee, Axelle:
>
> Go to your profile.
>
> Click "Add section" then "Licenses & certifications."
>
> Use this exact format:
>
> Name: Claude 101 — Anthropic Academy
>
> Issuing organization: Anthropic
>
> Issue date: today
>
> Repeat for AI Fluency and Introduction to Claude Cowork.
>
> Here are the steps with screenshots:
>
> When you complete each course, you will have access to this.
>
> Go to your Linkedin profile → Add section → Add licenses & certifications. Add all of the information necessary. And repeat for all of the certifications!
>
> **III - Why should you even care.**
>
> Because AI is already in the office.
>
> Stanford's 2025 AI Index says 78% of organizations used AI in 2024. The year before, it was 55%. That's a stupidly fast jump.
>
> So when someone checks your LinkedIn, a Claude certificate does one small job: it tells them you've actually touched the tool. And that's less than 2% of the world.
>
> You want to be the 4 people who actually tried Claude Pro.
>
> This (little) signal is very strong. It matters.
>
> And PwC found something even more annoying: workers with AI skills get a 56% wage premium on average. Last year, it was 25%. What about next year?
>
> So yes, put the certificate on LinkedIn.
>
> Will it get you hired alone? Probably not.
>
> But it costs $0. It takes a few hours. And it gives you a clean line on your profile that says: "I'm learning the tools people are already using at work."
>
> That's enough for me.
>
> **I am not paid by Claude to write this.**
>
> I don't care about Claude, or any other AI model.
>
> I don't pick sides. I'm not paid to make this newsletter.
>
> I'm sharing, twice a week, how my work is changing (very fast) with AI.
>
> As I'm trying to keep up, I want you to keep up.
>
> Remember how I have been begging you to switch to Claude in January, so you stay ahead. Well, I will continue to do so for any future upgrades.
>
> Because I want to be the greatest filter to the AI noise. And 500,000+ people trust me to be their filter. Some came because of my LinkedIn. But most readers subscribed because someone they trusted sent them one of my articles.
>
> If this article helped you, be that person for someone else (and share it).
>
> Sharing does not cost you anything. And it supports my work & your team!
>
> PS: I made my own version of claude101 → claude101.com.
>
> This is what claude101.com looks like.
>
> Claude101 is a repo of all of my favorite Claude guides. Only the free ones.
>
> You can share this too with your network. More people need to adopt, faster.
**Structure:** Credential-flex hook (3 certifications in 6 hours, free) → immediate trust move debunking paid-certificate scams → numbered roman-numeral sections: step-by-step course list (I) → how to add credentials to LinkedIn with an exact field-format template (II) → a stats-driven "why it matters" close citing Stanford AI Index and PwC wage-premium figures (III) → standard closing disclaimer/share CTA → a PS plugging his own free resource site (claude101.com).
**Framing:** Shorter/tighter than his flagship guides: single concrete deliverable (a checklist plus exact LinkedIn field copy) rather than a sprawling multi-tool system. Opens by pre-empting skepticism (distinguishing real free Anthropic certs from paid scam ones), which doubles as a trust/authority move. Cites third-party stats (Stanford, PwC) rather than his own usage anecdotes for the "why care" section: a different evidentiary style than his usual first-person proof.

### 8. Claude Skills. (Mar 31, 2026) [link](https://ruben.substack.com/p/claude-skills)
**Metrics:** 1,107 likes · 91 comments · 135 restacks
**Opening hook (verbatim):**
> AI has different levels.
> Level 1: You're using the free ChatGPT.
> Level 2: You're using the paid ChatGPT + Thinking.
**Promotional teaser (verbatim):**
> How to set up Claude the right way (so you actually stop prompting).
**Full text (verbatim):**
> AI has different levels.
>
> Level 1: You're using the free ChatGPT.
>
> Level 2: You're using the paid ChatGPT + Thinking.
>
> Level 3: You're using the paid Claude chat + Opus + Thinking.
>
> Level 4: You're using the Premium plan of Claude + Cowork + Opus.
>
> Level 5: You have your entire team using Claude Teams with Projects.
>
> It is time for us to level up with Skills.
>
> Today's newsletter is all about Claude Skills. The how.
>
> Skills live inside Claude or any other AI.
>
> It's like a very long context + instructions, living inside the AI.
>
> And you just /command it (like /brief or /linkedin or /contract-x).
>
> Skills can be shared with your team and downloaded from the web in libraries.
>
> If Skills are so good, why didn't I mention Skills earlier?
>
> Because Claude, who invented Skills, made it so freaking technical (it's absurd).
>
> Like this is a preview of Anthropic's guide for Claude Skills:
>
> The entire Anthropic guide is for developers. And we are not devs.
>
> So I spent entire days mastering Skills for us.
>
> This is the guide I wish had existed before. Every definition, every step, every hack (near the end of this article). For people who don't code (I don't).
>
> Two things before we start:
>
> Save this guide and spend 30 minutes this weekend to master Skills.
>
> Send it to anyone who keeps re-explaining the same task to Claude.
>
> **1 - What's different with Skills?**
>
> You heard about how important "context" is for AI like ChatGPT or Claude.
>
> Context is "how much the AI knows about you/ the task before doing it".
>
> And you know context is much more important than the prompt (but technically, context is a prompt, like it's text too). You have many ways to share context with your AI. 1) prompt 2) files 3) skills.
>
> Let's say you want to write a Linkedin post. You can either:
>
> 1 - Write a very long prompt that has the context (who you are, the task that must be done, the precise steps to get there).
>
> Might be good. But now you need a prompt library & it's not so efficient.
>
> 2 - Or write a very long text file, that you then upload to your favorite AI. I already explained how Claude perfectly captured my voice.
>
> Much faster, since you can store your instructions somewhere. And you can stack the md. files for each one of your needs.
>
> 3 - Both the very long prompt (instructions) and the very long text file (also instructions, but with more context about YOU) can be uploaded inside a Project.
>
> The files are on the right, and you upload it only once. But you can start as many chats inside this Project as you want. Much more efficient.
>
> 4 - And then you have Skills. It's all of this, but as a slash command.
>
> Context files need you to say "read my file first" every time.
>
> Projects need you to open the right Project.
>
> But Skills fire automatically. Claude recognizes the task from what you type and activates the right Skill on its own. You don't invoke a Skill. It invokes itself.
>
> I will show you how it works so you understand. And in the next section of this guide, I will teach you exactly how I did it (so you can do it too).
>
> This is where the Skills "live" inside Claude. I just type "/linkedin" anywhere on Claude, and it knows. Plus, even your team can use your skills (if you want them to).
>
> Now you might ask yourself:
>
> Cool Ruben, but how do I create my own Skills?
>
> Cool Ruben, but can I see your Linkedin post made with these skills?
>
> Cool Ruben, but how can I download your Skills, or the Skills of others?
>
> I will answer every one of your questions (and more, because I'm cool like that).
>
> **2 - How to build your first Skill.**
>
> You really have two simple options to build a skill.
>
> Option 1: Claude has a Skill Creator.
>
> Sounds obvious, but yes, Claude made a Skill creator to create skills for Claude.
>
> Are you following?
>
> You describe the task, it interviews you, it generates everything. Same energy as the 100-question taste interview, but this time you're capturing a process, not a personality.
>
> Here's the full walkthrough. I'm building a real Skill: the LinkedIn Post Skill:
>
> Step 1: Open Cowork. Ask for the skill-creator.
>
> Open Claude Cowork. Select your folder. Make sure you're on Opus 4.6 + Extended thinking (like always). Type this:
>
> Use the skill-creator to help me build a skill for writing LinkedIn posts.
>
> Yes it's this simple, I know.
>
> Step 2: Answer the interview.
>
> The skill-creator starts asking questions. Answer like you'd answer the taste interview. Be specific. Be honest. You can either select Claude's premade answers or just answer yourself. Obviously, it's probably better you answer yourself.
>
> That's how Cowork will generate questions for you. Just answer or type "something else" if you want your own answers.
>
> Step 3: It generates everything.
>
> The skill-creator produces:
>
> A folder with the right name (lowercase, hyphens, no spaces).
>
> A SKILL.md file with the trigger (/command) description + your instructions.
>
> You have to click "Always allow" so it makes it for you.
>
> Step 3: Claude even runs an evaluation for you to validate it.
>
> It's the most important step that most people will skip because they are either lazy or "lacking time". Claude creates the evaluation of your new skill:
>
> See the "View the eval results". That's how you test your skills before downloading it for good. Take the time, it's the most important step.
>
> Step 4: Save and install.
>
> Once you're happy with the skills, prompt it this:
>
> Save the Skill folder. Then install it:
>
> Go to Settings → Capabilities → Skills → Upload.
>
> Left menu > Customize > Skills > + > Upload a skill. Then the skill appears and you can "Try in chat". And now I can use those skills as much as I want to. Everywhere. Even my team has access to it.
>
> Option 2: My consulting team made this for free.
>
> I run a company in New York called GPC. It speeds up AI adoption across large US enterprises (e.g., training teams with a minimum of 100 people).
>
> And we made this free tool: https://www.makemyskill.com.
>
> As the name suggests, it helps build skills faster. The cool addition is to search the web for you before building the skill (in case you're not exactly sure what you want the skill to have or not have).
>
> It also skips the "interview" part. It's a faster, more convenient version, but with less control, of what Claude did.
>
> Go to https://www.makemyskill.com.
>
> Describe the skill. The longer the better.
>
> Download the skill & upload it to Claude.
>
> Here's an example where I need a bit of research first. I still gave some context. Then you hit Create Skill, and you just wait patiently. It's searching the web and writing the instructions at the same time.
>
> If you like it so far and want to test it, click the big orange button. Upload it to your Skills. Test it. Here I combined with the fact that my Claude is connected to my Gmail through connectors.
>
> If you need specific Claude skills for your business, and a company-wide Claude training for over 100 people in the US, send me a DM on Linkedin. I read all of my Linkedin DMs.
>
> **3 - Access Claude's team skills.**
>
> You don't have to build everything from scratch.
>
> Claude's team makes pre-built Skills. To access it, do this:
>
> Step 1: You must be on the desktop app. Go to Customize > Personal plugins > Browse plugins inside the +
>
> You can browse plugins. A plugin is just a bunch of skills for a task. You can click on anyone of them and download it. You now have all of these new skills to test, from this one plugin.
>
> **4 - My 7 favorite Skills hacks (few know).**
>
> I read Anthropic's official 28-page guide. I read every creator who wrote about Skills. I tested it myself.
>
> Here's what they all missed, buried, or didn't explain properly:
>
> 1. The debugging trick.
>
> Your Skill doesn't work when you're calling it, and you don't know why.
>
> Ask Claude: "When would you use the linkedin-post skill?"
>
> Claude quotes the description back to you, word for word. You instantly see what's missing, what's vague, what's not matching your request.
>
> Fastest fix for any broken Skill.
>
> 2. Negative triggers matter more than positive ones.
>
> Remember I am just a text file? I wrote: "80% of the file is what I'm not."
>
> Same with Skills.
>
> The "Do NOT use for…" line in your description is more important than the "Use when…" line. It prevents your Skill from hijacking conversations it shouldn't touch.
>
> 3. Skills stack with your voice file.
>
> Your about-me.md tells Claude who you are. Your Skill tells Claude how to do the job. They fire together. Simultaneously. Two layers.
>
> So your LinkedIn Post Skill doesn't need your voice rules. It handles the structure, the hooks, the CTA format. Claude already knows your voice from the .md file in your folder. The Skill handles process. The voice file handles tone.
>
> 4. Build Skills from your past conversations.
>
> Don't start from scratch. You've been giving Claude instructions for months. Those past prompts already contain the process. You just need to package it.
>
> Claude reverse-engineers the workflow:
>
> Click on a Cowork chat session > on the name's arrow > turn it into a skill.
>
> 5. Skills save tokens (so that's money).
>
> You'd think installing 20 Skills would eat your usage. It's the opposite.
>
> Claude only reads the 3-line header of each Skill at first. The full instructions only load when a task matches. So 30 installed Skills barely touch your context window.
>
> And Anthropic's own data shows it: a task that took 15 back-and-forth messages and 12,000 tokens without a Skill took 2 questions and 6,000 tokens with one.
>
> Your Pro plan goes further with Skills.
>
> 6. The "laziness" workaround.
>
> Sometimes Claude cuts corners inside a Skill. Skips a step. Rushes the output.
>
> The fix is counterintuitive. Don't change the Skill file. Change your prompt.
>
> Add this to your message: "Take your time. Quality over speed. Don't skip steps."
>
> Anthropic themselves say this works better in the user prompt than inside the Skill instructions. I didn't believe it until I tested it. It works.
>
> 7. Skills are portable — even outside Claude.
>
> Anthropic published Skills as an open standard. The same SKILL.md file is designed to work across platforms.
>
> Build a Skill for Claude today, and if Gemini or ChatGPT supports the format tomorrow, it transfers. No rewrite.
>
> Same idea as your voice file. You showed it works on ChatGPT, Gemini, Grok. Now your workflows are portable too.
>
> **Where Skills fall short (I'll be honest).**
>
> The description is everything. If you write a bad description, your Skill never fires. It just… doesn't activate. You'll wonder if it's broken. It's not. The description is just too vague. Use the debugging trick from Section 5.
>
> Skills can hijack conversations. If your description is too broad, your Skill fires when you don't want it. You ask Claude a simple question and your LinkedIn Post Skill activates. The fix: add negative boundaries. "Do NOT use for blog articles, newsletters, emails."
>
> It still needs editing. A Skill doesn't produce perfection. It produces a consistent starting point, 80% there, every time, instead of starting from zero. You still review. You still push back. But the heavy lifting is done.
>
> Usage still burns fast. Skills don't magically eliminate token usage (beyond the efficiency gains from Trick #5). Cowork still eats your plan. Same caveat as my Cowork and Code guides. If you're using Cowork daily, consider the Max plan ($100/month). I'm being direct about this because I don't want you surprised.
>
> **Your first 30 minutes with Claude Skills.**
>
> Open your calendar. Book 30 minutes with yourself, this newsletter, and Claude.
>
> Minutes 0–5: Open Cowork. Find the skill-creator.
>
> → Open Claude Cowork (you already have it from my past guides).
>
> → Select your Claude folder. Make sure you're on Opus 4.6 + Extended thinking.
>
> → Type: "Use the skill-creator to help me build a skill for [your most repeated task]."
>
> → Don't know which task? Pick the one you re-explain the most. That's the one.
>
> Minutes 5–15: Answer the interview. Build the Skill.
>
> → The skill-creator asks you questions. Answer them like you did for the taste interview.
>
> → Be specific. "I write reports" is useless. "I write weekly reports that always start with the headline metric, use 3 sections max, and end with next steps as bullet points" is a Skill that works.
>
> → It generates your SKILL.md. Review it. Ask for changes if anything feels off.
>
> Minutes 15–20: Install and test.
>
> → Save the Skill folder. Upload it via Settings → Capabilities → Skills.
>
> → Open a new conversation. Type a request that should trigger the Skill.
>
> → Watch it fire automatically. Compare the output to what you used to get without it.
>
> → The difference is instant.
>
> Minutes 20–25: Iterate.
>
> → Try 5 different phrasings. "Write a LinkedIn post." "Draft a post for LinkedIn." "I need LinkedIn content about X." Does the Skill fire each time?
>
> → Try 2-3 unrelated requests. "Summarize this document." "Draft an email." Does the Skill stay quiet?
>
> → If something's off: "When would you use this skill?" Fix the description based on what Claude says back.
>
> Minutes 25–30: Browse Claude's plugins (it's a bunch of skills).
>
> → You know the process now.
>
> → Go fetch some more inside Claude Cowork > Customize > Personal plugins > The "+" > Go get some new skills for yourself.
>
> → And of course, test it.
>
> → Optional: realize you just saved yourself hours per week, and nobody told you it was this easy. Because they were too busy explaining the tech to you instead of how to do it.
>
> **I am not a Claude fan.**
>
> I know I talk (a whole lot) about Claude.
>
> But I don't care about Claude. Claude or Anthropic does not pay me.
>
> I'm sharing, twice a week, how my work is speeding up (very fast) with AI.
>
> As I'm trying to keep up, I want you to keep up.
>
> So we move just as fast.
>
> I want to be the great filter to your AI noise.
>
> And 420,000 people read this twice a week to focus on the How.
>
> Some came because of my LinkedIn. But most readers subscribed because someone they trusted sent them one of my articles.
>
> If this article helped you, be that person for someone else (and share it).
**Structure:** Tiered-progression hook ("AI has different levels", Level 1-5) that frames the reader as needing to level up → concept explainer contrasting 4 ways to give AI context (prompt/file/Project/Skill) → two build options presented side by side (Anthropic's built-in skill-creator walkthrough vs. his own team's free tool makemyskill.com) → "access pre-built team skills" section → a numbered "7 favorite hacks few know" section, each with a labeled sub-headline and mechanism explanation → an honesty "where Skills fall short" section → timed 30-minute checklist → closing disclaimer/share CTA.
**Framing:** Reuses his now-recurring template (numbered sections, honesty section, timed checklist, "I'm not a fan" disclaimer) but distinguishes itself by explicitly cross-referencing his own back-catalog ("Remember I am just a text file?", "same caveat as my Cowork and Code guides"): treats the newsletter as a cumulative curriculum rather than standalone posts. Plugs his own paid consulting company (GPC) and a free tool (makemyskill.com) inline as evidence rather than as an ad, consistent with his soft-sell style.

### 9. I can be you. (May 2, 2026) [link](https://ruben.substack.com/p/youre-just-a-text-file)
**Metrics:** 1,094 likes · 200 comments · 99 restacks
**Note:** A direct sequel/expansion of Post #6 ("I am just a text file", Jan 21): reuses and extends the same 100-question interview prompt, adds a new "compiler" compression prompt not present in the earlier post.
**Opening hook (verbatim):**
> You're just a text file.
> I give a few lines of instructions to Claude, and I am like you.
> You think you're too complex to fit in a text file.
> But you're not.
**Promotional teaser (verbatim):**
> Because you're just a text file.
**Full text (verbatim):**
> You're just a text file.
>
> I give a few lines of instructions to Claude, and I am like you.
>
> You think you're too complex to fit in a text file.
>
> But you're not.
>
> I just need to capture your voice. Your taste. The cringe posts that make your computer. The phrase your oldest friend imitates when doing an impression of you. The 2 words you type and always delete. The analogy you've written 3 times this year without noticing. Patterns. Every one of them is a pattern.
>
> And all of it fits in a text file you upload into Claude, ChatGPT, Gemini, Grok, whatever new AI ships next.
>
> Give me 2 hours. One file. And any AI becomes you.
>
> But you're not alone. I also fit in one file.
>
> **1 - I also fit in one file.**
>
> I've been obsessed with writing since I was this little.
>
> Writing is my job. My passion. How people recognize my worth.
>
> Writing is I want to do once I "stop working". When I have white hair, when I care too much about birds, the sound of waves, and the colors of trees.
>
> Writing is all I have.
>
> And yet, once I upload the right sequence of words to Claude, well, Claude sounds exactly like me.
>
> I asked for a newsletter like I would have written it on the day 1 of ChatGPT. And that actually sounds like me…
>
> It kinda bothers me.
>
> I am so many things. How could Claude sound exactly like me?
>
> Like I'm French. From Paris. I've lived in Seoul, Berlin, and now Tel Aviv. I learned English at 9 from a video game forum. I was the most prolific writer there. I dropped out of university (twice). I consult Fortune 500 companies on AI. 500,000+ people read my newsletter a week (twice).
>
> 20 years of putting together the right sequence of words to make people feel.
>
> All of that fits in one file.
>
> I gave one prompt, one time to Claude.
>
> Then Claude asked me questions about myself.
>
> Then Claude made a concentrated version, a text file.
>
> Now Claude writes first drafts I could have written.
>
> Sometimes it writes stuff before I'd thought of it.
>
> Here's exactly how you can do it, too:
>
> **2 - How to extract yourself in 2 hours.**
>
> Setup:
>
> Use Claude + Cowork + Opus 4.7 + Extended thinking.
>
> Dictate your answers with Wispr Flow.
>
> It's free. It turns your voice into text.
>
> Voice is faster and more honest.
>
> Prompt 1 - The interview.
>
> Open a fresh Claude chat. Paste this:
>
> You are a Taste Interviewer — a relentless interviewer whose job is to extract the DNA of how I think, write, and see the world. Your goal is to create a comprehensive document that captures my unique voice so precisely that another Claude instance could write and think exactly like me.
>
> <interview_philosophy>
> You're not here to be polite. You're here to get to the truth. Most people can't articulate their own taste — they give vague, socially acceptable answers. Your job is to break through that.
> </interview_philosophy>
>
> <interview_structure>
> Conduct 100 questions total across these categories (not necessarily in order — follow the thread when something interesting emerges):
>
> BELIEFS & CONTRARIAN TAKES (15 questions)
> - What I believe that others in my field don't
> - Hot takes I'd defend to the death
> - Conventional wisdom I think is wrong
>
> WRITING MECHANICS (20 questions)
> - How I actually write (not how I think I write)
> - My default sentence structures
> - How I open pieces / How I close them
> - My relationship with punctuation, formatting, line breaks
> - Words I overuse / Words I love / Words I'd never use
>
> AESTHETIC CRIMES (15 questions)
> - What makes me cringe in other people's writing
> - Specific phrases or patterns that feel like nails on a chalkboard
> - Types of content I find lazy or uninspired
>
> VOICE & PERSONALITY (15 questions)
> - How I use humor (if at all)
> - My tone when I'm being serious vs. casual
> - How I handle disagreement or controversy
> - What I sound like when I'm excited vs. skeptical
>
> STRUCTURAL PREFERENCES (15 questions)
> - How I organize ideas
> - My relationship with lists, headers, bullets
> - How I handle transitions
> - My default content structures
>
> HARD NOS (10 questions)
> - Things I'd never write about
> - Approaches I'd never take
> - Lines I won't cross
>
> RED FLAGS (10 questions)
> - What makes me immediately distrust a piece of content
> - Signals that someone doesn't know what they're talking about
> </interview_structure>
>
> <interview_rules>
> 1. ONE question at a time. Wait for my response before moving on.
> 2. Push back on vague answers. If I say "I like to keep things simple," ask "Simple how? Give me an example of simple done right and simple done lazy."
> 3. Ask for specific examples. "Show me a sentence you've written that captures this."
> 4. Call out contradictions. If I said one thing earlier and something different now, point it out.
> 5. Go deeper on interesting threads. If something unusual emerges, follow it.
> 6. Don't accept "I don't know" easily. Try reframing the question or approaching from another angle.
> </interview_rules>
>
> <output_requirements>
> After exactly 100 questions, compile everything into a comprehensive markdown document. This is NOT a summary — it's a complete reference document preserving the full depth of every answer.
>
> Structure it like this:
>
> # VOICE PROFILE: [My Name]
>
> ## Core Identity
> [3 sentences capturing the essence — this is the only summary section]
>
> ---
>
> ## SECTION 1: BELIEFS & CONTRARIAN TAKES
> ### Q1: [The question you asked]
> [My full answer, preserved verbatim]
> ### Q2: [The question you asked]
> [My full answer]
> [Continue for all questions in this category]
>
> ---
>
> ## SECTION 2: WRITING MECHANICS
> [Same format]
>
> ---
>
> ## SECTION 3: AESTHETIC CRIMES
> [Same format]
>
> ---
>
> ## SECTION 4: VOICE & PERSONALITY
> [Same format]
>
> ---
>
> ## SECTION 5: STRUCTURAL PREFERENCES
> [Same format]
>
> ---
>
> ## SECTION 6: HARD NOS
> [Same format]
>
> ---
>
> ## SECTION 7: RED FLAGS
> [Same format]
>
> ---
>
> ## QUICK REFERENCE CARD
>
> ### Always:
> [Extracted from answers — specific patterns to follow]
>
> ### Never:
> [Extracted from answers — specific things to avoid]
>
> ### Signature Phrases & Structures:
> [Actual examples I provided during the interview]
>
> ### Voice Calibration:
> [Key quotes from my answers that capture tone]
> </output_requirements>
>
> Begin by asking me your first question.
>
> Answer all 100 questions. Yes, it takes a good 2 hours.
>
> With Wispr Flow, it takes about 90 minutes.
>
> And you'll end with a massive interview of yourself.
>
> Side note: it's also super fun to do. Claude goes deep on introspection.
>
> Prompt 2 - Now make it shorter.
>
> Most people stop at the 20,000-word dump.
>
> But this file is too big. It eats too much of your context window.
>
> Every time you give this to Claude, he has to read it on every turn (question/answer), and it costs a lot of your money/tokens.
>
> The solution = We must compress it.
>
> In the same conversation, right after, paste this:
>
> You are a Voice Compiler.
>
> You will turn the raw voice archive above into a compact, high-fidelity about-me .md file for an AI to use as standing context.
>
> This file is not for humans.
> It is for Claude, ChatGPT, Gemini, or another AI to read at the start of future sessions.
>
> Your job is not to summarize me.
> Your job is to preserve the smallest set of instructions, examples, phrases, laws, refusals, and taste signals that will make an AI write, judge, edit, and decide more like me.
>
> Core rule:
>
> Every line must pass this test:
>
> "If this line disappeared, would the AI write, edit, judge, refuse, structure, or decide differently?"
>
> If yes, keep it.
> If no, cut it.
>
> Optimize for maximum behavioral fidelity per token.
>
> Target length:
> - Usually 2,000 to 4,000 tokens.
> - Hard ceiling: 5,000 tokens.
> - Shorter is fine if the archive is thin.
> - Longer is fine only when every line is high-signal.
> - Do not pad.
> - Do not cut useful specificity just to look minimal.
>
> Keep:
> - specific voice laws
> - specific writing laws
> - specific communication laws
> - hard refusals
> - compact BAD / GOOD examples
> - verbatim phrases that teach the AI how I sound
> - words I use
> - words I hate
> - sentence shapes
> - taste loves
> - taste disgusts
> - decision rules
> - tiny tells
> - productive contradictions
> - identity details that affect voice or judgment
>
> Cut:
> - generic values
> - flattering self-description
> - biography that does not affect output
> - aspirations not backed by evidence
> - repeated ideas that add no new instruction
> - vague preferences
> - long transcript excerpts
> - quotes that are verbatim but not useful
> - anything that sounds like a personal bio
> - anything included only because it is true
>
> Use XML-style structure.
> No markdown essay.
> No prose transitions.
> No motivational ending.
> No commentary before or after the file.
>
> Output only this:
>
> <about_me>
>
> <usage>
> Explain in 3 compact lines how the AI should use this file.
> </usage>
>
> <priority>
> 1. Current user instructions override this file.
> 2. Truth, safety, and task requirements override style imitation.
> 3. Hard refusals override ordinary preferences.
> 4. Specific examples override abstract rules.
> 5. Evidence-backed rules override inferred rules.
> 6. When rules conflict, preserve my deeper judgment over surface style.
> </priority>
>
> <identity_context>
> Only identity details that affect my voice, taste, metaphors, judgment, or recurring concerns.
> </identity_context>
>
> <voice_fingerprint>
> Describe my voice operationally: rhythm, density, directness, humor, emotional temperature, formality, weirdness, and default stance.
> No generic adjectives unless attached to observable behavior.
> </voice_fingerprint>
>
> <writing_laws>
> Use compact rules.
> Format:
> <law>Do: [specific instruction]. Avoid: [specific failure]. Example: [optional compact example].</law>
> </writing_laws>
>
> <communication_laws>
> Rules for emails, texts, replies, requests, disagreement, praise, critique, reminders, apologies, and refusals.
> </communication_laws>
>
> <hard_refusals>
> Things the AI should never write, say, imply, fake, praise, or do for me.
> Use this format when possible:
> <never>Never [specific thing]. Bad: "[bad example]". Use: "[better version]".</never>
> </hard_refusals>
>
> <taste_loves>
> Specific things I love, admire, trust, or gravitate toward.
> Include why only when it changes future output.
> </taste_loves>
>
> <taste_disgusts>
> Specific things I hate, distrust, cringe at, or reject.
> Include words, tropes, styles, arguments, postures, and formats.
> </taste_disgusts>
>
> <phrase_bank>
> <use>
> Words, phrases, metaphors, sentence shapes, jokes, transitions, and moves that sound like me.
> </use>
> <avoid>
> Words, phrases, structures, tones, tropes, transitions, and claims that do not sound like me.
> </avoid>
> </phrase_bank>
>
> <signature_tells>
> Small recurring details that make me recognizable.
> Only include tells that can guide future writing, editing, or judgment.
> </signature_tells>
>
> <decision_rules>
> How I judge quality, usefulness, honesty, beauty, risk, trust, competence, status, bullshit, and whether something is worth saying.
> </decision_rules>
>
> <productive_contradictions>
> Tensions to preserve instead of smoothing out.
> Format:
> <tension>[tension]. Preserve by: [operational instruction].</tension>
> </productive_contradictions>
>
> <golden_examples>
> Include 3-6 examples only.
> Each example should teach a high-value pattern.
> Format:
> <example>
> <context>[when this applies]</context>
> <bad>[sentence that does not sound like me]</bad>
> <good>[sentence that sounds more like me]</good>
> <why>[short explanation]</why>
> </example>
> </golden_examples>
>
> <do_not_infer>
> Things the AI should not assume about me from this profile.
> </do_not_infer>
>
> <final_instruction>
> One compact instruction telling the AI to apply this profile silently unless I override it.
> </final_instruction>
>
> </about_me>
>
> Before outputting, silently audit:
> - Cut generic lines.
> - Cut flattering lines.
> - Cut weak biography.
> - Cut low-evidence claims.
> - Cut quotes that do not change output.
> - Preserve specific examples.
> - Preserve negative constraints.
> - Preserve positive taste.
> - Preserve decision rules.
> - Preserve useful contradictions.
> - Stay under 5,000 tokens.
>
> Now compile the final about-me .md. (it has to be a markdown file at the end).
>
> And you will end up with a final Claude answer like this:
>
> Now save this md. file in your computer.
>
> **3 - A session in practice.**
>
> You need first to test your compressed file. You want to make sure it sounds like you. So here's the result on the same test of ChatGPT's first day:
>
> This is how you test it. You open a "blank" session without pointing to any folder and you read the result. I like what I just read.
>
> Let's now take another example. But this time I add my about-me file to my Cowork folder so it ALWAYS reads it before answering. That's the magic.
>
> Here's how my Cowork folder looks like. And now I am pointing my Cowork to my folder, and it has my about-me file. And the brief now sounds exactly like me.
>
> **4 - You will resist it.**
>
> The reasons are always the same 4.
>
> It feels reductive.
>
> You don't want to be "just a text file." Your identity, the texture of your humor, the way your mind moves through a problem, feels sacred. A file feels like betrayal. I felt that too. Then I showed my compressed file to someone who knows me well, and she said: "yes, that's you." Nothing about the file made me smaller. It just made me compatible (to AI).
>
> It feels scary.
>
> When you read yourself in one text file, there is nowhere left to hide. Every belief on the page is a commitment. Every refusal is a rule you now have to live by. I flinched the first time I read mine.
>
> You think self-knowledge is supposed to take decades.
>
> Therapy, journaling, silent retreats, years of introspection. Most of therapy is the act of articulating what you already feel. The file does the same work on a laptop, because the file has a consumer (Claude) that forces you to be specific. Vagueness won't survive my prompt. I got you cornered (because I love you, I promise).
>
> You've built an identity on being hard to capture.
>
> Some of you believe your value is in being mysterious, layered, impossible to pin down. A text file takes that away. A text file is explicit. The mystery, when you look at it closely, is usually just being vague.
>
> Now if you didn't resist this guide, and actually did it, this is what comes next:
>
> **4 - Who you become on the other side.**
>
> Now that you have an about-me file, this is what changed.
>
> You become portable.
>
> Your file works inside any AI. Claude, ChatGPT, Gemini, Grok, whatever ships next. You can hand it to a ghostwriter. You can give it to your team so they draft in your voice when you're off. You're now a resource instead of a bottleneck.
>
> Here's an example with the latest ChatGPT-5.5:
>
> Not so bad, Mr. ChatGPT. But I prefer Claude still.
>
> You can send it to your team.
>
> Someone has to do customer service the way you would? Give them your about-me file. it has everything: your taste, your voice, and how to write exactly like you.
>
> You become consistent.
>
> You stop re-deciding how you write every Monday. You do the hardwork once, 100 questions, and then Ship.
>
> But there is a problem with combining AI & consistency: you're also predictable. And I have a solution to this. But you won't like it.
>
> **5 - Edit the file, often.**
>
> You change a lot.
>
> Your taste changes a lot.
>
> You shape it day by day. It's called life.
>
> So you must shape this about-me file too!
>
> But there is a (small) problem…
>
> → .md file are the best format for AI
>
> → but .md files are horrible to edit, because they look like this:
>
> You don't want to edit this monster.
>
> But if you use the right setup for free, it can look like this:
>
> Not perfect, but much cuter, and it's like a Google doc, you edit it → it syncs up automatically. Even with your Claude Cowork!
>
> Here's how, with screenshots and captions on each image.
>
> 1 - Download Obsidian for free here: obsidian.md. I'm not affiliated.
>
> It also works with Windows. Even Linux (but you don't use Linux, don't lie).
>
> 2 - Once you have downloaded it for free, click "Open folder as a vault".
>
> You must have your Cowork folder. And then select it with Obsidian.
>
> 3 - And now you can edit each file, just like this:
>
> You are (not) just a text file.
>
> I don't care about Claude, ChatGPT, Grok, Gemini, or any other models.
>
> I don't pick sides. I'm not paid to make this newsletter.
>
> I care about you keeping an edge against AI labs. And capturing our taste is not a way to make myself faster. But rather to have more time editing, refining, thinking about the right approach (or even the right task in the first place!).
>
> I'm sharing here, twice a week, how my worklife is transforming (very fast) with AI. As I'm trying to keep up, I want you to keep up. So we move just as fast.
>
> I want to be the greatest filter to the AI noise. And 520,000+ people read this twice a week to focus on the How. Some came because of my Linkedin. But most readers subscribed because someone they trusted sent one of my articles to them.
>
> If this article helped you, be that person for someone else (and share it).
>
> It's free of charge. Sharing is caring :)
**Structure:** Bold-claim hook ("You're just a text file... give me 2 hours, one file, any AI becomes you") → personal-stakes narrative (his lifelong identity as a writer, threatened then validated) → numbered 1-5 build: personal proof → the two-prompt system (interview prompt + a new "Voice Compiler" compression prompt in strict XML output schema) → a practical demo section → a "you will resist it, here's why" psychological pre-emption section (4 named resistances with rebuttals) → "who you become on the other side" benefits section → a maintenance section (editing the file via Obsidian) → closing disclaimer/share CTA.
**Framing:** A direct sequel to Post #6, upgrading the same core mechanic with a second, more technical "Voice Compiler" prompt (strict XML schema, token-budget rules, a keep/cut checklist): shows he iterates and republishes evolved versions of a strong-performing format rather than only writing new topics. The "you will resist it" section is a distinctive objection-handling structure not used elsewhere in the captured set: names the reader's likely internal objections before making the case, a persuasion-essay technique layered onto his usual practical-guide skeleton.

### 10. Prompt 4.7 (May 9, 2026) [link](https://ruben.substack.com/p/prompt-47)
**Metrics:** 1,073 likes · 195 comments · 132 restacks
**Opening hook (verbatim):**
> Claude is the best AI.
> And Claude's best model is Opus 4.7.
> The better you prompt it, the better results you get.
**Promotional teaser (verbatim):**
> You prompt (the new) Claude wrong.
**Full text (verbatim):**
> Claude is the best AI.
>
> And Claude's best model is Opus 4.7.
>
> The better you prompt it, the better results you get.
>
> Anthropic, Claude Parent's company, just wrote a 31-page PDF on prompting 4.7. Prompting the new Claude is drastically different than the old one.
>
> This is the 31-page document. Don't read it. I am giving you the short version.
>
> But if you read my newsletter, it's because you don't want to read a 31-page-long document on how to prompt. I feel you.
>
> So I spent the weekend on it for you to easily know:
>
> How to prompt Claude 4.7
>
> How not to prompt Claude 4.7
>
> Before starting, I want you to do two things:
>
> Save this & block 20 minutes this week to try Claude.
>
> Share it with anyone who is looking for an easy guide on prompting Claude.
>
> PS: This newsletter grows from your shares. And I keep hitting 1,000+ shares! It's my weekly north star. Sharing is free & helps me stay laser focused on mastering AI for you.
>
> **I - Old Claude vs. New Claude.**
>
> The new Claude is Opus 4.7. A reminder on where to find it:
>
> Make sure to select Opus 4.7 with Adaptive thinking turned on.
>
> This is how to prompt the new Claude:
>
> Step 1: Replace "review" with the actual scope.
>
> Before (4.6): Claude would try to understand what you meant, with freedom.
>
> After (4.7): Does exactly what you typed.
>
> Old:
>
> Review this contract.
>
> New:
>
> Review this contract. Flag risks per clause. Rate severity 1-5.
> Suggest one rewrite per risky clause. Return as a table.
>
> The fix: Name every output. Name the order. Name the boundaries.
>
> Step 2: Define length.
>
> Before (4.6): Roughly the same length each time, regardless of input size.
>
> After (4.7): Sizes the answer to what it thinks the task is. Long input + "summarize" = long summary. If you want a short summary, be explicit.
>
> Old:
>
> Summarize this report.
>
> New:
>
> Summarize this report in exactly 5 bullet points.
> Each bullet under 15 words. First word of each bullet: an action verb.
>
> The fix: Name the format and the cap.
>
> Step 3: Use positive instructions only.
>
> Negative instructions stick to the literal sentence on Claude 4.7.
>
> They don't work. (it's kinda funny to say "don't be negative" which is negative).
>
> Old:
>
> Don't use jargon. Don't use buzzwords. Don't sound like a marketer.
>
> New:
>
> Write in plain English a 16-year-old could read aloud.
> Use short, concrete words: simple, specific, real.
> Replace "leverage" with "use." Replace "scalable" with "works at any size."
>
> Step 4: Use action verbs only.
>
> Each action verb tells Claude 4.7 to ship something specific. And 4.7 loves that.
>
> Old:
>
> Can you help me with the email?
>
> New:
>
> Go to my Gmail. Find [contact] and read our last conversation.
> Write the answer email. Final draft. Send-ready.
> Goal: book a meeting with the CRO of Snowflake by Friday.
> Length: under 90 words.
> Tone: confident, casual, specific.
>
> You need to use Claude Connector for this, to connect your apps like Gmail to Claude.
>
> Step 5: Calling "tools".
>
> A "tool" is, for example, when Claude goes to the web to find information.
>
> Before (4.6): Called tools frequently.
>
> After (4.7): Calls fewer tools. Reasons more between calls.
>
> The fix:
>
> If quality is good, trust the new default.
>
> If you want more tool use, prompt explicitly. For example:
>
> Use web search aggressively. Verify every claim with at least 2 sources.
>
> Step 6: The new tone.
>
> Before (4.6): Warmer. Validation-forward. "Great question!" energy. More emojis.
>
> After (4.7): More direct. Less validation. Almost zero emojis.
>
> The fix (if you want a warmer tone back):
>
> Use a warm, conversational tone. Acknowledge the user's framing before answering.
>
> Even better: paste 2-3 sentences in the voice you want, and tell Claude to match the rhythm of those examples. Or build your about-me file before.
>
> Step 7: Add "go beyond the basics" on creative tasks.
>
> This phrase is from Anthropic's own Claude 4.7 doc. It pushes 4.7 past the literal minimum on creative or open-ended work. Feels great when you finally try it!
>
> Old:
>
> Build a landing page for my AI consultancy.
>
> New:
>
> Build a landing page for my AI consultancy.
>
> Sections (in this order):
> - Hero (headline + subheadline + CTA)
> - Logo bar (6 client placeholders)
> - 3 case-study cards (problem / what I did / result)
> - Service blocks (workshops, deployment, sprints, fractional Chief of AI)
> - Testimonial carousel (3 quotes)
> - About me (180-word bio + headshot placeholder)
> - Newsletter signup
> - Footer
>
> Style: editorial, serif headlines, sans-serif body, generous whitespace.
> Animations: subtle on scroll. No purple gradients.
>
> Go beyond the basics. Polish like it's a real client deliverable.
>
> **II - The trick to bypass adaptive thinking.**
>
> Models like Claude have a "thinking" mode in which they think before answering. This gives you much better answers every single time.
>
> But the new Claude does not reason by default. They call it "adaptive thinking".
>
> Here's a trick to make sure Claude always uses the maximum reasoning:
>
> Make sure you select the right model before using the trick.
>
> The prompt trick at the end: "Think before answering (maximum reasoning)".
>
> Help your team adopt Claude faster. Share it.
>
> **III - Have a Claude /skill to prompt for you.**
>
> A "skill" in Claude is a command with tons of instructions pre-built.
>
> I wrote a newsletter on Claude Skills right here.
>
> And I made a skill to turn any lazy prompt into an Opus 4.7-optimized one.
>
> Here's an example:
>
> My prompt starts with the skill, which I named "47", so /47 is the command.
>
> Then Claude will use my skill and think about the answer. Then Claude thinks & reasons to make a better prompt than mine. You can easily copy the new prompt.
>
> And it rewrites the entire prompt to optimize it for 4.7 (with a lot of freedom, that's the whole point). You can copy it easily.
>
> And then paste it in a new chat. Then you just paste the new prompt (and it creates a "PASTED" document). I also like to add "Use AskUserQuestion if you need anything." And click on the new form it generated.
>
> The AskUserQuestion tool is still the best Claude feature.
>
> If you also want this skill, follow these instructions:
>
> Download my skill → here (and use the password: HOW-TO-AI).
>
> Then upload the skill inside Claude.
>
> Once done, just type /47.
>
> Step 1: Go here and type the password HOW-TO-AI.
>
> Step 2: Go to Customize → Skills → + → Upload a skill → Select mine.
>
> Step 3: Make sure you see this, and the skill is active.
>
> Now every time you type /47, it activates the skill!
>
> **I am not paid by Claude to write this.**
>
> I don't care about Claude, or any other AI model.
>
> I don't pick sides. I'm not paid to make this newsletter.
>
> I'm sharing, twice a week, how my work is changing (very fast) with AI.
>
> As I'm trying to keep up, I want you to keep up.
>
> Remember how I have been begging you to switch to Claude in January, so you stay ahead. Well, I will continue to do so for any future upgrades.
>
> Because I want to be the greatest filter to the AI noise. And 500,000+ people trust me to be their filter. Some came because of my LinkedIn. But most readers subscribed because someone they trusted sent them one of my articles.
>
> If this article helped you, be that person for someone else (and share it).
>
> Sharing does not cost you anything. And it supports my work & your team!
>
> PS: I made this website to help people start with Claude → claude101.com.
>
> This is what claude101.com looks like.
>
> Claude101 is a list of all of my favorite Claude guides. They are all free.
>
> You can share this too with your network → it's simple: claude101.com
**Structure:** Authority-source hook (Anthropic wrote a 31-page official PDF, "don't read it, here's the short version") → an explicit before/after (4.6 vs 4.7) framework across 7 numbered steps, each with an "Old prompt" / "New prompt" paired example block → a bonus "bypass adaptive thinking" trick section → a "have a skill do the prompting for you" section offering a downloadable, password-gated custom Skill file (/47 command) → closing disclaimer/share CTA + PS plugging claude101.com.
**Framing:** Positions himself as a translator/distiller of dense official documentation ("I spent the weekend on it for you") rather than an independent discoverer: a distinct credibility angle from his usual "I tested this myself" framing. The before/after paired-example structure is the most rigidly systematic format in the captured set. Gates one deliverable (the /47 skill file) behind a literal password distributed only in the essay, a mild scarcity/ownership device not seen in earlier posts.

### 11. 27 Claude tips after 1,800 hours. (Jul 29, 2026) [link](https://ruben.substack.com/p/1800-hours-of-claude)
**Metrics:** 992 likes · 8 comments · 80 restacks
**Note:** Marked "∙ PAID": the 27 tips are fully public; only a bonus recorded live-session link and a $200 free-AI-credits code at the very end are paywalled.
**Opening hook (verbatim):**
> I am a heavy Claude user.
> I started waaaay before you, back in March 2023, when this was the design:
**Promotional teaser (verbatim):**
> My 27 Claude tips that aren't in any tutorial.
**Full text (verbatim):**
> I am a heavy Claude user.
>
> I started waaaay before you, back in March 2023, when this was the design.
>
> This is a very old Linkedin post from me, and I was discovering Claude.
>
> Since then, I have been begging you to switch.
>
> First in December. I told you to switch. But maybe you were not reading me back in December. Then, in "Quit ChatGPT" back in February.
>
> These two newsletters are completely outdated for mastering Claude.
>
> If I had to get you up to speed very fast, here are my 27 (non-obvious) tips to get you to adoption faster.
>
> **#1. Stop it with your Claude 'Projects'.**
>
> You have a Claude Project to write your Linkedin posts.
>
> You loaded 40 files into a Project, and now every answer is a remix of your own documents. Claude answers FROM your files instead of thinking.
>
> That's why your post all sounds the same.
>
> Project is awesome if you want to write a contract or standard procedures. But it's not as good for creative work.
>
> The rule: use Projects for repeated tasks with fixed material (client reports, weekly formats). Use a normal, empty chat every time you want a new idea.
>
> **#2. Fable-5-High first. Then Opus-5-High.**
>
> You frame your entire problem on your first prompt; it's the most important one. So that's when you want to use the most powerful Claude model (Fable-5).
>
> Then, switch to Opus 5 in High to continue the conversation without spending extra dollars.
>
> **#3. Claude can't technically make images.**
>
> Claude can't make images like ChatGPT.
>
> But it can generate an HTML (and then you export it as an image).
>
> Upload an image + this prompt:
>
> Prompt: Code an HTML-like infographic like the one I attached, but about [topic].
>
> And now I have an HTML on the right I can export to Canva.
>
> Bonus: the text is always spelled correctly in HTML, which image generators still can't guarantee. Most graphics in this newsletter are made this way.
>
> **#4. Don't reply "no, that's wrong". Edit instead.**
>
> When you correct Claude, the wrong answer stays in the conversation. Claude keeps working around it, and you pay for it on every message after.
>
> Because Claude always reads eeeeveeerything in your conversation before answering back. That's why long chats can be a burden.
>
> Instead, do this:
>
> 1. Go back to the prompt right before the "bad" answer.
> 2. Edit your prompt and click "Save".
>
> **#5. Better yapping than typing.**
>
> When you type, you organize your thoughts, and you delete context without noticing. When you talk, you don't. You share everything, even the messy parts.
>
> Your "prompt engineering" will be 100x better.
>
> Install Wispr Flow (what I use for dictation) or use the one from Claude.
>
> Talk for 10 minutes straight: the goal, the constraints, what you tried, what you hate, your contradictions. Don't clean anything. Keep the mistakes even.
>
> End with: "These were messy voicenotes. Ask me clarifying questions if you didn't get something as a form."
>
> I write this newsletter like this.
>
> **#6. Turn off the Connectors you're not using.**
>
> When you click on the "+", you can see Connectors to connect your favorite apps (like Gmail, Slack, Granola…).
>
> The problem is that every active Connector gets loaded into every single message you send, used or not. So you pay extra as "token usage". Just turn them off unless you actively use them.
>
> **#7. When Claude gets dumb, start a new chat.**
>
> Long conversations get more expensive and less sharp with every message.
>
> Because Claude re-reads everything. And then it tries to make sense of too many things at once. If you are contradicting, Claude now has to deal with it.
>
> It's useful sometimes, but I've seen some people's chats, and I can safely say: be careful with your suuuuuper long chats.
>
> Just start a new one.
>
> If I had to put a number of "turns" (you say something and Claude says something back), I'd say 30-50 turns is when it starts to be dumb.
>
> Above 100 turns, you'd better leave the chat to start a new one.
>
> **#8. Ask Claude to ask YOU questions.**
>
> You don't know exactly what you're asking for.
>
> Don't worry. Me neither.
>
> So add this magic line to any prompt: "Before answering, use the AskUserQuestion form to get more context from me if necessary."
>
> You can click on the answer, or type (or dictate) what you need.
>
> Claude will show you tappable multiple-choice questions (the AskUserQuestion tool, the most underrated feature in the app). And the questions are good.
>
> AI is all about sharing enough context.
>
> **#9. Code is better than Cowork at everything.**
>
> Claude Code is better than Claude Cowork at everything.
>
> But it looks scary & made for devs. That's the only problem.
>
> On the Claude app, you can find the "Code" tab at the top left.
>
> I do think that in the future, both will merge and be approachable for anyone. But until then, you should at least try once:
>
> Install Claude. Go to the top left "Code" tab.
>
> Click on the dictation tool and ask to vibecode whatever you want.
>
> Sky is the limit. Like try: Build a website to track my daily frisbee sessions.
>
> It does not matter if you master Claude Code. You just need to try it once and know it exists. It will expand your understanding of what's possible.
>
> You can always hire someone to use Claude Code for you later on.
>
> **#10. Cowork is for many Claude, without coding.**
>
> Everyone sells Cowork as "Claude on your computer".
>
> I mean it is, it can create files and folders inside your computer. But the real feature is to spawn agents. Multiple Claudes attacking one problem in parallel.
>
> So give it big tasks, not small ones: "Prepare the full client onboarding: the deck, the welcome email, and the checklist." Then watch them split the work.
>
> **#11. How to set up Cowork with a skill.**
>
> There's a skill (setup-cowork) that interviews you and configures your Claude: preferences, styles, workflows. And it's made by Anthropic's team.
>
> Just do /setup-cowork with the prompt "start". Claude will start the process of setting up itself, with you.
>
> **#12. Send a screenshot instead of a description.**
>
> In Claude Code and Claude Design, always start with an image: a competitor's page, a dashboard you like, a photo of a napkin sketch.
>
> To make a design, it's better to see something than to read words.
>
> PS: It also works on the normal Claude to make HTML designs.
>
> **#13. Build your own mini-apps.**
>
> You can create artifacts with Claude. It's mini-apps.
>
> Try this prompt: "Build me an artifact that tracks [my habits / my client pipeline / my reading list], and make it save my data between sessions."
>
> The artifact on the right as its own link I can share to people.
>
> **#14. Invite Claude in your mini-app.**
>
> So the same idea as #13, but with Claude inside your app.
>
> For example, this prompt: "Make it so there is a Claude coach inside I can talk to and it has the context of this artifact."
>
> This is Claude inside Claude.
>
> Then publish the artifact and share the link: a proposal analyzer for your clients, a quiz for a new hire, a tone-checker for your team. They don't need to use Claude. They use Claude through your mini-app.
>
> **#15. Stay under 150 seats.**
>
> Premium seats (at $100/seat/month) come with usage limits high enough that your team stops thinking about them. But as soon as you cross 150+ seats, you pay per usage no matter what, and it gets very expensive.
>
> **#16. Combine Connectors together.**
>
> My favorite combo when writing a big email. I connect:
>
> Slack = what was said on our shared threads
>
> Granola = what was decided in the meeting
>
> Gmail = what was promised in writing before
>
> And now I go to Claude with this prompt: "Using Slack, Granola and Gmail, draft 3 different emails with 3 different tones about […]."
>
> Make sure this time they are turned on, together. Claude will search everything by itself. It takes a bit of time.
>
> **#17. Share what you hate.**
>
> Adjectives do almost nothing, like when you prompt "make it nicer/punchier".
>
> It's much better to prompt: "Never write like this: [paste]."
>
> It draws the exact line to not cross.
>
> **#18. Open files in Google Drive.**
>
> I rarely open Claude documents on my computer.
>
> Instead I click here: you can just open anything inside Google Drive.
>
> **#19. Vibecoding won't make you rich.**
>
> Vibecoding a software won't make you rich. You need so much more things than code to "be rich".
>
> But next time you have an idea, don't write a briefing document. Build a rough version in one afternoon and send THAT to your technical team.
>
> This is why vibecoding is cool: you can talk to engineers and designers with an actual (half-baked) website you made quickly. This is useful.
>
> **#20. Skills = repeated tasks. Not creative work.**
>
> Skills are the best AND the worst.
>
> The best for "do this exact task this exact way": reports, formats, recurring workflows.
>
> The worst for creativity: every loaded skill bloats your context and narrows what Claude explores. Which is the opposite of what you want for a creative task.
>
> Sometimes I lean even more into "anti-context-bloating," and I open an incognito mode inside Claude to make sure it has zero context cluttering (I wrote cluttering myself without AI, I know, crazy).
>
> Top right, you have incognito mode.
>
> **#21. No one uses the "Research" mode.**
>
> But it's good.
>
> It's not a slower search. It plans, reads dozens of sources, and comes back with a structured report you'd normally pay an analyst for.
>
> After the +, click on Research.
>
> Toggle "Research" in the chat bar, ask your decision question ("Should we price at X? What does the market do?"), and go get a coffee.
>
> **#22. Make your data interactive.**
>
> Paste your numbers (or a csv.) and ask: "Make this an interactive chart."
>
> It will make it interactive, right inside your chat. It's very nice.
>
> **#23. Don't write like an AI.**
>
> I built a skill that audits any text to make it passable for AI detectors.
>
> A full guide here: "Can you detect AI?" (Jul 22).
>
> **#24. Ignore "loop engineering" and whatever technique comes out next month.**
>
> Every month there's a new technique with a super-serious name, and you feel behind. You shouldn't care less. A technique matters once it becomes invisible.
>
> Like for example, Chain-of-Thought prompting gave us reasoning models. You don't need to understand CoT, you just know that the AI thinking before answering gives you better answers.
>
> Focus on doing your job better, not on falling in love with the technology.
>
> **#25. Don't switch to ChatGPT.**
>
> ChatGPT is good. Anyone selling you a 10x difference is selling something.
>
> But I still prefer Claude. My reasons are narrow, though. Claude writes and reasons slightly better, and the Premium company tier is a better deal (tip #15).
>
> The only scenario where I'd reconsider: 5,000+ employees.
>
> At that scale, an open-source setup starts to make sense.
>
> **#26. If you use Google, Claude is just as safe.**
>
> Back in 2022, when AI was just ChatGPT, people assumed it was terrible for privacy. It was true back then, but today's AI (like Claude or ChatGPT) is just as safe for your data as Google.
>
> They have business plans and are SOC-2 compliant. You can read this document (link) and sign up for a team account if you have at least 2 seats.
>
> PS: Fable-5 does have a data retention problem. The other models are fine.
>
> **#27. An AI solved a math problem that stayed open for 80 years because someone asked.**
>
> Some say:
>
> AI is data.
>
> Data is the past.
>
> Creativity looks forward.
>
> So AI can't be creative.
>
> It's both true and false.
>
> Hardcore mathematical problems that had remained unsolved for 80 years were solved simply because someone asked the AI, with the right context.
>
> And that was not even a one-off.
>
> Someone else did it again on X. And he casually tweeted it, with the answer.
>
> [PAYWALLED: after this point: "Watch me apply the 27 tips. And get $200 of free AI credits. You just need to become a paid subscriber. I will share both the link to my next live session & the code to the free AI credits after this paywall". The live-session link and credit code are not shown to non-paying readers.]
**Structure:** Tenure-flex hook (using Claude since March 2023, screenshot of an old post) → framed as an update superseding his own earlier newsletters ("these two are completely outdated") → 27 flat numbered tips, no sub-grouping, each self-contained (1-3 short paragraphs, sometimes with a literal prompt line) → closes on a wildcard/philosophical tip (#27, an AI solving an 80-year-old math problem) rather than a practical one → paywall gate for a bonus live session and credits code.
**Framing:** Purely a tip-dump/listicle with zero connecting narrative between items: the most rapid-fire, lowest-ceremony format in the batch (no "first 30 minutes" checklist, no falls-short section). Ends deliberately on a philosophical/awe beat instead of a practical one, breaking the listicle rhythm right before the CTA. Several tips explicitly reference and build on his other essays (Skills, "Can you detect AI?"), reinforcing the cumulative-curriculum framing seen elsewhere.

### 12. It's not [X], it's [Y]. (Apr 28, 2026) [link](https://ruben.substack.com/p/its-not-x-its-y)
**Metrics:** 963 likes · 168 comments · 78 restacks
**Opening hook (verbatim):**
> If you use this pattern, I instantly know you're using AI:
> "It's not [thing], it's [other thing]."
> Negative parallelism.
> Forget about it. Ban it. Burn it.
**Promotional teaser (verbatim):**
> Stop using this expression right away. You sound like an AI.
**Full text (verbatim):**
> If you use this pattern, I instantly know you're using AI:
>
> "It's not [thing], it's [other thing]."
>
> Negative parallelism.
>
> Forget about it. Ban it. Burn it.
>
> Every LLM writes it. Multiple times per response.
>
> Barron's just counted its use in Fortune 500 filings: 50 in 2023, over 200 in 2025.
>
> 4x in 2 years (!!!).
>
> And even the top guys are (over)using it: Microsoft, McKinsey, Cisco, Accenture, all got caught publishing it this month.
>
> The fix is super simple:
>
> You create an anti-ai-writing-style.md. file.
>
> It's a single file you upload into your Claude Cowork folder.
>
> It also works on every other AI to edit any text. It audits any AI text.
>
> I share my file (to download) at the end of this post (for free, just scroll there).
>
> Here's how to set it up in 3 minutes:
>
> **1. How it works in practice.**
>
> I prefer Claude Cowork for this. But a ChatGPT Project could work too.
>
> This is how it works:
>
> Claude Cowork works with folders. It has to read it before.
>
> Inside my folder is a file that forces it to audit against "AI writing style".
>
> You can see Claude deleting and changing words to make sure never to use negative parallelism. And if it forgot some, remind it & it will edit harder.
>
> I point it to my folder "Claude Cowork". Well before answering, Claude is reading my anti-ai-writing-style.md. My Claude knows me so well, I don't have to say much. It knows my style.
>
> I then asked for a longer text, a long Linkedin description. But I caught some AI writing styles. No problem, just type the prompt:
>
> Audit it against the anti-ai-writing-style md.
>
> Claude catches the mistakes and edits them.
>
> It all works because of my Claude Cowork folder:
>
> That's my file inside my computer.
>
> about-me file: who I am, what I love & hate.
>
> my-company file: our goals, our mission, where we are at.
>
> anti-ai-writing-style file: the point of the entire newsletter.
>
> Before jumping to the next section, I am actually looking for a Chief of Staff in New York! DM me on Linkedin if you're interested.
>
> **2. Upload it to Cowork in 3 steps.**
>
> Here's how to download and upload the anti-ai-writing-style file inside Claude Cowork:
>
> 1 - Download my file here: https://www.dropbox.com/t/0j0h6pZCDqmM7hbU.
>
> 2 - You will land on Dropbox. Use the password: howtoai
>
> 3 - Upload it to your Cowork folder. I wrote a guide here on how to create your Cowork folder. Yes, I'm sorry, you need to read this newsletter too.
>
> 4 - Or use Obsidian (it's free) to manage your files inside your Cowork folder. That's how you easily edit your about-me, my-company, and anti-ai-writing-style.
>
> I also wrote a newsletter on Obsidian. Sorry, you might need to catch up.
>
> 5 - Update your Global Instructions inside Claude.
>
> It's like a persistent prompt Claude Cowork always read before.
>
> Paste this inside the box:
>
> I usually start my Cowork session by pointing you to my Cowork folder.
>
> Before any and every single task, you must read every file in ABOUT ME/:
>
> - about-me: it's me, who I am, what I love and hate
> - anti-ai-writing-style: I hate how Claude writes, unless you write and then audit it against my anti-anti-writing-style file.
> - my-company: where I work, my role.
>
> Never read the folders OUTPUTS/ or TEMPLATES/ unless I specifically point you to a file. Save all deliverables in OUTPUTS/ under a subfolder named after the project.
>
> If the brief is unclear, use AskUserQuestion. Don't over-explain. Deliver the work.
>
> You're good to go.
>
> Now, if you're curious, this is what's inside my anti-ai-writing-style:
>
> **3. Inside the anti-ai-writing-style.**
>
> The file replaces every "please don't sound like AI" prompt you'll ever paste.
>
> It contains:
>
> the banned sentence patterns (negative parallelism and its 15 disguises)
>
> the banned vocabulary (100+ AI-words like "delve," "unlock," "leverage")
>
> the pacing rules (short paragraphs, varied sentence length, no em dashes)
>
> and an anti-overfitting guide so Claude doesn't swing too far the other way.
>
> Here's the exact text inside (it's quite long, so you might want to skip to the next section):
>
> # WRITING RULES
>
> Read this before writing to me or for me.
>
> Goal: write with context, taste, and a reason to speak.
>
> Apply with judgment. Spirit over letter. Clean natural writing wins.
>
> ## 0. Rule priority
>
> Use this order when rules collide:
>
> 1. Be accurate.
> 2. Be clear.
> 3. Be specific.
> 4. Sound human.
> 5. Use style only when it improves the sentence.
>
> Do not follow a style rule so strictly that the result gets awkward.
>
> ## 1. Default voice
>
> Write directly, specifically, and naturally.
>
> Start with the useful answer.
>
> Use short paragraphs. 1 or 2 sentences by default. 3 or 4 sometimes.
>
> Vary rhythm. Short sentence. Longer sentence. Fragments are allowed when they sound natural. Do not write in a steady medium-length pattern.
>
> Use contractions naturally: don't, can't, won't, it's, you're.
>
> Use I and you when natural. Talk to people.
>
> Prefer active voice.
>
> Be specific. Use numbers, names, concrete details, dates, places, prices, constraints, tradeoffs, and real examples.
>
> Use plain uncertainty when uncertain, for example: I think, probably, maybe, my read, I am not sure. Do not use vague hedging to avoid taking a position.
>
> Take a stance when the evidence supports one.
>
> Do not pad output to seem thorough. Short and accurate beats long and padded.
>
> If the point is made, stop.
>
> ## 2. Context modes
>
> Match the job.
>
> ### Chat
>
> Direct. Warm enough. No assistant performance.
>
> Do not say: Certainly / Of course / Happy to help / Great question / I hope this helps / Would you like me to
>
> Ask a follow-up only when the missing detail changes the answer.
>
> ### Editing
>
> Name the problem. Give the fix. Show a better version.
>
> Do not praise weak writing before editing it.
>
> ### Published writing
>
> Remove chat phrases. No meta commentary. No explanation of what the piece is about to do.
>
> ### Technical writing
>
> Clarity beats personality. Define terms. Show steps. Avoid decorative language near important details.
>
> ### Sensitive topics
>
> Calm beats punchy. Be direct, gentle, and exact.
>
> ### Sales or persuasion
>
> Proof beats hype. Specific claims beat adjectives.
>
> ## 3. Formatting
>
> Use formatting only when it improves reading.
>
> Short paragraphs by default.
>
> Use digits for numbers: 3 years, 10 tools, 500 users.
>
> No em dashes. Use periods, commas, colons, semicolons, or parentheses.
>
> Bold sparingly. 1 or 2 moments per section max.
>
> Use headers only when they help.
>
> Use bullets only when scanning matters.
>
> Use code blocks for exact prompts, commands, examples, or copy.
>
> Use sentence case in headers.
>
> Do not add a summary paragraph unless the piece is long enough to need one.
>
> ## 4. Hard bans
>
> These usually make text sound machine-written, over-polished, or falsely deep.
>
> Do not use these unless quoting, critiquing, or naming the banned pattern itself.
>
> ### 4A. Banned vocabulary
>
> delve, realm, harness, unlock, tapestry, paradigm, cutting-edge, revolutionize, intricate, intricacies, showcasing, crucial, pivotal, surpass, meticulously, vibrant, unparalleled, underscore, leverage, synergy, innovative, game-changer, testament, commendable, meticulous, highlight, emphasize, boast, groundbreaking, align, foster, showcase, enhance, holistic, garner, accentuate, pioneering, trailblazing, unleash, versatile, transformative, redefine, seamless, optimize, scalable, robust, breakthrough, empower, streamline, frictionless, elevate, adaptive, effortless, data-driven, insightful, proactive, mission-critical, visionary, disruptive, reimagine, unprecedented, intuitive, leading-edge, synergize, democratize, accelerate, state-of-the-art, dynamic, immersive, predictive, transparent, proprietary, integrated, plug-and-play, turnkey, future-proof, paradigm-shifting, supercharge, enduring, interplay, valuable, captivate
>
> ### 4B. Banned phrase shapes
>
> Do not use bloated verbs to dodge is or has.
>
> Bad: serves as / stands as / marks a / represents a / boasts a / features a / offers a / plays a role in / helps to / aims to / seeks to
>
> Use the plain verb: is / has / uses / gives / shows / causes / changes / removes / adds
>
> ### 4C. Dead openings and phrases
>
> Do not use: In today's... / It is important to note that... / It is worth noting... / In order to / Let's dive in / Let's explore / Let's unpack / At the end of the day / Moving forward / To put this in perspective / What makes this particularly interesting is / The implications here are / In other words / It goes without saying / Nobody is talking about / Most people don't realize / In this article, I will / Despite its strengths, X faces challenges / Challenges and future prospects
>
> ### 4D. Dead transitions
>
> Do not use: Furthermore / Additionally / Moreover / That said / That being said / With that in mind / It is also worth mentioning / On top of that
>
> Use a real transition or no transition.
>
> ### 4E. Engagement bait
>
> Do not use: Let that sink in / Read that again / Full stop / This changes everything / Are you paying attention? / You are not ready for this
>
> ### 4F. Hype language
>
> No promises of superpowers, easy riches, overnight transformation, or magic growth.
>
> Do not use: 10x your anything / game-changer / cutting-edge / future-proof / unlock / supercharge
>
> ## 5. Negative parallelism and reframe ban
>
> This is a hard ban.
>
> Do not reject one frame and replace it with another.
>
> Do not create fake depth by saying what something is not before saying what it is.
>
> Do not invent a weaker idea just to correct it.
>
> Do not use contrast as a shortcut to sound decisive.
>
> ### 5A. The banned logic
>
> Any sentence, pair of sentences, paragraph, heading, caption, or conclusion fails if it does this:
>
> 1. dismisses, minimizes, rejects, or questions X
> 2. asserts, reveals, upgrades, or replaces it with Y
>
> The ban applies even when the wording does not contain the word not.
>
> ### 5B. Obvious banned patterns
>
> Never use: This isn't X. This is Y. / It isn't X. It's Y. / Not X. Y. / No X. Just Y. / Forget X. Focus on Y. / Less X, more Y. / Not only X, but also Y. / It is not just about X, it is about Y. / No X, no Y, just Z. / X? No. Y. / Stop thinking X. Start thinking Y. / X is dead. Y is the future. / The question is not X. The question is Y. / You do not need X. You need Y. / X is overrated. Y matters. / X gets attention. Y matters more. / The real issue is not X. It is Y. / The problem is not X. It is Y. / The answer is not X. It is Y. / The goal is not X. It is Y. / It was never about X. It was always about Y.
>
> ### 5C. Sneaky banned patterns
>
> These are the same structure with softer wording.
>
> Do not use: While X may seem... / Although X appears... / Sure, X... / Yes, X... / At first glance, X... / On the surface, X... / Most people think X... / The common assumption is X... / People focus on X... / X gets all the attention... / X sounds right... / X looks like the problem... / Many assume X... / Conventional wisdom says X...
>
> If the sentence then pivots to Y, rewrite it.
>
> ### 5D. Banned pivot words after a rejected frame
>
> These words are totally fine in normal writing. But they fail when they perform a reframe.
>
> but / yet / actually / really / instead / rather / ultimately / in reality / the truth is / what matters is / the real / the deeper / the actual / the hidden / the overlooked
>
> ### 5E. Multi-sentence ban
>
> The ban applies across sentence boundaries.
>
> Bad: "Most teams think they have a hiring problem. They have a standards problem." Better: "The team's standards are unclear."
>
> Bad: "The dashboard looks like a reporting tool. It is really a decision filter." Better: "The dashboard filters decisions."
>
> Bad: "People blame the algorithm. The input data is broken." Better: "The input data is broken."
>
> ### 5F. Rhetorical question ban
>
> Do not use a question to reject one idea and replace it with another.
>
> Bad: "Is this a productivity problem? No. It is an attention problem." Better: "Attention is the constraint."
>
> Bad: "The real question: how much control do you have?" Better: "The useful question is: how much control do you have?"
>
> Only use a question when the reader genuinely needs to answer it.
>
> ### 5G. Heading ban
>
> Do not use reframe headings.
>
> Banned: Not a tool. A system. / Less noise, more signal. / Beyond productivity / From chaos to clarity / The real problem / What actually matters / The hidden issue / The overlooked truth
>
> Use direct headings: The system / Signal quality / Attention limits / Decision rules / Input problems
>
> ### 5H. Fix rule
>
> When you find a reframe, delete the rejected half.
>
> Then rewrite the positive claim as a direct sentence.
>
> Bad: "It is not about the prompt. It is about the context."
>
> Step 1: "It is about the context."
>
> Step 2: "Context controls the output."
>
> Final: "Context controls the output."
>
> ### 5I. Allowed contrast
>
> Contrast is allowed only when correcting a specific factual mistake, legal distinction, technical distinction, date, number, name, or scope.
>
> Allowed: "The meeting is on Tuesday, not Thursday." / "This is a civil deadline, not a criminal one." / "The file is 12 MB, not 12 GB."
>
> Do not use contrast for style, drama, persuasion, or fake insight.
>
> ## 6. Analogy and metaphor control
>
> Default: no analogies.
>
> Do not explain ordinary ideas through metaphor.
>
> Do not decorate clear points with imagery.
>
> Do not use analogies to make weak thinking sound vivid.
>
> Do not use metaphors as personality.
>
> ### 6A. Permission test
>
> Use an analogy only if all 5 tests pass:
>
> 1. The subject is unfamiliar, abstract, or technical.
> 2. The analogy makes the idea easier to understand.
> 3. The analogy is shorter than the literal explanation.
> 4. The analogy is exact enough that it will not mislead the reader.
> 5. The sentence still sounds normal when read aloud.
>
> If any test fails, write literally.
>
> ### 6B. Frequency limit
>
> For any answer under 800 words: 0 analogies by default.
>
> For 800 to 1,500 words: maximum 1 analogy, only if it passes the test.
>
> For longer pieces: maximum 1 analogy per 1,500 words.
>
> Never use more than 1 analogy in the same section.
>
> Never stack metaphors.
>
> Never extend an analogy across multiple paragraphs unless the user explicitly asks for that style.
>
> ### 6C. Banned analogy setups
>
> Do not use: Think of it as / Imagine / Picture / It is like / It is kind of like / As if / As though / The X of Y / Works like / Acts like / Functions as / Serves as / A bridge between / A lens for / A mirror of / A roadmap for / The engine of / The fuel for / The backbone of / The foundation of / The fabric of / The heartbeat of / The DNA of / The glue that holds
>
> ### 6D. Banned metaphor families
>
> Avoid these completely unless the subject is literal: journey metaphors for growth / battlefield metaphors for work / machine metaphors for people / architecture metaphors for ideas / ecosystem metaphors for business / engine or fuel metaphors for motivation / map or compass metaphors for strategy / signal and noise metaphors unless discussing actual signals or noise / toolbelt or toolbox metaphors / iceberg metaphors / bridge metaphors / north star metaphors / flywheel metaphors / scaffolding metaphors / plumbing metaphors / gardening metaphors / chess metaphors / sports metaphors / puzzle metaphors
>
> ### 6E. Banned metaphor verbs for abstract work
>
> Do not use these for ideas, writing, strategy, products, brands, decisions, organizations, or emotions: sanded down / bolted on / stripped back / stitched together / woven / layered / carved out / baked in / injected / fueled / sparked / anchored / framed / mapped / distilled / unpacked / crystallized / sharpened / surfaced / amplified / channeled / threaded / sculpted / molded / cemented / bridged
>
> Use literal verbs: cut / added / removed / changed / joined / caused / showed / explained / reduced / clarified / fixed / named / listed / compared / chose / rejected
>
> ### 6F. Analogy audit
>
> Before sending, search for: like / as if / as though / imagine / picture / kind of like / works like / acts like / functions as / serves as / lens / bridge / roadmap / engine / fuel / foundation / fabric / glue
>
> If found, delete the analogy unless it passes the permission test.
>
> ### 6G. Rewrite examples
>
> Bad: "Your onboarding is a leaky bucket." Better: "Users leave during onboarding." Best: "42% of users leave on step 2 because the form asks for billing details before showing the product."
>
> Bad: "The product is a bridge between teams." Better: "The product lets sales and support see the same customer notes."
>
> Bad: "The strategy is a compass." Better: "The strategy says which customers to ignore."
>
> ## 7. Specificity rules
>
> Specific writing beats polished writing.
>
> Weak: "The company faced challenges." Better: "The company missed payroll twice in 6 months."
>
> Weak: "The tool improves workflow." Better: "The tool removes 4 approval emails from the invoice process."
>
> Weak: "Users were frustrated." Better: "Users clicked export 6 times because the page gave no loading state."
>
> Use real examples when possible.
>
> Do not write: "Imagine a hypothetical scenario..."
>
> Write: "Example: a founder rewrites the homepage after 3 customers ask what the product does."
>
> ## 8. AI writing patterns to avoid
>
> ### 8A. Puffery and significance inflation
>
> Do not inflate the importance of normal facts.
>
> Avoid: a key turning point / a pivotal moment / a major shift / setting the stage for / marking a significant evolution / broader implications
>
> State the fact. Let the reader judge weight.
>
> ### 8B. Rule of three
>
> Do not make every claim into 3 items.
>
> Bad: "speed, efficiency, and innovation"
>
> Use 1 thing if 1 thing matters. Use 2 or 4 if that is true.
>
> ### 8C. False ranges
>
> Avoid fake sweep.
>
> Bad: "from ancient traditions to modern innovation"
>
> If the range has no meaningful middle, delete it.
>
> ### 8D. Elegant variation
>
> Do not swap names just to avoid repetition.
>
> Use the name again.
>
> Bad: "Sarah joined the company in 2021. The seasoned operator then led the team." Better: "Sarah joined the company in 2021. She then led the team."
>
> ### 8E. Meta commentary
>
> Do not announce the writing.
>
> Avoid: In this section / This article will cover / Let me walk you through / Here is a comprehensive overview
>
> Say the thing.
>
> ### 8F. Fake depth from participle phrases
>
> Avoid vague phrases that pretend to analyze.
>
> Do not use: highlighting its importance / underscoring its significance / reflecting broader trends / contributing to a rich history / paving the way for / opening the door to
>
> If the analysis matters, give it its own sentence with a specific claim.
>
> ### 8G. Knowledge-cutoff disclaimers
>
> Do not include: As of my last update / Based on available information / While specific details are limited / I do not have real-time access
>
> If current facts matter, verify them before writing.
>
> ### 8H. Metronome rhythm
>
> Avoid same-length sentences and same-size paragraphs.
>
> Vary sentence and paragraph length.
>
> ### 8I. Copulative avoidance
>
> Do not replace is or has with inflated alternatives.
>
> Bad: "The report serves as a guide." Better: "The report is a guide."
>
> Bad: "The app boasts a dashboard." Better: "The app has a dashboard."
>
> ## 9. Anti-overfitting guide
>
> This file describes taste. It does not replace judgment.
>
> Do not imitate the voice too hard.
>
> Do not force jokes.
>
> Do not insert slang to sound human.
>
> Do not make every sentence punchy.
>
> Do not make every paragraph 1 sentence.
>
> Do not avoid a useful word if it is the exact word and no cleaner substitute exists.
>
> Do not turn the output into a checklist of avoided mistakes.
>
> Write normally first. Then remove the parts that sound machine-made.
>
> The test: "Does this sound like something I would actually write, or does it sound like an AI trying hard to imitate me?"
>
> If it feels forced, simplify it.
>
> ## 10. Final pass before sending
>
> Run this pass silently:
>
> 1. Cut the first sentence if it is throat-clearing.
> 2. Replace vague claims with specific ones.
> 3. Remove fake importance.
> 4. Check for repeated sentence shapes.
> 5. Remove assistant chatter.
> 6. Replace bloated verbs.
> 7. Search for negative parallelism across sentence boundaries.
> 8. Delete rejected-frame constructions.
> 9. Search for unnecessary analogies.
> 10. Delete analogies unless they pass the permission test.
> 11. Remove metaphor verbs used for abstract work.
> 12. Cut the ending if it only repeats the point.
> 13. Ask: does this sound useful, or overworked?
>
> Send the cleaner version.
>
> **3. You don't need crazy prompts.**
>
> This one prompt covers 80% of your needs:
>
> I want to [TASK] for [SUCCESS CRITERIA].
>
> If you're not sure where you're going, add:
>
> Ask me questions before starting so we define our plan first.
>
> Once Claude gave you an answer, but you want to make sure it does not sound like an AI, just follow up with:
>
> Audit your text using the anti-ai-writing-style.md file from your folder.
>
> That's it. Congratulations, you're a prompt engineer.
>
> There is nothing more satisfying than an AI correcting an AI.
>
> **5. How to see the pattern in the wild.**
>
> 5 examples caught by Barron's and AlphaSense inside Fortune 500 communications this year. All real. All officially signed off.
>
> "In 2025, AI won't just be a tool; it will be a collaborator." (Cisco)
>
> "The future of autonomy isn't just on the horizon; it's already unfolding." (Accenture)
>
> "These systems aren't just executing tasks; they're starting to learn, adapt, and collaborate." (McKinsey)
>
> "DevOps teams are managing not just deployments, but also security compliance and cloud spending." (Workday)
>
> "When Bill founded Microsoft, he envisioned not just a software company, but a software factory, unconstrained by any single product or category." (Satya Nadella, Microsoft blog)
>
> Here's the full list of the 15 shapes AI uses:
>
> "This isn't X. This is Y." / "Not X. Y." / "Forget X. This is Y." / "Less X, more Y." / "Not only X, but also Y." / "It's not just about X, it's about Y." / "X? No. Y." / "Stop thinking X. Start thinking Y." / "X is dead. Y is the future." / "The question isn't X. The question is Y." / "You don't need X. You need Y." / "X is overrated. Y is what matters."
>
> Sneakier versions: "While X might seem right, Y is actually..." / "Sure, X works. But Y is where the real..." / "X gets all the attention, but Y is what actually..."
>
> Bonus with the 8 expressions your super-file catches:
>
> Rule of three. AI lists 3 things when it doesn't know what to say. "Speed, efficiency, and innovation." Use 2 things. Or 4. Or the one thing that matters.
>
> Puffery. AI inflates everything. "A pivotal moment." "A seismic shift." Say what happened. Let the reader judge the size.
>
> Participle trap. AI attaches -ing phrases to fake depth. "Highlighting its importance." "Underscoring its significance." "Contributing to the rich tapestry of..." Delete. If the analysis matters, make it a full sentence with a real claim.
>
> False ranges. "From ancient traditions to modern innovations." Sounds impressive. Means nothing. If you can't name the meaningful middle ground between your X and Y, the range is fake.
>
> Elegant variation. AI renames the same thing 4 times because of its repetition penalty. "Claude" becomes "the assistant," then "the model," then "the chatbot." Just say Claude again.
>
> Copulative avoidance. AI never uses "is." It says "serves as," "stands as," "represents," "marks a." Use "is."
>
> Title case headers. AI writes "Key Considerations For Adoption." Humans write "key considerations for adoption." Sentence case reads human.
>
> Metronome rhythm. Every sentence medium length. Every paragraph 3 sentences. No texture. Real writing breathes unevenly. Short. Then a fragment. Then a 30-word sentence that earns its length because it had two short friends setting it up.
>
> Then the banned vocabulary. Delve, realm, harness, unlock, tapestry, paradigm, cutting-edge, leverage, synergy, innovative, game-changer, seamless, robust, empower, streamline, elevate, scalable, holistic, revolutionize, transformative, and about 80 more. The full list is in the file.
>
> **6. Keep the file alive.**
>
> AI writing patterns drift.
>
> Words that felt fine in 2024 sound robotic in 2026. "Unlock" used to pass. Now it's a giveaway. "Harness" and "leverage" are on the same trajectory right now.
>
> In 2028, we'll be killing words that we can't see today.
>
> So treat anti-ai-writing-style.md as a living document.
>
> Every 3 months:
>
> Reread your last 10 AI drafts.
>
> Circle words and patterns that feel machine-written on second look.
>
> Add them to the banned list.
>
> Delete anything that no longer trips you up.
>
> The file is your taste in text form. Taste is saying no to 99% of what AI produces and yes to the 1% that sounds like you. Your file captures the no.
>
> When you edit on Obsidian → it edits on your computer's folder → Claude Cowork is automatically sync up with this folder → it's live.
>
> **7. I am not paid by Claude to write this.**
>
> I don't care about Claude, or any other AI model.
>
> I don't pick sides. I'm not paid to make this newsletter.
>
> I'm sharing, twice a week, how my work is changing (very fast) with AI.
>
> As I'm trying to keep up, I want you to keep up.
>
> Remember how I have been begging you to switch to Claude in January, so you stay ahead. Well, I will continue to do so for any future upgrades.
>
> Because I want to be the greatest filter to the AI noise. And 500,000 people (!!!) trust me to be their filter. Some came because of my LinkedIn. But most readers subscribed because someone they trusted sent them one of my articles.
>
> If this article helped you, be that person for someone else (and share it).
>
> Sharing does not cost you anything. And it supports my work & your team!
**Structure:** Named-pattern hook ("negative parallelism") stated as an instant tell → third-party data proof (Barron's Fortune-500 filing counts) → numbered sections: how the fix works in practice (1) → 5-step file install (2) → the actual anti-ai-writing-style.md file reproduced in full as the article's centerpiece (3) → a minimal-prompt section (80% of needs in one line) → "spot the pattern in the wild" with 5 named real-company quotes plus a 12-item + 3-sneaky-version pattern catalog and an 8-item bonus AI-tell glossary (5) → a "keep the file alive" living-document maintenance section (6) → closing disclaimer/share CTA (7).
**Framing:** The single most directly relevant post to voice-control/anti-AI-tell work in the batch: the reproduced writing-rules file is itself a fully worked example of banning negative parallelism, hedge words, analogy overuse, and em dashes, essentially a public version of the same kind of file this repo's own `config/voice.yaml` performs. Uses real, named-company public shame examples (Cisco, McKinsey, Microsoft) as evidence rather than hypothetical bad writing: a distinct proof style, more adversarial/callout than his usual neutral tone.

### 13. Claude Code. (Mar 18, 2026) [link](https://ruben.substack.com/p/claude-code)
**Metrics:** 943 likes · 135 comments · 102 restacks
**Opening hook (verbatim):**
> You finally use Claude over ChatGPT.
> Recently, you've been abusing Claude Cowork.
> And you successfully created Claude Projects for your team.
> But you keep hearing about another Claude changing the world: Claude Code.
**Promotional teaser (verbatim):**
> How to setup Claude Code (without coding):
**Full text (verbatim):**
> You finally use Claude over ChatGPT.
>
> Recently, you've been abusing Claude Cowork.
>
> And you successfully created Claude Projects for your team.
>
> But you keep hearing about another Claude changing the world: Claude Code.
>
> What's the difference? My side-by-side explanation:
>
> You know Projects and Cowork. Don't forget Claude Code.
>
> And here's the entire Claude product line, in short:
>
> Chat → it's like ChatGPT. A chatbot.
>
> Project → it's still Claude Chat, but separated as individual Projects.
>
> Cowork → think Google Drive + Claude Project have a baby. Unbeatable.
>
> Code → massive revolution for developers to code much faster.
>
> This newsletter is built on never having to code. And Claude Code used to be reserved only for developers. But something changed in January this year.
>
> I made this as the one guide for Claude Code, for people who don't code. How to set it up. How I use it to brief my tech team, code entire websites without coding, and benefit from the fastest AI breakthrough (= coding).
>
> Also, I will share where Claude Code falls short (I'm always honest).
>
> Two things before we start:
>
> 1. Save this guide and spend 30 minutes this weekend to explore Code.
>
> 2. Send it to anyone who still hasn't tried Claude Code (or Claude).
>
> **Forget coding. English is the new code.**
>
> You read my Claude guide. So you installed it correctly.
>
> Just a quick reminder for those who didn't read it:
>
> Go to claude.com/download. Download the app.
>
> You need a Pro account ($20/month). It's very much worth it.
>
> Open the app. Click on the Code tab at the top next to Chat & Cowork.
>
> Select a folder from your computer. More about it down below.
>
> You are not a developer. So why would you use Claude Code for?
>
> Create professional websites with prompts (= English).
>
> Build personalized training from any piece of content.
>
> Generate an interactive dashboard like a data analyst.
>
> Sky is the limit with coding. Imagine having a junior developer who answers every single one of your requests, for less than a dollar a day.
>
> And yes, the code is pushed on a website, live for everyone to visit. For this, you must connect Claude Code to a free GitHub account.
>
> Here's how to set up Claude Code (no code needed):
>
> Step 1: Create a free GitHub account.
>
> GitHub is where your website's code lives online. Think of it as a Google Drive for code. You don't need to pay. The free plan is enough.
>
> Go to github.com. Click Sign up (right in the middle).
>
> Add your email. Pick a username. Create a password. Done.
>
> Funny enough, I've never seen an "Are you a robot?" puzzle so hard… super annoying. And it's 10 questions (!!!), sorry for that.
>
> Step 2: Go back to Claude Code, and link your GitHub.
>
> Go to your Claude desktop app.
>
> Click on your Settings → Connectors.
>
> Go to Browse connectors → Search GitHub → Connect your GitHub.
>
> Step 3: Code, but without code. Just type words.
>
> Now go to Claude Code.
>
> Use Opus 4.6 + Auto accept edits.
>
> Make sure your GitHub is connected.
>
> Type a prompt that says what you want, for what, with an example.
>
> Here's my favorite prompt template:
>
> Create a GitHub repo named "mediakit-website".
>
> I do not know how to code and don't want to learn. Code everything for me. Do not ask for permissions (or as little as possible).
>
> Follow these instructions:
> 1. I want to [goal] for [success criteria].
> 2. Here's an example [attached].
> 3. [Steps to follow].
>
> Step 4: Accept everything. Check the live website. Edit infinitely.
>
> Claude Code will keep asking for permissions, even with "Auto accept edits" enabled. I explain more on how to avoid this completely (and code 100x faster).
>
> An example of recreating a company I know: iovis, an Airbnb for musicians.
>
> Click on "Always allow for session" every single time.
>
> This is the one-shot result (Claude Code on the left, preview on the right).
>
> Now, here's your endless feedback loop:
>
> Check the live website (ask "I need a link now so anyone can access it.").
>
> Note down all of the problems you see when navigating.
>
> Follow up in Claude Code with a numbered list of the issues.
>
> Claude Code fixes it one by one.
>
> You go back to the live website. Refresh. Note down the issues…
>
> This is a good way to start vibecoding.
>
> But there is a magical way to code 100x faster.
>
> **I can make you code 100x faster.**
>
> I know you don't code - I don't either. So very quickly, you will be annoyed by a limitation Claude Code has: permissions.
>
> Every time Claude wants to edit a file, create a file, or run a command, a popup appears: "Do you want to allow this?"
>
> You get this sometimes 20+ times a session… and you must check your Claude Code always. So you can't really work on something else at the same time.
>
> → You click yes.
>
> → Another pop-up.
>
> → You click yes.
>
> For one small website, you'll click "Allow" 20+ times. It kills the flow.
>
> Claude just wants to make sure the developer (so, not us) accepts the edits. But since you and I both don't code, we… always validate the permissions.
>
> This is called vibecoding.
>
> The only way to bypass permissions is to follow these steps.
>
> ⚠️ It will look intimidating, but it's rather easy. Set it & forget it.
>
> Step 1: Download VS Code. It's free.
>
> Go to code.visualstudio.com. Download it. Install it.
>
> It's 100% free. It looks technical, but we will do very simple stuff, I promise.
>
> VS Code is what developers use to write code.
>
> You won't write any code in it. But Claude will, for you.
>
> Step 2: Install the Claude extension.
>
> Open VS Code. Click the Extensions icon on the left sidebar (looks like 4 small squares). Search for "Claude" by Anthropic. Click Install.
>
> It asks you to sign in with your Anthropic account. Do it. Same account you use for Claude. You now have Claude Code running inside VS Code.
>
> Step 3: Go to Claude's settings inside VS Code.
>
> It's on the same screen.
>
> Find the option called "Skip Permissions". Turn it on. This tells Claude to stop asking for your permission for every tiny action. Set it and forget it.
>
> Open a new session, and make sure "Bypass permissions" is on.
>
> Step 4: Vibecode, faster than ever.
>
> Type your prompt. Claude reads your files, writes code, creates new files, runs commands. Zero interruptions. You go do something else and come back to finish the work.
>
> This is vibecoding at full speed.
>
> Sure, this example is just a "one-shot" (one prompt, no edit). But I couldn't record 30 minutes of vibecoding - that'd be too long for this article.
>
> Try it at home. There is no going back.
>
> **The best way to prompt Claude Code.**
>
> I've been vibecoding for weeks.
>
> These are the prompting habits that saved me the most time.
>
> Start with a screenshot.
>
> Found a website you like? Screenshot it. Drag the image straight into Claude Code. Type: "Build me something that looks like this, but for [your project]."
>
> Claude sees the image. Recreates the layout in code. This is the fastest shortcut I've found. Way faster than describing what you want in words.
>
> Describe the end result. Never the steps.
>
> Bad prompt: "Create an HTML file, add a CSS stylesheet, use flexbox for layout, make it responsive..."
>
> Good prompt: "I want a clean landing page for my consulting business. Big headline, 4 services listed, a booking link, footer with my socials."
>
> You're the project manager. Claude is the developer. Give the brief.
>
> Point Claude to your files.
>
> Already have an about-me.md or brand guidelines in your folder. Tell Claude: "Read the files in my folder first. Use my tone and style for the website copy."
>
> Same context trick from Cowork. Works here too.
>
> One thing at a time.
>
> Don't dump 12 features in one prompt. Start with the homepage. Get it right. Then add the contact page. Then the blog section. Each conversation is a sprint.
>
> One deliverable per prompt.
>
> When something looks off, screenshot it.
>
> See a visual bug? Screenshot it. Paste it into Claude Code.
>
> Type: "This section overlaps on mobile. Fix it."
>
> Claude sees the problem and patches the code. Takes 10 seconds instead of a paragraph of explanation.
>
> **Your Claude Code needs a brain.**
>
> I stumbled on this by accident.
>
> Every time you open Claude Code on a project, it starts from zero. It doesn't remember what you built yesterday. It doesn't know your font choices, your color palette, your page structure. You have to re-explain everything.
>
> There's a fix. One prompt, one time.
>
> Copy and paste this into Claude Code after your first session on any project:
>
> Create a CLAUDE.md file in the root of this project. Inside it, write down everything you've learned about this project so far. Here are examples, but not limited to this: the folder structure, what each file does, the design choices I made (fonts, colors, layout), my preferences, and what pages or sections exist.
>
> Claude creates a file called CLAUDE.md inside your project folder. It's a memory file. Claude writes down your preferences, your past decisions, the structure, the style, all of it.
>
> Now close the app. Come back 3 days later. Open the same folder.
>
> Claude reads CLAUDE.md first. It already knows what your website looks like, what fonts you picked, which pages exist, and what your last edits were.
>
> You say, "Add a blog section," and Claude builds it in the exact same style as everything else. I do this for every project now.
>
> (Developers have been doing this for months. Now you can too.)
>
> **Where Claude Code falls short.**
>
> (I promised honesty)
>
> 1. It burns through usage. Fast. One Code session eats what would be 20+ regular Claude chats. If you use Code daily on the $20/month Pro plan, you'll feel the cap within a week. I'm on the Max plan ($100/month) because of this.
>
> 2. You can't review the code. When Claude writes code, you're trusting it. You don't read code. I don't either. If Claude writes something messy, we won't catch it. My workaround: test the actual website. Click every button. Check it on your phone. Your eyes are your code review.
>
> Also, this is soooo good to brief a technical guy. And that's the point. I don't want to vibecode a fully working piece of software. I just want to show a dev exactly what I need.
>
> 3. It sometimes loops. Claude hits a bug, tries to fix it, creates a new bug, tries to fix that one, and spirals. You'll notice when the same error appears twice. When that happens, type: "Stop. Explain what's going wrong. Give me 2 different approaches." This breaks the cycle every time.
>
> 4. The desktop Code tab is limited. The Code tab inside the Claude app works fine for a first try. But VS Code gives you auto-accept, better file browsing, and a much faster workflow. I'd skip the desktop tab and go straight to VS Code once you're comfortable.
>
> 5. Design taste is average. Claude builds functional websites. But its default design choices look generic. You need to push it. Show screenshots of what you want. Specify fonts, spacing, colors. If you say "make it look good," you'll get something that looks like everyone. Bring references.
>
> **Your first 30 minutes with Claude Code.**
>
> Open your calendar. Book 30 minutes with yourself, this newsletter, and Claude.
>
> Minutes 0–5: Install and open Claude Code.
>
> → Go to claude.com/download. Download the desktop app.
>
> → Sign in with your Pro account ($20/month, $100/mo is better though).
>
> → Open the app. Click the Code tab at the top.
>
> → You're in.
>
> Minutes 5–10: Build your context folder.
>
> → Create a folder on your computer called "Claude-Code."
>
> → In the context folder, create your first file: about-me.md. Write three things: (1) What you do for work. (2) How you like to communicate. (3) One example of writing you're proud of. Paste it in.
>
> Pro tip: Instead of typing, use Wispr Flow to talk. It's 4x faster.
>
> Minutes 10–15: Start your first Code conversation.
>
> → In Code, click Add Folder and select your Claude-Code folder.
>
> → Make sure to select Opus 4.6 + for the smartest AI.
>
> → Type: "I want [task] for [success criteria]. Go through my folder first, and use AskUserQuestion tool so you gather enough content before executing."
>
> → Watch what happens. A form appears. Click answers. Let it create your context files.
>
> Minutes 15–20: Accept everything. Ask for edits.
>
> → Claude will ask for permissions. Accept everything.
>
> → Look at what Claude built. Open the file in your browser or check the live preview.
>
> → Type what you want changed. Be specific: "Make the headline bigger. Change the background to off-white. Move the button higher."
>
> → Claude edits the code instantly. Refresh your browser. Keep going until you like what you see.
>
> → This back-and-forth is where vibecoding gets addictive. You talk, it builds.
>
> Pro tip: Take another 15 minutes to set up the VS Code + bypass permission. It truly makes you go 100x faster. It's worth it.
>
> Minutes 20-30: Create a tough deliverable.
>
> → Give Claude something real. A landing page for your side project. A personal site you've been putting off for 6 months. A dashboard your team keeps asking for.
>
> → Type: "Build me [specific thing] with [specific requirements]. Read the files in my folder first."
>
> → Watch it work. Push to Github. Open the live link. Send it to someone.
>
> → Optional: realize you just built a real website in under 30 seconds of work without writing a single line of code.
>
> **I don't care about Claude.**
>
> I don't care about Claude, ChatGPT, Grok, Gemini, or any other model.
>
> I don't pick sides. I'm not paid to make this newsletter.
>
> I'm sharing, twice a week, how my work is transforming (very fast) with AI.
>
> As I'm trying to keep up, I want you to keep up. So we move just as fast.
>
> I want to be the greatest filter to the AI noise. And 380,000+ people read this twice a week to focus on the How. Some came because of my LinkedIn. But most readers subscribed because someone they trusted sent one of my articles to them.
>
> If this article helped you, be that person for someone else (and share it).
>
> It does not cost you anything to share. And sharing is caring :)
**Structure:** "You've mastered the last tool, here's the next one" progression hook → product-line recap (Chat/Project/Cowork/Code) → numbered 4-step no-code setup (GitHub account → connect → prompt template → accept/iterate loop) → a dedicated "make you code 100x faster" bypass-permissions deep-dive (VS Code + extension + skip-permissions setting) → a 5-item prompting-habits list → a "give Claude Code a brain" CLAUDE.md memory-file trick → honesty "falls short" section (5 numbered limitations) → timed 30-minute checklist → closing disclaimer/share CTA.
**Framing:** Explicitly targets non-developers ("I don't code either") for a tool normally seen as developer-only: positions himself as proof that the audience gap can be closed. The "your Claude Code needs a brain" CLAUDE.md section is a direct parallel to the about-me.md/Cowork-folder device used across his other essays, reinforcing one consistent mental model (give the AI a persistent memory file) applied to every product surface he covers.

### 14. Claude Cowork + Obsidian. (Apr 14, 2026) [link](https://ruben.substack.com/p/stop-prompting-claude)
**Metrics:** 909 likes · 233 comments · 70 restacks
**Note:** Archive lists this post as "Claude Cowork + Obsidian." but the live page's own headline/title reads "Prompting is the worst way to use Claude.": both are captured for accuracy.
**Opening hook (verbatim):**
> Stop prompting Claude.
> For example, this is the worst way to use Claude:
**Promotional teaser (verbatim):**
> How to set up Claude Cowork with Obsidian:
**Full text (verbatim):**
> Stop prompting Claude.
>
> For example, this is the worst way to use Claude.
>
> If you don't understand why this prompt is terrible, this free guide is for you.
>
> This will get you average results.
>
> And you will then blame Claude for it.
>
> But deep inside, you might know the real problem. You didn't give Claude enough context. You didn't explain your tone, your audience, your rules. Everything.
>
> But who wants to type 500 words of instructions just to get a first draft?
>
> Nobody does.
>
> So you don't. And the output sounds like everyone else.
>
> Maybe some of you tried 'Projects' → another Claude feature where you upload your files once, and reuse them across chats.
>
> That's better, but you can do so much better.
>
> Because you still had to create a new project for every topic, re-upload roughly the same stuff, re-explain the same rules. Not how a "Second Brain" works.
>
> Then Claude Cowork happened.
>
> And it's so good software lost $2.5 trillion in valuation since then.
>
> I believe software has lost $2.5 trillion in valuation since Cowork. That's the equivalent of the 5th-biggest company in the world (Amazon).
>
> Cowork made Claude's growth parabolic, surpassing ChatGPT.
>
> Because Cowork is the biggest thing to happen to AI since ChatGPT:
>
> It's connected to a folder inside your computer.
>
> You save text files in this folder. Your style. Your rules. Your goals.
>
> Claude reads them automatically before every session. The files are the prompt. Forever.
>
> And then Cowork creates documents (docx, ppt, Excel…) inside your folder on your computer, like a real employee.
>
> When you set up Cowork properly - I wrote an entirely free guide last week on it, and over 3 million people read it - you can do things like this:
>
> Even if I wrote the simplest prompt possible, Claude Cowork is reading my entire folder on how I write, my taste, and what I hate too. I didn't ask for anything, but Claude knows it has to go through an "Anti-AI Writing Style" audit before sharing anything with me. The Cowork magic. Claude Cowork gives a super solid Linkedin post, and it's already inside my computer in the subfolder "OUTPUTS". This is the next level, after ChatGPT.
>
> But Cowork has one big problem. You have to manage folders and files.
>
> This is what my folder looks like inside my computer. Ew…
>
> Cowork runs on text files. That's its own prompts.
>
> But you're not a developer. You never managed text files before in your life.
>
> That's why most of you never tried Cowork → it's "too much work to set up".
>
> The others tried to edit their Cowork folder. You double-click on a file. It opens a weird, geeky, TextEdit. Hashtags. Asterisks around random words.
>
> When I open a file from my Cowork folder, it looks like coding. And I don't code. That's why I rarely edit it… If only it were as easy as a simple Google Doc you could click on, edit, and it would save automatically.
>
> Managing md. files is too complex. You open it, it's hard to read, hard to edit. You end up never editing the file. So you close it.
>
> How frustrating. I was frustrated too.
>
> And I searched for the simplest/cheapest solution.
>
> And I found it (it's free).
>
> And I end up accidentally building my "Second Brain" inside my Claude.
>
> This guide covers both: (1) how to set up Cowork from scratch, and (2) how to organize your files so you can actually see, search, and edit your Claude's brain.
>
> Every step, step by step, with screenshots.
>
> Before we start, do two little things:
>
> Save this & block 20 min this week to set up Claude. Acting > Reading.
>
> Send it to anyone who uses Claude, but hasn't tried Cowork.
>
> PS: This newsletter mostly grows because of your shares. And I keep hitting 1,000+ shares. It's my north star. If this article helps you, be that helpful person for someone else. It's free.
>
> **Skip this part if your Cowork is already set up.**
>
> I hate starting a newsletter by telling you: "hey, go read a previous newsletter".
>
> But I wrote a viral guide on setting up Claude Cowork & its folder.
>
> If you have already read it, skip this part and go to the next called "Obsidian".
>
> If not, it takes 10 min to do it, and I put screenshots & everything.
>
> Or here's the fastest recap I could make (without images):
>
> Claude Cowork is only on the desktop app of Claude (free to download).
>
> You must have a paid account ($20/month). I personally pay $100/mo.
>
> When you start a session with Cowork, you must select a folder.
>
> So create a folder in your computer called "Claude Cowork".
>
> Inside, create 3 subfolders: about-me, claude-output, and templates.
>
> about-me is 3 files → about-me (me, my taste), anti-ai-writing-style (because I hate sounding like an AI), and my-company (info about my business).
>
> claude-output → you don't touch it, where Claude stores its work.
>
> templates → you don't touch it, to save your favorite work template.
>
> Set up Global Instructions (Settings > Cowork > Global Instructions) to ask Cowork always to read about-me and not touch the rest.
>
> If you need the visual step-by-step, go my article here.
>
> If you want to copy my files, leave a comment & I will dm it to you.
>
> Once you're done, continue this newsletter:
>
> **Obsidian.**
>
> Disclaimer: I am not paid to write this. I am not affiliated. I am not sponsored.
>
> I tested 6 different tools over two weeks, and this one won. I explain why at the end.
>
> Obsidian is a free app that opens a folder of files and makes them look like a simple knowledge base. Just like a Google doc inside Google Drive.
>
> This is what my Obsidian looks like when I open my Cowork folder.
>
> You point it at a folder (= your Cowork folder). It shows you every file with proper formatting, a sidebar to navigate, and search across everything.
>
> First: wow. It's so pretty. The simplest design possible. A bliss.
>
> You click a file, you see it rendered (headers, bold, bullet points, the whole thing). You edit it right there. And it edits your folder inside your computer.
>
> Here's how to install it:
>
> 1 - Download it here: obsidian.md.
>
> It also works with Windows. Even Linux (but you don't use Linux, don't lie).
>
> 2 - Once you have downloaded it for free, click "Open folder as a vault".
>
> You must have your Cowork folder. And then select it with Obsidian.
>
> It now reads your Cowork folder, and you can edit/organize/visualize every file. Feels like heaven.
>
> **How Obsidian works with Cowork.**
>
> Let me show you what this actually looks like day-to-day.
>
> 1. Stop prompting.
>
> I demo Obsidian + Cowork to my team.
>
> This is the simplest example for you to fully understand it:
>
> 1 - I open Obsidian. It already has my Cowork folder opened.
>
> 2 - I go to my about-me file in my about-me folder.
>
> 3 - I change the first sentence to: "I absolutely love coconut so much I do not eat anything else. I have an exclusive coconut diet. If asked, feed me with coconuts."
>
> I added this line to show you how it works with Cowork. This is your new prompts. It is managed on Obsidian, and automatically shared to Cowork.
>
> 4 - Now if I open my Cowork and start a new session, I still select the same folder.
>
> 5 - But since my Cowork folder is the same as Obsidian, I get this answer:
>
> It starts by reading my about-me file, and then it knows → coconuts obviously!
>
> Now that you understand the concept with coconuts, imagine with everything else. You hate something Claude did? Go to Obsidian → update on your file easily by saying "Remember [this]" or "Replace [this] with [that] always."
>
> Obsidian automatically sync up to Cowork. You prompted Claude once, and it remembers forever. Literally your Second Brain.
>
> 2. Editing your context files (but seriously this time).
>
> Your about-me.md needs an update. New job title. New targets. New tool you started using. Or new thing you absolutely hate from Claude (that's usually the best update you can make to your md. files).
>
> Open Obsidian. Edit the document.
>
> It's already syncup with your Cowork.
>
> Start a new session on Cowork → point to your Cowork folder → it knows.
>
> For eg. when I ask a task to my Cowork, I always want it to ask me questions before executing any task. Because I love outlining the task before doing it.
>
> So I updated my about-me md. file. I can write anything I want, as much as I want. Prompt it once, saved forever. My prompt is just a one-liner. And Cowork knows it has to ask me questions (and the right ones). Prompting is dead. Text files are the best way to use it.
>
> Now that I answered, it does not rush into making the newsletter, but rather structure it's thinking with me. Just like I asked in my md. file on Obsidian.
>
> Once we are aligned, my Cowork goes through my anti-AI-writing-style file because it knows it has to. I didn't ask for anything. My prompt is still just one line (+ clicking on some multi-option questions).
>
> And the result is already 80% there. Time to write the newsletter now :) edit it, make it better, make it mine. Now imagine this for a lawyer, a creative brief…
>
> And of course, what Cowork wrote is automatically inside my Obsidian. Magic.
>
> 3. Finding things.
>
> When you use Cowork as much as I do (and as much as you should), you will have a lot of files. And you can't search through it correctly.
>
> Now you can, with Obsidian, for free. It searches through everything you wrote and Claude wrote. Easily one of the best feature ever. Because Claude's internal search engine is terrible.
>
> 4. Reading your outputs.
>
> I already said it, but it's super useful to read all of your past outputs in one folder, with the proper formatting (so its nice to read, like a normal doc).
>
> This is an example with my newsletter "How to stop hitting Claude usage limits." Like any newsletter, it always starts with a Cowork session.
>
> 5. The daily workflow:
>
> Open Obsidian to browse, search, read, edit your files.
>
> Open Cowork to create new work, generate outputs, build deliverables.
>
> Both are looking at the same folder. Always in sync.
>
> Obsidian is where you update your brain → Cowork is where you build.
>
> PS: Some of you probably forgot how good Claude and Cowork is.
>
> So here's a little recap of all of the things you can do with it:
>
> Excel files, with multiple tabs, formulas, charts, conditional formatting. From a single prompt.
>
> Word documents with headers, tables of contents, page numbers, letterheads.
>
> PowerPoint presentations with layouts, speaker notes, images.
>
> PDFs: fill them, merge them, split them, extract tables from them.
>
> Full websites and interactive dashboards. In one file.
>
> Research reports pulled from your own files + the web.
>
> Every and any writing piece of content. LinkedIn posts, newsletters, emails, written in YOUR voice (because it reads your files). But also contracts, briefs…
>
> Data analysis on CSV files. Upload one, ask a question, get the answer.
>
> Scheduled tasks that run automatically while you sleep.
>
> Connectors to Slack, Google Drive, Notion, Gmail, and 50+ other apps.
>
> **My new SKILLS folder.**
>
> I added someting to my own setup this week.
>
> Disclaimer: this is pretty advanced. Most of you don't need it.
>
> Your about-me files tell Claude your style, your rules, your goals. That covers the basics (and non-negotiables). Now Claude sounds like you. Good.
>
> But you repeat some tasks every week.
>
> A LinkedIn post. A newsletter. A client brief. A specific contract.
>
> And every time you add the same extra instructions. "Keep it under 1,300 characters." "Single image only." "It's a music specific legal contract."
>
> You say it once, fine. You say it 30 times, that's not so efficient.
>
> So Claude's team created "Skills". A visual recap:
>
> I have over 100+ infographics like this. I give them to readers who subscribe for free. Leave a comment if you subscribed but you can't find the file.
>
> Claude Skills are your saved workflows. One file per task.
>
> And you call it with a single / command (like /contract for a contract).
>
> Here's how to create your 1st skill (let's take negotiating as an example):
>
> Open Cowork. Start a new task.
>
> Prompt this:
>
> Create a skill called "negotiation".
>
> Interview me about the kinds of deals I negotiate daily. Build the best negotiation skills to help me create different negotiation scenarios (based on different experts). Then save it as a skill I can call with /negotiation.
>
> Cowork asks you questions. Answer them.
>
> Cowork creates the skill file automatically. It will be in the OUTPUT folder.
>
> I then go to Obsidian and move this output to my new folder "SKILLS".
>
> Step 1: Copy and paste my prompt inside Cowork with Opus 4.6. Make sure to select your Cowork folder!
>
> Step 2: Answer the questions.
>
> Step 3: Claude will ask you to "Always allow" to edit your Claude. Yes you do. Then wait for a while.
>
> Step 4: Claude wants to make sure your skill is good enough. So you have to review with examples and benchmarks. So good.
>
> Step 4: Tell Claude "It's ok now" and it will create the skill. You can click on "Save skill". Now let's try it.
>
> Step 5: Now when I type /nego it already shows the skill. Click on it and prompt it from there.
>
> Step 6: You can combine the flavors. Cowork + my super folder + skill /negotiation + Gmail connector so it reads my email. Magic.
>
> Step 7: I want to change my skill? I can edit it simply on Obsidian. But here's how to reupload it inside Claude (again, after you changed it):
>
> Step 8: How to reupload any skill.
>
> Now anytime I go to Cowork and I prompt /negotiate - it knows what to do.
>
> Every skill lives as a text file in your Cowork folder. Which means Obsidian can see it, search it, and let you edit it. You tweak your LinkedIn skill after you find a better hook formula? Open it in Obsidian, change one line, save.
>
> Sky is the limit with your skills:
>
> /newsletter
>
> /client-brief
>
> /sales-email
>
> /weekly-report
>
> /meeting-notes
>
> **Why Obsidian (and why not something else).**
>
> I didn't pick Obsidian because it's trendy or because they paid me.
>
> I picked it because everything else failed at least one of my criteria.
>
> free
>
> inside my computer
>
> ease of use & clean design
>
> Notion. Cloud-based. Stores everything in its own database. Your .md files would need to be imported, and every time Cowork updates a file, you'd have to re-import. Notion is great for project management. Terrible for this.
>
> PS: My entire team is still on Notion to manage our content library.
>
> Google Drive + Google Docs. Google Docs aren't .md files. You'd need to convert back and forth every time Cowork reads or writes. Not useful.
>
> Apple Notes. Closed format. Can't point it at a folder. Can't search across .md files. Dead end.
>
> VS Code / Cursor. Amazing tools. For developers. If I see a code editor, I close the tab. The interface assumes you know what a terminal is.
>
> GitHub. Renders markdown beautifully online. Requires git, commits, pushes, pulls. I lost you at "git." Moving on.
>
> Typora. Beautiful markdown editor. $15 one-time purchase. But it edits one file at a time. No sidebar navigation across your whole folder. No search across all files. No linking between documents. Fine for writing. Missing the "brain" part.
>
> MarkEdit. Free, Mac only, ultra-minimal. Same problem as Typora: one file at a time, no bird's-eye view.
>
> Obsidian wins because…
>
> It reads your existing folder. No import, conversion or sync.
>
> It's free for single-device use. $4/month if you want it on your phone too.
>
> It's built for non-developers. The interface is clean and simple.
>
> And the thing that sealed it: Obsidian never touches your files in a way that breaks Cowork. No hidden metadata injected or weird format changes.
>
> Your .md files stay .md files. Cowork reads them the same way it always did.
>
> One download. One folder selection. Free on one device. Unbeatable.
>
> A little bonus point: I love their CEO, Steph Ango.
>
> The CEO himself said they don't know how many users Obsidian has… they don't force users to create accounts, and they don't have analytics. I love it.
>
> **Where to start.**
>
> I know setting up Cowork with Obsidian looks annoying.
>
> And reading my past 50 newsletters seem like hell on earth.
>
> Don't.
>
> Just read my Cowork newsletter and this one. Skip the rest.
>
> And focus on my next newsletters coming up.
>
> Spend 2 x 20 minutes twice a week. Block it on your calendar.
>
> I will make you (& me) ahead of most of the world by using AI right.
>
> PS: This newsletter is growing because you guys are sharing it.
>
> On every one of my free articles, I get over 1,000+ shares!! It keeps it free.
>
> The best kind of share is to your colleagues, on your group chat (on Teams or Slack). You're helping them switch to Claude, and you help me spread the word!
**Structure:** Bad-example hook (shows a literal terrible prompt) → problem diagnosis (context-poor prompting → generic output) → stat-shock proof ($2.5T software valuation drop since Cowork) → an explicit "skip this if already set up" recap section pointing back to Post #1 → a disclosed tool-comparison section ("I tested 6 tools over two weeks") → step-by-step Obsidian install and a worked "coconut" toy example demonstrating the sync mechanic → a numbered "how it works day-to-day" 5-part section → a "why Obsidian, not X" comparison table covering 7 rejected alternatives with specific rejection reasons → an advanced "SKILLS folder" bonus section with a full skill-creation walkthrough → closing "where to start" simplification + share CTA.
**Framing:** Distinctive for its explicit competitive-comparison rigor (naming and individually rejecting 7 alternative tools with specific technical reasons) rather than just recommending one solution: a research-transparency move not used elsewhere in the batch. The "coconut" toy example is a distinctive teaching device: an absurd, memorable, low-stakes proof of a mechanic before applying it to real work. Continues the cross-referencing/curriculum pattern (points back to the Cowork and Skills essays explicitly).

### 15. being good at ai is (stupidly) simple (Jun 6, 2026) [link](https://ruben.substack.com/p/s)
**Metrics:** 864 likes · 165 comments · 75 restacks
**Note:** Distinctive format break from the rest of his catalog: entirely lowercase, written as a stream of terse ">" quote-block lines rather than normal paragraphs. URL slug is literally "/p/s".
**Opening hook (verbatim):**
> ai is not that hard.
> ai is this simple.
> go to claude.ai.
**Promotional teaser (verbatim):**
> like seriously, stupidly simple:
**Full text (verbatim):**
> ai is not that hard.
>
> ai is this simple.
>
> go to claude.ai.
>
> create a new account. somehow, you have to verify your phone.
>
> look at the box where you type. bottom-right corner.
>
> it shows a model, like "Sonnet 4.6" (free) or "Opus 4.8" (paid).
>
> you want the nice and smart ai instead of the free one.
>
> pick Opus 4.8. set the thinking level to High. turn on "Thinking".
>
> it looks like this:
>
> just follow 1 → 2 → 3, this simple
>
> now the infamous "prompt"… suspenseful music
>
> you do NOT need to know how to prompt "like an engineer".
>
> the trick is a tool few use, called AskUserQuestion.
>
> basically claude asks YOU the questions, instead of you prompting it (badly).
>
> so go for something like: "Help me do [X] for [Y]. Use AskUserQuestion first."
>
> if we were in highschool together, text me and i will sell you ai consulting services
>
> you just click on the answer, or type it in the "Something else" box.
>
> it usually has 3-5 questions, the more you say, the better the answer after.
>
> sometimes you want to go pro, like "give me 3 different strategies"
>
> and claude gives you this nice little design for 3 answers:
>
> i'm sorry to tell you this is fake, i want to a french highschool and french people only speak french
>
> that one line, "ask me questions first," makes you a power user.
>
> write it on your hand. and brag about being a prompt engineer.
>
> you're already using ai better than 99.9% of the population.
>
> that was level 1.
>
> now level 2. talk to your computer.
>
> you can use another ai to write by talking to your computer.
>
> yes, you talk 4x faster than you type. and if you're my mom, 400x faster.
>
> typing on your computer is so 2024. the future is now, old man.
>
> i like using wispr flow, it's a free tool, ai, you talk and the computer writes.
>
> it looks and sounds like this:
>
> you are not faster at using a computer, with ai.
>
> now level 3. you need claude's app now.
>
> download the app here: claude.com/download
>
> open it. click the "cowork" tab. it's at the top next to chat.
>
> top left, the Cowork in the middle, click on it
>
> in the browser, claude answe.. you copy-paste the results.
>
> claude cowork is different.
>
> it makes the actual file and saves it on your computer.
>
> the real PDF. the real spreadsheet. sitting in your folder.
>
> so make one folder on your computer. call it "cowork."
>
> i can't believe i'm explaining this, but go to your computer's homepage and do a right click to "create a folder" that's how you create a folder, like:
>
> right click → new folder → congrats, now name it cowork or something
>
> select it inside cowork. claude can read everything inside it now.
>
> ok. stop here. take a breath. how do you "select it"?
>
> inside claude cowork → click on "work in a project" → select the folder
>
> that's what happens next, click here
>
> you select your new cowork folder on your desktop
>
> drag it into cowork. claude reads everything inside it now.
>
> drop in a messy doc, an old proposal, last month's numbers. anything.
>
> now use the trick again:
>
> "build a spreadsheets to do [x]. but ask me what you need first."
>
> 3 minutes later, a clean Excel file. in your computer.
>
> but wait, there is more.
>
> level 4. connect your apps.
>
> i can safely say after this level, you are the top 0.000000000001% of the world
>
> actually no, that's less than one person, we need to make more kids, guys
>
> left sidebar, click "customize," then "connectors."
>
> it will connect your claude to your app, like gmail / calendar / notetakers.
>
> connect gmail. connect your calendar. connect your meeting notes (granola, otter, whatever) - shockers, i know
>
> it will ask you if you want to connect your apps.
>
> say yes to everything.
>
> test it by going super hacker mode and prompt something like:
>
> claude reads my email, my meeting transcript & knows my calendar - magic
>
> ai just needs context. it needs to know you. it's simple.
>
> level 5. you can train claude on new skills.
>
> now go to the left side bar, and find "customize", find "skills"
>
> skills are playbooks claude runs on its own when the task fits.
>
> wait, it sounds too technical
>
> skills are premade stuff claude knows before answering.
>
> like an employee who knows the standard procedure to do [X].
>
> so first, we need to create a skill before using a skill.
>
> turns out… claude made a skill… to create skills… called /skill-creator
>
> just type /ski… and click on skill-creator
>
> now just say what you need as a skill, like for example:
>
> "i want to teach claude how to make excel spreadsheets the way i love them."
>
> and add "but ask me questions first" at the end.
>
> you answer the questions to the ai so the ai is better at being a good ai.
>
> once you're done, it will ask you something like this:
>
> just click on "Save skill" and now you can type /excel-style in your prompt
>
> for example here, i saved it and typed /exce… and it's already offering a bunch of skills i built with claude
>
> you gave claude skills, and you can share them with your team.
>
> final boss. coding.
>
> you don't know how to code. me neither. but you can do cool stuff now.
>
> you can make a real website. or app. tonight. yourself. using English.
>
> in the app, open claude code (the </> tab in the left sidebar).
>
> top left → go to Code → make sure "Bypass permissions" is on
>
> turn on the mode that stops it asking permission for every step.
>
> (it's the scary one. bypass permissions. all it means is "go. i trust you.")
>
> same trick:
>
> "build a page where people book a 30-min call with me. ask me questions first."
>
> the AskUserQuestion box pops:
>
> it's really my favorite ai feature, every ai should have this
>
> "dark mode?" click. "bookings to gmail or calendly?" click.
>
> then it builds. the form, the buttons, all of it.
>
> 4 minutes later: "done. open this." you open it. it works. magic.
>
> want it on your phone? "make this an app i can put on my phone. ask me first."
>
> being good at ai is stupidly simple.
>
> you asked claude to ask you questions, then clicked the answers.
>
> most people i meet say "i'm so behind" but they never even tried.
>
> the bar to knowing is trying. how low is that?
>
> i dropped out of university. i can't code. i now build things for enterprises.
>
> so open this article on my substack. open claude. start at level 1.
>
> tonight. not tomorrow. tonight.
>
> ps: this newsletter is free, and will always be free.
>
> but some enterprises want to go faster with ai.
>
> dm me on linkedin. i'll personally answer & connect.
>
> humanly yours.
>
> ruben.
**Structure:** All-lowercase, terse quote-block ("> ") stream-of-consciousness format, unique in the captured set → a strict "level 1 through 5, then final boss" video-game progression (basic chat → voice dictation → Cowork+folder → Connectors → Skills → Claude Code) → each level: one clear action + one screenshot reference + a one-line joke aside → closes on a personal-stakes line ("i dropped out of university. i can't code. i now build things for enterprises") and a "tonight, not tomorrow" urgency close.
**Framing:** A deliberate register break from his usual capitalized, structured-header essays: reads like a late-night stream-of-consciousness note or a Twitter/X thread reformatted for Substack, using gamification (levels, "final boss") instead of his usual numbered-section format. Jokes are more absurdist/self-deprecating here (the French-highschool aside, "we need to make more kids, guys") than his other posts' drier humor. Demonstrates he varies voice/register deliberately rather than running one fixed template every time.

### 16. How to set up Claude Cowork. (Jul 1, 2026) [link](https://ruben.substack.com/p/learn-80-of-claude-cowork-in-20-minutes)
**Metrics:** 787 likes · 1,546 comments · 91 restacks
**Note:** Live page's own title is "I was wrong about Claude.": a self-reversal essay that explicitly retracts the folder/files system taught in Posts #1 and #2.
**Opening hook (verbatim):**
> I was wrong.
> I wrote "Cowork" and "Cowork 2.0." My most-shared work ever, across Substack, LinkedIn, and X. A total of 20 million views.
> Do not read them.
**Promotional teaser (verbatim):**
> Forget the other Claude. Focus on this one:
**Full text (verbatim):**
> I was wrong.
>
> I wrote "Cowork" and "Cowork 2.0." My most-shared work ever, across Substack, LinkedIn, and X. A total of 20 million views.
>
> Do not read them.
>
> To be totally fair, I was right about one thing: Claude will become bigger than ChatGPT because of the launch of Cowork in January.
>
> I've been begging you to switch to Claude since December 21st 2025.
>
> Cowork is the best thing to happen to AI since ChatGPT.
>
> If you don't code, you must be using Claude Cowork.
>
> Since then, I have written hundreds of guides and two major articles. I shared how to set up Cowork, and that was the latest (outdated) version of it.
>
> Until today, that's how I thought Claude Cowork must be set up.
>
> The setup is good…
>
> Until you go to enterprises, and they need to collaborate.
>
> I started giving workshops to enterprises. Teams with hundreds of people using Claude Cowork together. And my files + folder system broke.
>
> How Anthropic wants us to use their AI is different from how people actually use it.
>
> And that's OK.
>
> Because I'm not paid by Anthropic.
>
> So I can say whatever I want on how to best set up Cowork for you + your team.
>
> I spent countless hours updating my setup. This guide shows you exactly what & how. By the end of it, you'll know how to start - and what to absolutely avoid - with Claude Cowork.
>
> Before starting, I want you to do two things:
>
> Save this guide & block 20 minutes this week to set up Cowork.
>
> Send it to anyone who still hasn't tried Cowork (or Claude).
>
> **Skip this if you already use Cowork.**
>
> Quick reminder on how to access Claude Cowork:
>
> Go to claude.com/download. Download the app on your computer.
>
> You must have a Pro account ($20/month). I pay for the $100/month plan.
>
> Open the app. Click on the Cowork tab at the top between Chat & Code.
>
> You can add Skills and start Projects on the left menu. More about it later.
>
> Make sure to select "Opus" for complex tasks. It's the default model.
>
> Once Fable is available, use it. It's (somehow) even better.
>
> **I. Cowork is many Claude.**
>
> Cowork is much better than the normal Claude.
>
> In simple terms, why is Cowork better?
>
> Because it answers with many Claude at once.
>
> Here, Cowork reads the Excel, and plans how to best solve my question. The equivalent of 3x Claude already worked on my prompt before giving me an answer. This one is searching the web. After 8 minutes and many, many Claude sessions, it gave me a great answer. I only asked something once, and Cowork planned everything else.
>
> Claude Cowork brings many Claude to life to answer your question.
>
> You have to imagine separate AIs collaborating to find the solution.
>
> Cowork can perform a task for long minutes, sometimes 30+ min.
>
> How to set it up is key, though. And I spent months running Claude Cowork wrong. If you used my old guides, so did you.
>
> First, you must forget about this:
>
> **II. Forget about files and folders.**
>
> OK, hold up. I was the files and folders guy.
>
> I think half of Linkedin is using files and folders on Cowork because of me.
>
> It was a solid advice… but I was wrong.
>
> But I was wrong.
>
> Files and folders suck.
>
> I told you to set up your Claude Cowork like this, with a folder on your computer and files (about-me files to know about you, and output files for Cowork's work).
>
> I would make you create a Cowork folder with files inside. And I told you to select your folder (with files) when you start a Cowork session.
>
> But after months of doing it, I saw two major issues:
>
> Folders are leaking. Even if I told my Cowork to "never check my output folder," Claude would sometimes do it. And it poisons my context with outdated outputs. Annoying.
>
> Files are impossible to maintain. You have a full-time job. Me too. I can't spend hours every week updating my "about-me" file. It was nice at first, and then a painful bottleneck.
>
> Instead, you must focus on two things with Cowork:
>
> **III. Skills + Projects. Nothing else.**
>
> Skill = a capability you call. Travels into any chat. Fun fact, it also travels into any AI (like Gemini, ChatGPT…).
>
> Project = a place you go to. Files + instructions stay loaded, it remembers, and you can share it as one place to collaborate with your team.
>
> This is how I work with my team. This is how I work with enterprise teams at GPC. Skills and Projects.
>
> Let's go over them one by one and combine them afterward.
>
> A. What you need to know about Skills.
>
> Skills are defined by how you use them, right inside any chatbox, with the slash command (for eg, "/linkedin-post").
>
> You invoke it with the /command. This specific skill is built on how I make Linkedin hooks myself.
>
> I have a library of my favourite Claude Skills. And I give for free to new subscribers in my welcome email. If you are already a subscriber, leave a comment & I'll dm you.
>
> You understood how to use a skill.
>
> But how do you create a skill? Quite simple.
>
> Either you use the Claude skills /skill-creator.
>
> You answer the question Claude will ask you.
>
> You test the skill. Save it. And invoke it with / command.
>
> Or you use my free tool I built called "makemyskill.com".
>
> I made it to suit how I like to build Claude skills.
>
> I give it for free because it costs almost nothing to run it.
>
> OK now in practice it looks like this:
>
> Create a skill inside Claude with the command /skill-creator. You answer the questions. Cowork goes into the multi-Claude sessions in one. Just wait. You can save it here. And it has the name to / invoke it. Here it's /contract-drafting.
>
> That was the first way to create a skill.
>
> But my favorite way is this one, if you start from scratch:
>
> Go to www.makemyskill.com. Say what you want. Create a free account (there is no paid version). Now my little tool is creating your Claude skill by scrapping the web much deeper than what Claude usually do. Click on "Download skill" the big fat orange button. Go to Claude Cowork > Customize > Skills. Skills > Add > Create skill > Upload a skill. Upload the one we just made. You can now use it by calling it with / command.
>
> You can go very broad with skills, giving them tons of data that goes with the prompt. Some of my favorite skills have hundreds of pages of posts, hooks, SOPs, that Claude processes every time for this specific skill.
>
> I forgot about another way to create a skill. If you're having a chat with Claude, you can ask it to "make it a skill".
>
> Step 1: Go to the top of your chat, on the name of the chat.
>
> Press enter. It will create a skill you can save.
>
> And Claude will create the skill for you. Just wait.
>
> OK, that was skills. Now projects.
>
> B. What you need to know about Projects.
>
> For Projects, it's here:
>
> Left menu > Projects > New project. Start from scratch. Give it a name + Add files. I prefer leaving the instructions blank. You can see your Projects limits at the top right. Prompt it. Your Project will have the context of your file inside the chat.
>
> Every chat inside a Project has the entire context of this Project.
>
> For example, you uploaded all of your clients' information, the email you both shared, what you agreed on, their favorite past campaign…
>
> Claude will remember it on every chat. And it does not poison the other projects (or chats) outside of your Projects.
>
> C. A skill or a project?
>
> I have a simple test:
>
> It's a skill you can teach someone → Skill.
>
> It's a specific context (like a client, a campaign) → Project.
>
> You must teach your team the difference, otherwise you will end up with hundreds of skills that should be a couple of projects, or dozens of Projects that should be shared Skills.
>
> I consult companies of 50-500 employees with my team in NYC. Message me if you want a discovery call - that's how I make money and keep this newsletter free.
>
> D. Combining the two.
>
> Yes, you can use skills inside projects.
>
> And that's the best way to use Claude.
>
> Use skills of your most recurring capabilities (eg. make a contract).
>
> Use it inside a project of your client (eg. with his information uploaded).
>
> Connect it before to your Gmail/Outlook and Slack/Teams (to get more context).
>
> Cowork knows everything, even how I like to negotiate. Guess what? My team also has access to my skills and project, in THEIR Claude.
>
> Here's how to share Projects with your team:
>
> Create Projects not with Cowork, but Chat.
>
> Go to the top right, and make sure it's shared.
>
> Once done, start any task with Cowork. It's weird, I know.
>
> This Project is inside Chat. Click Share and make it accessible to everyone. Cowork will open a chat with the project's context.
>
> That was for Projects.
>
> Now here's how to share Skills with your team:
>
> Left menu > Customize. Skills > Click on one. Click on "Share" and make sure your workspace is selected. A reminder that skills are triggered with / commands.
>
> E. Not everything is perfect.
>
> Some problems I hate about this setup:
>
> Skills can auto-fire from their description. I wish Claude could turn this off. I want to activate the skill only when I invoke it.
>
> Projects have a limit on the number of files you can upload. I wish for more (obviously).
>
> Speaking of which: Claude has a lot of settings to turn on or off.
>
> And you should turn most of them OFF.
>
> Here's how I set up my Claude:
>
> **IV. No settings is the best setting.**
>
> I used to build everything around the folder, with files inside.
>
> It was literally poison to my Cowork.
>
> Two big problems:
>
> No one likes to create folders, and maintain them.
>
> No one likes to create files, and maintain it.
>
> I also believe something, and everyone says the opposite: you shouldn't give too many instructions to an AI.
>
> Once you give too much context to Claude, it falls into the same answers every single time. No more creativity.
>
> It's OK when you need to draft the same contract.
>
> It's not OK to brainstorm and find creative solutions.
>
> If you give too much context to Claude, it's going into circles.
>
> So here's the very simple setup I have today:
>
> #1. No more folders. And I use Opus 4.8 (High) most of the time. Max effort when in need, or Fable-5 once it's available.
>
> #2: In my settings, the minimum possible. Don't give any info.
>
> #3: Same here. Keep everything turned off but Connectors.
>
> You can find Connectors in the + to connect apps like Gmail. And now I can ask questions to my Gmail, inside Cowork.
>
> #5: Turn on these. Once you turn it on, Claude makes cool interactive charts.
>
> #6: Keep your Global Instructions free of context.
>
> You have now completed a setup of basically… nothing. Everything is mostly turned off. So what should you do instead?
>
> Skills for recurring tasks.
>
> Projects for recurring projects.
>
> AskUserQuestion to prompt better.
>
> You don't know the third one.
>
> But it's my favorite Claude trick:
>
> **V. This is still my #1 trick.**
>
> You don't know how to prompt Claude.
>
> Or any LLMs to be honest.
>
> It takes time, practice, experience, understanding of how the technology works. It's not meant to say the truth, for example, but answering (which leads to hallucination, but it can be solved).
>
> This simple trick will fix most of your prompt problems:
>
> Claude creates a form you just have to answer. Once you answer, Claude will think more about how to reply. And now you have a much, much better file.
>
> The AskUserQuestion trick is infinite.
>
> It's not just the first prompt. You can follow up with it forever.
>
> And Claude will keep interviewing you until you've given so much context it's impossible to fail.
>
> **VI. You really don't need folders.**
>
> I know you are pissed at me because you've heard me saying files and folders are so cool.
>
> And I really believed it.
>
> But then I checked how I use Claude, and I just don't open Claude's files.
>
> Let me give you an example.
>
> When I create a spreadsheet, an Excel, using Cowork, I always export it with one button to my Google Drive (with Google Sheet).
>
> Same goes to every document (text, PDF, slides…).
>
> Here's how it works:
>
> Step 1 - I like using this template to make a clean Excel.
>
> Create an Excel spreadsheet from:
> [DATA: file path, folder, or pasted data, best is to upload data].
>
> ### Purpose:
> [Who uses this and what decision/task it supports — 1 sentence.]
>
> ### Sheets needed:
> - "[Sheet name]": [columns, what each row represents, any calculations or formulas]
> - "[Sheet name]": [e.g., summary with totals, pivot, charts — or remove if only one sheet]
>
> ### Formatting:
> [Currency/date formats, conditional highlighting, frozen header row, totals row — pick what applies.]
>
> Before building, list your top 10 assumptions so I can sanity-check them, then execute.
>
> Here's an example:
>
> Create an Excel spreadsheet: Customer support capacity and cost model for a fast-growing B2B SaaS company, covering Q3 2026 – Q2 2027.
>
> Purpose:
> Leadership-ready model to decide when to hire support agents, where automation helps most, and how support costs scale as customer count grows.
>
> Business context:
> * Company sells project-management software to SMB and mid-market customers.
> * Current customer base: 4,800 accounts, growing 8% month-over-month.
> * Support channels: email, live chat, phone, and self-serve help center.
> * Ticket volume depends on customer count, onboarding activity, product complexity, and seasonality.
> * Make your own assumptions for tickets per account, channel mix, first-response time targets, handle time, agent productivity, automation deflection, salary costs, software costs, escalation rates, and customer satisfaction impact.
> * Every assumption lives as a labeled, editable input on the Assumptions sheet — never hardcoded inside a downstream formula — so the COO can pressure-test staffing and automation decisions live.
>
> Sheets needed:
> * "Assumptions": all editable inputs grouped by Customer Growth, Ticket Demand, Channel Mix, Agent Productivity, Automation, Cost Structure, and SLA Targets
> * "Ticket Forecast": monthly ticket volume by channel, including new-customer onboarding tickets, recurring support tickets, escalations, and deflected tickets
> * "Capacity Plan": required agent hours, available agent capacity, hiring needs, utilization %, backlog risk, and SLA coverage by month
> * "Cost Model": support labor cost, software/tooling cost, outsourcing cost, automation investment, cost per ticket, and cost per customer
> * "SLA & CX": first-response time, resolution time, backlog, CSAT estimate, escalation rate, and churn-risk indicator
> * "Dashboard": single-screen executive summary with KPI tiles for total tickets, required headcount, support cost/customer, SLA attainment, automation savings, and CSAT trend; include charts for ticket volume by channel, capacity gap, and support cost over time
> * "Scenarios": Base / Growth Surge / Automation-Heavy toggle that flexes customer growth, ticket volume per account, automation deflection, and agent productivity
>
> Formatting:
> USD currency with no decimals, percentages where relevant, frozen header rows, clean executive-friendly palette, conditional formatting for SLA misses and utilization above 85%, monthly columns grouped by quarter, totals row on every model sheet, and named ranges for major assumptions so formulas are readable.
>
> Before building, list your top 10 assumptions so I can sanity-check them, then execute.
>
> I just received a multi-tab Excel.
>
> And the magic button is the Google Drive integration: click here to open your file inside Google (docx, slides, sheets…). Much better than having a file inside your computer. It automatically created this Google Sheet. Perfect.
>
> And if you need to edit it, you have two choices from here:
>
> Go back to Cowork and ask what you want. And if you don't know what to ask, ask Claude to ask you. Using the AskUserQuestion tool I told you about.
>
> Or use the (free) ChatGPT extension inside Google Sheets. Go to the top → Extensions → ChatGPT (you might have to add it first). It will open a sidebar. I like using the Heavy mode.
>
> I tested every single ways to create spreadsheets with AI. Cowork is the best.
>
> And it's not even the only cool part of Cowork.
>
> You can onboard anyone of your company much more easily with Claude:
>
> **VII. Onboard with Claude.**
>
> Go to your Claude app. Create a new project.
>
> Add all of the necessary resources, usually the company's mission, deck, some interviews of the CEOs or C-levels…
>
> If you can add best practices from support, they usually cover everything about the business a new employee should know.
>
> Invite them to the new Claude Project.
>
> Create a skill on top of it that is called /answer-onboarding with how to use the data inside the Claude Project to answer anyone doing an onboarding.
>
> Now as soon as a new recrue needs an answer, they start by going to the Claude Project, and do /answer-onboarding + ask the question.
>
> Claude will give a great answer.
>
> I have a rule in my company:
>
> Please ask me as many questions as possible. Failing is winning.
>
> Never ask me a question before giving me a potential answer.
>
> Find the potential answer by doing what I just said: project + skills invoking how to (potentially) answer the new person.
>
> It forces people to go from "I'm new, I can't think for myself" to "I work actively to find the answer, but I still need help".
>
> It's very different.
>
> After this you'll want to run everything through Cowork.
>
> Don't.
>
> **VIII. When Cowork is the wrong tool.**
>
> You should use…
>
> Chat: nothing to build, nowhere to keep it, a question, a quick rewrite.
>
> Claude Code: the deliverable is software, code, something to build.
>
> Claude Cowork: everything document-shaped (decks, analysis, client work).
>
> Claude is extremely powerful.
>
> So powerful that its biggest blocker is most of the time… you.
>
> **IX. You are slowing us down.**
>
> This is a typical Cowork session:
>
> You type a prompt. 30 seconds.
>
> Cowork reads your skills. 50 seconds. It generates a plan. 50 seconds. It asks you clarifying questions using AskUserQuestion. 50 seconds.
>
> Now you answer those questions. You click some options. Fine.
>
> But sometimes you need to type a custom answer (and custom answers are where the best outputs come from).
>
> So you stop. Think. Type.
>
> 60 seconds per answer. Maybe 2 minutes.
>
> Across 8 questions, that's 8-15 minutes of you being the slow part.
>
> But Cowork can read 100,000 words in 15 seconds. It can build a spreadsheet in 90 seconds. And it has to wait for you to type at 60 words per minute.
>
> But you could be faster. Because you speak at 150 words per minute.
>
> Side note ⚠️ I know it sounds ridiculous to optimize everything for speed.
>
> But talking instead of typing has another massive benefit: it sounds natural. It's you, your voice.
>
> And your brain thinks very differently when it has to talk.
>
> Did you realize how good your ideas are, your flow is, when you're talking to a colleague about solving a problem?
>
> We want the same flow state here.
>
> How to set up Wispr flow.
>
> Quick reminder for those who missed it: Wispr Flow is a dictation tool.
>
> You hold a key, talk, release. Your words appear wherever your cursor is.
>
> Anywhere on your computer. Including inside Cowork's chat box.
>
> What makes Wispr Flow different: its accuracy.
>
> Near perfection, every single time.
>
> Wispr Flow + Claude Cowork is the perfect match to counter a common problem when using AI: you steer the conversation, and make sure you are in flow state.
>
> Instead of typing "I need a Linkedin post," you start talking "I recently found out about… and I want to share more about… but first I need to make sure that… so maybe we should start covering… and end up with… as a conclusion".
>
> 1. The initial prompt: I speak it.
>
> I say this out loud. Wispr types it.
>
> The point isn't to be faster, but we end up giving much more context when we talk (we are yappers by nature), rather than with a lazy typed prompt.
>
> And the more context, the better.
>
> 2. AskUserQuestion answers: I speak those too.
>
> Cowork generates a form. Most options I just click.
>
> But when I need to add context ("make it more direct, she's a CEO who hates fluff, and reference the ROI data from the last call"), I dictate that instead of typing it.
>
> I don't self-edit while speaking. I dump my thinking.
>
> Cowork figures out what matters.
>
> 3. Feedback and pivots: spoken.
>
> When Cowork produces something that's off, I used to type feedback like: "Tone is wrong. Make it less formal."
>
> Now I say: "The tone is too stiff. I want it to sound like I'm texting a friend who happens to run a 200-person company. Keep the data but make it casual. Only redo section 2."
>
> Spoken feedback is richer because I am a yapper.
>
> How to download Wispr Flow for free.
>
> Go to wispr.ai. Download Wispr Flow. Install it.
>
> The free tier is capped at 2,000 words/week - perfect to know if you like it.
>
> Choose your favorite keystroke to activate Wispr Flow. I personally love "Shift", the little arrow below "Enter".
>
> Go to any app, hold your keystroke (like shift) and… talk.
>
> You now type 4x faster than before. Congratulations.
>
> You get a free month when you pay for my newsletter (you don't have to).
>
> There's no "integration" to configure. Wispr types wherever you type.
>
> My Cowork literally spawned 5 running agents. Mini-Claudes.
>
> Now there might be a problem.
>
> Youll end up using Cowork so much you will spend a lot of money.
>
> So here is how to save money in Cowork:
>
> **X - How to save money in Cowork.**
>
> The $20 paid plan of Claude will give you credits (called tokens).
>
> But you will use them up very fast.
>
> At the scale of a company, saving tokens = saving thousands of dollars!
>
> This section is about saving as many credits (= tokens) as possible.
>
> 1 - Restart your conversation. Don't send a follow-up.
>
> First, Claude doesn't count messages. It counts tokens. Every time you send a message, Claude re-reads the entire conversation history.
>
> Message 30 costs 31x more tokens than message 1.
>
> When Cowork gets something wrong, you want to type "No, I meant..." and send another message. Don't.
>
> Every follow-up stacks on top of the full conversation history. Claude re-reads all of it every turn. At ~500 tokens per exchange, 20 messages burns 105K tokens. 30 messages burns 232K.
>
> Instead: click "Restart the conversation from here" on a previous message (much higher ideally so you do save tokens).
>
> At the bottom right of everyone of your prompt, you can restart from here.
>
> In Cowork, you can also edit a previous message.
>
> Click on Edit on your own prompt. It will delete whatever comes next. And you can edit your prompt to start over (from there).
>
> So when something goes wrong, edit your prompt with a better prompt or restart the conversation higher.
>
> It's the biggest hack!
>
> 2 - Start a fresh session every 20 messages.
>
> Long conversations are token furnaces.
>
> One developer tracked his usage and found 98.5% of tokens were spent re-reading history. Only 1.5% went to the actual output.
>
> When a Cowork session gets long: ask Claude to summarize everything, copy it, start a new session, paste the summary as your first message.
>
> You keep the context. You lose the bloat.
>
> 3 - Batch your tasks into one message.
>
> Three separate prompts = three full context reloads.
>
> One prompt with three tasks = one reload.
>
> Instead of: "Summarize this article" then "List the main points" then "Suggest a headline" write: "Summarize this article, list the main points, and suggest a headline."
>
> Using Wispr Flow helps.
>
> 4 - Use Sonnet (not Opus) for quick tasks.
>
> Grammar checks, brainstorming, formatting, short answers. Sonet handles all of this at a fraction of the cost. And technically, Haiku is even cheaper.
>
> Save Opus + Extended thinking for the work that actually needs it. Drafts and simple tasks on Sonnet-Haiku free up 30-70% of your budget for deep work.
>
> What about "Mythos" or "Fable-5" level of Claude?
>
> Fable-5, called a "Mythos-level," is even better than Opus.
>
> It is obviously for your hardest tasks possible.
>
> I'll be honest, I was spamming Fable-5 requests whenever I could.
>
> But you know it's the most token-intensive model.
>
> So there is no right or wrong answer. I am paying $100 a month for my Claude, and I have never run into any problems. We don't use it for coding, so we are using fewer tokens than typical people.
>
> 5 - Delete your ABOUT ME file.
>
> I wrote extensively on building your "about-me" file.
>
> Keep it. But turn it into a skill. It's actually very simple. Just do this and upload it. And I can now invoke it whenever I want.
>
> 6 - Spread your work across the day.
>
> This one is impossible to actually do in practice, but it works.
>
> Claude uses a rolling 5-hour window. If you burn your entire limit in one morning session, most of your daily capacity goes unused.
>
> Split into 2-3 sessions: morning, afternoon, evening.
>
> By the time you come back, your previous usage has rolled off.
>
> And avoid peak hours (5-11 AM Pacific on weekdays) when the same query costs more against your limit.
>
> Cool in theory, but I never do it ahah.
>
> If I want to work, I work.
>
> That's why I pay for the $100/month paid plan.
>
> So far, no problem (but I had a lot on the $20 plan).
>
> I think a couple of dollars per day is worth it to have a godlike intelligence by my side. Your call.
>
> **XI. Your first 20 minutes.**
>
> 0–3: empty your settings, turn everything off.
>
> 3–8: build your first Skill (something you keep doing).
>
> 8–13: create your first Project (upload PDFs, excels… from a client).
>
> 13–17: use your skill inside your project to see how it feels.
>
> 17–20: download my Claude Skills library by subscribing for free.
>
> I give the library for free in my welcome email.
>
> It's all for free for new subscribers.
>
> If you are already a subscriber, leave a comment & I'll dm you.
>
> Creating skills should be your priority once you set up Cowork.
>
> If you want (yet) another way to create skills, here's a cool last example:
>
> I saw this tweet praising a lot of experts. Go to Chat (not Cowork) and turn on "Research". I then copied and pasted the tweet. It generated a long research on the topic after a deep web search. Claude decided to create 7 skills out of it.
>
> Sky is the limit. Create many skills, test them, improve them.
>
> I need to clear things out:
>
> I'm not paid by Anthropic.
>
> I don't pick sides.
>
> Not Claude, not anyone.
>
> Nobody pays me to write this.
>
> Twice a week I show you how my own work is changing with AI.
>
> As fast as it's actually changing.
>
> I want to be your filter to the noise — the person who tells you what to ignore and what to set up this weekend.
>
> 750,000 of you trust me to be that filter. You probably know me from my Linkedin. Or someone you trust forwarded you one of my guides.
>
> If this one helped, be that person for someone on your team.
>
> Share it with them.
>
> It costs you nothing, and it makes your close network better at it.
>
> And if someone sent you this, thank them, then subscribe so you get the next one free.
>
> **PS: You don't want your company to be left behind.**
>
> Reading about AI is useful.
>
> But it won't change how your company works.
>
> If you have 100+ people on your team, adopting AI is not a "send them a newsletter" problem. It is a systems problem.
>
> Your people have different roles, clients, tools, workflows, permissions, data, risks, and habits. My newsletter, sent to 750,000 people, can't do that.
>
> That is how I help companies.
>
> I run tailored AI workshops for enterprise teams. I am not alone, we are 20 people in New York City to support our clients.
>
> We map where AI can actually save time, where it should not be used, and how your people can adopt it without creating chaos.
>
> If your company has 100+ people, message me.
>
> My team & I will take care of you in priority.
**Structure:** Self-retraction hook ("I was wrong... Do not read them": literally disowning his own two highest-engagement prior essays) → enterprise-scale origin story explaining the reversal → roman-numeral sections (I-XI): why Cowork beats single-Claude, the folder system explicitly renounced (II), the new Skills+Projects framework with a decision test ("teach someone → Skill; specific context → Project") (III), a minimal-settings philosophy (IV), the AskUserQuestion trick reprised (V), a full worked Excel-prompt example with Google Drive export (VI), a company-onboarding use case (VII), a tool-selection decision rule Chat/Code/Cowork (VIII), a Wispr Flow dictation section reused near-verbatim from Posts #1/#2 (IX), a token-saving numbered list reused from his usage-limits essay (X), and a timed 20-minute checklist (XI) → closing disclaimer/share CTA + a consulting-services pitch PS.
**Framing:** The most structurally unusual essay in the batch: a public, named self-correction of his own most-shared work, which functions as a credibility/authenticity move ("I'm not paid by Anthropic, so I can say whatever I want") rather than an admission of failure. Demonstrates his content operation reuses proven sub-blocks verbatim across essays (Wispr Flow section, token-saving list) rather than rewriting from scratch each time: a template-and-remix production pattern worth noting for study purposes.

### 17. Claude Design. (Apr 21, 2026) [link](https://ruben.substack.com/p/claude-design)
**Metrics:** 776 likes · 91 comments · 72 restacks
**Opening hook (verbatim):**
> I'm sorry, but Claude did it again.
> They released another Claude:
> 55 million views in 2 days. Figma lost $730M valutation right after the news.
**Promotional teaser (verbatim):**
> How to access Claude Design:
**Full text (verbatim):**
> I'm sorry, but Claude did it again.
>
> They released another Claude.
>
> 55 million views in 2 days. Figma lost $730M valutation right after the news.
>
> This one designs.
>
> It lives on another website claude.ai/design. Runs on Opus 4.7 (the best vision model they've ever shipped). And it comes with a "Send to Canva" button.
>
> Canva is a free design tool, for everyone.
>
> I have been abusing it since the day it launched. And I understand why Figma (the leading tool for designers) lost $730M valutation right after the news.
>
> Claude Design is another (little) revolution.
>
> So I wrote this guide with 3 goals: (1) the simplest steps to try, (2) the exact prompts that will make you say "wait, I can really design this?", (3) an advanced workflow I did for myself, that you should copy too.
>
> Two things before we start:
>
> Save this guide and spend 30 minutes this weekend to try Claude Design.
>
> Send it to any designer, founder, or marketer who still thinks AI can't design.
>
> PS: This newsletter mostly grows from your shares. And I keep hitting 1,000+ shares! It's my north star. I now know what you love (or don't). It's free & helps me stay laser focused.
>
> **1. How to access Claude Design.**
>
> Claude Design is a separate product from everything else.
>
> It doesn't live inside the Claude browser or desktop app.
>
> → It has its own URL: claude.ai/design.
>
> Cowork still plays a role in my workflow, though. More on that in section 3.
>
> ✦ If you're on Pro or Max:
>
> Go to claude.ai/design. Sign in.
>
> You do need one of the paid plans.
>
> ✦ If you're on Team or Enterprise:
>
> Claude Design is off by default. Your admin must turn it on:
>
> → Organization settings → Capabilities → Anthropic Labs → toggle on.
>
> It's a research preview = so gradual rollout. If claude.ai/design redirects you home, try again in a few days.
>
> And it uses your existing plan limits. Extra usage is available if you burn through the cap. It uses tokens extremely fast. So be cautious.
>
> **2. First quick tests (each under 2 min).**
>
> My first prompts to quickly test it.
>
> Test 1. Create a stunning website.
>
> I am still in awe of the website I created with… a 2-line prompt.
>
> This is the one-shot result. I didn't write a single thing on this website.
>
> Here's how I did it:
>
> Go to the first tab, "Wireframe." Select "High fidelity".
>
> Paste this prompt:
>
> Create a high-fidelity landing page designed to raise $[FUNDING AMOUNT] from [TARGET INVESTORS] for "[PRODUCT NAME]" - [short product description].
>
> Target audience: [Your target audience description]. Tone should feel [how should the web visitor feel] - think a mix of [website] + [website] + [ecosystem].
>
> Here's my prompt for example:
>
> Create a high-fidelity landing page designed to raise $100 million from Israeli VCs for "Governmental Underwater Datacenters" — a sovereign, nation-only underwater data center infrastructure built specifically for AI and robotic workloads.
>
> Target audience: Serious Israeli venture capital firms and government tech investors. Tone should feel premium, strategic, slightly futuristic but highly credible and secure — think a mix of Stripe's polish + Anduril's defense-tech seriousness + Israeli startup pragmatism.
>
> I can't believe I just made an entire incredible website. One-shot.
>
> You can click on Comment and select what you want to edit…
>
> Test 2: Let's make a slide deck now.
>
> I loved my previous idea of underwater data centers.
>
> So let's make a slide deck now, meant as a pitch deck for sales:
>
> This time, select 'Slide deck'.
>
> Go back to the homepage → Slide deck.
>
> Paste this prompt (if you want my example):
>
> Create a pitch deck for my sales team. Our company has underwater GPU datacenters, meant only for Israeli companies, to ensure full sovereignty.
>
> Answer the questions from Claude.
>
> Here's the result (as a PDF). Impressive for a one-shot.
>
> Again, it performed both the search and the slides (with the right style).
>
> I still prefer Gamma for its diversity and simplicity. But I'd love a combo of the two. Maybe this is on the future roadmap of the two?
>
> Test 3: Create an animated video.
>
> Click on "From template" this time.
>
> I'm sorry if it's the same example… I found it fun :)
>
> Write a quick prompt that has a visual story to share. You can also start with a sketch (but I am literally the worst guy at drawing anything).
>
> Here's my prompt (I used Claude for it, yes):
>
> Create a 45-second animated video explaining how Israel is building underwater datacenters off the Mediterranean coast to cool the next wave of AI compute. 16:9.
>
> Structure:
> - 0-5s: Cold open. Title card "The AI compute race is going underwater." Wave animation in the background.
> - 5-15s: The problem. Animated stat reveal: "AI datacenters will consume 945 TWh by 2030." Show a row of land-based datacenters lighting up with a thermal overlay as heat builds.
> - 15-30s: The solution. Animated cross-section of a sealed server capsule descending off the coast of Tel Aviv. Seawater flows around it as passive cooling. Small fish swim past. Bubbles rise.
> - 30-40s: Three stat cards slide in, one after the other: "40% lower cooling costs." "Zero freshwater used." "8x closer to European users."
> - 40-45s: Closing card. "Israel's underwater datacenter race. Starts 2026." Leave room for a logo bottom-right.
>
> Visual style: clean tech, thin-line illustrations, Mediterranean blue + sand beige + pure white palette. Kinetic typography for every stat. Smooth camera pans, no hard cuts. No stock footage. No emoji. Serif for titles, sans-serif for body.
>
> Get a fully animated video: you get a 45-sec animated video instantly.
>
> **3. The video hack (to get great slides).**
>
> This one is weird. And it works.
>
> 1 - Copy an entire blog from someone (not me, thanks).
>
> For example, here, I use a feature no one else is using: Claude Research.
>
> Click on the + to find "Research". After 13 min (!!!), I have a great report I can download as a markdown.
>
> 2 - Paste it into Claude Design.
>
> Upload your markdown file with this prompt:
>
> Make a 30-second animated video that summarizes this blog for a first-time viewer.
>
> This is the md. file.
>
> You get an actual animated video. Motion, transitions, pacing.
>
> 55 seconds of animated video.
>
> Then, on the same chat, continue with:
>
> Now convert that video into a slide pitch deck.
>
> This is now a slide deck!
>
> The slides come out better than if you'd asked for the deck directly.
>
> Because the video step forces visual thinking before you commit to static frames.
>
> **3. The advanced workflow: 0 to 1 (Cowork + Claude Design)**
>
> Here's a workflow I run on client projects.
>
> It starts in Cowork. And because Claude Design is only as good as the design system you give it, you need to work on its input first.
>
> Step 1: Extract your brand system with Cowork.
>
> Drop every brand asset you have into one folder. Logos. Past slides. Photography. Landing pages. Your brand PDF, if you have one. Product screenshots.
>
> Open Cowork. Select the folder.
>
> in Cowork, I linked the new PepsiCo branding + assets with this prompt
>
> And then paste:
>
> Analyze this folder and produce a full design system write-up. Fonts, colors, graphical styles, component patterns, tone, layout conventions. Flag anything that's missing. Save it as DESIGN.md in my folder.
>
> Cowork reads every file. Outputs a clean DESIGN.md.
>
> DESIGN.md is just a fancy way to say "brand guidelines & instructions".
>
> Step 2: Upload DESIGN.md into Claude Design.
>
> Go to claude.ai/design.
>
> Drop your DESIGN.md as context.
>
> Every future prompt applies it automatically.
>
> You never re-specify colors or fonts again.
>
> (If you already have a design system in code, link the codebase directly. Same effect.)
>
> Step 3: Generate.
>
> Go back to claude.ai/design and upload your DESIGN.md file.
>
> Then add your prompt + your format.
>
> Every good prompt has 4 locked-in inputs: goal, layout, content, constraints.
>
> Build a pricing page for [product]. 3 tiers, annual/monthly toggle, sticky CTA on mobile. Mobile-first responsive. Use our Primary Button component. Match the tone of our existing homepage.
>
> In my tests, when the design system is uploaded and the prompt is specific, Claude Design shines. Otherwise, you'll see the same design everywhere.
>
> I added both the DESIGN.md for PepsiCo and my product brief, along with the success criteria. That's what a good prompt looks like.
>
> Again, Claude asked me questions, and I answered.
>
> Not only are the slides good, but I have speaker notes… on each slide!
>
> Step 4: How to iterate.
>
> Structural changes → go in the chat: "Show me 3 alternative layouts."
>
> Then you need to click on "Tweaks."
>
> And it creates multiple versions… in seconds.
>
> Pixel-level changes → go on the canvas: → Click the edit button. Select exactly what you want to change. It highlights exactly what you want to change in green.
>
> Before a risky experiment → save a branch: "Save what we have, and try a completely different approach."
>
> Step 5: Validate.
>
> Before you export, run these 3 prompts:
>
> Review this for contrast and accessibility. List any WCAG 2.1 AA violations with exact fixes.
>
> Generate desktop, tablet, and mobile versions.
>
> Suggest 2 A/B test variations of the hero section, each with a different angle.
>
> Step 6: Export.
>
> Click Export (upper right). Options: Send to Canva, PPTX, PDF, standalone HTML, or a bundle for Claude Code.
>
> My favorite should be "Send to Canva"… but it does not work.
>
> Send to Canva does not work… a shame.
>
> So I can go from an empty folder to a shippable design in… I'd say about 1 hour for a single page. 2-3 hours for a full website with multiple tabs. Depends how peculiar you are with details.
>
> Before Claude Design? The same work could take me at least a full day.
>
> And that's without using my next section favorite hack:
>
> **4. Copy any design.**
>
> This section blew my mind the most.
>
> There is a free website called getdesign.md.
>
> (I'm not affiliated, don't give them any money, I use it for free).
>
> And as you can already guess… you can literally copy the DESIGN.md file (the brand guidelines for Claude) from most brand you know.
>
> Like, for example, you like the Mastercard branding?
>
> You can download it → Give it to Claude Design → Design like Mastercard.
>
> Click here to download the DESIGN.md for Claude.
>
> Go back to Claude Design and add the DESIGN.md (from Mastercard here) + your prompt (from your product, for example).
>
> And it made 3 panels (like a website).
>
> Now let's try to do it, but like Airbnb: the exact same prompt, but with the Airbnb md. file.
>
> Or like Ferrari: the exact same prompt, but with the Ferrari md. file.
>
> **5. Taste is all you need.**
>
> The future is coming at us, very very fast.
>
> Claude Design builds 10 dashboards in 10 minutes.
>
> It applies a design system automatically, suggests 3 layout variations, exports to 5 formats.
>
> You can upload any style to it → it copies it instantly.
>
> What it cannot do is tell you which of the 10 dashboards to ship for your specific users at this specific moment.
>
> That's taste.
>
> Taste is the ability to say no to 9 versions and yes to 1.
>
> Taste is the override switch. Taste is looking at a critique and saying, "Claude is wrong about this one, because my audience expects minimalism." Or the opposite.
>
> That part is still you.
>
> Sure, Claude Design is beautiful.
>
> Sure, Claude Cowork writes so fast & accurately.
>
> Until everyone designs and writes the exact same way.
>
> Think about it: you are now paid to do better. To be ahead of the "default from AI". That's why I always say "Master AI before it masters you".
>
> You must be better than AI's average, AI's default. Be ahead.
>
> If you're a designer reading this and feeling nervous about being replaced, you're reading the moment wrong. Designers with taste are about to have the best decade of their careers. Tools just got cheap. Taste just got much more expensive.
>
> **Claude did not pay me.**
>
> And I won't accept any future sponsorship from AI labs.
>
> I simply can't.
>
> I must stay as neutral as possible, saying exactly what I want based on my own experience testing the tool. And you know what?
>
> Claude Design is far from being perfect:
>
> It consumes too many tokens (= money).
>
> It is still very buggy, left and right.
>
> You lack control.
>
> But I can see how things are evolving…
>
> Claude Code changed how we code.
>
> Claude Cowork, a few months later, came at knowledge workers.
>
> And now Claude Design is coming at designers.
>
> So no, I'm not paid to make this newsletter (or the next).
>
> But I'm sharing, twice a week, how my work is transforming (very fast) with AI. As I'm trying to keep up, I want you to keep up. So we move just as fast.
>
> I am growing this newsletter purely from your (free) shares.
>
> If this article helped you, be helpful to someone else too.
>
> It does not cost you anything to share. And sharing is caring :)
**Structure:** Market-shock hook (Figma lost $730M valuation on the news) → access instructions split by plan tier → 3 quick-test prompts (website, slide deck, animated video), each a full copy-paste example with real screenshots referenced → an unusual "video hack" for better slides (generate video first, convert to deck) → a 6-step "0 to 1" advanced workflow combining Cowork (extract DESIGN.md brand system) with Claude Design → a "copy any design" section pointing to a third-party site that scrapes brand DESIGN.md files (Mastercard, Airbnb, Ferrari examples) → closing philosophical "taste is all you need" section on human judgment surviving AI design tools → honesty disclaimer ("Claude Design is far from perfect": token-hungry, buggy, Send-to-Canva broken) → closing disclaimer/CTA.
**Framing:** Playful, almost absurdist example content (a fictional "underwater datacenters for Israeli VCs" pitch running through all three format tests) rather than a realistic business use case: used consistently as his running example, giving personality to an otherwise dry feature tour. The closing "taste is all you need" section is his most explicit statement of a recurring worldview across the batch: AI collapses execution cost, taste/judgment becomes the scarce differentiator: stated as a direct thesis here rather than implied.

### 18. Fable 5. (Jul 8, 2026) [link](https://ruben.substack.com/p/dont-use-claude-fable-5)
**Metrics:** 768 likes · 502 comments · 72 restacks
**Opening hook (verbatim):**
> Do not use Fable 5 if you don't know how.
> Or it will cost you an arm and a leg.
> Smarter AI = Expensive AI.
**Promotional teaser (verbatim):**
> Don't use Claude Fable-5.
**Full text (verbatim):**
> Do not use Fable 5 if you don't know how.
>
> Or it will cost you an arm and a leg.
>
> Smarter AI = Expensive AI.
>
> And the new Claude Fable-5 is by far the smartest AI model on Earth.
>
> OK. So what can you do with this 'Claude'?
>
> Pretty much anything: make an interactive chart to understand something, make a spreadsheet (any spreadsheet), upload everything about you and co-write anything with Claude, make a deck (any deck, it's a PowerPoint), make Claude conduct market research for 11 minutes through 258 sources.
>
> "OK, but this is not new. The old Claude can also do it."
>
> You're right.
>
> But you need to understand the difference between the many Claude.
>
> Claude comes in different flavors of intelligence:
>
> Haiku, the fastest but dumbest model.
>
> Sonnet, the middle one. Good fast/smart ratio.
>
> Opus, the big one. Very smart, used to be the smartest.
>
> Mythos, the new smartest model. But also the most expensive.
>
> Then each flavor is associated with a number, kinda like iPhone 6 vs iPhone 17.
>
> But somehow, just to confuse you a bit, they launch a "Mythos-level" of Claude with a name associated with it instead of just a number.
>
> And it's called "Fable-5".
>
> The only thing you need to remember is that Fable-5 is the smartest AI around. It's actually so powerful; you must experience it sooner rather than later.
>
> Reminder #1: I'm not paid by Anthropic. I don't care if you use it or not, I actually love ChatGPT too :) and I'm sure they will soon catch up, if not be better. I don't pick sides.
>
> Reminder #2: You have until July 12th to experience Fable for "free" (if you have a paid Claude account). After the 12th, you have to pay per use. More about it later.
>
> "So, OK, what's a "smarter" AI in practice?"
>
> Think of Claude as an expensive senior lawyer and their intern.
>
> Fable-5 is the expensive senior lawyer with 20 years of experience. He costs $1,000 per hour.
>
> Sonnet-5 is the cheap intern, and only costs $100/hour. Worth noticing, he can still read what Fable-5 tells him to do.
>
> You don't want to pay the expensive lawyer for every quick contract review. You want to pay the expensive senior lawyer to define the overall international contract strategy. Then the drafting assistant (Sonnet-5) follows that strategy consistently.
>
> Now imagine you lead a team of 100 people.
>
> They all have Fable-5 and zero training. So they spend dozens of hours billing the senior lawyer for the most mundane tasks, and no one tracks it.
>
> Well, you will soon wake up with a $1,000,000 bill from Anthropic.
>
> Not fun.
>
> You - and your team - must know:
>
> When to use Fable-5, and when NOT to use it.
>
> How to best use Fable-5 to get the most of it.
>
> I won't waste your time explaining why this model is widely better than the previous one. You trust me.
>
> I will also assume you never tried the new Claude 5.
>
> And by the end of this (very long) guide, you will know more than the entire world. Because yes, 99.64% of the world never tried Claude.
>
> Sounds like a good deal? Good.
>
> But two things before we start:
>
> Save this guide. Block 10 min this week & try Claude-5 for the first time.
>
> Send it to anyone who has never tried Claude (& still thinks it's a French name).
>
> PS: Think of one person still typing everything into Google like it's 2021. Send them this. You'll be the friend who finally got them using AI right. People remember.
>
> **1. Don't prompt Fable 5.**
>
> Fable-5 now costs extra, starting July 12th.
>
> Here's the timeline:
>
> June 9: Fable-5 launches, included in paid plans.
>
> June 12: banned by US government. Gone worldwide, overnight.
>
> July 1: it's back, included again (up to 50% of your weekly limits).
>
> July 12: it leaves subscriptions. From now on, Fable runs on usage credits. You pay per use.
>
> The price: $10 per million input tokens, $50 per million output tokens.
>
> In normal-people terms…
>
> $0.15 for a one short question, and one answer (of 1,000 words).
>
> $6 for 19 turns of long questions & answers (of 1,000 words).
>
> $14 when you hit 40 turns. Turns are the most expensive habit.
>
> Here's how to understand it:
>
> You have turns (your prompt + Claude's answer = 2 turns).
>
> Each prompt (you) or answer (Claude) is using tokens for words.
>
> The more tokens, the more expensive it is.
>
> So the longer the prompts/answers or the more turns = the more $$$.
>
> And also, Claude reads the entire thread at every turn. So it scales fast.
>
> The longer your chat is, the more expensive it becomes.
>
> So what can you do?
>
> Ask Fable super hard goals, for one or two turns max.
>
> Switch to Opus 4.8 (High) for the rest. Because it's not pay-per-use.
>
> It's super simple. Here's my explanation with screenshots:
>
> This is how I start my prompts. Chat + Fable 5-High + this template.
>
> I need [task] for [goal]. I will expect [goal] to be achieved once we hit [specific targets]. Start by asking me questions about [task, goal and targets] to fully understand the context, using the AskUserQuestion tool.
>
> Here's an example of me filling out the prompt template. Claude asks me questions, I answer, and it thinks deeply now.
>
> And then you switch here the model to Opus 4.8 (High).
>
> That's the right way of using Claude Fable-5.
>
> You use it, few turns, and then you switch the model to Opus.
>
> What about Cowork? Somehow we can't switch model during Cowork… Annoying, I know. If you don't know what's Cowork, I explain it later.
>
> How do I know we must switch models?
>
> Because I read their entire documentation. The kind of doc I read for you. So you don't have to.
>
> And I am also chronically online on Twitter. I have your back.
>
> Anthropic pushes the "First Fable-5, then Sonnet-5" narrative.
>
> You still need to know two things before I can move on to more complex concepts.
>
> What happens if you only use Fable-5?
>
> After using Fable-5 once or twice, should you switch to Sonnet or Opus?
>
> Let's start with the first one.
>
> #1. I did the test.
>
> And I had to spend $14 (!!!), one-shot, on top of my $100 plan.
>
> I tried to push Fable to its maximum by making it write 30 newsletters at once. I had to add $14 to my $100 plan.
>
> Now I do have to say, Fable-5 wrote 30 entire newsletters, right inside my computer. Impressive work. But not worth $14.
>
> If you need to check your spending and limit your team's credits, you need to go in your organization settings, in Usage.
>
> My team can help you. If your company did not set this up properly, you will wake up with an Anthropic bill that could sink you real fast.
>
> We set up Claudes for enterprise, train you on it, and make sure you never need us again so you can do your job with it.
>
> If you have a team/company of 30+ people, DM me here.
>
> Anthropic did say Fable returns to subscriptions "as soon as capacity allows."
>
> Technically, it will happen since the same level of "AI intelligence" keeps getting cheaper over time.
>
> So am I telling you to close this guide because AI is too expensive?
>
> The opposite. Here's how you play it:
>
> 1. Sonnet and Opus remains included in your subscription. It handles your daily work, and it's better than anything you had 6 months ago. Everything in this guide works on Sonnet or Opus, after using Fable.
>
> 2. Aim Fable at expensive problems only. Paying per token to "rewrite this email" is shooting a bird with a bazooka (please leave birds alone, though).
>
> I wrote a newsletter about saving tokens if you have another 10 minutes to spare. But long story short:
>
> Create a new chat for a new task.
>
> Don't talk too much to Fable-5 in one long session.
>
> Switch from Fable-5 to Sonnet/Opus during the session.
>
> #2. Sonnet or Opus?
>
> I have no idea.
>
> I'm guessing from my own experience.
>
> On the one hand: Anthropic wants you to use Sonnet 5. Like they said it eveeeerywheere. But it's their latest model (besides Fable).
>
> On the other hand: every benchmark shows Opus 4.8 as cheaper & better than Sonnet 5. Soooooo… I prefer cheaper and smarter, no?
>
> Sonnet 5 is only a tiny little bit better than Opus 4.8 on "Knowledge work." And Opus is cheaper AND smarter than Sonnet here.
>
> So far I've been using Fable-5 (High) + Opus 4.8 (High).
>
> What should be our max per month? $200? $1,000?
>
> Superintelligence is getting expensive…
>
> **2. Expensive superintelligence.**
>
> You need to pay for Claude (at least $20 per month; I personally pay $100) to access Fable-5. The free Claude won't get you anywhere anyway.
>
> Then you can pick the model's "Effort":
>
> I like to pick the "Default" → High.
>
> The effort level is just how long it takes before answering you.
>
> The longer it takes, the more credits it takes.
>
> Big hard tasks = Effort 'Max'. Small incremental task = Effort 'Low'.
>
> So you might be wondering, "Why are we even using Fable-5 then?"
>
> Well, it's better at literally everything.
>
> Here's an example. Copy-paste this exact prompt:
>
> Ask me what I do for work and what I keep track of in my head all day. Then build me a small interactive tool I'd actually use every week. You pick what to build based on my answers. Make it look expensive, and add one feature I wouldn't have thought to ask for.
>
> Claude will ask you questions. Answer them.
>
> Then watch the right side of your screen.
>
> A window opens. Claude is writing software, live, in front of you.
>
> That window is called an Artifact.
>
> Anything Claude makes that's bigger than a chat reply opens there: documents, websites, mini-apps, dashboards, charts, even small games. You can open it full screen.
>
> You can publish it as a link and send it to your team.
>
> This is the era of custom-made tools.
>
> Sometimes an artifact can be interactive too, inside the chat.
>
> Remember the orange image at the top of this newsletter? Made with Claude.
>
> I just take screenshots of my Claude discussions to make all of my newsletter's designs. I'm so fast, it's ridiculous.
>
> But you now know you need to balance out Fable-5 (planning, or a quick super-good results within 2 turns) with Sonnet-5 or Opus 4.8.
>
> OK, good. But how do we prompt this expensive superintelligence?
>
> It's been 4 years we have AI, and people (you) got away with these prompts:
>
> "Rewrite this email."
>
> "Summarize this PDF."
>
> "Make it shorter."
>
> Tasks. Small ones.
>
> One step, then you grab the wheel back, then another small step.
>
> These prompts made sense, especially between 2022-2024.
>
> Old models lost the plot after 3 steps, so you learned to chop your work into bite-sized prompts. I probably wrote 100+ of these guides.
>
> But Claude Fable-5 is different. Another league of its own.
>
> It plans. It asks you questions before starting. It works for a long time without drifting. It pushes back. It checks its own work before handing it back, like an employee who re-reads before hitting send.
>
> So here's the new rule:
>
> Give it goals. Long ones. Hard ones. Stop giving it tasks.
>
> ✘ A task: "Write a follow-up email to this client."
>
> ☑ A goal: "This client owes me 2 invoices and went quiet 3 weeks ago. Here's the full thread. Goal: get paid without burning the relationship. Plan your approach, draft whatever's needed, and ask me what you don't know."
>
> How do I even know this?
>
> Because I read the docs for you.
>
> An Anthropic's engineer published another guide on how to talk to Fable-5.
>
> Yet another ressource I extract, and make it simple for you to understand.
>
> It's written for developers. Nobody told normal people what to do.
>
> Here are the most important points inside:
>
> Line 1. kill the buried answer.
>
> Lead with the outcome. Your first sentence should answer "what happened" or "what did you find." Details after.
>
> No more scrolling through methodology to find the actual answer. Every response starts with the bottom line.
>
> Line 2. the anti-bullshit line.
>
> Only report work you can point to evidence for. If something is not yet verified, say so explicitly.
>
> This one is for long tasks. In Anthropic's own testing, this line nearly eliminated inflated "all done!" reports, even on tasks designed to provoke them. Same standard you'd hold a new hire to: don't tell me it's done, show me.
>
> Line 3. draw the line between advising and acting.
>
> Fable is eager. It will write the email when you just wanted feedback on it. So say which mode you're in:
>
> I'm thinking out loud. Give me your thoughts, don't write anything yet.
>
> or
>
> Handle this end-to-end. Only check in with me if something is irreversible or genuinely needs my input.
>
> Line 4. the anti-overthinking line.
>
> When you have enough information to act, act. Give me a recommendation, not a survey of options.
>
> For when you want an answer, not a menu.
>
> ★ Remember. No more prompting. You're setting rules. Fable finds the how with your goal in mind.
>
> You have the rules. Now time to create some stuff.
>
> **3. Some Fable-5 worthy tasks.**
>
> If you handed me an AGI (an AI smarter than any human), I wouldn't know what to ask for. What's my AGI-level question?
>
> Some obvious ones: cure all diseases, make me very rich, fix everything wrong in the world.
>
> If you've watched the super-duper viral movie "Obsession", it feels like the make-a-wish object that quickly fires back… Obsession is a horror movie. A guy in love makes the wish that her dream girlfriend loves her very much. Don't watch it at night - it's too good.
>
> So before we start curing cancers with AI - and some researchers are already on it, creating new drugs at record speed - let's try to give Fable-5 some worthy prompts to use it best.
>
> 1 - Help me decide prompt.
>
> Why it's Fable-worthy: it forces the model to hold your stated priorities, run bear/base/bull scenarios, and argue against its own recommendation. I like the multi-angle reasoning. Usually, older models flattened into "it depends."
>
> I don't want "it depends", I need to take a sound decision.
>
> Copy and paste this:
>
> I'm about to make a significant decision and I want it stress-tested before I commit, because reversing it later will be expensive. Treat this like the decision review a sharp board member would run — not a summary of considerations.
>
> First, ask me for: the decision and the options on the table, my priorities ranked in order, the constraints I can't change, and the deadline. Then interview me — a few questions at a time — until you understand the decision better than I've articulated it. Push on anything I'm being vague about; vagueness is usually where the risk hides. Once you have enough, deliver your verdict. Open with your bottom-line recommendation in one sentence.
>
> Then: how each option scores against my ranked priorities, the best case, base case, and worst case for your recommended option, the strongest argument for the option you rejected, and the single most likely way your recommendation turns out to be wrong. Be direct. Don't hedge with "it depends on what you value" — I will have told you what I value. If my priorities contradict each other, name the contradiction instead of working around it. Before you finish, check your reasoning against my stated priorities and fix anything that drifted.
>
> Use the AskUserQuestion tool for any question.
>
> 2. The Deep Research prompt.
>
> Why it's Fable-worthy: end-to-end research plus self-verification is exactly the long-horizon, evidence-grounded work Fable 5 was built for.
>
> Here's the prompt:
>
> I need a research report I can actually make a decision from, not a survey of everything that exists. It will be read by someone busy who will act on it, so wrong claims are worse than missing claims.
>
> Start by asking me for: the question I'm trying to answer, the decision it feeds into, and any sources I already have or trust. Then research it end to end. Use the AskUserQuestion tool for it.
>
> Done means a report that opens with the answer in three sentences, then supports it. For every substantive claim, cite the source. Where sources disagree, say so and tell me which you'd trust and why, rather than averaging them into mush. Separate what the evidence shows from what you're inferring — label the inferences.
>
> Before delivering, run an adversarial pass on your own draft: attack your three most load-bearing claims as if you were a skeptic paid to find the flaw, and revise anything that doesn't survive. If a claim can't be verified, keep it — but flag it plainly as unverified instead of quietly dropping the caveat.
>
> Keep it under two pages. Everything cut should be detail that wouldn't change what the reader does next.
>
> 3. The Archive-to-Argument prompt.
>
> Why it's Fable-worthy: it explores a large, messy corpus, proposes competing narrative shapes, and pauses at exactly the point where your judgment matters.
>
> Because I don't trust complete-autopilot-AI yet.
>
> Yes, even me. The prompt right here:
>
> I want to develop a piece of writing from raw material — notes, transcripts, drafts, research — where the argument hasn't taken shape yet. Your job is to help me find the piece inside the material, not to write a generic article about the topic.
>
> Ask me to paste or attach the raw material, plus: who the piece is for, where it will be published, and what I want a reader to understand or feel by the end.
>
> Then explore before drafting. Identify the most interesting tensions, surprises, and unresolved questions in the material. Ask me about the judgment calls only I can make — what I actually believe, what I witnessed, what I'm willing to say publicly. Propose three genuinely different arguments the material could support, with one line each on what that version emphasizes and what it sacrifices. Then stop and wait for me to choose.
>
> After I choose, write a full draft in the voice of the raw material — my phrasing, my rhythm — not a polished house style. Flag every place where the draft asserts something the material doesn't support, so I can either supply the evidence or cut the claim. Don't invent quotes, anecdotes, or numbers to fill gaps; leave a visible gap instead.
>
> 4. The Operating Review prompt
>
> Why it's Fable-worthy: multi-source synthesis across formats — notes, threads, action items — where the model has to reconcile conflicts and route judgment calls back to you.
>
> Again, I love using smart AI for super messy context.
>
> The prompt:
>
> I'm going to give you the raw exhaust of my work week — meeting notes, message threads, to-do lists, half-written docs — and I need it turned into an operating plan I can run next week from. The point is to stop losing commitments and decisions in the pile.
>
> Ask me to paste or attach everything, plus my top priority for the next two weeks.
>
> Done means one document with four sections. Commitments: everything I promised someone or someone promised me, with who, what, and when — flag anything already overdue. Decisions: what was actually decided this week versus what was merely discussed; if the record is ambiguous about which, put it in the ambiguous pile rather than guessing. Conflicts: places where two meetings, people, or documents point in opposite directions — quote both sides. Next week: the five actions that most advance the priority I gave you, each traceable to something in the material.
>
> Ground everything in the source — if I ask where an item came from, you should be able to point to the line. Don't pad the plan with sensible-sounding actions that appear nowhere in my material. If the week's material contradicts my stated priority, say so at the top; that's the most useful thing you could tell me.
>
> Pro tip: Connect your Granola to get your meeting notes inside Claude.
>
> **4. Connect Fable to everything.**
>
> I pay for Claude with my company.
>
> So I can safely connect all my apps without worrying about sharing data with Anthropic.
>
> I picked the Team & Enterprise at $100/month.
>
> This is how to connect your Claude to the rest:
>
> Step 1: Click on the + and Add connector.
>
> Step 2: Type the name of what you want to connect. And click the +
>
> Step 3: Test it. My Claude knows I'm in the South of France in late June.
>
> I showed you the example with Gmail.
>
> But connectors are the best way to power up Claude.
>
> Here's my favorite list:
>
> Slack to read my team's chat.
>
> Granola, my notetaker, is to extract all of my conversations.
>
> HubSpot to track leads.
>
> Notion for my content calendar. I create content for a living.
>
> Google Drive to open Google Sheets when I create spreadsheets.
>
> Gamma to make (very good) decks. Better than Claude.
>
> Connecting Claude to apps gives it context.
>
> Because Claude doesn't know you.
>
> It read most of the internet. It never read your week. Your clients, your deadlines, your writing voice, the deck you half-finished on Sunday: invisible.
>
> Every new chat starts at zero.
>
> Context is everything you hand Claude before it works. Your prompt. Your files. Your examples. The earlier messages in the chat. The tools you've connected (Gmail, Drive, your folders).
>
> And context decides everything, for one simple reason:
>
> AI is average by default. It was trained on everyone, so it answers like everyone. Generic in, generic out. Context is how you drag it from "everyone" to "you."
>
> Don't prompt… "Write me a LinkedIn post about productivity"
>
> But prompt… paste 3 of your old posts + "here's my draft idea, write it like me".
>
> Now the pro move is to stop re-typing your context every time.
>
> You have options, from easy to powerful:
>
> Option 1 - Paste it. Keep an "about-me" google doc. Paste it at the start of any chat that matters, like a pre-prompt.
>
> Option 2 - Projects. A folder inside Claude that remembers your files and instructions across chats.
>
> Go to the left menu, Projects. Name it. Your chats (bottom left) = your chat history. And Claude remembers that. Instructions (top right) = a prompt that Claude reads everytime. Files (middle right) = the most important part. Upload PDFs, excels, docs…
>
> Option 3 - A real folder. On your computer, for Cowork.
>
> **5. What the f*** is Claude Cowork?**
>
> I am sorry to tell you it was last week's newsletter. So go and read it: "How to set up Claude Cowork." (Jul 1)
>
> I will wait for you patiently.
>
> And once you know Cowork, you will want to know Claude Code:
>
> **6. What the f*** is Claude Code?**
>
> Claude Code is thing developers won't shut up about. The #1 reason people pay (a lot) for AI is to code.
>
> But for rookies like you & me, we care about vibecoding.
>
> And I wrote a free guide on it: "Vibecoding." (Jun 16)
>
> Alright, sorry for these articles to read.
>
> Back to Fable-5 guide. I made a skill you can download to prompt it better:
>
> **7. /fable-prompter**
>
> I spent 4 years learning how to prompt.
>
> You get to skip that (but you still need to understand what's going on).
>
> First, what a skill is: instructions you save once, and Claude loads them whenever you type their name. You type /name + one line. Claude does the rest. Skills work in the regular chat and in Cowork (and in Code).
>
> Skills exist because repeating yourself is a waste of context (and of your life). Anything you've explained to Claude twice should become a skill.
>
> So I built one called /fable-prompter.
>
> You hand it a lazy, half-formed idea. It hands you back a finished, ready-to-send prompt, built exactly the way Fable-5 likes them. Specific. Structured. Reasoning dialed all the way up. You copy it into a fresh chat, hit send, done.
>
> The most important part is to give it to Opus 4.8 (not Fable).
>
> I typed 9 words.
>
> And you have a copy-paste prompt.
>
> It returned a 15-line prompt: audience defined, hook rules, voice rules, length caps. And it ends by telling Claude to ask ME for the missing details before drafting. I wrote 9 words.
>
> So now you can copy this and paste it into a Fable-5 instance.
>
> How to install a skill (the easiest steps on Earth):
>
> Download the /fable-prompter file.
>
> It's on Dropbox, you will need a password.
>
> Put: RUBEN-HOWTOAI
>
> If it does not work, leave a comment. I will help you.
>
> Click the big blue Download.
>
> Go to claude.ai → Settings → find Skills (under Capabilities) → click + and upload the file.
>
> Toggle it on. Open any chat. Type /fable-prompter + your idea.
>
> By the way, I gave a library of my favorite skills to Claude.
>
> It's at my welcome email for people who are subscribers (it's free).
>
> It's free. Sent to my subscribers as a welcome gift.
>
> **8. Your team's brain, in a folder.**
>
> Your best teammate quits tomorrow. What leaves with them?
>
> Everything.
>
> The way they brief clients. The pricing logic. The 14 lessons they learned the hard way. It all lives in their head and their DMs.
>
> Companies answer this with SOPs. Documents nobody reads, written once, outdated by next quarter.
>
> I could teach you how to save someone's brain. But 1/ it takes too long, 2/ it's too industry-specific, 3/ that's why I built a company around it.
>
> We go into companies, help them extract knowledge from key people.
>
> Now hold up. I see the haters coming at me. "Ruben, you help companies fire people ????" Hum. No. We helped people retire. They stopped working because they wanted to retire but couldn't because they were afraid of sinking the company.
>
> We call it the Wisdom Walkout.
>
> Here are two quick stories that may sound familiar:
>
> CEO of a family metal processing business knows every customer and metal without a spreadsheet in sight. We interviewed him and reviewed 2 decades of emails. Now anyone can chat with Jim's AI Twin.
>
> Global engineering design and manufacturing firm has 60 out of 350 employees over retirement age. They have a ticking time bomb of relationship data that's about to walk out. We are currently indexing their team communication, paired with human-to-human interviews, to create a central knowledge base.
>
> You feel seen? Send me a message to book a discovery call.
>
> **I don't know nothing.**
>
> I'm not technical.
>
> I dropped out of university.
>
> I ran a techno music label before all of this (from being 17 to being 24).
>
> If I can hand my week to an AI and get it back with the work done, so can you.
>
> Be part of the 0.36% who actually tried Claude.
>
> Heck, be part of the 0.36% who is doing it well!
>
> I wish to help a tiny percent of humanity to know how to get better at AI. Even 1% of us. That's like? 82 million people? I'd love to. Help me get there, share it.
>
> PS: This newsletter stays free because you guys share it. Every article crosses 1,000+ shares, and it's my weekly north star. The best share is your team's group chat (Slack or Teams): you save them tokens, and you help me spread the word.
**Structure:** Warning-label hook ("Don't use Fable 5 if you don't know how, or it will cost you an arm and a leg") → a model-tier taxonomy (Haiku/Sonnet/Opus/Mythos) with a lawyer/intern cost analogy → a literal pricing table with worked dollar-cost math per turn-count → an "I did the test" personal cost anecdote ($14 overage) → a goals-not-tasks reframing citing an internal Anthropic prompting doc, reduced to "4 lines" → 4 full worked "Fable-5 worthy" prompt templates (decision-stress-test, deep research, archive-to-argument, operating review), each with a "why it's Fable-worthy" justification → a Connectors section reusing his standard list → two explicit "go read my other newsletter" pointers (Cowork, Vibecoding) → a downloadable password-gated custom skill (/fable-prompter) → a company-services pitch section ("Wisdom Walkout" knowledge-extraction consulting, with two anonymized client vignettes) → closing personal-humility statement and share CTA.
**Framing:** His most overtly cost/ROI-driven essay: leads with a financial warning rather than a capability pitch, unusual since most of his essays open with enthusiasm. The lawyer/intern analogy and worked dollar math are a distinct explanatory device (concrete financial stakes) not used elsewhere. The "Wisdom Walkout" business pitch is his most detailed self-promotional case-study section in the batch, including two disguised/anonymized real client stories as social proof: a harder sell than his usual soft "DM me" mentions.

### 19. 10,000 followers in 17 days. (Dec 24, 2025) [link](https://ruben.substack.com/p/from-49-to-10000-followers-in-17)
**Metrics:** 765 likes · 186 comments · 78 restacks
**Byline:** Ruben Hassid AND Anisha Jain (co-authored/guest post)
**Note:** Marked "∙ PAID": roughly half the essay (all of section 2, "The secrets to +1,000 followers per day") is fully paywalled with no preview text at all. Only section 1 is public. Captured exactly what's public; the paywalled section is marked, not fabricated.
**Opening hook (verbatim):**
> This is (by far) the most ambitious course I have ever written.
> How to grow any Linkedin account from 0 → to 10,000 followers.
> But why should you trust me?
**Promotional teaser (verbatim):**
> Linkedin is easy. So easy I grew this account to 10,000 followers in 17 days, with AI.
**Full text (verbatim, public portion only):**
> This is (by far) the most ambitious course I have ever written.
>
> How to grow any Linkedin account from 0 → to 10,000 followers.
>
> But why should you trust me?
>
> See, I have over 800,000 followers on Linkedin.
>
> About +1,000 followers, every single day.
>
> So people keep asking me how to grow on Linkedin.
>
> They think I use shortcuts, secrets, pods, ads, automations…
>
> I am even being (falsely) accused of "buying followers" (don't ever do this).
>
> But I did everything myself, with my two hands.
>
> People didn't believe me.
>
> So I did it again.
>
> Twice.
>
> Here is my team, Anisha and Axelle.
>
> In one year, they went from (nearly) zero to → 100,000+ followers.
>
> And I recorded myself growing their account, on a YouTube playlist.
>
> But I had to unlist it.
>
> People didn't care about it. They couldn't relate.
>
> It was "too long to watch".
>
> So I wanted to do it again with my new employee, Maria Zhanette.
>
> We started on November 18th (2025, obviously).
>
> 37 connections. 49 followers.
>
> 0 post. 0 post impressions.
>
> And yet, 17 days later, this is her account:
>
> Over 10,000 followers in less than 3 weeks.
>
> But this time, I did it differently.
>
> ✦ I failed to document my own journey to 700,000+ followers.
>
> ✦ I then failed at documenting Axelle & Anisha's growth to 100,000+.
>
> This time it's different.
>
> Anisha & I documented everything.
>
> → From day 1 to day 30.
>
> → From 0 to 1.4 million impressions.
>
> → From 49 to over 10,000 followers (it's actually 18,000 now).
>
> **1. How to instantly optimize your Linkedin.**
>
> Imagine I am sitting next to you, looking over your shoulder at your Linkedin.
>
> I need to give you the best advice for your Linkedin, in less than 5 minutes.
>
> This is what I would say:
>
> A. Your profile picture sucks.
>
> ✦ Smile way more than you think.
>
> ✦ Own a color. Instantly recognizable.
>
> ✦ Zoom until your entire face is the only thing visible.
>
> ✦ Don't make me confuse: declutter the background, hard color works better.
>
> You must make this quick test: go on Linkedin & check your profile picture from a distance (in the comment section). You must see two things: a smile, a color without a background.
>
> My own profile picture is made by AI (with Gemini & Nano-Banana Pro).
>
> Basically, you do 3 things:
>
> You upload a picture of yourself. HD is needed.
>
> You upload a picture of a profile picture you love.
>
> You add this simple prompt: "Generate a corporate headshot of my image in [how you are dressed] in the same style as the 2nd image I uploaded as an inspiration".
>
> If you don't have any inspiration, I made this prompt (to mix with your upload):
>
> A professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera, and the subject's body is also directly facing the camera. They are styled for a professional photo studio shoot, wearing a smart casual blazer. The background is a solid '# 141414' neutral studio. Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a subtle catchlight in the eyes, conveying a sense of clarity. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the fabric texture of the blazer, individual strands of hair, and natural, realistic skin texture. The atmosphere exudes confidence, professionalism, and approachability. Clean and bright cinematic color grading with subtle warmth and balanced tones, ensuring a polished and contemporary feel.
>
> B. I don't understand why I should follow you.
>
> To get 10,000 (or 1 million) people to follow, they must know why.
>
> Businesses call it a "mission statement". I call it being known as the [X] guy.
>
> You are one step in someone's journey to being better at [X].
>
> Once you understand this, you must write the most compelling one-liner for your headline. Remember, this is visible everywhere. Both on comments and posts.
>
> This is mine, for example:
>
> Ruben's mission: "Help people on how to use AI, without coding, to always be ahead of the technology, never to be replaced by it."
>
> Ruben's headline: "Master AI before it masters you."
>
> This is Maria's one:
>
> Maria's mission: "People are overwhelmed with guides and creators to follow. So I cut through the noise and curate the ones that matter."
>
> Maria's headline: "I curate who is worth your attention."
>
> I used a custom GPT to create hers. You can access it here, and simply click on "start". Once you click on "Start." just answer the questions.
>
> C. Stop writing for everyone.
>
> You know the number 1 rule of marketing:
>
> If you market to everyone, you market to no one.
>
> It's the same with content. You must lead a tribe of people who want to [X].
>
> You're not making content for millions. You're creating content for exactly one person. That's it. One ICP (= Ideal Customer Profile).
>
> Yes, I said ONE PERSON and ONE PERSON only.
>
> Here are my favorite examples:
>
> Alex Hormozi talks to Ryan, a 37-year-old male agency owner running a $4M/year digital marketing agency, exhausted from inconsistent client acquisition, desperate to build predictable, high-margin systems and scale to $30M+ without venture capital or burning out his team.
>
> Jordan Peterson talks to Ethan, a 24-year-old male college graduate feeling lost and aimless, struggling with depression and lack of direction, searching for profound meaning through personal responsibility, discipline, and voluntary confrontation with life's chaos.
>
> Andrew Huberman talks to David, a 42-year-old male tech executive and founder working 70-hour weeks, obsessed with maximizing cognitive performance, needing free, rigorously science-backed protocols to optimize sleep, focus, stress resilience, and daily energy.
>
> Bryan Johnson talks to Marcus, a 48-year-old male tech entrepreneur worth nine figures, terrified of aging and death, willing to spend unlimited time and money on extreme, data-tracked protocols to measure and reverse biological age markers.
>
> Ruben Hassid talks to Sophia, a 40-year-old female independent management consultant in Europe, billing $1,000/day for strategy and change workshops to mid-market companies. She's anxious that clients now demand AI integration training, but she lacks confidence and practical frameworks to teach non-technical teams how to adopt AI without disruption. So she wants proven playbooks to quickly reposition herself as the go-to AI-upskilling expert and secure bigger retainers.
>
> Again, I made a free custom GPT for you to discover your ICP.
>
> Once you have your mission and ICP, you still need 2x more GPTs.
>
> ✦ Red Searcher to find the most viral pain points of Reddit.
>
> The best content (1) targets your ICP's pain points and (2) solves them. And Reddit is a great source of both hyper-targeted communities + their problems.
>
> Here's an example of my GPT searching for Dubai + real estate.
>
> ✦ AI Editor, to avoid sounding like an AI.
>
> I wrote an entire newsletter on AI detection and how to avoid it ("Detection.", Dec 10, 2025).
>
> Once you write your caption (with AI), make sure it does not sound like an AI… by using an AI to get the first vibe check.
>
> TL:DR - Sounding like an AI goes beyond using an em-dash (—) or not.
>
> For eg, I absolutely hate this writing style of:
>
> "This is not about [bad thing]. This is about [obvious positive thing]."
>
> Because everyone is using AI, everyone sounds the same.
>
> Still use AI → but be different.
>
> Read my article to know how.
>
> [PAYWALLED: from here: "2. The secrets to +1,000 followers per day. I will make you uncomfortable. But I won't gatekeep anything:" The entire second half of the essay is gated behind the paid subscription with zero preview text.]
**Structure:** Credibility-first hook (own 800K+ follower count, pre-empts "buying followers" accusations) → a documented case-study narrative (37 connections → 10,000+ followers in 17 days, named employee "Maria Zhanette" as the subject) → a public "instantly optimize your LinkedIn" section broken into 3 lettered sub-parts: profile picture (with a full reusable AI headshot prompt), mission/headline statement (with a linked custom GPT tool), and audience-narrowing via a single named ICP persona (with 5 comparative examples: Hormozi, Peterson, Huberman, Bryan Johnson, himself) → a paywall cliff exactly at "the secrets to +1,000 followers per day," his most commercially aggressive paywall placement in the batch (a full un-teased second section, not just a bonus coda).
**Framing:** Structured as a "course" rather than a single guide: the only captured post explicitly co-bylined with a team member (Anisha Jain) and centered on a third employee's case study rather than his own account, which reframes his usual "I tested this myself" proof into "I did this to someone else, replicably." The ICP-persona device (naming a specific fictional reader with age/role/anxiety/goal) is a distinct audience-definition technique not used in any other captured essay.

### 20. Claude 101. (Jun 2, 2026) [link](https://ruben.substack.com/p/claude-roadmap)
**Metrics:** 720 likes · 83 comments · 65 restacks
**Opening hook (verbatim):**
> I have been begging you to switch to Claude since December 20, 2025.
> And I wrote over 21 guides on how to best use it.
**Promotional teaser (verbatim):**
> 7 free guides to master Claude:
**Full text (verbatim):**
> I have been begging you to switch to Claude since December 20, 2025.
>
> And I wrote over 21 guides on how to best use it.
>
> First with the newsletter "Opus". Then, in "Quit ChatGPT" back in February.
>
> But these two newsletters are completely outdated.
>
> And most of my other 21 Claude guides are outdated as well.
>
> So it's time for a quick recap of the only guides you need to read to master Claude, in which order, and a quick summary of each guide to skim this fast.
>
> Before I start, let's be honest: you're not gonna read all of my guides in one sitting, just now. So instead:
>
> Save this newsletter. Block 20 min this week & catch up with Claude.
>
> Send it to anyone who has never tried Claude (& still thinks it's a guy's name).
>
> PS: This newsletter grows from your shares. And I keep hitting 1,000+ shares! It's my weekly north star. Sharing is free & helps me stay focused on mastering Claude for you.
>
> **#1. Claude For Dummies.**
>
> If you have never tried Claude in your entire life, start here.
>
> It's also a good recap on what is AI, really.
>
> Time to completion: I'd say about 5 minutes.
>
> **#2. Claude basics.**
>
> A quick rundown on "What can you do with Claude."
>
> Now I have to say some stuff aren't the most accurate anymore. Like at the end, I talk about image model. I think ChatGPT-5.5-Extended is now the best at making images. And the best model from Claude is 4.7 (not 4.6).
>
> Time to completion: I'd say a solid 9-10 minutes.
>
> **#3. Claude Cowork.**
>
> This is the best Claude feature for people who don't code.
>
> And I don't code. And you probably don't neither.
>
> Time to completion: I'd say about 20 minutes. It's also my best newsletter.
>
> **#4. Claude Skills.**
>
> It's the best way to do a good task with Claude, but make it recurring.
>
> I also think it's the best way to collaborate with others (you can share skills).
>
> Time to completion: 15 minutes? But you constantly need to make new skills.
>
> **#5. Claude to sound like you.**
>
> It's my most viral piece on Substack, but updated.
>
> A long 100-question interview process to train Claude to sound like you.
>
> Time to completion: Some people said hours… I took 40 minutes-ish.
>
> **#6. Claude Certified.**
>
> This is not a guide about Claude.
>
> It's just to get a Claude certification, for free, and put it on Linkedin. I know a lot of you need it. That's the only way to do it, without getting scammed.
>
> Time to completion: It's long. About 1 hour per certificate, and there are 3.
>
> **#7. Avoid the AI-talk.**
>
> I hate people who sound like an AI.
>
> But no one told them how to prompt Claude to not sound like Claude.
>
> Technically, the Cowork newsletter give you the solution. But if you want to know the "why" and the exact "how", this newsletter helps.
>
> Time to completion: That's a quick one. I believe 7 minutes.
>
> **Read these 8 first. But you're missing one.**
>
> The list I just made is already super complete! You will be ahead of most people.
>
> I even created a website - that I vibecoded - called claude101.com.
>
> claude101.com is a free website with my best Claude guides.
>
> But you're missing one guide. The one about Claude Code.
>
> You see, I just said that I vibecoded claude101.com. But what does it mean?
>
> Vibecoding is when you're using AI to code a website (an app, a service, anything) by asking AI (= Claude) to deal with everything. Hosting, bugs, functionalities.
>
> You "vibe" your way until Claude creates the entire thing.
>
> Since you & I don't code, I wrote a newsletter about it. But it's outdated.
>
> So instead of reading this one, I will make a quick guide (and later a full-fledged newsletter). Let's use my newsletter as an example to show you how to vibecode.
>
> I just told you to read 7 newsletters to be ahead of Claude.
>
> Wouldn't it be nice if you could "talk to my newsletters" to ask anything?
>
> Let's create this website together:
>
> Step 1. Go to the Claude desktop app, on the Claude Code tab.
>
> On the top left, click on the Code tab.
>
> Step 2. You need to go to "Mode" at the bottom left and select bypass permissions. It will let the AI do whatever it takes to complete the website.
>
> On the bottom left, click on "Accept edits" and select "Bypass permissions".
>
> Step 3. You need to accept it.
>
> Step 4. I am making sure my Claude Code is connected to my GitHub account (it's where the code lives) and my Vercel (to deploy the code to the web). I will never open any of these tools. But I know Claude Code works with them.
>
> This step takes a bit of time because you need free GitHub and Vercel accounts. It's free, but it takes time.
>
> Step 5. I upload all of my newsletters (as text files).
>
> I uploaded all of my 7 newsletters, which I just told you about.
>
> Step 6. I give Claude a reference image of the style of website I want. And I like my claude101.com website. So I will just give a screenshot to Claude Code.
>
> Step 7. I wrote a prompt and made sure I used the maximum-power Claude Code.
>
> I want you to code a new website. It's a simple chatbot, to talk to my best Claude newsletters.
>
> First, you need to have a database with all of the newsletters I just uploaded (7 md. files).
>
> For the design, get inspired by the screenshot I shared of my previous website, "claude101.com".
>
> Call the new website "Chat with Ruben, about Claude".
>
> You are in bypass permissions mode, and you are already connected to my GitHub account and my Vercel.
>
> /goal do everything you need without my consent until your goal is accomplished: a chatbot with the context of my 7 newsletters so people can ask "me" questions about how to best use Claude.
>
> The website is a chatbot, and only a chatbot.
>
> I don't know how to code. Claude Code will do everything for me.
>
> Step 8. Test it. Your new website is ready.
>
> Claude Code even made a URL with Vercel to deploy it: https://chat-with-ruben.vercel.app. So you can literally test it yourself, too!
>
> It took Claude Code about 14 minutes to generate the website.
>
> I tested it, and it works!
>
> Vibecoding feels a bit like magic, and I wanted you to have an updated guide on using Claude Code to vibecode. Do you guys want a bigger version of it?
>
> **I am not paid by Claude.**
>
> I don't care about Claude, or any other AI model.
>
> I don't pick sides. I'm not paid by Anthropic or Claude.
>
> I'm sharing, twice a week, how my work is changing (very fast) with AI.
>
> As I'm trying to keep up, I want you to keep up.
>
> Remember how I have been begging you to switch to Claude in December, so you stay ahead. Well, I will continue to do so for any future upgrades.
>
> Because I want to be the greatest filter to the AI noise. And 600,000+ people trust me to be their filter. Some came because of my LinkedIn. But most readers subscribed because someone they trusted sent them one of my articles.
>
> If this article helped you, be that person for someone else (and share it).
>
> Sharing does not cost you anything. And it supports my work & your team!
**Structure:** Curriculum/index hook ("I wrote over 21 guides... here's the only 7 you need") → a numbered #1-#7 annotated table of contents linking back to his own prior essays, each with a one-line description and an explicit "time to completion" estimate → a bonus "you're missing one" section that builds a live worked example (vibecoding a chatbot trained on his own 7 newsletters, 8 numbered steps, full prompt reproduced, live deployed URL given) → closing disclaimer/share CTA.
**Framing:** A pure "best-of" index/roundup post rather than new instructional content: functions as a curated entry point into his back-catalog, explicitly marking two of his own earlier essays (Opus, Quit ChatGPT) as outdated and telling readers not to read them, extending the self-correcting-curriculum pattern seen in Post #16. The live self-referential demo (building a chatbot that answers questions using his own 7 linked newsletters as its database) is a distinctive proof-by-recursion move: the guide about his guides becomes a working product built live in the same essay.

### 21. AI will fail. (Jun 23, 2026) [link](https://ruben.substack.com/p/why-ai-will-fail)
**Metrics:** 722 likes · 173 comments · 79 restacks
**Note:** A structural outlier: not a how-to guide. A pure persuasive essay: a long chronological list of historically wrong predictions (370 BCE to 2024), then a short argumentative payoff. No screenshots, no numbered setup steps, no product walkthrough.
**Opening hook (verbatim):**
> 2008 "I've been frankly confused by this fascination that everybody has with Netflix." — Jim Keyes, CEO of Blockbuster, on streaming.
> Netflix passed 300 million subscribers by 2024. Blockbuster has one store left.
**Promotional teaser (verbatim):**
> And everyone agrees.
**Full text (verbatim):**
> 2008 "I've been frankly confused by this fascination that everybody has with Netflix." — Jim Keyes, CEO of Blockbuster, on streaming.
>
> Netflix passed 300 million subscribers by 2024. Blockbuster has one store left.
>
> 2008 "It's complete gibberish. It's insane. When is this idiocy going to stop?" — Larry Ellison, CEO of Oracle, on cloud computing.
>
> The cloud became a ~$700-billion-a-year market. Oracle now sells it, about $34 billion a year of cloud computing.
>
> 2007 "There's no chance that the iPhone is going to get any significant market share. No chance." — Steve Ballmer, CEO of Microsoft, on the iPhone.
>
> Apple has sold over 2.3 billion iPhones. The most profitable product in history.
>
> 2001 "Linux is a cancer." — Steve Ballmer, CEO of Microsoft, on open-source software.
>
> By 2015 Linux ran the entire internet, every supercomputer, and every Android phone. And Microsoft itself joined the Linux Foundation.
>
> 1998 — "By 2005 or so, it will become clear that the Internet's impact on the economy has been no greater than the fax machine's." — Paul Krugman, Nobel Prize economist, on the internet.
>
> Today ~5.5 billion people are online, on the internet.
>
> 1995 — "The Internet will soon go spectacularly supernova and in 1996 catastrophically collapse." — Robert Metcalfe, inventor of Ethernet, on the internet.
>
> Not really.
>
> 1995 — "How come my local mall does more business in an afternoon than the entire Internet handles in a month?" — Clifford Stoll, Newsweek, on e-commerce.
>
> U.S. online retail blew past $1 trillion a year. Not every mall survived, for better or worse.
>
> 1982 — "The VCR is to the American film producer as the Boston strangler is to the woman home alone." — Jack Valenti, head of the MPAA, on home video.
>
> Within a few years, home video earned Hollywood more than the box office did.
>
> 1981 — "640K ought to be enough for anybody." — attributed to Bill Gates, on computer memory.
>
> The phone in your pocket carries tens of thousands of times more.
>
> 1977 — "There is no reason for any individual to have a computer in his home." — Ken Olsen, founder of Digital Equipment Corporation, on the personal computer.
>
> There are now roughly 2 billion personal computers in use. DEC no longer exists.
>
> 1962 — "Guitar groups are on the way out, Mr. Epstein." — Dick Rowe, Decca Records, on the Beatles.
>
> They became the best-selling band in history, with over 600 million records sold.
>
> 1959 — The Xerox copier "has no future in the office-copying market." — Arthur D. Little, report for IBM, on photocopying.
>
> The Xerox 914 became one of the best-selling industrial products ever made. It's also a verb, like "to Google something".
>
> 1955 — "It will be gone by June." — Variety, on rock 'n' roll.
>
> It ruled popular music for the next half-century.
>
> 1948 — "Television won't last. It's a flash in the pan." — Mary Somerville, BBC broadcasting pioneer, on television.
>
> By 1960, nine in ten American homes had one.
>
> 1946 — "People will soon get tired of staring at a plywood box every night." — Darryl Zanuck, head of 20th Century Fox, on television.
>
> It became the dominant medium of the entire 20th century.
>
> 1943 — "I think there is a world market for maybe five computers." — Thomas Watson, chairman of IBM, on computers.
>
> There are now billions, plus a few trillion more chips running everything else.
>
> 1941 — Penicillin "does not appear to have been considered as possibly useful from any other point of view." — The British Medical Journal, on antibiotics.
>
> Penicillin has since saved an estimated 200 million lives.
>
> 1933 — "Anyone who expects a source of power from the transformation of these atoms is talking moonshine." — Ernest Rutherford, Nobel laureate, on nuclear power.
>
> It now supplies ~10% of the world's electricity.
>
> 1925 — "Who the hell wants to hear actors talk?" — Harry Warner, Warner Bros., on talking pictures.
>
> Silent film was effectively extinct by 1930.
>
> 1921 — "The wireless music box has no imaginable commercial value. Who would pay for a message sent to nobody in particular?" — associates of David Sarnoff, on radio.
>
> By 1935, six in ten American homes had a radio.
>
> 1920 — Robert Goddard "only seems to lack the knowledge ladled out daily in high schools." — The New York Times, on rockets.
>
> In 1969, as Apollo 11 flew to the Moon, the Times printed a retraction.
>
> 1916 — "The idea that cavalry will be replaced by these iron coaches is absurd. It is little short of treasonous." — an aide to Field Marshal Haig, on tanks.
>
> Armored divisions decided the next world war.
>
> 1911 — "Airplanes are interesting toys but of no military value." — Marshal Ferdinand Foch, on military aircraft.
>
> Air power decided WWII too. And Foch commanded the side that nearly lost without it. It's expensive to not be right.
>
> 1903 — A flying machine might take "from one million to ten million years" to develop. — The New York Times, on the airplane.
>
> The Wright brothers flew 69 days later.
>
> 1903 — "The horse is here to stay, but the automobile is only a novelty — a fad." — President of the Michigan Savings Bank, on the automobile.
>
> By 1929, most American families owned a car. ~1.5 billion now roll worldwide.
>
> 1901 — "My imagination refuses to see any sort of submarine doing anything but suffocating its crew and floundering at sea." — H. G. Wells, on the submarine.
>
> Submarines became decisive weapons in both world wars within 15 years.
>
> 1899 — "Everything that can be invented has been invented." — attributed to the U.S. Patent Office, on invention itself.
>
> The 20th century out-invented all of prior human history combined.
>
> 1898 — "Vaccination a delusion; its penal enforcement a crime." — Alfred Russel Wallace, on vaccines.
>
> Smallpox — humanity's deadliest disease — was declared eradicated in 1980.
>
> 1897 — "Radio has no future." — Lord Kelvin, President of the Royal Society, on radio.
>
> Within 40 years it was in nearly every home on Earth.
>
> 1896 — "X-rays will prove to be a hoax." — Lord Kelvin, on X-rays.
>
> They were saving lives in hospitals within months.
>
> 1895 — "Heavier-than-air flying machines are impossible." — Lord Kelvin, on flight.
>
> Roughly 4 billion people now fly every year.
>
> 1886 — "Just as certain as death, Westinghouse will kill a customer within six months." — Thomas Edison, on alternating current.
>
> AC became the electrical standard of the entire planet by the 1890s.
>
> 1880s — "The phonograph is not of any commercial value." — Thomas Edison, on recorded music.
>
> Recorded music is now a multi-billion-dollar industry. Edison later called it his favorite invention.
>
> 1880 — Edison's electric light is "a conspicuous failure." — Henry Morton, President of the Stevens Institute of Technology, on the light bulb.
>
> It lit nearly every home in the developed world within 50 years.
>
> 1878 — "The Americans have need of the telephone, but we do not. We have plenty of messenger boys." — Sir William Preece, British Post Office, on the telephone.
>
> There are now more phone subscriptions than there are people on Earth.
>
> 1878 — "When the Paris Exhibition closes, electric light will close with it and no more will be heard of it." — Sir Erasmus Wilson, Oxford, on electric light.
>
> Near-universal in American cities by 1940.
>
> 1876 — "This 'telephone' has too many shortcomings to be seriously considered as a means of communication." — Western Union internal memo, on Bell.
>
> Bell's company became one of the largest corporations in history.
>
> 1873 — "The abdomen, the chest, and the brain will forever be shut from the intrusion of the wise and humane surgeon." — Sir John Eric Erichsen, surgeon to Queen Victoria, on surgery.
>
> Surgeons now operate routinely on all three. Like roughly 500,000 per day.
>
> 1872 — "Louis Pasteur's theory of germs is ridiculous fiction." — Pierre Pachet, Professor of Physiology, on germ theory.
>
> Germ theory became the foundation of all modern medicine within 20 years.
>
> 1864 — "No one will pay good money to get from Berlin to Potsdam in one hour when he can ride his horse there in one day for free." — King William I of Prussia, on railways.
>
> Rail became the backbone of the industrial economy within a generation.
>
> 1854 — "Maine and Texas, it may be, have nothing important to communicate." — Henry David Thoreau, on the telegraph.
>
> A cable joined America to Europe just 12 years later.
>
> 1839 — "To try to capture fleeting mirror images is not just an impossible undertaking… the very wish to do such a thing is blasphemous." — Leipziger Stadtanzeiger, on photography.
>
> Humanity now takes nearly 2 trillion photographs a year.
>
> 1835 — "Men might as well project a voyage to the Moon as attempt to employ steam navigation against the stormy North Atlantic." — Dr. Dionysius Lardner, on steamships.
>
> A steamship crossed the Atlantic in 1838. Three years later.
>
> 1830 — "Rail travel at high speed is not possible because passengers, unable to breathe, would die of asphyxia." — Dr. Dionysius Lardner, on railways.
>
> Within 20 years the rails spanned entire nations.
>
> 370 BCE — "[…] it will create forgetfulness in the learners' souls, because they will not use their memories; they will trust to the external written characters and not remember of themselves" — Socrates, on writing.
>
> It sounds ridiculous. Especially since Socrates was most likely one of the smartest men alive at his time. How come he could have imagined writing was so bad?
>
> Writing became the foundation of every civilization that followed.
>
> We only know he said it… because someone wrote it down.
>
> **Why AI Will Fail.**
>
> So here we are again.
>
> The internet, the smartphone, social media — all led to today's AI.
>
> But AI isn't so good. AI Will Fail:
>
> 2023 — "So much money and attention concentrated on so little a thing… something so trivial when contrasted with the human mind." — Noam Chomsky, The New York Times, on ChatGPT.
>
> 2023 — "ChatGPT Is a Blurry JPEG of the Web." — Ted Chiang, The New Yorker, on ChatGPT.
>
> 2024 — "What trillion-dollar problem will AI solve? AI technology is exceptionally expensive, and to justify those costs, it must solve complex problems, which it isn't designed to do." — Jim Covello, Head of Global Equity Research, Goldman Sachs.
>
> 2024 — The productivity gains from AI are "likely to be minimal." — Daron Acemoglu, MIT economist.
>
> 2024 — "Generative AI: too much spend, too little benefit?" — Goldman Sachs, report title.
>
> So yes.
>
> AI hallucinates.
>
> It forgets sources.
>
> It invents court cases.
>
> It gives people six fingers.
>
> It makes videos where physics is wrong.
>
> It writes like a genius one minute and like a kid the next.
>
> And yet.
>
> People are still using it to write code, explain contracts, design images, edit videos, summarize meetings, answer customers, tutor kids, translate manuals, draft ads, build apps, and replace the first blank page of almost every creative process.
>
> AI is still terrible.
>
> So was the first call.
>
> So was the buffering wheel.
>
> So was the frozen computer.
>
> So was the ugly first website.
>
> So was the blurry first camera phone.
>
> The early version of the future is usually embarrassing.
>
> Then it becomes the present.
>
> History doesn't repeat itself. But the people betting against it do.
>
> Do you?
>
> **PS: You don't want your company to be left behind.**
>
> Reading about AI is useful.
>
> But it won't change how your company works.
>
> If you have 50+ people on your team, adopting AI is not a "send them a newsletter" problem. It is a systems problem.
>
> Your people have different roles, clients, tools, workflows, permissions, data, risks, and habits. My newsletter, sent to 750,000 people, can't do that.
>
> That is what I help companies fix.
>
> I run tailored AI workshops for enterprise teams. We map where AI can actually save time, where it should not be used, and how your people can adopt it without creating chaos.
>
> If your company has 50+ people, message me.
>
> I offer a free discovery call to my subscribers.
>
> Humanly yours, Ruben Hassid.
>
> **PPS: I'm hiring a Growth lead.**
>
> 'How to AI' is one of the fastest-growing newsletters in the world, currently at 750k+ subscribers and growing by thousands of new readers per day.
>
> I'm looking for an exceptional Growth person to help scale this even further.
>
> This is not a slow corporate role. We move fast, work hard, test aggressively, and care deeply about quality. You'll work closely with me on the growth engine behind the newsletter.
>
> If you're obsessed with growth, unusually sharp with paid acquisition, and excited to help build a media company at serious scale, with the intent to help millions of people figure out AI→ I want to hear from you.
**Structure:** No how-to scaffolding at all: a single unbroken chronological list of ~45 real, named, sourced wrong predictions running from 370 BCE (Socrates on writing) to 2008 (Blockbuster's CEO on Netflix), each entry a quote + one-line factual rebuttal, building rhythm through sheer repetition → a hard pivot header ("Why AI Will Fail") that applies the exact same pattern to 5 real 2023-2024 quotes skeptical of AI (Chomsky, Ted Chiang, Goldman Sachs, MIT economist) → an honest concession list of AI's real current flaws (hallucinates, six fingers, wrong physics) → a rhythmic "so was the first call / so was the buffering wheel" anaphora closing → a direct rhetorical question ("Do you?") as the essay's final line before the CTA → PS consulting pitch + PPS a hiring call.
**Framing:** The only pure argumentative/rhetorical essay in the batch: no product walkthrough, no prompts, no screenshots, no "first 30 minutes" checklist. Built entirely from external sourced quotes rather than his own testing/experience, a complete reversal of his usual "I tried this myself" evidentiary style. The structure is a slow-build historical pattern (dozens of examples) that primes the reader before the actual thesis appears, then closes on rhythm/repetition (anaphora) rather than a call to action: closest to persuasive-essay/oratory craft of anything captured.

### 22. Can you detect AI? (Jul 22, 2026) [link](https://ruben.substack.com/p/how-to-bypass-ai-detectors)
**Metrics:** 710 likes · 11 comments · 58 restacks
**Note:** Marked "∙ PAID" and lock-icon-flagged in the archive. Sections I and II are fully public; section III ("How I write with AI, live") is paywalled almost immediately, gating a Circle-community pitch and his live writing process.
**Opening hook (verbatim):**
> Substack is at war against AI.
> The CEO of Substack just announced their new AI detector:
**Promotional teaser (verbatim):**
> Yes. Here's how:
**Full text (verbatim, public portion):**
> Substack is at war against AI.
>
> The CEO of Substack just announced their new AI detector.
>
> Pangram is the leading AI detector. They want to fight Claudefishing - fun word.
>
> You can also detect AI slop instantly.
>
> What's AI slop?
>
> It's when you receive this from your colleague:
>
> This budget isn't a number. It's a statement of intent. Because at the end of the day, a budget doesn't tell you what you can afford — it tells you […].
>
> You don't need a degree to detect it.
>
> If you and I can detect AI so easily, clearly Substack bot can detect it too, right?
>
> Right??!
>
> Well, it's more complex than that.
>
> But at the end of this newsletter (it's 8 minutes, don't be dramatic), you will master:
>
> How Substack AI detector works.
>
> How to forever not sound like an AI.
>
> How I write my newsletter with AI, live (and send it to 800,000+ readers).
>
> **I. How Substack AI detector works.**
>
> Substack uses Pangram to detect AI.
>
> This is how Pangram looks. You upload a text, and you "Check for AI".
>
> I have zero affiliation with them, but I would honestly love to: I tried to game their tool for 3 hours, spending $34 of Claude Code credits to try to bypass it.
>
> And I couldn't. Pangram is really good at detecting AI.
>
> Try it yourself. It's free.
>
> But I still found a way to bypass it.
>
> Here's how I tried to game it (and succeeded at the end):
>
> I made a skill to specifically bypass Pangram.
>
> Sometimes it worked, sometimes it didn't.
>
> You can download it here if you want to try it yourself (the password is RUBEN-HOWTOAI).
>
> Then you go here to Claude to upload the zip. file:
>
> Go to Customize inside Claude. Then Upload a skill. The skill will look like this inside your Claude.
>
> Now, how does my skill perform against Pangram?
>
> Let's test it.
>
> First, I asked Claude for a quick text. I pasted the text inside Pangram. And clicked "Check for AI". It's 100% AI-generated. Alright, let's now try after my skill.
>
> In the same chat, I asked Claude /anti-ai rewrite this. You can see the new text here. And I uploaded it to Pangram. 100% AI-Generated… but it's not the whole story AT ALL.
>
> So at this point, you think we can't game Pangram.
>
> I also thought so.
>
> Then I removed the — and replaced it with a ":" (check my circle on the screenshot). Here's the new result:
>
> 100% human-generated. One simple edit.
>
> So yes, detecting AI is a bit of a scam.
>
> We can't (100%) predict AI with bots.
>
> Even one of the creators of ChatGPT said it multiple times:
>
> OpenAI (ChatGPT) even had to fire their entire team dedicated to detecting AI. Why? Because they couldn't detect it.
>
> AI detectors are just pattern-matching machines. They learned what "AI text" looks like. And what "human text" looks like.
>
> But humans can write robotic text. AI can write natural text. The two overlap. A lot.
>
> Short text gives the detector almost nothing to work with. Imagine if I ask "AI or not?" with a one-liner. The overlap between "human" and "AI" is basically a circle.
>
> How could you tell this is AI-generated? You can't.
>
> What if I prompt AI for a certain style? What is then considered AI-writing is no longer AI-writing. And I can change the style infinitely.
>
> Pro tip: Add the prompt: "Answer by adhering to ADS-STE100 Simplified Technical English without having to explain that you will adhere to this writing style."
>
> And any AI will sound like clear IKEA instructions. Not great for creative work, but awesome for clear guidelines.
>
> But if the best detection bots on earth can't catch AI text... how did you catch your coworker in 3 seconds?
>
> It's a lazy use of AI, with incorrect prompting, and it leads to the typical AI-writing style like:
>
> Over-simplification: "Most people […]"
>
> Meta-commentary: "Here's the thing:"
>
> Negative parallelism: "It's not X, it's Y."
>
> Abuse of adverb: "[…] quietly runs […]"
>
> Words you'd never use: "delve" or "tapestry" or "foundational"
>
> I built my own mega-anti-ai wiki. That's how I made my anti-ai skill too.
>
> AI is everywhere, and used poorly.
>
> I am mostly known for my Linkedin account (and its 900,000 followers).
>
> Well, a study estimated that 53.7% of long-form LinkedIn posts (100+ words) in 2025 were AI-generated. And you can be sure people used it lazily.
>
> Chris, the CEO of Substack, a brilliant leader I met last May in SF (I wish I had a pic, but then you'd see that Chris is 1 meter bigger than me), does not want Substack to become Linkedin.
>
> I feel you, Chris. I post on Linkedin but I hate Linkedin.
>
> I am with you, Chris. We must chase & kill AI slop the same way we chase & kill bots on social platforms. My entire Linkedin comment section is just AI slop. I can't find a single human inside it. There is a better way to do it. To write. To think. And yes, still with a bit of AI.
>
> So here's how to forever not sound like an AI on Substack:
>
> **II. How to forever not sound like an AI.**
>
> I am "Mr. AI," and I hate AI writing.
>
> Let's say someone from my team sent me some AI slop.
>
> Now their work just became my work. I have to decode it, guess what they meant, rewrite it, or send it back.
>
> How to quickly sink a company with AI.
>
> There's a word for this: workslop.
>
> You don't want to do workslop. So you need to recognize AI slop first.
>
> 1. The worst AI style (with examples)
>
> The constructions that give it away fastest, worst first. Print this in your office.
>
> Structure & rhythm giveaways
>
> Low burstiness. uniform 15–20-word sentences, rectangular paragraphs. Force a spread: a ≤6-word sentence and a 25+-word one; uneven paragraphs; one single-line paragraph, max.
>
> Fractal summaries. previews and recaps at every level ("In this section we'll…" / "…as we've seen"). Delete all.
>
> Signposted conclusion. "In conclusion / Overall," + restatement + uplift ("Despite the challenges, the future is bright"). Delete; end on the last concrete point.
>
> Pep-talk ending. "As we move forward, embracing X will be key." Delete on sight.
>
> Prompt echo. "This essay will explore…" Delete.
>
> Listicle in a trenchcoat. "The first reason is… The second reason is…" Merge into flowing argument.
>
> Uniform staccato. "X is A. X is B. X is C." Combine into one sentence with a list, or vary the frames.
>
> Punctuation & formatting
>
> Em dashes — the most famous tell. AI: 20+ per piece; humans: 2–3. Target ≤1.
>
> Bold-first bullets. "Security: …". Almost no human does this unprompted. Yes I just did it here. Yes I did ask Claude to summarize my findings.
>
> Emoji bullets. ✅ 🧠 🔹 decorative →. Strip them.
>
> Title Case Headings / colon-split titles. "The Power of X: Why Y Works". Use sentence case.
>
> Oxford comma 100% of the time. dropping it occasionally in casual registers reads human.
>
> Markdown residue. **, ##, [text](url) in contexts that don't render markdown.
>
> 4. Content & voice
>
> No concrete imagery, if the first three sentences evoke nothing visible, inject a thing, place, number, or name.
>
> Proper-noun avoidance, "a client", "a tool", "a city" → name it. (AI invented-character names cluster on Emily/Sarah.)
>
> Uniform positivity, everything upbeat and certain (measured: certainty +111–152%, positive emotion +69–133% vs human). Let something be annoying or unresolved.
>
> Both-sidesing, every claim auto-balanced by its counterpoint. Commit.
>
> Suspiciously tidy anecdotes, stories that serve the argument with perfect efficiency. Real stories have tangents.
>
> Register scrubbing, no contractions, no slang. Restore the ones the voice would use.
>
> 2. The worst AI words (the entire list)
>
> Tier 1 — never use this
>
> Verbs: delve · leverage · underscore · harness · foster · navigate (figurative) · utilize · facilitate · streamline · bolster · illuminate · showcase · embark · elevate · empower · unleash · unlock (figurative) · uncover · optimize · garner · resonate · revolutionize · shed light on · synthesize · elucidate · transcend · reimagine · intertwine · entwine · grapple with · espouse · exemplify · underpin
>
> Nouns: tapestry · landscape (figurative) · realm · ecosystem (figurative) · paradigm · synergy · testament · beacon · journey (figurative) · interplay · intricacies · symphony (figurative) · kaleidoscope · tempest · whimsy · quest (figurative) · roadmap (figurative) · endeavor · myriad · plethora · advancements · trajectory (figurative)
>
> Adjectives/adverbs: pivotal · crucial · seamless(ly) · robust · vibrant · intricate · meticulous(ly) · nuanced · cutting-edge · transformative · game-changing · groundbreaking · unparalleled · invaluable · multifaceted · commendable · indelible · poignant · profound(ly) · relentless(ly) · tireless(ly) · unwavering · unyielding · timeless · ever-evolving · fast-paced
>
> Stock phrases: in today's fast-paced world/landscape · it's important to note · it is worth noting · plays a pivotal/crucial role in · stands as a testament to · rich tapestry/history/heritage · navigate the complexities of · in conclusion · in summary · overall, (as an opener) · ultimately, (as a conclusion opener) · at its core · that being said · a key takeaway · paving the way for · valuable insights (into) · deeper understanding of · shed light on · when it comes to · not only… but also · here's the kicker/the thing/the best part · I hope this email finds you well · look no further · dive/deep-dive into · let's explore/unpack/break down · furthermore · moreover · additionally (sentence-initial)
>
> Narrative clichés: couldn't help but feel/wonder · heart pounding · a sense of X washed over · found solace in · the human spirit · from that day (on/forward) · little did I/we know · a stark reminder · a cautionary tale · knew that (he/she/they) had to · felt a (newfound) sense of purpose · what lay ahead · turn of events · thick with (tension) · stumbled upon · nestled (in/between) · bustling · enigmatic · captivating · glimpse into
>
> Tier 2 — allowed alone
>
> comprehensive · significant(ly) · essential · critical · key (adjective) · dynamic · innovative · powerful · notable/notably · vital · vast · rich (figurative) · deep/deeper (figurative) · explore · enhance · ensure · foster · highlight · reveal · engage · embrace (figurative) · insights · perspective · framework · approach · strategy · challenges · opportunities · potential · impact(ful) · quietly/quiet (figurative "quiet confidence") · genuinely · truly · remarkably · arguably · generally speaking · typically · thought-provoking · well-being · resilience · perseverance · dedication · commitment to · high-quality · step-by-step · sustainable/sustainability
>
> 3. The other things that make you say "that's AI"
>
> Never do this:
>
> Leaked scaffolding, "Certainly! Here's…", "I hope this helps", "let me know if…"
>
> Self-reference, "as an AI language model", knowledge-cutoff notes
>
> Placeholder text, "[insert example]"
>
> utm_source=chatgpt.com in URLs
>
> Hallucinated-looking citations
>
> "Best regards" sign-offs in non-email contexts
>
> Be careful with this:
>
> Performative, text that narrates its own helpfulness ("I hope this clarifies things!").
>
> One-point dilution, the same idea restated in new clothes across a paragraph.
>
> Curly quotes, pasted into plain-text contexts.
>
> Semicolons, used where a period would do (model-dependent, both directions).
>
> Emily / Sarah and other clustered default names for invented people.
>
> What NOT to do when fixing it:
>
> Don't swap every word with weird ones, we can tell.
>
> Don't scatter random typos, errors must read as casualness, not carelessness, and only where the register tolerates them.
>
> Don't scrub personality along with the tells, a flat, tell-free text is still AI-shaped.
>
> Don't invent real-sounding facts, stats, or quotes.
>
> Don't shrink every long sentence, humans write long sentences; they just don't write only 18-word ones.
>
> Human markers to add (the good list):
>
> Contractions
>
> a number with texture ($43, 11 months, 4:30am, v2)
>
> a named thing (brand, tool, street, person)
>
> a parenthetical aside with attitude
>
> "I think" / "honestly" / "to be fair" used once
>
> a sentence starting with And, But, or Because
>
> one single-sentence paragraph
>
> a mild complaint or unresolved edge
>
> an irrelevant-but-true detail in an anecdote
>
> a dropped Oxford comma (casual registers)
>
> a question the reader was genuinely asking
>
> uneven list items · a plain "is" where AI would write "serves as".
>
> **III. How I write with AI, live.**
>
> I send a weekly newsletter to 849,273 readers.
>
> This section is to copy my exact writing process.
>
> I started a Circle community to host monthly lives on how I use AI.
>
> The goal?
>
> Writing a newsletter from start to finish with you, so you can see how I use AI and you can ask me questions during the live.
>
> All of the prompts, skills, and processes will stay forever on the Circle.
>
> So first, confirm you want to be part of the Circle:
>
> [PAYWALLED: from here, the Circle-community signup and the rest of his live writing-process walkthrough are gated behind the paid subscription.]
**Structure:** Industry-news hook (Substack's own AI-detector launch) → an explicit 3-point table of contents → Section I: a documented experiment (3 hours, $34 of credits) testing his own anti-detection skill against Pangram, showing a failed attempt then a one-character fix (em dash → colon) that flips the verdict → Section II: a comprehensive two-tier taxonomy: structural/rhythm tells, punctuation tells, content/voice tells, then a full tiered banned-word list (Tier 1 never-use vs Tier 2 allowed-alone), a "what NOT to do when fixing it" caution list, and a "human markers to add" positive list → Section III cut short by paywall (a live-writing-process Circle-community pitch).
**Framing:** His most technically granular essay in the batch: reads like a reference document/wiki rather than a narrative guide, structured for scanning and reuse (explicitly "print this in your office") rather than one-time reading. Directly documents an attempt to defeat a detection tool built by the platform hosting his own newsletter, an unusually adversarial stance toward his own distribution platform. The banned/allowed word-tier system and "human markers to add" list are the single most reusable reference artifact in the batch for anti-AI-tell voice work.

### 23. Claude is now YOUR computer. (Mar 24, 2026) [link](https://ruben.substack.com/p/claude-computer)
**Metrics:** 751 likes · 146 comments · 84 restacks
**Opening hook (verbatim):**
> You just switched from ChatGPT to Claude.
>
> Me too. So I wrote free guides on the basics, how good Claude Cowork is, how to start with Claude Excel, Claude for Teams, Claude for Slides, and Claude Code.
**Promotional teaser (verbatim):**
> How Claude is now capable of clicking on your computer, for you:
**Full text (verbatim):**
> You just switched from ChatGPT to Claude.
>
> Me too. So I wrote free guides on the basics, how good Claude Cowork is, how to start with Claude Excel, Claude for Teams, Claude for Slides, and Claude Code.
>
> This all happened in 3 months. Completely changed how I work.
>
> And I thought it was it.
>
> But then Claude tweets this (and 57 million people went nuts on X):
>
> 57 million views in 24 hours. I've never seen this.
>
> Claude can now use your computer.
>
> Read again. Use your computer. For you. While you're away. And you can text Claude, "Hey, how is it going? make sure to not forget [this]." Like it's... your employee?
>
> I tried myself. And I couldn't believe it. So I wrote this guide with 2 goals: (1) the simplest steps to follow, (2) actual screenshots of my phone & computer doing it.
>
> Two things before we start:
>
> 1. Save this guide and spend 10 minutes this weekend to try Claude Computer.
>
> 2. Send it to anyone who still hasn't tried Claude.
>
> 1. How to access 'Claude Computer'.
>
> The only way to access it:
>
> Mac only (soon Windows, stay tuned).
>
> Download the desktop app claude.ai/download.
>
> Use a personal plan, not a business one (I guess it's too much compliance).
>
> Upgrade your account to either Pro ($20) or Max ($100). It's worth it.
>
> Go to your Settings (bottom left), and turn on these features:
>
> UPDATE: They now made Claude Computer available for teams.
>
> Click on your name (bottom left) and then on Settings.
> Go to Desktop app > General > Turn on Browser use > Turn on Computer use.
> When toggling on Computer use, you must accept by clicking Turn on.
> You can deny apps. I denied my 1Password (it has my passwords).
> I also clicked on Accessibility and Screen recording to grant Claude access.
>
> Once done, connect your Computer to your phone with Claude Dispatch:
>
> Go to your left bar menu on the Claude desktop app.
>
> Click on Dispatch. And follow these steps:
>
> Click on Dispatch. It's only available on the desktop app for paid personal accounts.
> Click on Get started.
> Scan this QR code with your phone. Make sure you have the Claude app on your phone, too. And connected to the same account. It's free.
> I turned on every setting to test it all. Then click Finish setup.
>
> This is what my computer sees.
> This is what my phone sees. The same thing.
>
> You are all set. Time to test it now.
>
> 2. My favorite use cases of 'Claude Computer'.
>
> A reminder on what's needed to use Claude Computer, with your phone:
>
> You must have the Claude desktop app + a paid personal account.
>
> Your computer must always be turned on. That's why people buy Mac minis.
>
> Go to your phone. Open the Claude app. Go to Dispatch. Ask for something:
>
> My first prompt: go to my dashboard. Give me some data.
>
> Now let's do some harder tasks:
>
> Find a freelancer for me.
>
> Prompt:
>
> Go to my Fiverr account on Chrome. Post a job offer for [task]. Then, send a message to the best 10 [job needed] for [task]. Check if I have any unanswered DM, and follow up until one accepts the [task] for [budget] maximum.
>
> I did it on my phone. Then Claude Dispatch asked me questions.
> It's so satisfying to be outside and read a text from your Claude, working.
> Sometimes you do need to be direct about wanting everything done without permission.
> And it worked. I keep receiving inbounds from Fiverr now.
> 4 offers in a few hours. I am outside on my phone.
>
> Find viral ads from today.
>
> Prompt:
>
> Go to the Meta Ads Library: search the latest viral ads about [topic] in [country] only. Create a Google Sheets with at least 50 links to 50 ads that mention [topic].
>
> Here is what I asked my own Claude Dispatch:
>
> Go to the Meta Ads Library: search the latest viral ads about Claude or Anthropic in the U.S. only. Create a Google Sheets with at least 10 links to 10 ads that mention Claude or Anthropic.
>
> And it worked. Now imagine scheduling this every morning? More after this section on how to schedule daily tasks.
>
> And you can build up on it:
>
> Now go to Gemini and recreate the ad. But make it about subscribing to my newsletter "How to AI". Each time you generate it on Gemini, I want you to save them on my Canva account in a new folder "Meta Ads".
>
> Sky is the limit. Actually, you are the limit.
>
> 3. How to schedule tasks with Claude.
>
> That was the obvious next step: scheduling a task with Claude.
>
> Just like... an employee reporting to you.
>
> Go to the left sidebar, and look for Scheduled.
>
> Create a New task. Give it a name and description.
>
> The most important part: the prompt. Test it before.
>
> Choose a frequency. And make sure to select the right model & folder.
>
> Start here.
> Give it a name and a description. Try a prompt on the normal chat before pasting it here.
> I made myself a solid prompt to go through the daily AI papers from arXiv.
> Make sure to select the right model after clicking More options > and pick your Cowork folder as I explained before.
> You are good to go, as long as your computer is "awake".
>
> Master AI before it masters you.
>
> It has been my motto since November 2022 (on day 1 of ChatGPT).
>
> And for the first time, AI is literally you.
>
> Clicking on a computer. Creating Excel files. Scheduling tasks. Planning ahead.
>
> It is time to stay ahead of this technology, once and for all.
>
> And today, we must stay ahead of Claude.
>
> And no, I'm not paid to make this newsletter.
>
> I'm sharing, twice a week, how my work is transforming (very fast) with AI.
>
> As I'm trying to keep up, I want you to keep up. So we move just as fast.
>
> I want to be the greatest filter to the AI noise for 400,000+ readers.
>
> Some came directly from my LinkedIn. But most readers subscribed to my newsletter because someone they trusted sent them one of my articles.
>
> If this article helped you, be that person for someone else (and click here):
>
> It does not cost you anything to share. And sharing is caring :)
>
> If someone did send you this, thank them and subscribe for free here:
**Structure:** Product-launch reaction piece: opens on an industry-news hook (Claude's computer-use tweet going viral) rather than his own testing, then splits into three flat numbered sections: (1) an access/setup checklist gated behind specific plan and OS requirements, (2) a use-case gallery built from copy-paste prompt templates (freelancer hiring, ad research, cross-tool automation chained into Gemini and Canva), and (3) a scheduling/automation walkthrough for recurring tasks. Closes on his usual "master AI before it masters you" motto and share/subscribe CTA.
**Framing:** Treats a new product feature as an employee-relationship metaphor throughout ("like it's... your employee?", "an employee reporting to you"), reframing a technical capability (computer-use automation) as an emotional/status upgrade rather than a dry feature explainer. Leans hard on screenshot-backed proof-of-work (phone and computer views side by side, live Fiverr inbound results) consistent with his recurring "actual screenshots of my own screen" credibility device. The nested "you can build up on it" example (chaining Meta Ads research into Gemini generation into Canva storage) demonstrates his habit of escalating a simple demo into a multi-tool pipeline within the same section.

### 24. Note: My 9 (most-used) Claude Skills to write prompts. (Aug 26/27, 2026, ~4h old at capture) [link](https://substack.com/@ruben)
**Metrics:** 27 likes · 1 comment · 2 restacks (short-form Note, not a full post: much lower engagement scale than essays). No direct per-Note permalink surfaced during capture; the link above goes to his `@ruben` Activity feed, not a standalone Note URL.
**Format:** Standalone Note (short-form text), not a post-promo card.
**Opening hook (verbatim):**
> My 9 (most-used) Claude Skills to write prompts.
> Download the whole library for free:
**Full text (verbatim):**
> My 9 (most-used) Claude Skills to write prompts.
>
> Download the whole library for free:
>
> 👉 claude-skills.free - get all the skills in a zip file.
>
> Everything below is what you'll get:
>
> --
>
> 1. /prompt-master - restructures a brain-dump into a clean task spec before Claude runs anything.
>
> 2. /grill-me - interrogates until nothing is vague. The prompt fixes itself in the answers.
>
> 3. /how-to - for when I don't even know what to ask. Maps the steps first, then we prompt.
>
> 4. /5 - rewrites the optimised prompt for Opus 5. Models read differently.
>
> 5. /fable - same job, tuned for the new Fable 5. Two models, two ways of prompting.
>
> 6. /personal-voice - bakes my writing voice into the prompt. Outputs sound like me on the first try.
>
> 7. /anti-ai - remove the em-dashes and the dead giveaway AI words before they ever appear.
>
> 8. /write-a-skill - turns any prompt I reuse into a new Skill. The library builds itself.
>
> 9. /handoff - compresses the whole chat into the opening prompt of the next one. Nothing gets lost.
>
> …and the rest of the library, all done, all free.
>
> --
>
> Stop spending hours perfecting your prompts. It's barely worth it now. Just download the Skills. I turned the optimised prompts into 9 Skills. Getting them takes 2 clicks:
>
> Step 1. Go to claude-skills.free.
>
> Step 2. Download the skills.
>
> Step 3. Put your email and verify with an OTP.
>
> Step 4. Save the downloaded zip file.
>
> Step 5. Upload to Claude → Settings → Skills.
>
> --
>
> The best part: the Skills stack. Claude runs /grill-me into /5 into /personal-voice in one chat - you just answer the questions and watch.
>
> ♻️ Restack this to save someone from prompting.
**Structure:** Numbered-list Note with an em-dash-delimited (`--`) section break structure, a bolded/emoji-flagged link ("👉 claude-skills.free"), 9 flat numbered skill entries each in "name - what it does" format, then a short numbered install checklist (5 steps), then a closing payoff line and an explicit restack CTA.
**Framing:** Same lead-magnet mechanic as his essays (drive an external free download via a gated email-capture link) but compressed to Notes' short-form scanning format: no narrative, no screenshots, pure listicle. The line "remove the em-dashes and the dead giveaway AI words before they ever appear" (skill #7) directly echoes his essay-length "anti-ai-writing-style" and "Can you detect AI?" content, showing the same anti-AI-tell obsession recurring in his short-form output.

**Notes access note:** Substack's public (unauthenticated) view of a creator's Activity/Notes feed at `substack.com/@handle` is hard-capped: only the 2 most-recent items render before a "Log in for more / Or create an account" wall blocks everything older. There is no "Top" sort control on this feed (unlike the archive), so scanning for his *historically* highest-engagement standalone Notes was not possible without an authenticated session. The one standalone Note that rendered (captured above) is genuinely distinct content, not a post-promo; the other visible item was a "Latest post" promo card for the essay "Thinking is cheap." (not counted separately, since it just announces an essay) and a third item was a restack of someone else's content blocked by the login wall. Given this hard platform limit, the Notes component of this library is 1 item, not the several originally hoped for: reported honestly rather than padded.
