# Cory Doctorow: content library

**Handle:** @pluralistic@mamot.fr (Mastodon)
**Primary platform:** Mastodon
**Primary media type:** text
**Audience size:** 76K followers (at capture, 2026-08-26)
**Topic(s):** Platform-overall (digital rights, copyright/monopoly critique, "enshittification" commentary)
**Capture method:** Mastodon public REST API via curl, no auth. Account lookup at `https://mamot.fr/api/v1/accounts/lookup?acct=pluralistic` (account id 303320), then paginated `https://mamot.fr/api/v1/accounts/303320/statuses?exclude_replies=true&exclude_reblogs=true&limit=40` with `max_id` pagination, collecting 1,120 original posts spanning 2026-07-25 to 2026-08-26 (about one month). This is a bounded-window capture of his most-engaged posts from that window, not an all-time top list. Ranked by boosts+favourites on each thread's root post (self-reply thread continuations were excluded from ranking and instead folded into their thread's entry, walked via `in_reply_to_id` chains sorted by timestamp).
**Posts captured:** 30/30

**Note on threads:** Doctorow's pluralistic.net essays are cross-posted to Mastodon as long numbered self-reply threads (1/, 2/, 3/...eof/), each ending in a link to the essay-formatted version on pluralistic.net. Where a ranked post is the head of such a thread, the full thread is captured below (marked with `---` between posts) rather than just the head. He also runs a separate recurring format, a daily "Today's threads (a thread)" digest/link-roundup, distinct from the essay-threads; several of these placed in the top 30 due to volume of daily engagement and are labeled accordingly.

## Posts

### 1. They disinvented the VCR (2026-08-26) [link](https://mamot.fr/@pluralistic/117159662819871806)
**Metrics:** 101 boosts, 98 favourites, 8 replies (thread of 48 posts)
**Opening hook (verbatim):**
> They disinvented the VCR. You might think that the reason we don't have VCRs anymore is because VCRs were supplanted by DVDs, PVRs and streaming, but that's not the case. They had it in for the VCR from the very start, and they never stopped trying to kill it. Eventually, they succeeded.

**Structure:** Long single-topic essay-thread (48 posts). Opens with a punchy thesis, links to the pluralistic.net essay version, then numbers through the argument (1/, 2/, 3/...eof/), heavily hyperlinked to sources and his own prior essays.
**Framing:** Extended historical case study (the VCR and the Betamax decision) used as an analogy/precedent to build a present-day argument (Trump's tariffs could re-legalize anti-circumvention workarounds worldwide).
**Full text (verbatim):**
> They disinvented the VCR. You might think that the reason we don't have VCRs anymore is because VCRs were supplanted by DVDs, PVRs and streaming, but that's not the case. They had it in for the VCR from the very start, and they never stopped trying to kill it. Eventually, they succeeded.
>
> -- 
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/25/gammamax/#felony-contempt-of-business-model
>
> 1/
>
> ---
>
> The VCR was one of the fastest-adopted technologies in the history of the world, and it was *disruptive*. The fact that you could record shows to watch later, skip the ads, build a library of your favorites, even loan your tapes around - it drove the studios and broadcasters *nuts*. 
>
> 2/
>
> ---
>
> The VCR hit the market under a cloud of litigation, and the lawsuits went all the way up to the Supreme Court, culminating with 1984's *Betamax* decision, whose key precept is that a new technology doesn't violate copyright law if it can "sustain a substantial, non-infringing use":
>
> https://en.wikipedia.org/wiki/Sony_Corp._of_America_v._Universal_City_Studios,_Inc.
>
> As important as the VCR was as a device - creating the home video market, which begat DVDs, then streaming - the *Betamax* decision is even *more* important.
>
> 3/
>
> ---
>
> You see, copyright is a "fact-intensive" doctrine, which means that determining whether a use is or isn't a copyright violation can be a complex and expensive process of gathering facts, weighing conflicting expert views to arrive at a judgment. If the rule was that new technologies couldn't be introduced unless you could prove that they would *never* infringe copyright, we wouldn't have *any* digital technology. Indeed, most technologies would be illegal under that standard. 
>
> 4/
>
> ---
>
> You can infringe copyright with VCRs, photocopiers, hard drives, tape recorders, scanners, computers, phones... Hell, you can infringe copyright with an X-ray machine, a saxophone or a pair of ballet slippers! 
>
> There's clearly ways you can use a VCR to infringe copyright: for example, you can record a TV show to a tape, then sell that tape to someone else. 
>
> 5/
>
> ---
>
> There's also ways you can use a VCR that clearly do *not* infringe copyright: you can lug a camcorder around your kid's birthday party, pester the kids by recording them, then watch the footage later in your living room. 
>
> 6/
>
> ---
>
> Then there's an infinite universe of ways to use a VCR that *might* infringe copyright, depending on the specifics: recording the Super Bowl while you're at work, then inviting your workmates over to watch it after your shift ends; creating a library of kids' shows for the day-care you run out of your living room; making a highlight reel of your favorite politician's campaign speeches. 
>
> 7/
>
> ---
>
> Anyone who says, "Oh *every* judge would *always* call that legal‡ under *every* circumstance" is admitting they don't understand how copyright works.
>
> ‡ Or illegal.
>
> 8/
>
> ---
>
> This is a feature, not a bug. Copyright is a fact-intensive doctrine because it is a *flexible* doctrine. Since the printing press, new ways of mechanically reproducing and transmitting information have appeared at an accelerating pace, and judges are asked to figure out the rules for these new technologies long before legislatures come to grips with them and pass special, tech-specific laws.
>
> 9/
>
> ---
>
> Copyright's future-proofing lies in this flexibility, which the Supremes (correctly) recognized in 1984 with the *Betamax* decision. By ruling that any technology that had "non-infringing uses" was presumptively legal to create and market, the Supremes laid the legal foundation for all the digital tools that followed since.
>
> 10/
>
> ---
>
> Crucially, *Betamax* ensured that last year's tech lottery winners wouldn't get to prevent *next year's* winners from emerging. This year's admirals are *always* last year's pirates, and they insist that what *they* did to their predecessors was progress, while anyone who tries to do the same thing to *them* is a thief. The sheet music composers condemned the record player, recording artists decried the radio, broadcasters sued over cable and cable operators sued over VCRs. 
>
> 11/
>
> ---
>
> This never stopped: Sony - the company that invented the Betamax and defended it all the way to the Supreme Court - went on to sue Napster!
>
> There's nothing inherently virtuous about "innovation." It's perfectly possible to "innovate" new ways to spy on people and rip them off. But if you're trying to launch a new product in a category that already has clear winners, the best way to convince people to take a chance on you is by making a valuable and useful product.
>
> 12/
>
> ---
>
> "Disruptors" are best when they move value from existing companies to those companies' customers. The first TV remotes let people change the channel when an ad came on, making their TV better at broadcasters' expense. The broadcasters had to struggle to adapt, which is fine. They're not charities, after all: they're in business to make money for themselves, and they're only going to give you as much value as they have to.
>
> 13/
>
> ---
>
> Competitors fight enshittification: any time a company that you do business with takes something away from you, a competitor can win your business by giving it back. If Youtube doubles the number of ads they expect you to watch - "charging" a higher attentional "price" - an ad-blocking competitor can bargain back on your behalf, allowing you to counteroffer with "how about if I just don't watch *any* ads?"
>
> https://www.eff.org/deeplinks/2019/07/adblocking-how-about-nah
>
> 14/
>
> ---
>
> Inside every company, there are fair, honest people, and there are greedy, shitty people. Companies that face competitors are more likely to listen to the workers who want to give customers a fair shake. 
>
> 15/
>
> ---
>
> But if a company has no competitors, those good people can no longer say, "This is a losing strategy because it will open the door to competitors who will make us poorer." Without competitors, the argument against enshittification becomes, "I would feel bad about myself if we did that." This argument always loses to the bad guys, whose argument is, "We will all get richer if we do this."
>
> 16/
>
> ---
>
> That's why Google enshittified search: they had no competitors, so the worst ideas of the worst people at Google could be shown to make the most money, and so Google deliberately made its search results worse:
>
> https://pluralistic.net/2024/04/24/naming-names/#prabhakar-raghavan
>
> Of course, companies can also face consequences from the government, but the fewer competitors a company has, the easier it is for that company to capture its regulators:
>
> https://pluralistic.net/2022/06/05/regulatory-capture/
>
> 17/
>
> ---
>
> Competition makes companies weaker, giving the public *and* democratic institutions more power. Competition makes the public richer at the expense of corporate shareholders, who have less money to spend on the project of subverting democracy. 
>
> 18/
>
> ---
>
> That's the VCR story all over. The VCR shook up a sclerotic, stagnant TV and film industry, created the home video market, and opened up new distribution channels that allowed all kinds of new creative workers to reach new audiences, either directly or through a fiercely competitive new constellation of distributors who fought each other to offer them the best possible deal.
>
> 19/
>
> ---
>
> The media companies who were forced to adapt to the VCR never forgave it for forcing them to develop new, multi-billion dollar businesses without permission. As a Hollywood executive once put it to me, his goal was "a polite marketplace" where no one ever rudely forced him to disgorge more value to viewers and performers:
>
> https://pluralistic.net/2022/01/02/the-internet-heist-part-i/
>
> 20/
>
> ---
>
> The executives who made billions after losing their bid to ban the VCR wanted to ensure that no one would ever be so "impolite" as to force them to make billions of dollars against their will ever again. They partnered with electronics firms to ensure that the VCR's successor technologies would only have those features that they approved.
>
> 21/
>
> ---
>
> That's why DVD *players* are not DVD *recorders*: the consortium that developed the DVD embedded "hook IP" in the technology. "Hook IP" is a term of art: it means any trademark, copyright or patent that is incorporated into a technology so that anyone who wants to implement that technology must license the hook IP; under the terms of those licenses, doing anything that disrupts the business plans of the consortium is banned.
>
> 22/
>
> ---
>
> The DVD consortium's hook IP had all kinds of bizarre licensing terms, like "region coding" - a requirement for DVD players to register the country in which they were sold and to check whether the DVDs you tried to play were from a compatible country. If not, the license terms required the DVD player to refuse to play your discs.
>
> 23/
>
> ---
>
> Region coding is an "anti-feature," a technology developed at great expense *for which there is no market*. Sure, some DVD player owners who had never shopped abroad for a DVD didn't care about region coding. But for customers who bought a disc on vacation, or moved from one country to another: region coding was *terrible*.
>
> 24/
>
> ---
>
> So there were customers who didn't care about region coding, and customers who hated region coding, but there were *zero* DVD player owners who *wanted* region coding. No DVD manufacturer could advertise that their products come with region coding. If there were two equivalent DVD players in the market, identical except that one had region coding and the other didn't, the "region-free" player would win. Region-coding is an anti-feature.
>
> 25/
>
> ---
>
> Anti-features aren't the only deliberate defects we find in DVD players. The consortium's hook IP licenses didn't just *require* anti-features, they also *banned* useful features...including recording. Long after the price of read/write optical drives plummeted to pocket-change, there was still no such thing as a home DVD recorder that would let you stick a spindle full of discs next to the TV and use them to record all your favorite shows.
>
> 26/
>
> ---
>
> Shortly after the DVD player emerged, Congress created the most powerful hook IP of all: "anti-circumvention law." Under anti-circumvention law, it's a literal crime - a felony - to modify or reimplement a technology without permission from the manufacturer. 
>
> 27/
>
> ---
>
> In 1998, Bill Clinton signed America's landmark anticircumvention law, the Digital Millennium Copyright Act, section 1201 of which establishes a five-year prison sentence and a $500,000 fine for "bypassing an access control":
>
> https://pluralistic.net/2026/01/14/sole-and-despotic/#world-turned-upside-down
>
> After DMCA 1201, all a manufacturer had to do was add an "access control" (like a password or an encryption key) to their device, and modifying that device in *any way* could land you in prison. 
>
> 28/
>
> ---
>
> As microchips plummeted in price, all kinds of devices and services acquired these "access controls," so that it became *a crime* to refill an ink cartridge, fix a tractor, or connect your insulin pump to your glucose monitor. Congress never passed a law criminalizing this conduct: rather, they gave companies the ability to write their own criminal code. Simply by adding an access control to a device, they could felonize any conduct that displeased them.
>
> 29/
>
> ---
>
> Every video format and distribution system that succeeded the VCR shipped with an access control: DVDs, Blu-ray and HD DVD, satellite and digital cable, and, of course, streaming video. This is how they disinvented the VCR. Once every video had an access control, it had "hook IP" that could be used to control *all* technologies that were capable of receiving, storing, or playing back that video.
>
> 30/
>
> ---
>
> Remember Tivo? The first digital "personal video recorders" were true successors to the VCR. They could record *any* broadcast or cable program, store it forever and fast forward through the ads. They were all "feature" and nary an "anti-feature" in sight. 
>
> 31/
>
> ---
>
> That's because they only worked with analog cable (which, being analog, didn't have "access controls" that qualified them for DMCA 1201 consideration) and broadcast signals (sent over the public airwaves on the condition that they not be scrambled).
>
> Digital cable disinvented the Tivo. Every post-VCR digital video signal came with hook IP, and so the Tivos (and other PVRs) had to get permission before they could store and play back modern videos. 
>
> 32/
>
> ---
>
> To get that permission, PVR makers had to agree to a whole suite of anti-features, such as a "broadcast flag" that told it which shows you could and could not record. 
>
> 33/
>
> ---
>
> Even if you did record a show, PVR makers also supported more flags, such as an "expiry date" flag that forced your recorder to delete your shows after a set period, a "no skip" flag that blocked you from fast-forwarding through ads, and "geofence" flags that stopped you from playing back your stored videos based on which country you found yourself in.
>
> 34/
>
> ---
>
> Today, if you have a PVR, you probably rent it from your cable provider (who can use DMCA 1201 to block other PVRs from working with your cable provider). It's probably slow, with a confusing user interface, and it only records an ever-dwindling subset of the shows your cable company transmits. 
>
> 35/
>
> ---
>
> Notwithstanding that it's a genuinely shitty piece of technology, it's still awful that you can't buy it - the fact that you have to rent that crapgadget month after month means that you're paying for it several times over.
>
> But at least cable signals *have* PVRs. For the majority of video we interact with, there's no PVR - not even a shitty, broken one. You can't record your Netflix videos, your HBO Max videos, your Disney Plus videos or your Prime videos. 
>
> 36/
>
> ---
>
> Recording a video off a streaming service has the same copyright status as recording a show off your analog cable was in 1984 when the Supreme Court handed down the *Betamax* decision, but because there's an "access control" on video streams, it's nevertheless a felony to make a VCR for a streaming service.
>
> 37/
>
> ---
>
> You know how streaming companies play all kinds of bullshit games, like dropping videos from their catalog? Even worse: the Amazon Prime scam where Christmas cartoons are all included in your "free" streaming tier from March-October, but cost $3.99 to watch from November to February. All of these ills can be cured with the VCR, a technology that was first marketed in 1971, a technology we have disinvented. 
>
> 38/
>
> ---
>
> If you could record those shows with a device that took orders from you, a device without anti-features, Amazon would derive no benefit playing these grinchy little games. If they played those games anyway, you could beat them.
>
> 39/
>
> ---
>
> It's not just VCRs. Anti-circumvention law led to the enshittification of everything from tractors to ventilators, phones to smart speakers, thermostats to games consoles, all of which are bristling with hook IP that lets their manufacturers decide what you can do with your own property.
>
> 40/
>
> ---
>
> All of this is extremely relevant at this moment, thanks to Trump's tariffs. For more than a quarter century, the US Trade Representative has arm-twisted every American trading partner into enacting an anti-circumvention law like DMCA 1201. All over the world, governments promised to lock up entrepreneurs and technologists if they dared to disenshittify America's defective tech exports. 
>
> 41/
>
> ---
>
> In exchange, governments were promised free trade with the USA: tariff-free access to American consumers.
>
> That's where Trump comes in. From the moment his "Liberation Day" tariffs landed, any country that upheld its anti-circumvention laws was sacrificing its national competitiveness, resiliency and integrity in exchange for *nothing*. Trump reneged on America's obligations to its trading partners, just like he reneged on every deal he's ever made:
>
> https://pluralistic.net/2026/07/22/table-flipper/#graveyard-of-indispensable-nations
>
> 42/
>
> ---
>
> The good news is, this means we can have VCRs again! All it will take is for one (or more) countries to decide to lift its one-sided restrictions on making technologies "capable of sustaining a substantial non-infringing use" and wait for one (or more) entrepreneurs to figure out that reintroducing the VCR is a winner, just like it was in the 1970s, when the VCR was the fastest-adopted technology in the history of the world.
>
> 43/
>
> ---
>
> It's not just VCRs, of course. For a *generation*, entire product categories have been suppressed, all over the world. There is a whole CES (good) worth of products that are truly innovative (good) waiting to be brought to market.
>
> 44/
>
> ---
>
> The last time there was this much low-hanging fruit on offer was after WWII, where six years' worth of bombings, austerity and neglect provided endless opportunities to repair, rebuild and replace the worn, crumbling built environment, vehicle fleet and personal belongings of people all over the world.
>
> 45/
>
> ---
>
> After a quarter-century of innovation prohibition, there are *dozens* of lucrative, easily perfected technologies just *waiting* to be made: the dongle that jailbreaks your phone or console and installs a third-party app store, the dongle that flashes your printer so it takes generic ink; the dongle that lets your mechanic install generic parts in your car and lets farmers fix their tractors. 
>
> 46/
>
> ---
>
> Our whole digital world has been wrapped in chains by rent-extracting monopolists who gloried in their power to use hook IP to deprive you of the right to use your property in ways you see fit, writing private laws that made it a crime to displease them.
>
> 47/
>
> ---
>
> A generation of allowing companies to shift value from their customers and suppliers to themselves has made them richer, us poorer, and everything more expensive. They've accumulated vast wealth at our expense. Their margins are our opportunity.
>
> The VCR was a great idea 55 years ago. 55 years later, it's an idea whose time has come - again.
>
> eof/

### 2. In 2019, there were more people struck by lightning... (2026-07-27) [link](https://mamot.fr/@pluralistic/116990297900226273)
**Metrics:** 80 boosts, 90 favourites, 5 replies
**Opening hook (verbatim):**
> in 2019, there were more people in America struck by lightning than consumers who got monetary awards from an arbitration panel. 

**Structure:** Single-post aphorism: a startling statistic with a one-line attribution and source link. No thread.
**Framing:** Irony/absurdist juxtaposition (lightning strikes vs. consumer arbitration payouts) used to needle corporate arbitration clauses, credited to Matt Stoller.
**Full text (verbatim):**
> in 2019, there were more people in America struck by lightning than consumers who got monetary awards from an arbitration panel. 
>
> Matt Stoller
> https://www.thebignewsletter.com/p/monopoly-round-up-how-to-stop-the

### 3. Neoclassical econ assumes rationality (2026-08-01) [link](https://mamot.fr/@pluralistic/117020262269371294)
**Metrics:** 85 boosts, 70 favourites, 3 replies (thread of 45 posts)
**Opening hook (verbatim):**
> Neoclassical econ assumes rationality. The corollary of, "If you're so smart, why aren't you rich?" is "you're rich, so you must be very smart!" Thus it is that many people assume that if powerful, well-compensated CEOs insist "AI is changing everything," well then, *AI must be changing everything*.

**Structure:** Long essay-thread (45 posts) built around quoting and dissecting another writer's viral essay (Nikhil Suresh's 'AI Mania Is Eviscerating Global Decisionmaking'), with pull-quotes, then Doctorow's own commentary layered on top.
**Framing:** Quote-and-respond framing: extensive block quotes from a cited external essay, interspersed with Doctorow's own analysis and his recurring 'asbestos in the walls' AI metaphor at the close.
**Full text (verbatim):**
> Neoclassical econ assumes rationality. The corollary of, "If you're so smart, why aren't you rich?" is "you're rich, so you must be very smart!" Thus it is that many people assume that if powerful, well-compensated CEOs insist "AI is changing everything," well then, *AI must be changing everything*.
>
> -
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/01/dare-snot/#i-will-fucking-piledrive-you-if-you-mention-ai-again
>
> 1/
>
> ---
>
> But the evidence for this "changing everything" thesis is thin on the ground. Despite a global mania that has reduced the real, pressing need for digital sovereignty to the imaginary need to create "sovereign AI," no one can really articulate the case for "sovereign AI." If Donald Trump ordered Big Tech to turn off all of your country's chatbots tomorrow, nothing would change. Every one of your country's ministries and corporations would chug on with nary a hitch. 
>
> 2/
>
> ---
>
> Households, too, though perhaps younger members of those families would have to do their own homework again.
>
> (Contrast this with what would transpire if Trump directed his tech giants to switch off your country's Office 365 access, or to brick your Android and iOS phones, or to killswitch your John Deere tractors. Your country would effectively cease to exist. If "digital sovereignty" means anything, it means doing something about *this* urgent fact):
>
> https://pluralistic.net/2026/06/18/their-trillions-our-billions/#eyes-on-the-prize
>
> 3/
>
> ---
>
> The world is full of people who insist that "AI is changing everything" but who - when pressed - have to admit that what they mean is that they're pretty sure that AI *will* change everything. Eventually. After we allow it to consume all the planet's energy, carbon, water and financial resources.
>
> Maybe.
>
> (They're pretty sure.)
>
> 4/
>
> ---
>
> One person who's had a lot of opportunity to observe the shear between the stated business/AI situation and the *real* business AI situation is Nikhil Suresh from Hermit Tech, a consulting firm of "radically ethical data wizards" (that is, tech consultants). 
>
> 5/
>
> ---
>
> Suresh reports on his experience talking with hundreds of executives (and, more importantly, their subordinates) about what (if anything) AI is doing for business in an essay entitled "AI Mania Is Eviscerating Global Decisionmaking":
>
> https://hermit-tech.com/blog/ai-mania-is-eviscerating-global-decisionmaking
>
> Suresh has a good track record of writing trenchant, frank criticism of AI. You may know him from his 2024 essay, "I Will Fucking Piledrive You If You Mention AI Again":
>
> https://ludic.mataroa.blog/blog/i-will-fucking-piledrive-you-if-you-mention-ai-again/
>
> 6/
>
> ---
>
> Or possibly from his "Contra Ptacek's Terrible Article On AI," a stinging rebuttal to Thomas Ptacek's widely read "My AI Skeptic Friends Are All Nuts":
>
> https://ludic.mataroa.blog/blog/contra-ptaceks-terrible-article-on-ai/
>
> 7/
>
> ---
>
> While those are important pieces of critical AI realpolitik, none of them have the heft or urgency of "AI Mania Is Eviscerating Global Decisionmaking," whose thesis can be summed up with this passage from halfway through this 6,000-word article:
>
> > [W]e’re facing a coordination problem around executives being honest around the AI gains they’ve witnessed – if they co-operate, they keep their jobs.
>
> 8/
>
> ---
>
> > If they defect, they will possibly be fired by their embarrassed peers (who have now been implicitly called liars, cowards, or incompetents) and then replaced with someone that will toe the line anyway. If they could all admit the truth at once there might be some hope, but there is no way to coordinate that event. 
>
> 9/
>
> ---
>
> In other words, corporate leadership is starting from the premise that AI has (or will) radically change the business, and they're working backwards from that premise to find the evidence to support this article of faith.
>
> In support of this thesis, Suresh cites "hundreds" of conversations with execs and employees who spoke to him on the condition that he would "file the serial numbers" off their stories. 
>
> 10/
>
> ---
>
> These, combined with his own experience consulting for large, multi-billion-dollar companies make it clear that "AI mania" is an absolutely justifiable label for the state of AI in corporate circles.
>
> Here are a few highlights from this morning's read - moments where I had to look away from my screen and read out a passage to my wife so that we could share a "holy shit" moment.
>
> 11/
>
> ---
>
> A person worked for a division that "pivoted" to re-engineer its software to create interfaces that support AI agents. When it became apparent that only *ten users* had touched this expensive new technology, they "pivoted" again to support "agentic workflows." Why did they double down on AI agents after discovering such yawning market indifference for "agentic"? "Because every company has to do something agentic now."
>
> 12/
>
> ---
>
> Suresh describes this as a literal religious mania. In the 500+ employee businesses Suresh studied, the only people who were promoted - or even spared from being fired - were people who professed "religious declarations of faith" about "the transformative power of AI." Employees who voiced honest, informed objections to AI in the workplace were passed over for promotions or targeted for layoffs.
>
> 13/
>
> ---
>
> This has created a situation in which *everyone* - "boards, executives, employees, vendors, consultants" - has a strong incentive to lie about how much AI is delivering for their companies. Suresh says he's seen announcements from publicly traded companies about their AI triumphs that he knows for a fact never took place.
>
> Suresh says he's *never* seen a successful enterprise AI project: "Every single one – we have seen 0% success in a year and a half." 
>
> 14/
>
> ---
>
> Not one of their clients would face a business challenge if OpenAI went out of business tomorrow. The problem most companies struggle with is that they're "terminally bad at running software projects effectively." Adding AI to the mix doesn't solve this problem - it just adds a whole new range of ways that software deployment can fail.
>
> 15/
>
> ---
>
> Chatbots don't help. The internally facing chatbot that's supposed to help employees figure out how to navigate the business sucks because it is only as good as its training date - the business's documentation of its own processes. Businesses *suck* at documenting their processes. Customer-facing chatbots *also* suck. They either can't solve your problem, or, when they seem to solve your problem, the "solution" goes nowhere.
>
> 16/
>
> ---
>
> Suresh recounts his sole positive customer service chatbot experience: a Mitsubishi chatbot with a natural sounding, responsive voice politely took all the details of an automotive failure and promised him a callback. That callback never came, but Suresh is certain that Mitsubishi has logged this as a chatbot success story, even though the experience convinced him *not* to buy a Mitsubishi car.
>
> 17/
>
> ---
>
> Suresh and his team at Hermit Tech now have a policy of not even asking about ongoing AI projects. They've learned that by the time an AI project has begun, no one will discuss it honestly until it reaches a crisis point.
>
> Suresh says he frequently encounters people who reflexively utter the AI catechism: "AI is changing everything." 
>
> 18/
>
> ---
>
> But when he presses these people for details, they admit that their organization "does not currently use LLMs for anything, and indeed, that they cannot name a single thing that has changed other than they get some use out of ChatGPT."
>
> 19/
>
> ---
>
> This shear ("AI is changing everything"/"Well, OK, we're not using AI for anything") is so extreme that Suresh once met an exec who confessed to crafting an AI-centered AI strategy for a $2b/year business, even though that exec "had never even used ChatGPT or any AI tool in their life."
>
> 20/
>
> ---
>
> Some people have privately admitted to Suresh that they've embraced AI in order to earn a career-boosting corporate reputation for "thought leadership." But many other people (especially nontechnical people) sincerely believe that AI is about to "change everything." As Suresh says, if you're in business with a liar, you might be able to reason with them in private - but you can't reason with a true believer.
>
> 21/
>
> ---
>
> The true believers are in charge. Suresh points out that it would be very weird for the CEO of an engineering firm or a hospital to mandate "specific procedures or building techniques without explicit agreement from the professionals on staff." But when it comes to AI, business leaders will confidently demand that the skilled professionals who perform the business's core functions use AI, even if those professionals don't think it will help.
>
> 22/
>
> ---
>
> As an aside: I remember the dotcom era, when the business press was full of articles about the conflict between CEOs and a new workforce that *demanded* the right to use the web on the job. Today, the business press is full of articles about the conflict between the workforce and CEOs who *demand* that they use AI.
>
> Suresh describes workers who feel they have to "AI wash" their work: "They just do the work, the same way they have for decades, and say Claude did it." 
>
> 23/
>
> ---
>
> To add verisimilitude to this sham, they write circular processes in which one chatbot prompts another, and then the process repeats itself in reverse, for the sole purpose of consuming AI tokens to score a high rank on corporate "token leaderboards."
>
> How to account for this wildly, expensively irrational corporate leadership? Suresh places the blame in the hypnotizing, mesmerizing power of the AI demo. 
>
> 24/
>
> ---
>
> For example: Hermit Tech is often engaged to set up a database product called Snowflake for its customers. Snowflake has a useless, expensive AI bolt-on called Cortex, that Snowflake itself describes as being 92% accurate under ideal circumstances (that is, at least 8% of the time, it will mislead you, perhaps very badly).
>
> Suresh describes sales meetings with execs who were lukewarm on the idea of retooling with Snowflake, but who were very interested in Cortex. 
>
> 25/
>
> ---
>
> Against their better judgmentthe  team provided demoed Cortex, carefully explaining that this AI tool *could not* satisfy their requirements. Without fail, this resulted in the previously lukewarm customers insisting that they be allowed to purchase Cortex *immediately*. Sales prospects who'd been unmoved by a pitch for new technology that would result in *millions* in savings were *hypnotized* by demos of a product that was described as *unsuitable and unreliable*.
>
> 26/
>
> ---
>
> To their credit, Hermit Tech refused to sell these customers Cortex, and stopped doing Cortex demos altogether. Suresh describes the experience of "the total 180°, that shift from ice-cold to red-hot buying frenzy" as "deeply unsettling." What's more, the Cortex demos that Suresh and co performed were, by his account, pretty uninspiring. 
>
> 27/
>
> ---
>
> The thing that these demos had going for them is that they showed AI actually doing something marginally useful, to execs who'd already spent millions on AI without having *anything* to show for their money. The spectacle of AI that *did something* galvanizes corporate leaders who feel like they're the only bosses who can't find a revolutionary use for AI in their businesses.
>
> 28/
>
> ---
>
> This is the situation up and down the corporate org-chart. Suresh has a reader whose title is "Head of AI" at a billion-dollar firm who tells him "their job is totally fraudulent but it was the only promotion pathway remaining at the organisation." This exec is hardly alone. They're part of a cohort of executives at companies that have publicly announced "100x" productivity gains, but who confessed to Suresh that nothing of the sort has happened.
>
> 29/
>
> ---
>
> Why did these companies make these claims? Because their *customers* were making the claims. How could you hope to sell to a company that had 100x'ed its productivity with AI unless you, too had 100x'ed your productivity? 
>
> 30/
>
> ---
>
> If, as a vendor, you walked into a boardroom and said that this wasn't a plausible claim, you'd be calling your sales prospect a liar, with real consequences: "getting enterprise contracts cancelled because you wanted to opine on something that doesn’t really matter to your organisation’s mission is a great way to get fired."
>
> 31/
>
> ---
>
> With the state of the industry dominated by froth, lies and mutual destruction pacts, it's no wonder that companies are deploying "totally gameable metrics such as 'money spent on AI'" as a means of evaluating employees and divisions.
>
> Between true believers and people who must find ways to plausibly tout their AI usage, there is now a gigantic market for "AI solutions." 
>
> 32/
>
> ---
>
> At *best* these are just traditional tech consulting contracts, like migrating a database from Oracle to Snowflake, with some kind of ornamental AI usage around the edges so that the person who commissions the work can claim to be "procuring AI-enabled services" for the business.
>
> This isn't a harmless frippery: contracts are delayed and work is put off until the work can be made "sufficiently AI" to attain the minimum degree of buzzword compliance. 
>
> 33/
>
> ---
>
> Worse: every fake AI project that produces real results (because it's not really AI) adds credibility to the AI true believers, who view these projects as proof that AI can do anything, and therefore demand to know why *everything* isn't being done by AI.
>
> 34/
>
> ---
>
> Suresh ends his essay with a long section on how to "navigate AI mania" - advice for how to smile and nod politely when you're confronted with AI bullshit, while steering clear of the worst consequences and avoiding needless fights. This looks like very sound advice for anyone in a corporate environment, but thankfully, that isn't me.
>
> 35/
>
> ---
>
> Rather than summarize that advice, I want to reflect a little on two questions that Suresh's essay raises but doesn't answer. The first is *why*? Why are people in power such easy converts to this religious mania?
>
> I have my own theory. The most important discomfort that powerful people experience is having ego-shattering conflicts with subordinates who know how to do things they do not know how to do. 
>
> 36/
>
> ---
>
> The fact that you're "in charge" is hard to reconcile with the fact that the people you're nominally in charge *of* tell you that all your ideas are impossible, illegal, immoral, or lethal:
>
> https://pluralistic.net/2026/01/05/fisher-price-steering-wheel/#billionaire-solipsism
>
> Take that Cortex demo. Sure, Cortex is an expensive, unreliable way to address a Snowflake database. But (unlike Snowflake) Cortex is controlled via conversational, plain-language commands. 
>
> 37/
>
> ---
>
> With Cortex, a boss doesn't need to ask an underling to retrieve information from the company Snowflake system, an interaction that might come with unsolicited feedback about the technical or commercial incoherence of the boss's request. Cortex *is* the underling, except that unlike a human underling, Cortex *never* back-sasses you about your foolish questions. 
>
> 38/
>
> ---
>
> The fact that it grossly misleads you 8% of the time is a small price to pay for a life untroubled by uppity pismires who insist that your ideas be connected to base reality as they understand it.
>
> The other question Suresh implicitly raises is, "How can you reconcile the failure of AI in the enterprise with the individual claims of skilled technologists who insist that AI is helping them do great work?" 
>
> 39/
>
> ---
>
> The answer is that these AI users are "centaurs" - experienced workers who are assisted by automation on terms that they set for themselves:
>
> https://pluralistic.net/2025/09/11/vulgar-thatcherism/#there-is-an-alternative
>
> Thanks to their skill and experience, these workers possess *discernment*, the ability to tell good code from bad, and (more importantly) good *uses* of code-generation tools from bad. 
>
> 40/
>
> ---
>
> They demonstrate the adage that worker-driven automation improves quality, while capital-driven automation improves *throughput*:
>
> https://pluralistic.net/2026/07/28/hitl-ers/#ai-ai-oh
>
> An automation technique that requires close supervision by skilled and experienced workers isn't going to be a raw productivity powerhouse. You don't "100x" your code this way, at least, not in the sense of firing 99 of your coders and having the remaining programmer pick up all their work. 
>
> 41/
>
> ---
>
> Rather, an automation tool that requires the continuous and conscientious exercise of discernment will let individual practitioners improve their work in extremely satisfying and useful ways. It's a way to spend more on operations in order to produce better outputs. It's *not* a way to cut your workforce, realize a gigantic savings, and still produce comparable goods and services at a far lower cost.
>
> 42/
>
> ---
>
> That is why some individual coders report such delight with their AI tools. They engage with those tools on their own terms, to improve their work in the ways that they, in their expert judgment, consider beneficial. No one ranks them on a "token-maximization" scoreboard. No one tells them they can't do a project if it isn't "sufficiently AI." When they set out to do a project, no one makes them prove that it couldn't be "done by AI."
>
> 43/
>
> ---
>
> As ever, the most important fact about a given technology isn't "what it does," but "who it does it *for*" and "who it does it *to*."
>
> All the pathologies Suresh observes and documents so well in this piece are hypertrophied versions of the buzzword-compliance dysfunctions from previous bubbles, but at a scale never before seen. Quantity has a quality all its own. These businesses aren't just wasting billions - they're replacing skilled workers with defective chatbots. 
>
> 44/
>
> ---
>
> As I've written before, AI is the asbestos we're shoveling into the walls of our technological society. Our descendants will spend *generations* digging it out again, and the longer the bubble goes on without popping, the longer it will take to repair the damage. 
>
> eof/

### 4. In the summer of 2013, two esoteric, technical... (2026-08-11) [link](https://mamot.fr/@pluralistic/117076609218874535)
**Metrics:** 71 boosts, 70 favourites, 3 replies (thread of 49 posts)
**Opening hook (verbatim):**
> In the summer of 2013, two esoteric, technical, incredibly important texts were published within weeks of one another: the first is the Snowden leaks, which revealed a system of global, pervasive digital surveillance. 

**Structure:** Long essay-thread (49 posts) that synthesizes two historically disconnected texts (the Snowden leaks and Piketty's Capital in the 21st Century) into one unified thesis.
**Framing:** Historical-parallel/statistical framing device: compares Stasi surveillance ratios to NSA surveillance ratios to argue technology turned surveillance into an oligarchic 'productivity dividend.'
**Full text (verbatim):**
> In the summer of 2013, two esoteric, technical, incredibly important texts were published within weeks of one another: the first is the Snowden leaks, which revealed a system of global, pervasive digital surveillance. 
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/11/tragedy-of-the-commoners/#piketty-snowden
>
> 1/
>
> ---
>
> The second was Thomas Piketty's *Capital in the 21st Century*, a book about the economic inevitability (and political instability) of oligarchy:
>
> https://memex.craphound.com/2014/06/24/thomas-pikettys-capital-in-the-21st-century/
>
> 2/
>
> ---
>
> In 2013, it wasn't immediately apparent how these two works connected with one another, but in the years since, I've grown increasingly convinced that Snowden and Piketty can only be properly understood as describing two aspects of the same phenomenon.
>
> 3/
>
> ---
>
> Piketty's landmark volume was grounded in a detailed analysis of 300 years' (!) worth of global capital flows, painstakingly compiled by a large team of grad students from a massive set of heterogeneous records. The book's conclusion is the statement that "returns to capital exceed the rate of growth over the long term" (abbreviated as "r > g").
>
> 4/
>
> ---
>
> This may sound innocuous, but it is *explosive*. If r > g, then the most wealth will inevitably accumulate in the hands of people who *start* with the most wealth, irrespective of whether they do anything productive with that money. This means that the alleged heroes of the market system - the entrepreneurs who found and manage the firms that increase public prosperity - are doomed to play second fiddle to the mere plumbers of money, people who "contribute" by accumulating.
>
> 5/
>
> ---
>
> The starkest example of this in *Capital 21C* is Piketty's contrast between L'Oreal heiress Liliane Bettencourt (then the richest woman in the world) and Bill Gates, founder of Microsoft (then the most successful corporation in the world). 
>
> 6/
>
> ---
>
> Piketty compares the growth in the fortunes of Bettencourt and Gates over two periods: first, the period between Microsoft's founding and Gates' retirement as CEO; and second, the period after Gates's retirement from his executive role, when he became a mere investor, no longer an entrepreneur.
>
> 7/
>
> ---
>
> During the period when Gates founded and ran the world's most successful corporation, he accumulated *less* wealth than Liliane Bettencourt, who did precisely *nothing* of value over that period. Bettencourt didn't even manage her investments - that was all handled by some very clever financial planners, lawyers and accountants. In other words: for Bettencourt, doing *nothing at all* produced more wealth as *founding the most successful corporation in the world* did for Gates.
>
> 8/
>
> ---
>
> Bettencourt, a person who *owned things*, did better than Gates, a person who *did things*.
>
> And then Gates retired. He stopped *doing things* and started *owning things*. He became an investor, whereupon he out-earned *both* Bettencourt and Gates-the-entrepreneur. 
>
> 9/
>
> ---
>
> Again, the market system allocated fewer rewards to the most successful person in the *doing things* business than it allocated to that same person once he quit that job and got into the *owning things* business.
>
> Piketty shows that this holds true across markets and nations and eras: all other things being equal, the market system produces a class of hereditary aristocrats who command the world's capital and direct its deployment, despite never having *done* anything. 
>
> 10/
>
> ---
>
> The market's most lavish rewards do not go to its most productive participants, but rather, to those participants who have the good fortune to emerge from the luckiest of orifices.
>
> Worse: winning the orifice lottery in no way qualifies you to direct the capital you've inherited. Liliane Bettencourt had no revolutionary new business ideas, invented no miraculous new materials or processes, produced no brilliant art. 
>
> 11/
>
> ---
>
> She merely accumulated, thanks to the professional services of skilled technicians whose job description includes hiring their own successors to ensure that another generation of winners of the Bettencourt orifice lottery could continue to accumulate, commanding more capital and power in society.
>
> 12/
>
> ---
>
> Perhaps if these orifice winners were content to allow their bloodless Renfields to allocate their capital while consuming bonbons and attending yacht parties, this could yield a stable politics. 
>
> 13/
>
> ---
>
> But inevitably, people who win the orifice lottery observe that they come from a long line of wealthy people, a line that will continue with their own descendants, and conclude that they have some kind of special, heritable virtue - magic blood - that the system has recognized with their great fortunes and the power those fortunes confer.
>
> 14/
>
> ---
>
> That's when things get dangerous: when aristocrats grow bored with their leisure and mobilize their inherited capital to change the way the rest of us live. Billionaire dilettantes are weapons of mass destruction, and their special projects have a wide blast radius and inflict a *lot* of collateral damage.
>
> 15/
>
> ---
>
> Take Bill Gates: his ideological projects have been a catastrophe. A patent maximalist, he funded the lobbyists who successfully blocked South Africa from producing its own AIDS drugs under an IP waiver program, and then deployed them again to stop the Global South from making their own covid vaccines:
>
> https://pluralistic.net/2021/04/13/public-interest-pharma/#gates-foundation
>
> 16/
>
> ---
>
> Closer to home, Gates's hatred of public institutions led him to allocate millions to dismantling public schools and replacing them with charter schools, particularly for poor and racialized kids, with disastrous results:
>
> https://pluralistic.net/2026/03/09/autocrats-of-trade-2/#witness-the-firepower-of-this-fully-armed-and-operational-battle-station
>
> And of course, Gates supported and empowered Jeffrey Epstein and his rape island:
>
> https://en.wikipedia.org/wiki/Bill_Gates#Connection_with_Jeffrey_Epstein
>
> 17/
>
> ---
>
> Capital's tendency to accumulate in the hands of the already wealthy (r > g) means that these aristocrats end up setting an ever-larger proportion of our societal agenda, despite their manifest unfitness to govern and their absence of any kind of democratic legitimacy.
>
> 18/
>
> ---
>
> Piketty argues that inequality is inherently politically destabilizing. A society ruled over fools and monsters who were not voted into power and can't be voted out of power is a doomed society. Eventually - the French Revolution, the World Wars - these societies grow so unstable that they collapse altogether.
>
> 19/
>
> ---
>
> This is where Piketty and Snowden converge. When the Snowden leaks broke, there was a lot of talk about the *mechanics* and the *legality* of the NSA's global digital surveillance, but precious little consideration was given to the *reason* for all this surveillance. In 2013, the idea that this spying was about "security" was so obvious as to be self-evident. 
>
> 20/
>
> ---
>
> The questions at the time were whether spying could *produce* security. We weren't asking why things were so *insecure*.
>
> In retrospect, the answer is to be found in Piketty. Piketty's *Capital* includes a long, impassioned plea to both lawmakers and aristocrats to consider redistributive policies (like a wealth tax) as the most affordable way to achieve political stability. 
>
> 21/
>
> ---
>
> Fundamentally, Piketty argues that the cheapest way to stop people from building a guillotine on your lawn is to build hospitals and schools; this is cheaper than paying for guards and prisons to lock up would-be guillotine builders.
>
> Today's AI debates swirl around the question of whether AI can *truly* make us more productive - that is, if chatbots will allow one person to do the work of two, or three, or four - or 100. 
>
> 22/
>
> ---
>
> But when it comes to surveillance, the digital revolution unquestionably yielded a *massive* productivity dividend.
>
> Consider the spying apparatus of the former East Germany ("GDR") widely considered the most surveilled society in human history. When the Berlin Wall collapsed, there were about 16m people in the country. Of those East Germans, about 90,000 worked directly for the Stasi (the secret police), aided by another 100-200,000 paid informants:
>
> https://www.dw.com/en/east-germany-spy-agency-stasi-surveillance/
>
> 23/
>
> ---
>
> Call it 200,000 people to spy on 16m. In other words, it took one spy to watch 80 of their neighbors. Contrast this with NSA spying: they accumulated detailed surveillance dossiers on about 6 billion internet users using a staff of no more than 5 million spooks (in 2013, about 5 million Americans were eligible for security clearance). 
>
> 24/
>
> ---
>
> If *every single person with security clearance in the USA* was working on the NSA's surveillance program, that would mean that by 2013, computers had made it possible for a spy to keep tabs on *more than a thousand people*.
>
> Orders of magnitude improvements in a mere generation! This is the kind of productivity lift that economists dream of when they fantasize about the dividends from automation.
>
> But *why*? Why spy?
>
> 25/
>
> ---
>
> East Germany spied on its people because the system was so unjust and cruel that its beneficiaries understood that their neighbors forever on the brink of rising up against them. East Germany's leaders were right about that - but if anything, they didn't put *enough* people onto the spying project. We can tell, because the Berlin Wall fell in 1989!
>
> 26/
>
> ---
>
> Of course, the GDR was *already* paying *more than 1.2% of its population* to spy on everyone else. It's likely that East Germany's leaders believed that their society simply lacked the fiscal space to hire more spies, even if short-staffing the Stasi risked societal collapse. Now, if Piketty is right, East Germany's leaders *could* have solved this problem by giving people *fewer reasons* to want to overthrow the state. 
>
> 27/
>
> ---
>
> They could have taken their hands out of the cookie jar, could have instituted democratic reforms - they could have made a bid for democratic legitimacy and public material comfort. But that would have come at the leaders' own power and wealth, and, lacking the stomach for this sacrifice, they lost *everything*.
>
> 28/
>
> ---
>
> Enter the NSA: the digitization of human civilization has *drastically* reduced the cost of surveillance, and - again, per Piketty - this *vastly* increases the amount of inequality the world can sustain before the illegitimacy, incompetence and cruelty of rule by the neoaristocratic winners of the orifice lottery brings the whole thing crashing down.
>
> 29/
>
> ---
>
> The Trump years are proof of this. We've reached a high-water mark for rule by illegitimate billionaire dilettantes. The second Trump admin began with DOGE's Bonfire of the Stupidities, where Musk cultists dismantled vast swathes of the American administrative state. 
>
> 30/
>
> ---
>
> Musk didn't just attack foreign aid - though the fact that the world's richest man murdered hundreds of thousands of the world's poorest children for the lulz isn't merely cruel, but also massively destabilizing in a way that will shake the world's politics for generations - but also domestic institutions. It was a DOGE cultist who fed the part of the NIH that tracks cyclosporin outbreaks into the wood-chipper:
>
> https://truthout.org/articles/disease-researchers-blame-doge-cuts-for-spiraling-cyclospora-outbreak/
>
> 31/
>
> ---
>
> Today, tens of thousands of Americans are experiencing the literal enshittification of the American state, and this isn't just a human tragedy (though it is), it's also an economic tragedy, with massive knock-on effects for the businesses that rely on those sickened Americans and for the agricultural sector whose outputs are now being shunned by millions. 
>
> 32/
>
> ---
>
> Whether it's letting Bill Gates decide how your schools will work or letting Elon Musk decide how your public health system runs, the result is political chaos and a societal nudge away from the rule of law and towards guillotines.
>
> Which brings me back to Snowden. The Snowden revelations *did* spur a global conversation about digital surveillance, with the result that the majority of the world's digital traffic is encrypted today. That's not nothing.
>
> 33/
>
> ---
>
> But the American state found new ways to conduct mass-scale, global surveillance, often by collaborating directly with tech giants. Billionaires like Peter Thiel capitalized on Big Tech's conflicted feelings about openly participating in surveillance by founding Palantir, with the express mission of murdering the political opponents of oligarchy:
>
> https://www.thecanary.co/trending/2026/01/07/palantir-kill-communists/
>
> 34/
>
> ---
>
> Over the past decade, the steady march of digital technology, dominated by a cartel of giant global firms who collude with the US government's system of political repression in exchange for tax breaks, antitrust forbearance and fat federal contracts has yielded more mass surveillance productivity gains than the previous 25 years:
>
> https://apnews.com/article/trump-inauguration-tech-billionaires-zuckerberg-musk-wealth-0896bfc3f50d941d62cebc3074267ecd
>
> 35/
>
> ---
>
> The Trump administration is the most unpopular in more than a century. Trump has stolen more money in office than any president in history. Trump presides over spiraling greedflation and collapsing buying power. The Trump administration has also presided over a *titanic* increase in state-aligned, privatized surveillance. The Trump years are the Flock years:
>
> https://newrepublic.com/article/206992/flock-safety-cameras-alpr-deflock-resistance-nationwide
>
> 36/
>
> ---
>
> The Trump years are Palantir years:
>
> https://www.nytimes.com/2025/05/30/technology/trump-palantir-data-americans.html
>
> The Trump years are facial recognition years:
>
> https://www.aclu.org/news/privacy-technology/ice-face-recognition
>
> Trump's authoritarianism is a function of his misrule, and his misrule is enabled by authoritarianism. The more he steals, the more he wages wars of choice, and incoherent tariff policies, and official pronouncements linking autism and vaccinations, the more he needs spy cameras, internet surveillance, vehicle tracking, and facial recognition.
>
> 37/
>
> ---
>
> Every time Trump talks about a third term in office, or canceling elections, or suppressing the vote, he creates demand for mass surveillance to catch and imprison the people this drives into the streets. The more mass surveillance there is, the safer it is for him to commit unpopular, corrupt acts. It's the world's worst self-licking ice-cream cone.
>
> 38/
>
> ---
>
> It's not just Trump, of course. Trump is the vanguard of a movement of orifice lottery winners whose delight in stealing, cheating, maiming and despoiling gives rise to political instability and requires them to divert some of their yacht money to mercenaries:
>
> https://theintercept.com/2026/06/25/police-luigi-mangione-wealthy-ceos-threat/
>
> Take AI: the Trump years are also the AI years. This is the time in which a wildly unpopular technology is being shoved into every part of every app we rely on:
>
> https://pluralistic.net/2025/05/02/kpis-off/#principal-agentic-ai-problem
>
> 39/
>
> ---
>
> It's an era where corporate bosses can't stop gloating about how many jobs they're planning to destroy and how many paycuts they plan on imposing on the surviving workers:
>
> https://www.axios.com/2025/05/28/ai-jobs-white-collar-unemployment-anthropic
>
> AI can't do your job, but an AI salesman can reliably convince your boss to fire you and replace you with an AI that *can't* do your job:
>
> https://pluralistic.net/2025/03/18/asbestos-in-the-walls/#government-by-spicy-autocomplete
>
> 40/
>
> ---
>
> And - most visibly - it's an era in which people's cities and towns are being despoiled by data centers they don't want, by local governments operating in the most extreme secrecy, who silence and even arrest citizens who demand a democratically legitimate process for deciding whether they will have to give up their power and water and land and peace:
>
> https://www.404media.co/city-that-arrested-person-for-clapping-at-data-center-meeting-moves-to-virtual-townhalls-for-public-safety/
>
> 41/
>
> ---
>
> An economist would tell you that there's an equilibrium being sought here: between the cost of bribing a town council to ram through data center approvals, the cost of building a more modest and palatable data center, and the cost of mollifying public critics. The cost of bribing towns to foist a data center on the townsfolk is low, because there are *lots* of towns that fit the bill, so data center barons can shop around.
>
> 42/
>
> ---
>
> But as data center protests grow larger and better organized (oligarchy is destabilizing), the cost of dealing with public opposition is mounting. Which is why the Trump administration is teaming up with its preferred tech and military contractors to engage in detailed surveillance of data center and AI critics:
>
> https://prospect.org/2026/08/10/private-intelligence-firms-selling-dossiers-on-ai-data-center-critics/
>
> 43/
>
> ---
>
> These corporate spooks aren't just spying on data center critics: they've got a whole portfolio of oligarchy-stabilizing surveillance services, targeting "antifa," immigrants' rights and anti-ICE groups.
>
> They're joined by hardware vendors who offer corporations, the wealthy, and enclaves where both are to be found on *literal* robocops, the ultimate in cheap guard labor (alas, the robots suck):
>
> https://www.404media.co/the-roboguard-revolution-is-short-circuiting/
>
> 44/
>
> ---
>
> Trump and his orifice-winning army are caught in the same trap as the leaders of the GDR. Every gain in guard-labor efficiency creates the space for more of them to stick more of their hands even further into the cookie jar. Every time they do, American society grows more unstable, demanding more guard labor.
>
> 45/
>
> ---
>
> As we saw in Minneapolis, guard labor - be it mass surveillance, robocops or ICE chuds - is *itself destabilizing*. Police states make the people who live in them want to overthrow the state, requiring yet more cops, creating more partisans for tearing the whole thing down.
>
> 46/
>
> ---
>
> In theory, the orifice class could decide to stop stealing, cheating and maiming. The problem is that for every plute who realizes that the cheapest way to keep the guillotines off his lawn is to play fair, there are three more who lack the executive function to stop cheating. That means that you might as well keep on cheating, since the instability - and the guard labor bills - are coming no matter what.
>
> 47/
>
> ---
>
> In the tale of the "Tragedy of the Commons," a common pasture is grazed to dust by shepherds who each understand that if they don't graze their flock until everything is gone, some *other* shepherd will do so. The original "Tragedy of the Commons" paper was a racist hoax perpetrated by an academic fraud who wanted to make the case for the expulsion of black and Brown people from America and their mass extermination abroad:
>
> https://memex.craphound.com/2019/10/01/the-tragedy-of-the-commons-how-ecofascism-was-smuggled-into-mainstream-thought/
>
> 48/
>
> ---
>
> In reality, commons need not be tragic and many of our most important resources have been managed as commons for hundreds of years:
>
> https://archive.org/details/governing-the-commons/page/4/mode/2up
>
> But when it comes to the commons that is "a stable society," the orifice class is caught in an inescapable tragedy, certain of the knowledge that if they don't cheat us, the next American aristo will. Thus the demand for guard labor continues to mount...as does the demand for guillotines.
>
> eof/

### 5. AI is alarming for many reasons (2026-08-20) [link](https://mamot.fr/@pluralistic/117130483897538524)
**Metrics:** 55 boosts, 52 favourites, 5 replies (thread of 22 posts)
**Opening hook (verbatim):**
> AI is alarming for many reasons: it's a dangerous financial bubble, an environmental catastrophe, and a tool for eroding wages and labor power. But in addition to all that, AI is an epistemic disaster.

**Structure:** Essay-thread (22 posts), thesis-first, building outward through a chain of analogies to a closing argument.
**Framing:** Analogy framing: opens with a named Putin-era propaganda tactic (Vladislav Surkov funding fake opposition groups) as a lens for how AI-era deepfakes destroy shared truth, then extends to regulatory-capture examples (FDA, banks).
**Full text (verbatim):**
> AI is alarming for many reasons: it's a dangerous financial bubble, an environmental catastrophe, and a tool for eroding wages and labor power. But in addition to all that, AI is an epistemic disaster.
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/20/epistemic-void/#expert-agencies
>
> 1/
>
> ---
>
> We've had photoshopped images, voice impersonators and visual effects for years, of course, but with deepfakes, we've democratized access to reality-bending images, sounds and videos that appear real but are *not*. It's harder than ever to know what's true. Politicians and celebrities and activists show up in our feeds, declaring their fealty to this cause or product, or their fury at some turn in the world's events.
>
> 2/
>
> ---
>
> Battlefields mound high with bodies and influencers marvel at impossible, sumptuous meals. It all *seems* plausible, and some of it is real, but not all of it, and because we know some of it is fake, we can't be sure if any of it isn't.
>
> 3/
>
> ---
>
> It's a very putinesque way of living. Vladislav Surkov was Vladimir Putin's media strategist, and he had a deadly effective tactic: he announced that he was covertly funding *some* of the groups that publicly opposed Putin, but did not disclose which of those opposition groups were fake. That meant that *any* of the groups could be fake, which meant that any discussion of the opposition was liable to devolve into an argument about its authenticity. 
>
> 4/
>
> ---
>
> Anything could be a lie, so nothing was necessarily true. Putin's method isn't to get you to believe a lie - it's to keep you from believing that *anything* is true.
>
> That's life under AI - a world of uncertainty, an epistemological void full of plausible phantasms, some of which are actually real. A world where it's impossible to know what's true, and where anything might be fake.
>
> 5/
>
> ---
>
> But here's the thing: AI's assault on our ability to know isn't a new battle - rather, it's the latest barrage in a war that's been waged for years, as corporations grew larger and more powerful, capturing their regulators, who let them lie to us and abuse us with impunity.
>
> This complicated, technical world - the world that produced AI - is full of complicated, technical questions, and none of us can answer these questions for ourselves.
>
> 6/
>
> ---
>
> You're not stupid, but even a generational genius could not acquire the expertise to answer the long list of life-or-death questions we face every day.
>
> Are the food hygiene standards followed by your grocer or lunchtime spot adequate, or will your dinner make you shit yourself to death? Are the building codes that specify the alloys in the steel joists that hold up the roof over your head sufficient, or are you about to be crushed to death? 
>
> 7/
>
> ---
>
> Is the software in your anti-lock brakes any good, or will you die in a fireball on the way to work?
>
> From food additives to pedagogy, psychotherapeutic techniques to retirement savings, it would take a hundred lifetimes for you to acquire the 200 PhDs needed to answer these questions for yourself.
>
> 8/
>
> ---
>
> Thankfully, we don't have to answer those questions for ourselves. Instead, we defer to expert agencies: governmental regulators that assess truth claims by soliciting input from all comers, publicly deliberating about the evidence they've gathered, and then making a rule in public. These regulators are meant to be experts, nonpartisan and neutral, operating with the highest degree of probity, recusing themselves in the event of even a whiff of conflict.
>
> 9/
>
> ---
>
> It has to be that way. You may not be able to assess claims about the safety of vaccines - or opioids - but you can see for yourself whether the FDA is full of ex-pharma execs. You can see for yourself whether pharma company lobbyists all used to work for the FDA. You don't need to be a virologist or a cell biologist to tell whether the system that's supposed to sort truth from lies is fit for purpose.
>
> 10/
>
> ---
>
> It is *not* fit for purpose. When arguments broke out over covid vaccines, many vaccine advocates characterized their opponents as foolish people engaged in foolish conspiratorialism. They argued that the corporations that produced the vaccines and the regulators who oversee them were intrinsically trustworthy, and on that basis, we should all get vaccinated.
>
> 11/
>
> ---
>
> Now, I happen to be a big believer in vaccination. I've had so many covid jabs that I glow in the dark and get five bars of 5G in a coal-mine. But I didn't get vaccinated because I trust pharma companies or their regulators. A string of scandals - most notably the Sacklers' Oxycontin murder-spree - has proven that pharma will kill you for a nickel and that the FDA will let them get away with it:
>
> https://pluralistic.net/2024/03/25/black-boxes/#when-you-know-you-know
>
> 12/
>
> ---
>
> From tobacco safety to food safety to the climate emergency, it's obvious that the system of expert agencies that we rely on was terminally compromised by corporate power and regulatory capture:
>
> https://pluralistic.net/2022/06/05/regulatory-capture/
>
> This is the epistemological void we were already adrift in *before* AI came along: a world of unresolvable, urgent, terrifyingly high-stakes questions.
>
> 13/
>
> ---
>
> When you get a call from "your bank" and accede to the demand that you hand over all kinds of personal information before they will disclose the call's purpose, you're not being naive or foolish - you're doing the thing that our banks have conditioned us to do for years by engaging in *exactly this behavior* (my bank did this to me *this week*!). 
>
> 14/
>
> ---
>
> Why are banks allowed to get away with engaging in this kind of outrageous conduct? Because - as we've repeatedly discovered through crisis after crisis - banks are too big to fail, too big to jail, and too big to care.
>
> 15/
>
> ---
>
> Why is it so believable that a loved one might call you in a panic because they've been arrested or injured and need an immediate cash payment before they can get bail or doctor's treatment? Because our criminal justice system and our health care system are *already* plagued by this kind of inhumane, high-handed, extortionate behavior.
>
> 16/
>
> ---
>
> Why do you fall for a deepfake of celeb shilling for supplements or a shitcoin? Maybe it's because celebs *actually* shill for supplements and shitcoins, and face no consequences for helping rope us all into scams:
>
> https://gizmodo.com/matt-damon-crypto-com-crypto-bitcoin-1850282413
>
> Not just celebs - also our newspapers:
>
> https://www.nytimes.com/interactive/2022/03/18/technology/cryptocurrency-crypto-guide.html
>
> 17/
>
> ---
>
> We laugh when other people fall for newspaper articles making absurd claims - but after living through a time in which our most respected journalistic outlets credulously helped a dishonest government lie the world into a war that's still smoldering more than a generation later, who can be sure when to trust the papers?
>
> https://www.nytimes.com/2004/05/26/world/from-the-editors-the-times-and-iraq.html
>
> 18/
>
> ---
>
> One of the reasons it is so hard to agree on covid's death-toll is that so many of the people who died of covid were already compromised by chronic illnesses or "pre-existing conditions" from cancer to heart disease. Those people *did* die of covid - *and* they died of cancer or heart disease or some other comorbidity. Covid was an opportunistic infection that inflicted disproportionate harms on people who were already suffering.
>
> 19/
>
> ---
>
> The epistemic void created by AI is another opportunistic infection. Our ability to know things has been in decline for generations, as monopolies shredded our truth-assessment systems, rendering us all incapable of knowing the truth in a world where believing lies could bankrupt you or kill you dead.
>
> 20/
>
> ---
>
> *If* you could trust your government's expert agencies and *if* they had reliable systems for making their findings known; *if* your bank was banned from engaging in conduct indistinguishable from phishing; *if* the health-care and criminal justice systems *never* forced the people they ensnared to call their relatives and beg for money, then deepfakes would have a much harder time penetrating our cognitive immune systems.
>
> 21/
>
> ---
>
> It's not so much that AI is a powerful way of lying - rather, we have been made progressively more vulnerable to lies for decades, leaving us at an epistemic death's door, and AI has arrived to deliver the coup de grace.
>
> eof/

### 6. With 'surveillance pricing,' businesses have finally found something AI can do way better than people (2026-07-30) [link](https://mamot.fr/@pluralistic/117009020284446712)
**Metrics:** 60 boosts, 47 favourites, 3 replies (thread of 25 posts)
**Opening hook (verbatim):**
> With "surveillance pricing," businesses have finally found something AI can do way, way, *way* better than people: price gouging.

**Structure:** Essay-thread (25 posts): mechanism explainer (how AI-driven price discrimination works) followed by a real-world legislative case study (California's AB-2564) and an EFF rebuttal letter.
**Framing:** Explainer-then-advocacy framing: defines a practice, gives concrete examples (Instacart markups, Delta's scrapped plan), then turns into a call to action for a specific bill.
**Full text (verbatim):**
> With "surveillance pricing," businesses have finally found something AI can do way, way, *way* better than people: price gouging.
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/07/30/pay-for-privacy/#ab2654
>
> 1/
>
> ---
>
> As the name suggests, "surveillance pricing" is the practice of charging every customer a different price for every transaction, based on the massive surveillance dossiers that Big Tech companies and data-brokers have assembled on everyone in the world. Congress hasn't updated federal consumer privacy law since 1988 (when they passed a law banning the disclosure of VHS rentals), so pretty much any form of consumer surveillance is fair game.
>
> 2/
>
> ---
>
> This is where AI comes in. One thing AI is indisputably great for is multivariate statistical analysis. You can feed an AI "behavioral data" (information about where you go, what you do, what you buy, who you talk to and what you say) about all of your customers and ask it to cluster them according to their shared traits. Then you can direct the AI to automatically run a series of small experiments to discover the maximum markup each group will stomach under which circumstances.
>
> 4/
>
> ---
>
> This works without directing the AI to rip off certain groups - it will simply find the most vulnerable people and rip them off the most. If you're hiring in an industry that practices a lot of tacit racial discrimination, a system like this can figure out on its own that people of color typically accept lower wages because there are fewer employers bidding for their labor, and recommend lowball salary offers, all without you ever typing "please be racist" into your AI prompt.
>
> 4/
>
> ---
>
> This works so well that Google has announced that it is their plan for making a profit off of AI, after losing hundreds of billions of dollars on chatbots:
>
> https://pluralistic.net/2026/01/21/cod-marxism/#wannamaker-slain
>
> In the before times, marketers and demographers had to dream up demographic categories based on limited data and run focus groups to figure out how to maximize revenue from each market segment. 
>
> 5/
>
> ---
>
> Now an AI can segment the data to any degree you choose, and continuously, automatically experiment on each segment to find their weak spots.
>
> It's "theory-free." You don't have to discover *why* a group is willing to pay more under a given set of circumstances, you merely have to observe and weaponize this fact. 
>
> 6/
>
> ---
>
> You don't have to know why one group of purchasers consistently accept higher prices between 6AM and 8AM - you can just automatically jack up prices on them without knowing or caring that you're gouging parents of young children who are re-ordering essential supplies while trying to get their kids to school in the morning.
>
> 7/
>
> ---
>
> I thought up that example. I don't know if it's really happening. But here's something that really *is* happening: ecommerce sites charge parents of newborns extra when they order thermometers in the middle of the night. I'm not saying anyone ever sat down and said, "Parents with sick children will pay whatever we charge for a thermometer at 2AM." They didn't have to: this is the kind of thing an automated system can do without any human intervention:
>
> https://www.ftc.gov/system/files/ftc_gov/pdf/p246202_surveillancepricing6bstudy_researchsummaries_redacted.pdf
>
> 8/
>
> ---
>
> The goal of surveillance pricing is to shift all the "consumer surplus" (the difference between the highest price you're willing to pay and the price you actually pay) to companies. It's a form of cod-Marxism where you are gouged according to your ability (to pay) and charged according to the desperation of your need:
>
> https://pluralistic.net/2025/01/11/socialism-for-the-wealthy/#rugged-individualism-for-the-poor
>
> 9/
>
> ---
>
> The problems of surveillance pricing are well documented. Under Biden, the FTC did a landmark study on the practice, developing a rich record that documents the role surveillance pricing plays in the affordability crisis:
>
> https://pluralistic.net/2024/07/24/gouging-the-all-seeing-eye/#i-spy
>
> Companies are already using this technology to rip you off, and they're *slavering* for the chance to do more of it. Instacart was recently caught marking up some shoppers' items by as much as a *third*:
>
> https://pluralistic.net/2025/12/11/nothing-personal/#instacartography
>
> 10/
>
> ---
>
> The problem is that as much as companies love this, shoppers *hate* it. Last summer, Delta announced that it was going to surveillance price every seat on every flight, only to face such a massive backlash that they had to make another announcement bemoaning the fact that we'd all misunderstood their (unambiguous and extremely damning) announcement and they were actually going to do no such thing:
>
> https://pluralistic.net/2025/07/30/efficiency-washing/#medallion-clubbed
>
> 11/
>
> ---
>
> One thing Mamdani's campaign impressed on every politician is that people are *pissed* about affordability and they will support anyone who stands up for the public against AI-equipped price gougers. The problem of course is that those price gougers are highly organized and have deep treasuries (stuffed with money they stole from us). With surveillance pricing, politicians face a familiar conundrum: if they do the thing that's popular with voters, they'll enrage donors.
>
> 12/
>
> ---
>
> One way to cut this knot is to enact legislation that *seems* to address the problem, but stuff it with so many loopholes that it does nothing. This lets you declare yourself the people's champion without doing anything to protect them from the donors who prey on your voters. That's the approach they took in Maryland:
>
> https://pluralistic.net/2026/04/30/something-must-be-done/#there-ive-done-something
>
> 13/
>
> ---
>
> But in California, they're actually *doing something* about surveillance pricing. AB-2564 is a smart, well-written bill that bans surveillance pricing. It contains an easily evaluated test for surveillance pricing and carves out legitimate reasons for offering different prices for the same purchase (for example, when it costs more to deliver the product or service):
>
> https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB2564
>
> 14/
>
> ---
>
> Now we're in for the hard yards of turning this bill into a law. That's where California's cities come in. When municipal governments pass resolutions supporting a state bill, it makes it much easier to get that bill through the state legislature (and conversely, without support from major cities, it's that much easier to kill the bill before it becomes law).
>
> 15/
>
> ---
>
> A few days ago, the San Francisco Board of Supervisors was on the verge of passing a resolution in support of AB-2564. Now, that vote is stalled, thanks to a letter sent by the San Francisco Chamber of Commerce, an organization that has been pissing in San Franciscans' faces and telling them it was raining since 1850:
>
> https://www.sfexaminer.com/news/community/board-not-yet-ready-to-weigh-in-on-state-surveillance-pricing-ban/article_0ae4d143-cced-4988-abda-0b71bcbe524c.html
>
> 16/
>
> ---
>
> The Chamber's letter is - to use a technical term - *flaming garbage*. It raises the most spurious objections imaginable, claims about the bill's language that are belied by its plain, easily understood text. These objections are demolished in a letter the Electronic Frontier Foundation sent to the Supervisors:
>
> https://www.eff.org/document/letter-sf-bos-re-surveillance
>
> 17/
>
> ---
>
> In the letter, EFF explains that claims that surveillance pricing will *lower* prices are overblown and not borne out by evidence. But more importantly - as EFF points out - privacy is a human right, and the idea that you should have to give up your privacy to get a fair price is just a fancy way of saying that privacy should be the exclusive preserve of people who can afford to pay more:
>
> https://www.eff.org/wp/privacy-first-better-way-address-online-harms#Legislation
>
> 18/
>
> ---
>
> EFF's letter goes on to address the Chamber's objections. Far from creating uncertainty about which conduct the bill addresses, AB-2564 crisply defines surveillance pricing as:
>
> > a customized price for a good for a specific consumer or group of consumers based, in whole or in part, on personally identifiable information collected through electronic surveillance.
>
> 19/
>
> ---
>
> The Chamber raises other tired objections, falsely claiming that banning surveillance pricing will end common discounting strategies like offering seniors cheaper movie tickets, or giving cheaper rates to retain customers who call to cancel their service. 
>
> 20/
>
> ---
>
> EFF replies by pointing out that all the Chamber's concerns are covered by the three comprehensive carve-outs in the bill: the ability to charge higher rates when it costs more to service a given customer; offering discounts to retain customers who want to cancel their service; and finally, discounts for criteria anyone can meet (like an "early bird special"), for membership in a broadly defined group (like "seniors"), or for participation in a loyalty program.
>
> 21/
>
> ---
>
> The San Francisco Supervisors could have figured out at a glance that the Chamber was bullshitting them. All it takes is a cursory read of the statute. But now they don't even have to do that: EFF has painstakingly debullshittified the Chamber's FUD.
>
> 22/
>
> ---
>
> Surveillance pricing is grossly offensive. When a company charges me $0.50 for a product that it charges you $1 for, they're essentially saying that your dollars are worth half as much as mine are. Companies shouldn't be able to reach into your wallet or your bank account and chop your money in half:
>
> https://pluralistic.net/2025/06/24/price-discrimination/#
>
> 23/
>
> ---
>
> No wonder AB-2564 has plenty of backers, from EFF to Consumers Union:
>
> https://advocacy.consumerreports.org/press_release/california-state-assembly-passes-key-bill-to-prohibit-surveillance-pricing/
>
> San Francisco's city government should be on that list of supporters.
>
> 24/
>
> ---
>
> Image:
> Takkk (modified)
> https://commons.wikimedia.org/wiki/File:Hungarian_Antique_three-column_full-keyboard_cash_register_1902.jpg
>
> CC BY-SA 3.0
> https://creativecommons.org/licenses/by-sa/3.0/deed.en
>
> eof/

### 7. Forget 'Don't be evil'; Google's true motto is a form of vulgar spidermanism (2026-08-05) [link](https://mamot.fr/@pluralistic/117042522377325981)
**Metrics:** 62 boosts, 42 favourites, 2 replies (thread of 34 posts)
**Opening hook (verbatim):**
> Forget "Don't be evil"; Google's true motto is a form of vulgar spidermanism: "With great power comes no responsibility." The internet's *de facto* boss is an absentee landlord.

**Structure:** Essay-thread (34 posts), single-company indictment built from a catalogue of concrete scam examples (fake airline numbers, cloned restaurant sites, hotel-booking fraud).
**Framing:** Extended metaphor ('absentee landlord') plus a borrowed concept (Tim Wu's 'Main Character Syndrome') used to explain why a monopoly intermediary stops policing fraud on its own platform.
**Full text (verbatim):**
> Forget "Don't be evil"; Google's true motto is a form of vulgar spidermanism: "With great power comes no responsibility." The internet's *de facto* boss is an absentee landlord.
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/05/absentee-landlord/#main-character-syndrome
>
> 1/
>
> ---
>
> Google - a thrice-convicted monopolist - is the gateway to the internet, with more than a 90% search market share that it attained by buying out all its competitors and bribing Apple more than $20b/year not to start a rival search engine:
>
> https://www.democracynow.org/2024/8/6/google_monopoly
>
> Google likes to position itself as a wise steward of the internet. They say they use their vast troves of data about the internet and its users to connect the right person with the right information at the right moment.
>
> 2
>
> ---
>
> As their mission statement has it, "organize the world's information and make it universally accessible and useful":
>
> https://www.google.com/intl/en_us/search/howsearchworks/our-approach/
>
> The tacit argument is, "Sure, we repeatedly violated antitrust law in order to monopolize the internet, but the internet *needs* a monopolist. It's scary out there! We have amassed power so that we can protect and guide *you*."
>
> 3/
>
> ---
>
> It's a bullshit argument and no one should accept it - but even if you think it's worth harnessing monopoly power to promote a wise king to rule over the internet, you'd still want Google to take that responsibility seriously. If we're to have a landlord for our civilization's digital nervous system, let's not have it be an *absentee* landlord.
>
> 4/
>
> ---
>
> Google is an absentee landlord. In 2019, they chose to *deliberately worsen* search results in order to make you search repeatedly to find the information you're seeking, because every fresh query lets them serve fresh advertisements:
>
> https://pluralistic.net/2025/05/26/babyish-radical-extremists/#cancon
>
> Not all of Google's enshittification can be attributed to deliberate sabotage. Much of it is the result of neglect. 
>
> 5/
>
> ---
>
> Ask Google for a product review and they'll pass over the most rigorous, honest websites on the internet in favor of affiliate scammers who repackage Amazon best-of lists to peddle overpriced, underperforming junk that's sometimes so bad it's *dangerous*:
>
> https://pluralistic.net/2024/02/21/im-feeling-unlucky/#not-up-to-the-task
>
> Google keeps announcing that it Takes This Problem Very Seriously - and then nothing happens:
>
> https://pluralistic.net/2024/05/03/keyword-swarming/#site-reputation-abuse
>
> 6/
>
> ---
>
> And of course, Google AI search results present the company with a highly refined and confident-sounding way to launder spam into product recommendations:
>
> https://pluralistic.net/2025/07/15/inhuman-gigapede/#coprophagic-ai
>
> Could Google do better? Provably so. Kagi, a small company that runs a search engine powered by Google's own search index consistently delivers results that are substantially superior to Google's - using Google's own infrastructure:
>
> https://pluralistic.net/2024/04/04/teach-me-how-to-shruggie/#kagi
>
> 7/
>
> ---
>
> If Kagi (a startup with a handful of engineers) can extract useful search results from Google's databases, then Google - a thrice-convicted monopolist that's had its pick of *thousands* of the top computer scientists from the world's most prestigious universities for a generation - could also do so.
>
> They just choose not to.
>
> They're too big to fail. They're too big to jail. They're too big to care.
>
> 8/
>
> ---
>
> Google's AI search isn't a way to fix its broken core product: it's a way to partially remediate the damage Google itself inflicted on the open internet, while imprisoning the web in a walled garden that would make Steve Jobs drool:
>
> https://pluralistic.net/2026/06/29/arsonist-firefighters/#im-feeling-lucky
>
> It's a deadly combination: Google has committed hundreds of billions to stock buybacks and its AI money-furnace, financed by mass layoffs targeting the people who keep the core services useful.
>
> 9/
>
> ---
>
> The too-big-to-care company is still the internet's gatekeeper, but half the guards at the gate have been fired and the other half have pulled so much overtime that they keep falling asleep on the job.
>
> Google has become a scammer's paradise.
>
> Take Google's "answer box." This is the part of the search results page that tries to answer your query directly, without sending you elsewhere for that info. 
>
> 10/
>
> ---
>
> Back in 2023, Google's Answer Box was taken over by scammers who impersonated airline help desks. When Google's users searched for airlines' toll-free phone numbers, Google directed them to phones that rang in the scammers' boiler room, where they were tricked into giving up their passport info and credit card numbers to boiler-room thieves:
>
> https://www.nbcnews.com/tech/tech-news/phone-numbers-airlines-listed-google-directed-scammers-rcna94766
>
> 11/
>
> ---
>
> (This was an especially devastating attack because the airlines themselves hide their customer service phone numbers - as enshittified monopolists, they want your money, not your complaints - so it's normal to search Google for the number you're seeking, rather than scouring the airlines' deliberately confusing customer service sites.)
>
> 12/
>
> ---
>
> This is especially galling because Google has an extensive "verified merchant" program that goes to enormous lengths to establish the true identity of every merchant whose businesses are listed on Google, in maps, ads and search results. Google "knows" which URLs belong to the airlines. 
>
> 13/
>
> ---
>
> If it can be tricked into scraping a different website for the airlines' phone numbers, that's because Google couldn't be bothered to connect its own database of canonical airline URLs to the process that serves phone numbers to the 90% of the web-using public who search with Google.
>
> 14/
>
> ---
>
> Google's database of the canonical URLs for businesses doesn't stop at airlines or even large businesses. Nearly every local merchant has undergone Google's verification process, which includes a step where Google physically mails a postcard with a unique number to the merchant's registered address, which the merchant must then key into Google to prove that they're located where they say they are.
>
> 15/
>
> ---
>
> Despite this, Google's ad-sales system will happily sell *anyone* the right to advertise a *different* website for queries for specific merchants, and those ads appear *above* the real result for the business's website.
>
> 16/
>
> ---
>
> To make this even worse, Google's spent years making it more difficult to distinguish ads from "organic" search results, changing the font and size of the "ad" warning to make it harder to spot, and making the font and color of the ad itself closer to the color of the search results below it.
>
> 17/
>
> ---
>
> This is a gift to fraudsters. I had my own run-in with it in 2023, when I was tricked by a Google ad into ordering dinner from my local Thai place using a scam site that had cloned the restaurant's menu. The scammers marked up the price by 15%, then passed the order on to the restaurant, pocketing the vig:
>
> https://pluralistic.net/2023/02/24/passive-income/#swiss-cheese-security
>
> 18/
>
> ---
>
> This scammer - based out of a UC Berkeley dorm-room - had copied *hundreds* of restaurant websites, then bought Google ads for the restaurants' names, ensuring that searchers would see the scam result *before* the real one. Remember: Google *knows* what the true URL is for every one of those restaurants but it sold the scammer ads for a different URL that appeared when people searched for the restaurant by name.
>
> 19/
>
> ---
>
> Google could trivially add a step to the ad sales pipeline that detects mismatches between a merchant's known URL and the URL in an ad bought against the merchant's name. It could automatically resolve these mismatches by sending an email to the merchant's verified email address that says, "Hey, are you buying an ad with a new URL? If so, just reply to this email."
>
> 20/
>
> ---
>
> I don't know why Google doesn't do this. Maybe they make huge sums from these scam ads and they don't want to forego the revenue. Or maybe they just don't care.
>
> Whichever it is, there's real consequences for this negligence by the internet's absentee landlord. Take abortions: fake abortion clinics - where pregnant women are bullied or tricked out of the abortions they're seeking - buy Google ads against the names of *real* abortion clinics. 
>
> 21/
>
> ---
>
> Google makes millions sending abortion-seekers to fake abortion providers:
>
> https://pluralistic.net/2023/06/15/paid-medical-disinformation/#crisis-pregnancy-centers
>
> Google started off as the ideal "intermediary" - the fancy economist's term for a "middleman." They took as their duty to figure out the best websites for you to look at based on your interests, serving as an honest broker between internet users and internet publishers. 
>
> 22/
>
> ---
>
> In the quarter-century since the company's founding, as it transformed itself into a monopolist, it developed the curse of every intermediary: it got Main Character Syndrome.
>
> This is Tim Wu's formulation: the reason for an intermediary existence is to serve the parties to the transaction. Ebay says it exists to connect buyers and sellers, Uber is supposed to connect drivers and riders, dating sites are supposed to connect people with their love-matches.
>
> 23/
>
> ---
>
> But intermediaries are cursed with an enviable position: by dint of sitting between these different groups of people, the intermediary learns everything about *both* sides of the transaction, while each side only knows about its own position.
>
> Amazon knows the price you're willing to pay, it knows who's set the lowest price, and it knows how many identical items that match your query are for sale. But the sellers don't know any of that, and you only know some of it. 
>
> 24/
>
> ---
>
> By capitalizing on the info (rather than efficiently matching buyers and sellers), Amazon can match you with sellers willing to pay the highest junk fees, not the ones who offer the best price for the best goods:
>
> https://pluralistic.net/2023/11/03/subprime-attention-rent-crisis/#euthanize-rentiers
>
> This is Wu's Main Character Syndrome in action. Once Amazon attains a dominant market share, it can maximize its own welfare at the expense of its buyers and sellers, transforming itself from a helper to a parasite:
>
> https://www.lawfaremedia.org/article/lawfare-daily--tim-wu-on--the-age-of-extraction
>
> 25/
>
> ---
>
> Google *says* it will "organize the world's information and make it universally accessible and useful," but every dime it spends on  fraud (a critical part of this mission!) is a dime it can't spend on buybacks, executive pay and AI servers. "Organize the world's info and make it universally accessible and useful" is the mission of a *good* intermediary; "do the absolute minimum to fight fraud" is the mission of a once good intermediary with terminal Main Character Syndrome.
>
> 26/
>
> ---
>
> Google keeps finding ways to expose its users to fraud while lining its own pockets. That restaurant markup scam that caught me in 2023? Three years later, it's *way* worse.
>
> San Francisco City Attorney David Chiu just filed suit against GuestReservations.com, BookOnline.com and Booking Holdings for running a *massive* version of the restaurant menu scam - one that extracted *millions* from people booking hotel rooms:
>
> https://www.kron4.com/news/bay-area/alleged-sf-hotel-booking-scam-had-up-to-85-markup-fees-city-attorney/
>
> 27/
>
> ---
>
> Here's how the scam worked: these companies put up websites with deceptive URLs, like *SanFranciscoMarriott.GuestReservations.com*, and then bought the associated Google ad-word ("San Francisco Marriott"). At the top of Google searches for "San Francisco Marriott booking" was the ad for SanFranciscoMarriott.GuestReservations.com. This site would sell you a room at the Marriott, at a markup of *35% to 85%*.
>
> 28/
>
> ---
>
> This is a pure ripoff. If Google had served the correct result at the top of the page - if it had used its own database of confirmed merchants and their associate websites to validate its ads - then people booking hotels would have saved 35% to 85% on their rooms.
>
> City Attorney Chiu says that the perps here registered domains for all kinds of hotels, even tiny ones in small towns, all over America. 
>
> 29/
>
> ---
>
> That means that it's not just visitors to San Francisco who got screwed by these creeps - it's also San Franciscans who booked hotel rooms around the country.
>
> Google bears the lion's share of the blame here, but Visa and the other credit card companies are critical to these scams. 
>
> 30/
>
> ---
>
> Card companies allow merchants to set terms of service that refuse refunds under almost any circumstances, and, more often than not, the card issuers side with the merchants over their own customers when they call to cancel a charge from one of these scammers.
>
> I discovered this for myself when I was tricked into buying theater tickets from a ripoff site that had registered the URL of the show I wanted to go to. 
>
> 31/
>
> ---
>
> I figured out that I'd been rooked within a minute of clicking the buy button, but it took months and multiple appeals - and ultimately a threat to cancel my credit card - to get Visa to refund me.
>
> Visa - another bloated monopolist with terminal Main Character Syndrome - can see that it has merchants who generate zillions of  appeals and charge-backs because they run scam businesses like these. 
>
> 32/
>
> ---
>
> They *could* treat these merchants as the fraudsters they are, but because the crooks wreathe themselves in gauzy excuses and lengthy terms of service, Visa enables these massive, nationwide cons.
>
> 33/
>
> ---
>
> Google, Visa and the other monopolists who serve as *de facto* regulators for our society have arrogated to themselves the power to observe every transaction and block the obvious scams. We pay for their failure to take minimal, obvious steps to protect us from the scammers who thrive on their platforms.
>
> Why should they? They're the main characters. They're Bizarro-world spidermen, whose great power confers no responsibility.
>
> eof/

### 8. Any frank assessment of your achievements starts with an equally frank assessment of the world-historic forces (2026-08-22) [link](https://mamot.fr/@pluralistic/117136533182049636)
**Metrics:** 48 boosts, 52 favourites, 5 replies (thread of 35 posts)
**Opening hook (verbatim):**
> Any frank assessment of your achievements starts with an equally frank assessment of the world-historic forces attending those achievements. For example, I often tell young people who want to get into tech, "If you don't have the foresight and work ethic to be born in 1971, I can't really help you."

**Structure:** Essay-thread (35 posts) opening with a personal/autobiographical anecdote (his own tech-industry origin story) before broadening into a general argument about historical contingency in tech.
**Framing:** Personal-anecdote-to-thesis framing: uses his own 'born on third base' career story and Kevin Kelly's 'adjacent possible' concept as a lens for explaining the AI boom's reliance on parallel-computing history rather than inherent merit.
**Full text (verbatim):**
> Any frank assessment of your achievements starts with an equally frank assessment of the world-historic forces attending those achievements. For example, I often tell young people who want to get into tech, "If you don't have the foresight and work ethic to be born in 1971, I can't really help you."
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/21/world-historic-forces/#multicore
>
> 1/
>
> ---
>
> When it comes to tech, being born in 1971 - to a computer scientist father, no less - conferred a tremendous advantage for my career chances. My dad - a refugee - came to Canada at a time when post-war public services meant that he could become the first person in his family to go to university, all the way to a doctorate.
>
> 2/
>
> ---
>
> That set me up for life in a house where tech and education were all around me. Both my parents are teachers, both from working class families where no one had ever gone beyond high school, who found themselves in a time and place where it was easier than at any time in history for people from backgrounds like theirs to attend university. 
>
> 3/
>
> ---
>
> I got to go to university, too, at a time when education was cheap enough that I could drop out of four schools before figuring out that it wasn't for me, and still be debt-free, largely thanks to income from a series of part-time jobs.
>
> When I dropped out of my final degree program, it was to take a job in tech at a time when anyone with a little creativity, work ethic, aptitude and curiosity could walk into a career. 
>
> 4/
>
> ---
>
> Millions of us did it, and I ended up working as a freelancer, then founding a startup, and then going to EFF. I know I work hard, I know I apply myself to understanding the world around me, but also...when it comes to this kind of career, I was born on third base.
>
> There's plenty of this to go around. Think of boomers who bought their "starter home" with the income from their first job and traded it in for a succession of larger, nicer homes, each of which skyrocketed in value.
>
> 5/
>
> ---
>
> Some of those people fancy themselves to be veritable Warren Buffets for having had the shrewd financial insight that buying a house and living in it was a good idea. The *truly* smart ones know that they just got lucky.
>
> There are world-historic forces all around us, creating moments and circumstances that contribute to the life-thriving of those of us who are lucky enough to be suited to the moment we find ourselves in.
>
> 6/
>
> ---
>
> Take computing: for decades, computing was ruled by Moore's Law, an unbroken run in which computers got faster and cheaper every year. If you were interested in the kinds of computing applications that were well-suited to serial computation - programs that worked best when run on a single computer - you were in luck. 
>
> 7/
>
> ---
>
> Even if your application or field of study was expensive and difficult to realize on today's computer, you could just stand still for a year or two and a much faster computer would park itself on your doorstep, ready to solve your problems.
>
> 8/
>
> ---
>
> When Moore's Law tapped out - when the pace at which transistors got smaller and computers got faster slowed and plateaued, and the expense of even modest performance gains climbed infinitywards - computing changed with it. Parallel computing - putting more cores on a chip, more chips on a board, more boards in a system - took off, as chipmakers and system builders switched from a focus on building their computers tall to building them *wide*.
>
> 9/
>
> ---
>
> As parallel computing took off, so did parallel applications. This is the beginning of the graphics revolution, as GPUs - components made up of many, many low-powered computers - became more central to academic research and commercial product roadmaps. But it wasn't just graphics that saw a huge lift here: any task that could be parallelized got easier and cheaper to perform every year, in a steady trend that has run to this day. 
>
> 10/
>
> ---
>
> This is the era of performance gaming, VR and AR, cryptocurrency, and, of course, AI.
>
> In *What Technology Wants*, Kevin Kelly introduces the idea of the "adjacent possible" through the example of the helicopter. Da Vinci sketched a "helicopter" - blades in the shape of maple keys attached to a kind of wine-press screw - in the 15th century. 
>
> 11/
>
> ---
>
> In the centuries that followed, many other people had the insight that twirling blades on a screw of some type could provide lift for some kind of heavier-than-air craft. But it wasn't until strong alloys, internal combustion engines and light, energy-dense refined hydrocarbon fuels came on the scene that the helicopter became possible, whereupon it was all but inevitable, with several people independently inventing the helicopter all at once:
>
> https://memex.craphound.com/2010/10/13/kevin-kellys-what-technology-wants-how-technology-changes-us-and-vice-versa/
>
> 12/
>
> ---
>
> In the same way, the computing industry's focus on parallel computing made life easier for people who burned to do something parallelizable. Then the achievements of the parallel computing partisans drove more investment in improvements to parallel computing hardware *and* theoretical work on how to parallelize other problems. 
>
> 13/
>
> ---
>
> This feedback loop raised the profile of parallel computing applications, attracting more bright and ambitious people to those applications, whose even more impressive accomplishments brought more people into the field, more capital into hardware development, and more resources to parallelization research.
>
> 14/
>
> ---
>
> The point being that world-historic forces, combined with accidents of history, shape the outcomes of individuals, companies and disciplines. It's much easier to be an accomplished graphics wizard in an era in which GPUs are doubling in power every year than it is in an era when linear computing is getting the lion's share of investment and improvement.
>
> 15/
>
> ---
>
> These forces and accidents have acted on AI in ways that profoundly shaped its development. The latest AI boom started when a group of machine learning researchers tried a minor variation on existing techniques and saw a *major* improvement in the outcomes. This is one of the most exciting kinds of breakthrough: if tweaking a single variable in a small way produces a large improvement, then it may be that further tweaking will produce even more improvements.
>
> 16/
>
> ---
>
> The minor variation that produced the major improvement in AI performance was *scale*. Prior to the "deep learning" era, AI research relied on a mix of hand-built models of reality and training data that computers fitted into those models. 
>
> 17/
>
> ---
>
> Deep learning swapped the painstaking work of describing reality in software for a brute-force approach: throw *lots* more training data at the system and then throw *lots* more (parallel) computing power at that data and let the computer figure it out without your having to explain how the world worked.
>
> 18/
>
> ---
>
> The early gains from this were very exciting: they dangled the promise of software that could essentially "teach itself" how to do complicated, valuable things in a series of accelerating returns. The fact that the early improvements in AI systems that used this technique were *so* much greater than anyone would have expected based on AI research up to that point dangled an even more exciting promise: that the improvements would continue to scale faster than the inputs.
>
> 19/
>
> ---
>
> Researchers and investors came to expect an AI that was "untouched by human hands," that taught itself how the world worked. This was the self-licking ice-cream cone of machine learning, the world of "theory-free inference" that had fueled the Big Data industry. 
>
> 20/
>
> ---
>
> With theory-free inference, you don't have to figure out how the world works in order to act upon it: you can just gather up all the data about how things happen in the world, use statistical methods to find the correlations, and then intervene to change the outcomes. You don't have to know why a molecule improves a medical condition - it's enough to discover that fact, produce that molecule, and administer it to people with that condition.
>
> 21/
>
> ---
>
> Lots of stuff in the world works this way. Our understanding of the causal relationships that make up reality has massive holes in it that we fill with mere correlation. Correlations are easier to discover than causes, and while correlation is (famously) not causation, causes and effects *are* correlated, and if you can evince the effect you're seeking without understanding precisely what happened to make that effect appear, well, at least you got the effect you were seeking.
>
> 22/
>
> ---
>
> Theory-free inference is a very pragmatic way to approach the world: "I don't need it good, I need it *Thursday*." Scientists burn to know why a molecule stopped you from dying, but you are likely satisfied to not be dead. What's more, our ability to observe correlations will always race ahead of our understanding of causality, so the power of theory-free inferences pushes out the frontier of things we can act on, beyond the realm of the understood.
>
> 23/
>
> ---
>
> Which is all to say: it's reasonable to be excited about a breakthrough in theory-free inference. But just like a boomer who thinks that buying a house to live in makes them a shrewd real-estate speculator, someone who achieves great things through theory-free inference runs the risk of missing the limitations to those techniques.
>
> 24/
>
> ---
>
> And they *are* limited. Theory-free inference is good at predicting what your spouse will type into their phone based on all the things they've ever typed into their phone. You are *also* good at guessing what your spouse will say based on the things they've said before. 
>
> 25/
>
> ---
>
> The difference is that when your spouse says something entirely unexpected and unprecedented to you (say, "I want a divorce"), the fact that you have a theory about *why* your spouse said all the things they said up to that moment can help you understand why they've said this new thing. But a machine learning model that relies on theory-free statistical modeling to predict your spouse's next words will be entirely at sea. Theory-free inference works well, but it fails badly.
>
> 26/
>
> ---
>
> The problem is that the AI sector has raised literally *trillions* of dollars by assuring investors that the era of hand-made, causal world models that let computers act on the world is hopelessly inefficient and outdated. But there are many, many tasks that are vastly more efficient and reliable when done through conventional computer programs, rather than through "AI."
>
> 27/
>
> ---
>
> As Gary Marcus describes in a recent *Organized Money* interview, an LLM can recite the rules of chess, but it can't *play* chess because - lacking a theory of how chess works - it will just emit statistically likely chess moves, even if those moves cause pieces to illegally move through other pieces. 
>
> 28/
>
> ---
>
> The first conventional chess-playing programs ran on electromechanical proto-computers, and they played a better game of chess than an LLM that uses *billions* of times more computing power and energy: 
>
> https://www.organizedmoney.fm/p/an-ai-expert-explains-the-hype
>
> The AI companies have proved that there are many domains and applications where we can swap scale for understanding.
>
> 29/
>
> ---
>
> But, having ridden some world-historic forces and adjacent possibles to great fortunes and stature, they cannot be dissuaded from their conviction that theory-free inference and scale can do *everything*. They can't be convinced that in many cases, the things that scale and theory-free inference *can* do are much better accomplished through causal understandings and conventional computing techniques.
>
> 30/
>
> ---
>
> From a research perspective, it is interesting to learn about the potential and limitations of a model trained on the entire internet. From a societal and industrial perspective, it is often grossly wasteful, inefficient and unreliable to swap scale for understanding.
>
> 31/
>
> ---
>
> The AI sector was born of world-historical forces that favored massively parallel computing, forces that had also conjured up an internet with trillions of documents that could be fed into those massively parallel computers to conduct theory-free inference. Like every success, AI was born on third base.
>
> 32/
>
> ---
>
> As rent-burdened millennials who abandoned avocado toast and fancy coffee and *still* can't afford a downpayment will tell you, the fact that being born in 1945 made it easy to trip and land on a couple million dollars' worth of real estate wealthy by the time you reached retirement age tells us nothing about how to solve the housing crisis of 2026.
>
> 33/
>
> ---
>
> By the same token, continuing to give trillions to AI companies because they experienced early success with theory-free inference at scale tells us nothing about how to solve the *vast* range of problems that theory-free inference at scale sucks at. Doubling down on AI to overcome its increasingly obvious limitations is like doubling down on building post-war suburbs to fix today's housing market.
>
> 34/
>
> ---
>
> It's possible to achieve impressive feats because you're smart and hard working and *also* because you were in the right place at the right time. Historical contingency produced the AI bubble, and it is producing the conditions for that bubble to pop. 
>
> eof/

### 9. Hardly a day goes by without my getting email from someone looking for ways to do good with technology (2026-08-08) [link](https://mamot.fr/@pluralistic/117059089266318334)
**Metrics:** 52 boosts, 39 favourites, 1 replies (thread of 35 posts)
**Opening hook (verbatim):**
> Hardly a day goes by without my getting email from someone looking for ways to do good with technology. From computer science students thinking about post-grad careers to seasoned coders with decades of experience, there's an army of hackers looking for a way to turn their expertise into public goods.

**Structure:** Essay-thread (35 posts): movement history survey (public interest technology from EFF and UK's GDS through Audrey Tang and USDS/DOGE) that lands on a current-events news hook.
**Framing:** History-to-news framing: traces a decade-plus lineage of 'public interest technologists' to argue Mamdani's NYC 'PIT Crews' are DOGE done right.
**Full text (verbatim):**
> Hardly a day goes by without my getting email from someone looking for ways to do good with technology. From computer science students thinking about post-grad careers to seasoned coders with decades of experience, there's an army of hackers looking for a way to turn their expertise into public goods.
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/08/find-yourself-a-city/#to-hack-in
>
> 1/
>
> ---
>
> There's a name for this movement: it's called "Public Interest Technology" and the people who work in it are called "public interest technologists." There've always been techies who understood the link between tech and public wellbeing and who committed themselves to working for the betterment of society.
>
> 2/
>
> ---
>
> But these numbers swelled as Big Tech companies saturated their markets and switched from growing by making products people like, to locking in their users and then extracting more value from their technological prisoners:
>
> https://pluralistic.net/2024/04/24/naming-names/#prabhakar-raghavan
>
> It was the era when (in the words of Facebook's Jeff Hammerbacher) "The best minds of my generation are thinking about how to make people click ads":
>
> https://quoteinvestigator.com/2017/06/12/click/
>
> 2/
>
> ---
>
> For organizations like the Electronic Frontier Foundation, the growing cohort of hackers who wanted to hack for good was great news. Our staff technologist group swelled from a couple of overworked computer scientists helping lawyers and activists with campaigns to a series of increasingly ambitious software projects, from Privacy Badger (a tracking-blocker that every web user needs):
>
> https://privacybadger.org/
>
> 4/
>
> ---
>
> To Let's Encrypt and Certbot, projects that forever changed the internet's default state, so that today, nearly all online communications are encrypted and resistant to mass surveillance:
>
> https://certbot.eff.org/
>
> Other opportunities for public interest technologists proliferated. Bruce Schneier created the canonical resource page for Public Interest Technologists, including career opportunities for would-be public interest technologists:
>
> https://public-interest-tech.com/
>
> 5/
>
> ---
>
> But the motherlode of public interest technologist opportunities wasn't the nonprofit sector - it was the *public* sector. It started with the UK's Government Digital Service, a group of public-spirited hackers (many of them ex- of the BBC, where they'd been tempest-tossed by endless internal power-struggles over the role of the internet in public service media) who retooled many of the UK government's most important administrative front-ends. 
>
> 6/
>
> ---
>
> For several glorious years, Britons delighted to the daily marvel of having their routine interactions with their government transformed from clunky, broken web-pages to slick, superbly thought through online processes that had all the polish of Amazon or Google, but without any of the gamesmanship, manipulation or privacy invasions:
>
> https://en.wikipedia.org/wiki/Government_Digital_Service
>
> 7/
>
> ---
>
> Despite many attempts at official sabotage by a string of increasingly shambolic UK governments, the GDS still exists, and it still does amazing work, even though it operates today with a fraction of the official support that it enjoyed at its inception. The last time I renewed my UK passport, I was gobsmacked by how *easy* and *sensible* the process was. 
>
> 8/
>
> ---
>
> Local authorities have gotten in on the act, too: I renewed my absentee voting registration with Hackney Council last week and it was as simple as scanning a QR code, affirming my details, and clicking "submit."
>
> 9/
>
> ---
>
> Around the world, a generation of public sector technologists duplicated and improved on the UK GDS's work. In Taiwan, a rogue public interest hacker named Audrey Tang led a group of digital guerrillas in creating shadow versions of every Taiwanese government website that scraped and remade the entire digital presence of the Taiwanese state to make public information and services accessible, legible and useful to its people. 
>
> 10/
>
> ---
>
> After the next election, Tang was named Taiwan's first ever Minister of Digital Affairs (today, she is a Taiwanese "Ambassador-At-Large"):
>
> https://en.wikipedia.org/wiki/Audrey_Tang
>
> 11/
>
> ---
>
> In the USA, Jen Pahlka went from running a ragtag "civic hacking" org called Code For America to helping to found the United States Digital Service under Obama, bringing some of that UK GDS spirit to America's dreadful online presence, which had been largely built and maintained by beltway bandits who'd billed handsomely and delivered some of the internet's greatest crimes against usability:
>
> https://en.wikipedia.org/wiki/United_States_Digital_Service
>
> 12/
>
> ---
>
> But the USDS's legacy is bitter. In 2025, USDS was effectively dismantled and replaced with DOGE, Elon Musk's handpicked team of tech-bro cultists who set out to dismantle as much of the US government as possible, deliberately sabotaging the usability of America's governmental systems to make it harder for the public to access the services they are entitled to and pay for with their taxes.
>
> 13/
>
> ---
>
> My own run-in with this was my attempt to get a certificate of citizenship for my daughter when she turned 18: all I could find was an online form that started by requiring me to list the dates and flight numbers for every trip I'd taken to the USA from the time I was born to the day I became a US citizen, a 50+ year period that started with a trip to visit my snowbird grandparents in Florida when I was six months old. 
>
> 14/
>
> ---
>
> The entire support and advice service for the US Customs and Immigration Service has been replaced with a DOGE chatbot that repeatedly emails and texts links to the form, no matter what question you ask, and no matter whether you call, email or use the website's chat interface:
>
> https://pluralistic.net/2026/02/06/doge-ball/#n-600
>
> 15/
>
> ---
>
> Many of the DOGE kids were monsters. The most chilling DOGE story I've heard was the anonymous testimony of NIH officials who begged the DOGE children who were dismantling their work to spare some long-running cancer research projects whose great promise would be vaporized if they were interrupted. The DOGE kids laughed at these entreaties, saying that once Musk had perfected "General AI" we wouldn't need cancer research, because their tame AI god would cure cancer.
>
> 16/
>
> ---
>
> But not every DOGE operator was a digital arsonist. Take Dan Berulis, a DOGE staffer who came out of the private sector and later turned whistleblower over the group's activities, who now faces assassination attempts:
>
> https://www.wired.com/story/he-blew-the-whistle-on-doge-then-his-brakes-were-cut/
>
> 17/
>
> ---
>
> Berulis joined DOGE to improve America's digital infrastructure, not to dismantle it. When he talks about his motives, he sounds like an early GDS pioneer, one of Audrey Tang's direct-action government data scrapers, or one of the Code For America hackers who followed Pahlka to USDS:
>
> https://www.npr.org/2025/04/15/nx-s1-5355896/doge-nlrb-elon-musk-spacex-security
>
> 18/
>
> ---
>
> DOGE was a catastrophe. It left America's government digital presence in *far* worse shape than it found it, and even the modest savings it claimed to have made from all this destruction turn out to be lies:
>
> https://www.yahoo.com/news/politics/articles/elon-musk-doge-made-big-110000036.html
>
> 19/
>
> ---
>
> But as Berulis demonstrates, there is a bipartisan group of skilled, ethical technologists who are desperate to do meaningful public interest work. Their numbers swell every day, as Big Tech continues to curdle - no longer merely sclerotic and enshittifying monopolies, now active participants in Trump's authoritarian dismantling of democracy itself:
>
> https://pluralistic.net/2025/10/06/america-with-chinese-characteristics/#orphaned-syrian-refugees-need-not-apply
>
> 20/
>
> ---
>
> Tech bosses' gleeful mass layoffs mean that tech workers can no longer count on good treatment and stable, high-earning careers; at the same time, tech bosses' betrayal of democracy makes the prospect of working for a tech company far more ethically dubious than mere ad-tech optimizations. The result is a bumper crop of geeks looking for ways to do good with their lives and skills - as all the emails in my inbox asking for advice about this attests.
>
> 21/
>
> ---
>
> Enter NYC Mayor Zohran Mamdani, who has made "public excellence" the cornerstone of his politics, hiring the most skilled workers he can find and then giving them all the authority and resources they need to fix 100,000 potholes, bring New York's worst landlords to justice, and deliver every day for all the people of New York:
>
> https://pluralistic.net/2025/11/15/unconscionability/#standalone-authority
>
> 22/
>
> ---
>
> Mamdani has just unveiled his Public Interest Technology (PIT) Crews: five "game changing" teams of public interest hackers who will remake NYC's digital services:
>
> https://www.nyc.gov/mayors-office/news/2026/07/transcript--mayor-mamdani-launches--public-interest-technology--
>
> Writing for *Wired*, Steven "Hackers" Levy paints a portrait of New York's PIT Crews, describing them as "what DOGE should have been":
>
> https://www.wired.com/story/mamdani-assembles-his-nyc-tech-team/
>
> 23/
>
> ---
>
> I'll go farther than that: the PIT Crews - and Mamdani's project as a whole - is delivering the *entire* failed promise of DOGE. Unlike Musk and Trump, Mamdani is *actually* rooting out fraud and waste. The reason Mamdani can do this - and the reason billionaires can't - is that the fraud and waste that undermines governments at all levels come from the super-rich, with their tax-dodging, their no-bid contracts, their addiction to public subsidies.
>
> 24/
>
> ---
>
> Musk owes his riches to federal bailouts and contracts: if he wants to "eliminate government fraud and waste" he should turn over his files to an IRS inspector (if he can find a survivor of the DOGE massacre) and surrender himself for a lengthy prison sentence. 
>
> 25/
>
> ---
>
> For Musk, "government fraud and waste" is a single mom on food stamps who misses a box on a 600-page form because she's exhausted from working three jobs to make rent - not a no-bid contractor trousering billions in public funds for projects that overcharge and underdeliver.
>
> 26/
>
> ---
>
> Mamdani's PIT Crews are "small groups of engineers and designers will strive to change the hidebound and confusing nature of current city services by using state-of-art skills to rapidly whip up specialized apps that solve real problems." Mamdani says that they'll "raise expectations on what government can deliver, because we really can deliver."
>
> 27/
>
> ---
>
> As Levy describes it, the big difference between the Obama-era USDS and 2026's PIT Crews is "a skeptical, almost adversarial, stance toward Big Tech."  NYC's PIT Crews explicitly recruit top-tier hacker talent who want to "make software that doesn't serve advertisers, the military, or the pocketbooks of centibillionaires."
>
> 28/
>
> ---
>
> Their inaugural chief is Lisa Gelobter, a veteran of both tech firms and the USDS, who says that "Without technology, policy is just words written on a piece of paper." The first project on her roster is implementing "Click to Cancel," a policy inaugurated by Lina Khan, Biden's FTC Chief - and then dismantled by Trump. 
>
> 29/
>
> ---
>
> Under Click to Cancel, companies are required to create one-click workflows to cancel subscriptions and memberships, ending the pernicious, incredibly profitable practice of trapping people with impossible-to-halt recurring billings. Today, Khan is running Mamdani's Economic Development Board, and her Click to Cancel rule is back - for New Yorkers, at least:
>
> https://www.theguardian.com/us-news/2026/jul/22/lina-khan-nyc-economic-development-board
>
> 30/
>
> ---
>
> NYC PIT Crew's new Click to Cancel site will be live when the policy takes effect on Oct 1. It's a whistleblower site that will make it easy to report merchants who make it *hard* to get shut of their online Roach Motels (users check in, but they don't check out). It's estimated the Click to Cancel rule will save New Yorkers $160m in the first year alone - but only if Mamdani can enforce it, which is why this website is so critical.
>
> 31/
>
> ---
>
> This focus on meat-and-potatoes service delivery was once dismissed as "sewer socialism," an unserious form of progressive politics with an undue focus on improving people's daily lives at the expense of high-flying political change. 
>
> 32/
>
> ---
>
> Today, Mamdani is at the vanguard of an army of proud sewer socialists, who say that once you deliver for people in their day-to-day existence, they will trust you and back you when you fight for deep, structural changes (and the corollary: if you *can't* deliver for people in their daily lives, why should they trust you when you claim that you'll make everything better?):
>
> https://prospect.org/2026/04/10/zohran-mamdani-getting-new-york-city-believe-in-government/
>
> 33/
>
> ---
>
> 3,000 techies applied for 35 jobs with NYC's PIT Crews, and, as Levy writes, many of them are high-flying senior coders who are willing to take a massive pay-cut and forfeit their stock options to do something that's both technically excellent and meaningful to their users' lives.
>
> 34/
>
> ---
>
> It's a clear message to other leaders, at every level of government. Many of the most skilled, ambitious people in every field want to make the world a better place. Every city, county and state could use a squadron of PIT Crews, and there's an army of coders who would give anything for the chance to give everything to make a better world.
>
> eof/

### 10. According to an Economist editorial, 'AI is breaking the British state' (2026-08-10) [link](https://mamot.fr/@pluralistic/117069929713762654)
**Metrics:** 44 boosts, 39 favourites, 8 replies (thread of 21 posts)
**Opening hook (verbatim):**
> According to an *Economist* editorial, "AI is breaking the British state" by making it too easy to file complaints, demands and appeals, which will "drown the state" with "demands as well-crafted as a first-class lawyer's":

**Structure:** Essay-thread (21 posts) built by quoting and rebutting a specific magazine editorial, then layering in multiple external writers' analogies (Henry Farrell, Dan Davies).
**Framing:** Pop-culture analogy framing: cites a 1980s British comic villain (Abelard Snazz and his 'Big Police Robots') as the throughline connecting bureaucratic AI arms races in health insurance, email spam filtering, and content moderation.
**Full text (verbatim):**
> According to an *Economist* editorial, "AI is breaking the British state" by making it too easy to file complaints, demands and appeals, which will "drown the state" with "demands as well-crafted as a first-class lawyer's":
>
> https://archive.is/VTrj9 
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/10/deep-state-wopr/#abelard-snazz
>
> 1/
>
> ---
>
> Let's pause a moment to appreciate the *Economist*'s touching credulity about AI's coming legal mastery. The law seems to be the area where AI is *most* prone to "hallucinate" (that is, "produce defective outputs"), which can only be sorted through by skilled practitioners whose experience gives them the discernment to distinguish useful arguments from foolish ones:
>
> https://pluralistic.net/2026/07/28/hitl-ers/#ai-ai-oh
>
> 2/
>
> ---
>
> (And this requires those skilled practitioners to avoid the "automation blindness" that afflicts people who are asked to remain vigilant for things that seldom occur, a phenomenon that has turned every TSA agent into the water-bottle-detectingest motherfucker the human race has ever produced, who still misses 95% of the guns that red teams bring through the checkpoint):
>
> https://www.nbcnews.com/news/us-news/investigation-breaches-us-airports-allowed-weapons-through-n367851
>
> 3/
>
> ---
>
> More notable than the *Economist*'s faith-based predictions about the impending army of hyper-competent robo-lawyers is the magazine's proposed solution to this looming crisis: "stop creating entitlements that are ripe for AI-fuelled claims…prune the mass of procedural rights."
>
> 4/
>
> ---
>
> Above all, replace the bureaucrats who process your "complaints, demands and appeals" with *more* AI, which will arbitrarily decide who gets what, through "personalised welfare interventions" that are not based on any kind of guaranteed rights.
>
> 5/
>
> ---
>
> Writing on his blog, the political scientist Henry Farrell tells us where this will inevitably end up: with AI-based robot wars in which increasingly stingy and pernickety robo-bureaucrats create demand for progressively more aggressive robo-lawyers:
>
> https://www.programmablemutter.com/p/the-downside-of-robot-solutionism
>
> As Farrell writes, this end-time was foretold by the prophet Alan Moore with his 1980s *2000 AD* character Abelard Snazz, "the man with the two-storey brain":
>
> https://en.wikipedia.org/wiki/Abelard_Snazz
>
> 6/
>
> ---
>
> Snazz "solves" the street crime epidemic on the planet Twopp with "Big Police Robots," who spiral out of control, arresting the citizens of Twopp for trivial crimes like wearing brown shoes with a blue suit ("breaking the laws of good taste"). To solve this new problem, Snazz invents "Big Criminal Robots" whose "cunning, efficient" crimes "take up all the police's time."
>
> 7/
>
> ---
>
> Twopp is left in a state of high-stakes Big Robot crimewars, in which the most efficient criminals imaginable battle the most ruthless robocops science can deliver, with the Twoppians caught in the crossfire, collateral damage in a robotic forever war (on crime).
>
> As Farrell writes, this is already afflicting the US health system, where an army of insurance company robo-claim-deniers have been countered with a doctors' army of robot-claim-*appealers*:
>
> https://www.nytimes.com/2024/07/10/health/doctors-insurers-artificial-intelligence.html
>
> 8/
>
> ---
>
> The point being that people *need* health care, people *need* public services, and while there will always be some waste at the margins (whether due to incompetence or dishonesty) responding to this by beefing up the system's defenses with more advanced red tape just requires the people who legitimately need these services to employ more aggressive tactics.
>
> 9/
>
> ---
>
> In support of this, Farrell points to a great, long essay by Dan "Accountability Sink" Davies for the Niskanen Center, "'The Problem Factory' - Preemptive risk aversion in infrastructure planning and the role of professional services":
>
> https://www.niskanencenter.org/the-problem-factory-preemptive-risk-aversion-in-infrastructure-planning-and-the-role-of-professional-services/
>
> 10/
>
> ---
>
> Davies' essay describes how increasing bureaucratic defenses against frivolous or dishonest claims drives the participants in these processes to assume a war footing and approach the system as a battlefield, leading to the very runaway cost inflation that the bureaucratic process was instituted to prevent.
>
> (Davies, a cybernetician, has some fascinating advice about how to structure planning processes to minimize this, but that's out of scope for this particular post.)
>
> 11/
>
> ---
>
> This reminds me of nothing so much as the spam wars. There was a time when it was very easy to set up a mail server and provide email access for anyone who wanted it - including spammers. Increased spam begat increased anti-spam countermeasures, notably the creation of blocklists that allowed mail administrators to automatically reject email from "insecure" mail servers.
>
> 12/
>
> ---
>
> Inevitably, spammers figured out how to send spam from "secure" servers, resulting in stricter, more onerous standards for mail server configuration. Spammers - for whom the ability to send spam is an existential matter - figured out how to meet these standards, so the security demands jumped again - and again, and again.
>
> 13/
>
> ---
>
> Today, sending and receiving mail is so technically challenging that most of the internet's email is run by a handful of giant, mostly US-based corporations. If any of these companies decides your mail server is spamming, you effectively disappear from the internet and good luck getting them to acknowledge an error.
>
> 14/
>
> ---
>
> Meanwhile, these companies emit an *avalanche* of spam, but no one will ever block their servers, because to do so would be to cut off billions of legitimate email users:
>
> https://pluralistic.net/2021/10/10/dead-letters/
>
> And since most of these companies are US-based, they are liable to being weaponized by Trump, who has taken to ordering his tech giants to block foreign officials whose policy decisions make him angry:
>
> https://carnegieendowment.org/emissary/2026/07/icc-trump-push-dismantle
>
> 15/
>
> ---
>
> Another parallel is the content moderation wars that saw the large platforms coming up with progressively more detailed rules about what constituted harassment and hate speech, only to have dedicated trolls master these rule-books.
>
> 16/
>
> ---
>
> Trolls - for whom harassment was a full-time vocation - became the world's greatest experts on the platforms' speech policies, which let them skate right up to the line when abusing their victims, *and* to get those victims kicked off the platforms if they could be lured into putting a single toe over the line in response:
>
> https://pluralistic.net/2022/08/07/como-is-infosec/
>
> 17/
>
> ---
>
> Farrell criticizes the *Economist*'s answer to the (alleged) looming robo-lawyer threat as "solutionism," Evgeny Morozov's word for "Recasting all complex social situations either as neat problems with definite, computable solutions":
>
> https://en.wikipedia.org/wiki/Technological_fix
>
> 18/
>
> ---
>
> Using AI to root AI-generated bureaucratic appeals sacrifices the system's putative purpose - delivering services - in the name of defending that service from abuse and misuse of the system's resources. As the pioneering cybernetician Stafford Beer famously wrote, "the purpose of a system is what it does." If your bureaucracy is more concerned with fighting fraud than delivering service, then it isn't a service delivery system at all - it's a service *denial* system. 
>
> 19/
>
> ---
>
> As Farrell writes, the people of Twopp can tell you how this ends - in a war of giant robots in which we are all collateral damage.
>
> 20/
>
> ---
>
> (A brief postscript: Farrell is a font of science fictional analogies to modern policy issues. This weekend in the *FT*, he and Dan Wang published an excellent editorial on the relevance of the paranoid, claustrophobic fiction of Philip K Dick to our present political reality:)
>
> https://archive.is/2YT4k
>
> eof/

### 11. I'm sure that working in social media... is a cognitohazard (2026-08-06) [link](https://mamot.fr/@pluralistic/117048015415336821)
**Metrics:** 40 boosts, 39 favourites, 5 replies (thread of 26 posts)
**Opening hook (verbatim):**
> I'm sure that working in social media - dealing with people as mass statistical abstractions - is a cognitohazard, the sort of thing that could make anyone a little solipsistic, convinced that everyone else is a kind of stimulus-responding automaton lacking the interiority that you yourself experience.

**Structure:** Essay-thread (26 posts), a psychological character study of a single named executive (Mark Zuckerberg) built from a chronological string of case examples spanning his whole career.
**Framing:** Thesis-driven profile framing: opens by considering and rejecting one causal theory (social media warps you) in favor of another (Zuckerberg was always a solipsist), invoking a Terry Pratchett line ('sin is when you treat people like things') as the moral frame.
**Full text (verbatim):**
> I'm sure that working in social media - dealing with people as mass statistical abstractions - is a cognitohazard, the sort of thing that could make anyone a little solipsistic, convinced that everyone else is a kind of stimulus-responding automaton lacking the interiority that you yourself experience.
>
> -
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/06/sin-is-when/#you-treat-people-as-things
>
> 1/
>
> ---
>
> But when it comes to Mark Zuckerberg, I'm increasingly convinced that he didn't acquire his worldview through the self-inflicted brain damage of his long exposure to the back-end of a vast social media system. I think the causal arrow points in the other direction: I think that Zuck founded Facebook *because* he doesn't really believe that other people are truly *real*, at least not as real as he is.
>
> 2/
>
> ---
>
> We see this in Facebook's very earliest days, as we see it today, as we see it at every critical juncture in Facebook and Zuckerberg's history.
>
> Consider Facebook's origins, founded by a young Zuckerberg in his dorm as a means to nonconsensually rate the fuckability of his fellow Harvard undergrads:
>
> https://mashable.com/article/mark-zuckerberg-lying-about-facebook
>
> 3/
>
> ---
>
> The boy Zuck was delighted and surprised that so many of his fellow students entrusted him with their data but even then, he had no inkling *why* they would do so. Privately, he jeered at his users for trusting him, calling them "dumb fucks":
>
> https://www.theregister.com/offbeat/2010/05/14/facebook-founder-called-trusting-users-dumb-fcks/294365
>
> Zuck has since prosecuted history's most ruthless war on privacy, a surveillance campaign that would put the Stasi to shame and make Orwell scoff at the hacks butchering his work with over the top absurdities.
>
> 4/
>
> ---
>
> Zuck doesn't think *you* deserve any privacy, but boy does he ever value his own. This is a guy who bought the four houses surrounding his San Francisco home and left them empty in order to form a buffer zone:
>
> https://www.nytimes.com/2025/08/10/us/mark-zuckerberg-palo-alto.html?unlocked_article_code=1.3VA.4Avp.cVm3LUnvajRK&smid=url-share
>
> When a single candid photo of Zuck and his family in their kitchen leaked (from Facebook!), Zuck, his lawyers, and his operatives treated it as a three-alarm fire:
>
> https://abc7news.com/archive/8933289/
>
> 5/
>
> ---
>
> Zuck acquired a vast Hawaiian acreage and left most of it undeveloped, fenced and patrolled to prevent anyone from catching a glimpse of his private life. In order to acquire this acreage, Zuck exploited a dirty legal tactic called "heirs property," which leverages the informal basis of indigenous land claims by locating a single person with a colorable claim to their distant relatives' territory in order to force an auction of the ancestral land:
>
> https://www.wired.com/story/mark-zuckerberg-secretive-hawaii-compound-burial-ground/
>
> 6/
>
> ---
>
> If Zuck thought other people are as real as he is, he wouldn't spy on them in ways he himself could never tolerate. He certainly wouldn't pay fancy white-shoe lawyers to steal their land out from under them. At heart, Zuck is a billionaire solipsist to beat all other examples of the form - a billionaire *social media* solipsist who sees others as manipulable collections of statistical abstractions, and not as people at all:
>
> https://pluralistic.net/2025/08/18/seeing-like-a-billionaire/#npcs
>
> 7/
>
> ---
>
> When he's forcibly reminded other people do indeed exist, it goes very badly. He's insisted Sarah Wynn-Williams, a former FB exec turned whistleblower, must pay him *$111,000,000* as punishment for her excellent tell-all memoir *Careless People*. His lawyers say that Wynn-Williams violates the non-disclosure and non-disparagement "agreement" of her old Facebook employment contract *merely by standing motionless and silent* for an hour on-stage:
>
> https://pluralistic.net/2026/06/27/zuckerstreisand-2/#autodisparagement
>
> 8/
>
> ---
>
> Once you realize that Zuck doesn't really think other people exist, "the metaverse" starts to make a lot more sense. Why would Zuck light $61b on fire in a bet that we will all stand still while he converts us and everyone we love into legless, sexless, low-polygon, heavily surveilled cartoon characters that he imprisons in a virtual world he stole from a 25 year old satirical dystopian cyberpunk novel? 
>
> 9/
>
> ---
>
> It's easy to understand if we're all non-player characters - if that's true, then the metaverse is surely our native habitat.
>
> For Zuck, people aren't co-equals with needs that are as real and important as his own. For Zuck, people are problems to be solved. He embodies Terry Pratchett's maxim (voiced by Granny Weatherwax) that "sin is when you treat people like things."
>
> 10/
>
> ---
>
> Nowhere is this sin more on display than in Zuck's relationship to the social connections that bind together the users of his platforms. Zuck has benefited enormously from the fact that you love your friends more than you hate him, but (because hell is other people), you can't all agree on when to leave and where to go next, so you stay put on Facebook and Instagram:
>
> https://locusmag.com/feature/commentary-cory-doctorow-hell-is-other-people/
>
> 11/
>
> ---
>
> For Zuck, the fact that you and your friends have trapped one another in a mutual hostage-taking is *maddening*, because those friends who've tied you to his platform refuse to organize their social contact with you to "maximize your engagement" with Facebook and Insta, which would let him maximize the number of ads he shows you. 
>
> 12/
>
> ---
>
> Rather, these friends just want to *be your friends*, which means that they don't want to get into stupid endless fights to keep you replying or stage little entertaining skits to keep you scrolling.
>
> At first, Zuck tried tweaking his algorithm to replace your friends with trolls who'd bait you into flamewars. 
>
> 13/
>
> ---
>
> When that petered out, he stole a march from Tiktok and recruited an army of theater kids to do amateur dramatics for you in exchange for the promise of an intermittent reward schedule payment for the sketches that got the most views:
>
> https://pluralistic.net/2026/04/17/for-youze/#forever
>
> The problem (for Zuck) is that theater kids are *also* people and they resent being jerked around by the algorithm and ripped off by Meta's rigged revshare slot-machine. 
>
> 14/
>
> ---
>
> Last year, he started signaling that he would replace the theater kids - *and* your friends - with chatbots:
>
> https://sfist.com/2025/05/01/mark-zuckerberg-gets-roasted-for-saying-the-average-american-has-fewer-than-three-friends-while-pushing-ai-chatbots/
>
> 15/
>
> ---
>
> AI is a catastrophic bet for Meta, worse than the metaverse. Meta stock's in a death-spiral as investors decide that when Zuck fired his coders and replaced them with chatbots while spending $300b on AI, he excised the heart of his skilled workforce, pissing away all its free cash-flow, and sinking into a bottomless pit of debt to produce a substandard product that no one wants, at the expense of the company's only profitable lines of business:
>
> https://www.cbsnews.com/news/ai-bubble-tech-selloff-investment-consumer-business-demand/
>
> 16/
>
> ---
>
> But Zuck is sure that chatbots can solve his most pernicious problem: the search for a gimmick that will keep you locked to his platform that is under his complete control. Zuck doesn't want to rely on your friends with their unwillingness to maximize your engagement. He doesn't want to depend on volatile and unpredictable trolls to bait you into sticking around to argue and see more ads. 
>
> 17/
>
> ---
>
> He wants to be shut of theater kids and their amateur dramatics that inevitably come with demands for decent treatment.
>
> For Zuck, chatbots dangle the promise of social media without socializing. Zuck thinks he can solve all his problems by imprisoning you in a house of mirrors where you interact with LLMs that are tuned to keep you scrolling no matter what, chatbots that will never demand anything of Meta.
>
> 18/
>
> ---
>
> He's been at this for a while, and each generation of chatbots was worse than the last. How bad? The last batch had to be killed off after they took to luring children into explicit sexual role-play:
>
> https://archive.is/fopCh
>
> Nevertheless, the dream of a world without people is one that Zuck can't let go of. 
>
> 19/
>
> ---
>
> Solipsism's seductive song convinced him to buy a company called Social.ai, which specializes in trapping people in conversations with chatbots, and now he's announced his plan to flood Facebook and Instagram with LLM slop:
>
> https://www.mediapost.com/publications/article/402263/
>
> The amazing thing about this is that Zuck is talking about chatbots as a way to capture a younger audience for his graying platforms. Kids *hate* chatbots. 
>
> 20/
>
> ---
>
> My 18 year old and her friends use "that's so AI" as a pejorative to dismiss anything distasteful or ugly:
>
> https://futurism.com/artificial-intelligence/gen-z-attitude-ai
>
> For Zuck - who owns a controlling share of voting stock in his company and need not answer to his board - it's a spectacular act of delusional self-sabotage. Zuck refuses to understand that the majority of his users are on his platform because they love their friends more than they hate him. 
>
> 21/
>
> ---
>
> Zuck's on a quest to isolate you from the friends who keep you on his platform and transfer your bond to people (and now chatbots) who can be commanded by Zuckerberg.
>
> Only someone who doesn't think other people are real could believe that you'd prefer to talk to chatbots than your friends - or that a habit of talking with chatbots would be so hard to break that you'd endure an ever-increasing number of advertising interruptions to maintain those pointless conversations.
> 22/
>
> ---
>
> In 1993/1994, AOL connected its millions of users to the public internet. These users were unaccustomed to the internet's conversational and technical norms, and they kept coming. It wasn't that the old internet was incapable of absorbing surges of new users: every September, an incoming class of undergraduates found their way online through their universities' computer labs.
>
> 23/
>
> ---
>
> But the AOL bridge was different: the flood of users was much larger, and it *never stopped*. The old internet people who struggled to transfer the culture and techniques of the internet to that flood of newbies called it the "Eternal September."
>
> For the Facebook and Instagram users who are about to be buried in an endless botshit avalanche, this is the beginning of the "Eternal Sloptember." From here on in, the slop only gets worse and thicker and harder to avoid. 
>
> 24/
>
> ---
>
> Zuckerberg refuses to acknowledge that he owes his fortune to the fact that his users love each other more than they hate him, so he has set out to shatter those bonds of love and sharpen that hatred.
>
> It won't end well. Zuck and people like him call themselves "high agency," a disgusting bit of jargon meant to denote someone who has real interiority, wishes and desires (as opposed to the rest of us, who do as we're told and stay where we're put). 
>
> 25/
>
> ---
>
> Zuck's "agency" isn't higher than yours or mine. The difference between him and us is that he doesn't think we're really real, and we know that he's really a monster.
>
> eof/

### 12. Today's threads (a thread) (2026-08-24) [link](https://mamot.fr/@pluralistic/117152640762373520)
**Metrics:** 41 boosts, 27 favourites, 5 replies (thread of 19 posts)
**Opening hook (verbatim):**
> Today's threads (a thread)	

**Structure:** Recurring daily-digest format, distinct from the essay-threads: a short pointer to that day's essay, a 'Hey look at this' reading list, an 'on this day' rundown of historical anniversaries (#25yrsago, #20yrsago...#1yrago), then standing book/tour-promotion and subscribe boilerplate.
**Framing:** Digest/roundup framing, not argumentative essay: functions as a daily table-of-contents and cross-platform promo post rather than a single-topic piece.
**Full text (verbatim):**
> Today's threads (a thread)	
>
> Inside: How Canada can save Americans and defeat America; and more!
>
> Archived at: https://pluralistic.net/2026/08/elbows-really-up//
>
> #Pluralistic
>
> 1/
>
> ---
>
> How Canada can save Americans and defeat America: True Carneyism has never been tried.
>
> https://mamot.fr/@pluralistic/117152616739417872
> https://bsky.app/profile/did:web:pluralistic.net/post/3mtuaztp7i22c
>
> 2/
>
> ---
>
> Hey look at this
>
> * Shielded from Shame: Civil Immunity for Ontario's Long-Term Care Facilities in the Wake of Covid-19 https://www.canlii.org/en/commentary/doc/2021CanLIIDocs13991#!fragment//BQCwhgziBcwMYgK4DsDWszIQewE4BUBTADwBdoByCgSgBpltTCIBFRQ3AT0otokLC4EbDtyp8BQkAGU8pAELcASgFEAMioBqAQQByAYRW1SYAEbRS2ONWpA
>
> * Many recent grads say AI is making it harder to get a job. Economists aren't so sure https://www.npr.org/2026/08/18/nx-s1-5910677/recent-college-graduates-employment-job-artificial-intelligence
>
> * Shitbot https://dodoeraser.org/2026/07/29/shitbot/
>
> * Nonfeasance, Misfeasance, and Malfeasance: Academic Freedom in a Nutshell https://3d.laboratorium.net/2026-08-23-academic-misfeasance
>
> 3/
>
> ---
>
> #25yrsago Kevin Mitnick is out of prison https://web.archive.org/web/20010000000000*/https://www.techtv.com/screensavers/showtell/story/0,23008,3343816,00.html
>
> #25yrsago Brazil to nationalize AIDS drug patents https://edition.cnn.com/2001/WORLD/americas/08/22/aids.drug/index.html
>
> #25yrsago Copyright your DNA https://web.archive.org/web/20010827170510/http://www.cosmiverse.com/science08230102.html
>
> #25yrsago The internet is boring now https://www.nytimes.com/2001/08/26/us/exploration-of-world-wide-web-tilts-from-eclectic-to-mudane.html
>
> #20yrsago TSA busts “explosive water” that turns out to be cosmetics https://web.archive.org/web/20060822123448/http://www.kxma.com/getARticle.asp?ArticleId=35223
>
> #20yrsago Windows Media DRM cracked, no one cares https://archive.blogs.harvard.edu/cmusings/2006/08/25/#a1889
>
> 4/
>
> ---
>
> #20yrsago Canadian music label puts fans and artists first https://web.archive.org/web/20060830211418/http://wired.com/wired/archive/14.09/nettwerk_pr.html
>
> #20yrsago After the Siege in Russian https://craphound.com/Cory_Doctorow_-_After_the_Siege_Russian.html
>
> #20yrsago Victory in War on Moisture: Gel-bras once again safe! https://web.archive.org/web/20060820185006/http://www.tsa.gov/travelers/airtravel/prohibited/permitted-prohibited-items.shtm
>
> #20yrsago EFF sues Barney the humorless, copyright maximalist dinosaur https://web.archive.org/web/20060813093642/http://www.eff.org/news/archives/2006_08.php#004884
>
> #15yrsago MP3tunes verdict: music lockers are legal https://www.eff.org/deeplinks/2011/08/mp3tunes-victory-music-lockers-is-good
>
> 5/
>
> ---
>
> #15yrsago Lolita on Wikipedia: 2,300 edits later https://web.archive.org/web/20111008072145/http://www.theawl.com/2011/08/case-history-of-a-wikipedia-page-nabokov’s-lolita
>
> #15yrsago SF mockumentary: ‘Ghosts With Shit Jobs’ — China looks at westerners with awful jobs https://ghostswithshitjobs.com/
>
> #15yrsago Information consumes attention: focus in the age of abundant stimulus https://web.archive.org/web/20111113004501/http://nymag.com/print/?/news/features/56793/
>
> #15yrsago Jack Layton’s final public words: “Love is better than anger. Hope is better than fear.” https://web.archive.org/web/20110829050308/http://beta.images.theglobeandmail.com/archive/01310/Jack_Layton_s_lett_1310744a.pdf
>
> 6/
>
> ---
>
> #15yrsago Getting people’s names right in software design: a LOT harder than it looks https://www.antipope.org/charlie/blog-static/2011/08/why-im-not-on-google-plus.html
>
> #15yrsago Internet Archive’s cache of 24/7 TV footage from 9/11 and beyond https://archive.org/details/911
>
> #10yrsago Peter Thiel &amp; Y Combinator fund a “litigation financing” startup to make money off other peoples’ lawsuits https://gizmodo.com/a-startup-backed-by-peter-thiel-makes-bankrolling-civil-1785707590
>
> #10yrsago Universities fought unionization’s ‘one-size-fits-all’ using identical arguments https://crookedtimber.org/2016/08/25/great-minds-think-alike/
>
> 7/
>
> ---
>
> #10yrsago 5 years after Texas GOP’s attack on women’s reproductive health, TX leads developed world in maternal mortality https://web.archive.org/web/20160820212602/https://www.theguardian.com/us-news/2016/aug/20/texas-maternal-mortality-rate-health-clinics-funding
>
> #10yrsago You didn’t find a meteorite https://sites.wustl.edu/meteoritesite/
>
> #10yrsago Young Conservatives’ “leadership seminar” featured food &amp; water deprivation, sexist epithets, physical abuse https://web.archive.org/web/20160824145226/https://www.thestar.com/news/queenspark/2016/08/23/ontario-tories-apologize-to-party-activists-after-controversial-youth-seminar.html
>
> #10yrsago The 2017 Ikea Catalog considered as dystopian urban microapartment futurism https://web.archive.org/web/20160817154440/https://www.fastcodesign.com/3062854/ikeas-2017-catalog-is-a-terrifying-glimpse-into-the-tiny-apartments-of-the-future
>
> 8/
>
> ---
>
> #10yrsago Singapore will disconnect entire civil service from the internet https://www.theguardian.com/technology/2016/aug/24/singapore-to-cut-off-public-servants-from-the-internet
>
> #10yrsago They’re making a Twits ale from Roald Dahl’s body-yeast https://web.archive.org/web/20160817154531/http://www.independent.co.uk/arts-entertainment/books/news/beer-to-be-made-from-yeast-swabbed-from-roald-dahls-writing-chair-a7195721.html
>
> #10yrsago As America’s temperatures soar, prisoners are dropping dead https://web.archive.org/web/20160825000426/https://theintercept.com/2016/08/24/deadly-heat-in-u-s-prisons-is-killing-inmates-and-spawning-lawsuits/
>
> #5yrsago Are privacy and antitrust on a collision course? https://pluralistic.net/2021/08/24/illegitimate-greatness/#peanut-butter-in-my-antitrust
>
> #5yrsago What kind of emergency is our emergency? https://pluralistic.net/2021/08/23/dont-wanna-spoil-the-surprise/#monocausotaxophilia
>
> 9/
>
> ---
>
> #5yrsago The secrets of hospital bills https://pluralistic.net/2021/08/23/dont-wanna-spoil-the-surprise/#surprise
>
> #5yrsago Belarusian dictator pwned by "cyber-partisans" https://pluralistic.net/2021/08/25/taxes-are-for-the-little-stores/#cyber-partisans
>
> #5yrsago Big Box stores' other shoe drops https://pluralistic.net/2021/08/25/taxes-are-for-the-little-stores/#metastatic-parasites
>
> #5yrsago The Unraveling https://pluralistic.net/2021/08/23/dont-wanna-spoil-the-surprise/#the-two-genders
>
> #1yrago Friction cannot be reduced, it can only be redistributed https://pluralistic.net/2025/08/23/become-unoptimizable/#downward-redistribution
>
> 10/
>
> ---
>
> Friday's threads: Born on technology's third base; and more!
>
> https://mamot.fr/@pluralistic/117136600592645407
>
> 11/
>
> ---
>
> My latest nonfiction book is the internationally bestselling"The Reverse Centaur's Guide to Life After AI," from MCD/Farrar, Straus and Giroux:
>
> https://us.macmillan.com/books/9780374621568/thereversecentaursguidetolifeafterai/
>
> --
>
> My previous nonfiction book is the internationally bestselling "Enshittification: Why Everything Suddenly Got Worse and What to Do About It":
>
> https://us.macmillan.com/books/9780374619329/enshittification/
>
> 12/
>
> ---
>
> My ebooks and audiobooks (from FSGxMCD, Tor Books, Head of Zeus, McSweeneys, Beacon, Verso and others) are for sale all over the net, but I sell 'em too, and when you buy 'em from me, I earn twice as much and you get books with no DRM and no license "agreements."
>
> https://craphound.com/shop/
>
> 13/
>
> ---
>
> Upcoming appearances:
>
> * #Melbourne: Enshittification at the Wheeler Centre, Aug 25
> https://www.wheelercentre.com/events-tickets/season-2026/cory-doctorow-enshittification
>
> * #London: AI and the Enshittification of the Media, NUJ (Sep 2)
> https://www.nuj.org.uk/learn/ems-event-calendar/ai-and-the-enshitification-of-the-media.html
>
> * #Brighton: The Reverse Centaur's Guide to Life After AI with Carole Cadwalladr (Brighton Dome), Sep 8
> https://brightondome.org/whats-on/LSC-cory-doctorow-the-reverse-centaurs-guide-to-life-after-ai/
>
> * #Manchester: Take Back Big Tech with Jovan Owusu-Nepaul (House of Books and Friends), Sep 11
> https://ma.to/event/cory-doctorow-house-of-books-and-friends-11-sep-2026
>
> 14/
>
> ---
>
> Upcoming appearances (cont'd):
>
> * #London: The Reverse Centaur's Guide to Life After AI with Riley Quinn (Foyle's Picadilly), Sep 9
> https://www.foyles.co.uk/events/enshittification-cory-doctorow-riley-quinn
>
> * #SouthBend: An Evening With Cory Doctorow (Notre Dame), Oct 6
> https://franco.nd.edu/events/2026/10/06/an-evening-with-cory-doctorow/
>
> * #Hudson, OH: Hudson Library, Oct 7
> https://engagedpatrons.org/EventsExtended.cfm?SiteID=3850&EventID=596952&PK=
>
> * #Victoria: Munro's Books, Oct 20
> https://www.munrobooks.com/events/6113620261020
>
> 15/
>
> ---
>
> Upcoming appearances (cont'd)
>
> * #Vancouver: BC Policy Solutions Gala, Nov 12
> https://bcpolicy.ca/gala/
>
> 16/
>
> ---
>
> Recent appearances:
>
> * Hope, AI, Fixing the Internet and the Reverse Centaur of it all (Wilosophy)
> https://podcastaddict.com/everyone-relax/episode/231414816
>
> * Deflating the AI Bubble (Do Not Pass Go)
> https://www.donotpassgo.ca/p/deflating-the-ai-bubble-with-cory
>
> * Technofeudal Enshittification (Fucking Cancelled)
> https://www.fuckingcancelled.com/p/technofeudal-enshittification-with
>
> * Who The Machine Serves (EFF)
> https://archive.org/details/effecting-change-who-the-machine-serves
>
> * Speculative Fiction for Social Change II (Cool People Who Did Cool Stuff)
> https://pocketcasts.com/podcast/cool-people-who-did-cool-stuff/08cbb840-a6ae-013a-d8aa-0acc26574db2/part-two-cory-doctorow-on-speculative-fiction-for-social-change/937e8800-9404-45a6-b5e3-90ebee2cfaea
>
> 17/
>
> ---
>
> You can follow these posts as a daily blog at pluralistic.net: no ads, trackers, or data-collection! 
>
> Here's today's edition: https://pluralistic.net/2026/08/elbows-really-up//
>
> --
>
> If you prefer a newsletter, subscribe to the plura-list, which is ad-/tracker-free, and is utterly unadorned save a single daily emoji. Today's is "⭐️". Suggestions solicited for future emojis!
>
> --
>
> You can also get a fulltext RSS feed, licensed CC BY 4.0:
>
> https://pluralistic.net/feed/
>
> 18/
>
> ---
>
> I'm also on Bluesky. Read today's thread there at:
>
> https://bsky.app/profile/did:web:pluralistic.net/post/3mtuaztp7i22c
>
> eof/

### 13. Maybe it seems weird that AI bosses won't stop rending their garments about the terrible potential of their chatbots (2026-08-19) [link](https://mamot.fr/@pluralistic/117121055423124959)
**Metrics:** 36 boosts, 28 favourites, 4 replies (thread of 23 posts)
**Opening hook (verbatim):**
> Maybe it seems weird that AI bosses won't stop rending their garments about the terrible potential of their chatbots, from the jobspocalypse once AI can do our jobs better than us, to the impending moment when the word-guessing programs learn too many words, wake up and turn us all into paperclips.

**Structure:** Essay-thread (23 posts), argumentative refutation piece that coins/reuses a term ('criti-hype') to reframe how AI critics talk about the technology.
**Framing:** Reframing/refutation device: argues AI should be treated as 'normal technology' rather than either magically transformative or uniquely evil, closing on a media-criticism point about not repeating tech bosses' own hype as warnings.
**Full text (verbatim):**
> Maybe it seems weird that AI bosses won't stop rending their garments about the terrible potential of their chatbots, from the jobspocalypse once AI can do our jobs better than us, to the impending moment when the word-guessing programs learn too many words, wake up and turn us all into paperclips.
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/19/banaility/#brackets-negative
>
> 1/
>
> ---
>
> It seems weird that they won't stop fretting about this terrible potential - until you realize that every public pronouncement about this *terrible* potential is also a public boast about its *potential*, period.
>
> 2/
>
> ---
>
> That's very, very important, because all AI really has is *potential*. Actual, existing AI is useful at the margins, *if* you're already a skilled practitioner who can discern correct from incorrect outputs, and *if* you integrate AI judiciously so that it doesn't overwhelm your ability to pay attention to those outputs and apply your discernment to them:
>
> https://pluralistic.net/2026/07/28/hitl-ers/#ai-ai-oh
>
> 3/
>
> ---
>
> In other words, AI is mostly a novelty, a heavily subsidized toy that produces little more than distraction. Where AI *does* produce value, that value is comparable to a *plug-in*, a new feature for your word processor or image/sound/video-editing package that might help you do your job somewhat better, or it might not.
>
> 4/
>
> ---
>
> That doesn't make AI useless, it just makes it a *normal* tech: useful for some, useless for others, capable of abuse and likely to waste a lot of time when used unwisely:
>
> https://www.normaltech.ai/
>
> Normal tech is *fine*. But normal technologies do not warrant the massive economic and political commitments that have been bestowed upon AI: a trillion dollars in the past year alone, and the world's civil servants fired en masse and replaced with AI:
>
> https://pluralistic.net/2026/05/13/vibe-governance/#k-hole
>
> 5/
>
> ---
>
> The people who have committed our society and its resources to an all-or-nothing bet on AI will tell you that AI is the everything machine, but when pressed, they will confess that AI is about to *become* the everything machine, for example, once AI starts doing AI research, a thing that AI *cannot* do:
>
> https://www.normaltech.ai/p/ai-agents-cant-yet-do-open-ended
>
> 6/
>
> ---
>
> This is a civilizational act of Magic Underpants Gnomery, and every day that it goes on is a day when more economic, climate and political costs of AI are imposed on all of us. Scientific journals, open source repositories and even science fiction magazines are being overwhelmed by slop, whose perpetrators and apologists insist that *soon*, AI will realize its potential and the slop will be transformed into gold.
>
> 7/
>
> ---
>
> *That's* why AI bosses are so committed to talking up AI's *destructive* potential: because destructive potential is nonetheless *potential*. The moment we stop believing in that potential is the moment that we stop supplying AI companies with bales of cash to shovel into their money-furnaces so that they can afford to sell hundred dollar bills for a dollar each to Elon Musk cultists who want to generate child porn and pictures of Sonic the Hedgehog with giant boobs.
>
> 8/
>
> ---
>
> AI *does* have destructive potential. It has the potential to destroy the productive economy when an AI salesman convinces your boss to fire you and replace you with chatbots that can't do your job:
>
> https://pluralistic.net/2025/03/18/asbestos-in-the-walls/#government-by-spicy-autocomplete
>
> AI has destructive potential because bosses are in a prisoner's dilemma where none of them can admit that the money they've spent - and the jobs they've destroyed - chasing AI has been wasted, and so other bosses bet even harder:
>
> https://pluralistic.net/2026/08/01/dare-snot/#i-will-fucking-piledrive-you-if-you-mention-ai-again
>
> 9/
>
> ---
>
> AI has destructive potential because the data-center bubble has convinced credulous town officials to throw out environmental and planning review, seize people's home and farms, and carpet the countryside with giant data centers (many of which will never be built):
>
> https://www.404media.co/people-hate-datacenters-survey-finds/
>
> AI has destructive potential because it is consuming scarce water and energy and emitting gigatons of carbon:
>
> https://www.404media.co/even-the-u-s-government-says-ai-requires-massive-amounts-of-water/
>
> 10/
>
> ---
>
> *This* is the destructive potential we need to be hammering at, because this isn't the kind of destructive potential that translates into productive potential that will someday make the AI bet pay off. Quite the opposite: this is all about the potential of AI to destroy the economy and consume your retirement savings:
>
> https://www.thebulwark.com/p/congrats-youre-about-to-unwittingly-make-elon-musk-trillionaire-spacex-ipo-index-funds
>
> 11/
>
> ---
>
> Just as importantly: we have to *stop* amplifying tech bosses' chosen narratives about their products' destructive potential, because *this helps them raise more money* and do more terrible things. Bernie Sanders needs to stop insisting that the US government should own 50% of the money-losingest corporations the world has ever seen and start talking about how they will *not* get a government bailout when their investment bubble bursts.
>
> 12/
>
> ---
>
> We need to stop talking about AI "haves" who will enjoy the awesome potential of AI, and AI "have-nots" who will fall behind.
>
> We need to stop talking about "AI safety" and the possibility of "rogue AI" destroying the world. When an AI company's security tool "escapes containment" and hacks someone's servers, we need to ask the company "Why do you suck so bad at building secure sandboxes for your hacking tools?" rather than "Why are your hacking tools so amazingly powerful?"
>
> 13/
>
> ---
>
> Above all, we need to stop talking about AI as *exceptional*. AI is normal. A normal technology has some uses, but isn't useful for all things and all people. A normal technology isn't inevitable, it's something you decide whether you want to use or not.
>
> Treating AI as unexceptional is the *best* way to halt the destructive march of AI companies and their impact on jobs, the climate and the economy.
>
> 14/
>
> ---
>
> But treating AI as unexceptional requires that we stop talking about AI as if it were exceptionally *evil*. Yes, some people who use AI experience severe mental problems, but that's not because AI is a Lovecraftian horror that destroys your brain and your capacity for rational thought if you use it. It's not a *basilisk*.
>
> 15/
>
> ---
>
> AI is like a carny ride that triggers cardiac events in riders who never knew they had a problem because they never experienced those particular g-stresses - it's not something that *induces* vulnerability, it's something that *triggers* vulnerability:
>
> https://pluralistic.net/2026/06/03/mission-space/#gsd
>
> Using AI doesn't make you evil, nor does it risk your sanity - no more than doing any of the other dangerous, compromised, unsustainable things that constitute our daily lives in this fraught moment.
>
> 16/
>
> ---
>
> The world will be better off when the AI companies are bankrupt and their servers are sold off at ten cents on the dollar - but using those servers to run open models in modest, careful ways won't infect you with their wickedness. They are not stained with communicable sin. They're just computers. They are *unexceptional*.
>
> 17/
>
> ---
>
> One way for a technology to be normal is for it to be produced and marketed by an *awful* corporation that wants to do *terrible* things. This isn't to say that "all technologies are dual use, and you have to take the good with the bad." That's the *inevitabilist* argument of vulgar Thatcherites who insist - as Margaret Thatcher did - that "there is no alternative," and we have to accept their abuse if we want to reap the benefits of the technology.
>
> 18/
>
> ---
>
> The *normal* way to deal with this is to reject vulgar Thatcherism in favor of heroic Gibsonism, thundering William Gibson's rallying cry, "the street finds its own use for things," as we seize the means of technology and use it in the ways that benefit us, while restricting, banning, or blocking the uses that harm us:
>
> https://pluralistic.net/2026/03/17/technopolitics/#original-sin
>
> 19/
>
> ---
>
> To treat AI as exceptionally evil is to elevate the mediocrities who run AI companies to super-villain status, a status in which they positively *revel*. A serial liar like Sam Altman will someday trip over his own dick and end up in a cell for securities fraud - unless we keep exalting his evil to Satanic scale, in which case he might make himself "too big to jail":
>
> https://time.com/article/2026/05/26/sam-altman-ai-job-losses-openAI-/
>
> 20/
>
> ---
>
> Altman is a con-man and a stock swindler, not a super-genius. The more we describe his products as possessing a special, durable evil that will endure even after his company fails and he is condemned to history's ash-heap, the more we help Altman raise money for his chatbot Ponzi. Normal technology isn't a cursed artifact. That's something you find in a lich-king's tomb. We need to stop helping Altman burnish his reputation as a lich-king and stop treating AI like it's magic.
>
> 21/
>
> ---
>
> There's a technical term for the kind of tech criticism that inadvertently helps tech bros sell their swindle: "criti-hype," Lee Vinsel's term for "tak[ing] the sensational claims of boosters and entrepreneurs, flip[ping] them, and start talking about 'risks'":
>
> https://peoples-things.ghost.io/youre-doing-it-wrong-notes-on-criticism-and-technology-hype/
>
> 22/
>
> ---
>
> In other words, to commit criti-hype is to repeat the marketing claims of people like Sam Altman and then add, "(and that's bad)" in parentheses at the end. These guys - these terrible, mediocre, boring-ass losers - are bullshit factories, ejecting *fountains* of nonsense about AI. The right way to criticize them is to point out that they're lying - not to repeat their lies as warnings.
>
> eof/

### 14. 우편으로 뭐가 왔는지 좀 봐! (2026-08-07) [link](https://mamot.fr/@pluralistic/117053580260310946)
**Metrics:** 21 boosts, 36 favourites, 2 replies
**Opening hook (verbatim):**
> 우편으로 뭐가 왔는지 좀 봐!

**Structure:** Single short non-English post (Korean: roughly 'Look what came in the mail!'), no links, no thread -- almost certainly a photo caption.
**Framing:** Personal aside, no argumentative framing; a brief glimpse of daily life rather than an essay.
**Full text (verbatim):**
> 우편으로 뭐가 왔는지 좀 봐!

### 15. As Canada is learning (the hard way), the 'art' of all of Trump's deals can be summed up in a single word: 'renege' (2026-08-24) [link](https://mamot.fr/@pluralistic/117152616739417872)
**Metrics:** 30 boosts, 22 favourites, 3 replies (thread of 48 posts)
**Opening hook (verbatim):**
> As Canada is learning (the hard way), the "art" of all of Trump's deals can be summed up in a single word: "renege":

**Structure:** Long essay-thread (48 posts), part of a same-day pair with the linkdump post (#12): a policy manifesto that narrates a geopolitical timeline (Trump/Canada tariffs) before pivoting to a specific legislative ask (repeal Bill C-11).
**Framing:** Argument-to-policy-proposal framing: builds the case through a chronological account of broken trade promises, then proposes a concrete counter-strategy (legalize jailbreaking) as the real 'elbows up.'
**Full text (verbatim):**
> As Canada is learning (the hard way), the "art" of all of Trump's deals can be summed up in a single word: "renege":
>
> https://pluralistic.net/2026/07/22/table-flipper/#graveyard-of-indispensable-nations
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/elbows-really-up/#peoples-revolutionary-front-of-carneyism
>
> 1/
>
> ---
>
> In 2020, Donald Trump ripped up NAFTA, a trade deal that conferred a huge advantage to the USA at Canada's expense, and replaced it with CUSMA, a trade deal that was *even more* advantageous to America, and even *worse* for Canada. In 2024, after being elected for the second time, Trump publicly railed against CUSMA using the exact same language he'd used to decry NAFTA, branding it "a very bad deal" that needed to be shredded and renegotiated.
>
> 2/
>
> ---
>
> To that end, Trump declared sweeping tariffs on Canada's exports, thereby raising the costs Americans paid for many everyday goods, because while Canada does not ship a lot of finished products to the US, it is a key supplier of parts and materials, all of which were made instantly more expensive thanks to the Trump tariffs. Trump went on to insist that Canada should annex itself to the US, becoming the "51st State."
>
> 3/
>
> ---
>
> His operatives openly meddled in Canadian separatist movements, backing the "Wexit" partisans who want to separate the oil-rich, boom/bust-plagued province of Alberta from Canada.
>
> CUSMA was negotiated by Justin Trudeau's government, and Trump II's tariff war landed on Trudeau's successor, Canadian Prime Minister Mark Carney, billed as a technocratic safe pair of hands who could be relied upon for sober, effective leadership.
>
> 4/
>
> ---
>
> Much to everyone's surprise, Carney - the epitome of a "Davos Man" - responded to the Trump tariffs by traveling to Davos and giving a fiery speech denouncing Trump and declaring a "rupture" that left the old world order dead:
>
> https://www.weforum.org/stories/forum-institutional/davos-2026-special-address-by-mark-carney-prime-minister-of-canada/
>
> Carney promised that Canada would go "elbows up" against America, with retaliatory tariffs, blockades and boycotts of key US exports.
>
> 5/
>
> ---
>
> Cutting off this stream of goods would have the same effect on Canadians that Trump's tariffs had on Americans: raising prices. Unlike their American cousins, Canadians were far more tolerant of this increase in their cost of living, because, unlike Americans, Canadians believed the narrative that they were sacrificing for the good of their country against an existential threat from a fractious neighbour.
>
> 6/
>
> ---
>
> Americans were far less willing to believe that Canada was somehow cheating the US or flooding the country with fentanyl.
>
> "Elbows up" is largely a war of symbols, in which Canadians take pride in mastering the minute differences between "Product of Canada," "Made in Canada," "Assembled in Canada," and "Designed in Canada" so they can seek out maximal Canadianness in their consumption choices.
>
> 7/
>
> ---
>
> There's even a kind of twisted honour in committing yourself to drinking Wayne Gretzky's shitty rye in preference to delicious American bourbon, a way to affirm your love of country with each astringent, metallic swallow.
>
> When the trade war was confined to symbolic terrain, Carney's elbows remained reliably elevated. But outside the realm of symbols, Carney's elbows wilted.
>
> 8/
>
> ---
>
> Take the Digital Services tax, a plan to charge America's tax-evading tech giants a 3% levy to make up for the untaxed profits they keep by pretending to be Irish. So long as Trump's tech giants can dodge their tax obligations, they can always outcompete Canada's tech sector, who are expected to pay 38% federal and provincial tax.
>
> 9/
>
> ---
>
> American tech companies are closely allied with the Trump regime: they financed his campaign, conduct domestic and international surveillance for him, provide the software to administer his ethnic cleansing, and restrict access to software that helps Americans evade the armed secret police he sent into the streets to kidnap and disappear his enemies:
>
> https://pluralistic.net/2025/10/06/rogue-capitalism/#orphaned-syrian-refugees-need-not-apply
>
> 10/
>
> ---
>
> Trump repaid his tech giants by threatening Carney with still more tariffs unless he canceled the Digital Service Act, and Carney capitulated. Meanwhile, Carney raced to enact a plan to fire tens of thousands of civil servants and replace them with AI chatbots running American software on American chips:
>
> https://www.pm.gc.ca/en/news/news-releases/2026/06/04/prime-minister-carney-launches-ai-all-canadas-new-national-artificial
>
> 11/
>
> ---
>
> Canada's federal and provincial ministries are all entirely dependent on American cloud software, most notably Microsoft's Office 365, a package that Trump has fashioned into a geopolitical weapon, ordering Microsoft to shut down foreign officials who thwarted his plans, denying them access to all their data and cutting off their ability to communicate with the outside world:
>
> https://apnews.com/article/icc-trump-sanctions-karim-khan-court-a4b4c02751ab84c09718b1b95cbd5db3
>
> 12/
>
> ---
>
> In other words, Canada is already terribly vulnerable to American cyberwarfare. Trump's tech companies don't have to hack into Canada's digital infrastructure to shut it down: they *already* control it.
>
> 13/
>
> ---
>
> But - incredibly - Carney found a way to make this situation *even worse*, turning over key aspects of the digital back-end of Canada's military to Palantir, the tech company most closely aligned with Trump, whose CEO openly boasts that his company was founded to kill America's political enemies:
>
> https://thedeepdive.ca/canada-military-palantir-license-deal/
>
> Carney's symbolic gestures - memorable speeches and minor changes to consumption habits - are second to none.
>
> 14/
>
> ---
>
> But when it comes to building a strong country that is resilient against the attacks we can all foresee (not least because Trump has repeatedly told us he intends to launch them), Carney himself becomes Carneyism's fiercest opponent:
>
> https://pluralistic.net/2026/05/30/rupture/#deeds-not-words
>
> It's not just the attacks that are foreseeable, alas. Trump can always be relied upon - to break his word.
>
> 15/
>
> ---
>
> Carney repeatedly caved to Trump, and in response, Trump has hit Canada with *massive* new tariffs - 50%! Remember: the "art" of every Trump deal is *renege*:
>
> https://www.pbs.org/newshour/economy/what-to-know-about-trumps-50-tariffs-on-canadian-goods-that-just-went-into-effect
>
> Trump can also be relied upon to circle back to his fixations and obsessions.
>
> 16/
>
> ---
>
> Decades ago, someone showed Trump a Mercator projection map of the Earth and he became obsessed with "yuge" Greenland, to the point where he is prepared to dissolve Nato and go to war with Europe to steal it from Denmark:
>
> https://archive.is/3Q8nj
>
> 17/
>
> ---
>
> By the same token, Trump has long been publicly obsessed with the Gilded Age president William McKinley, who enacted sweeping tariffs at a time when the US economy was rapidly growing, a fact that lodged in Trump's brain and led him to believe that tariffs are a surefire growth-hack that will let him eliminate taxes on the wealthy without shutting down the country:
>
> https://edition.cnn.com/2025/02/12/business/trump-william-mckinley-tariffs/
>
> 18/
>
> ---
>
> Trump will still be obsessing about these *idées fixes* when he draws his last breath, gasping out "Greenland...tariffs" as he tumbles from his golden toilet, forehead and coronary arteries bulging from the strain of trying to pass a half-digested Big Mac with only a viscous paste of rectal mucus and Diet Coke to lubricate that final, unyielding bolus.
>
> 19/
>
> ---
>
> The fact that Trump is immune to learning from his mistakes (because that would require admitting that he made a mistake) does not bind Canada to do the same. Quite the contrary: Trump's inability to learn or reason means that if Canada engages in novel retaliatory tactics, it stands a good chance of flummoxing the Mad King, leaving him flat-footed and lumbering while it dekes him out and swarms past him.
>
> 20/
>
> ---
>
> Lucky for Canada, Trump's incontinent belligerence has opened up a large and diverse territory of novel tactics for conducting both geopolitical and economic policy. As November Kelly says, "Trump inherited a poker game rigged in his favour but he flipped over the table anyway because he resents having to pretend to play." The systems that Trump has dismantled as unfair to the US were, in fact, sources of tremendous advantage to America.
>
> 21/
>
> ---
>
> Take those tech companies that have fused so tightly with the Trump regime. These companies operate global monopolies that allow them to extract vast sums and even vaster troves of sensitive data from billions of people around the world. Having attained total economic dominance and total technical lock-in, these companies have embarked on a program of enshittification, squeezing their customers and suppliers for even more data and even more money:
>
> https://us.macmillan.com/books/9780374619329/enshittification/
>
> 22/
>
> ---
>
> Under normal market conditions, the decay of these American platforms would invite competitors from around the world. The fact that Apple and Google extract 30% of every dollar spent in their app stores would bring forth new app stores who were willing to give better deals to app makers and app users. The fact that HP charges $10,000/gallon for the coloured water in its printers would invite competitors who were willing to take a mere 100,000% margin on ink.
>
> 23/
>
> ---
>
> The fact that Meta and Google and Microsoft and Apple spy on you with your devices and software and use that data to target you, manipulate you and overcharge you - and to train their AIs to steal from you even more efficiently - would create demand for privacy blockers, jailbreakers, and other "adversarial interoperability" tools that force your technology to work for *you*, even if the manufacturer wishes it were otherwise:
>
> https://pluralistic.net/2025/11/01/redistribution-vs-predistribution/#elbows-up-eurostack
>
> 24/
>
> ---
>
> But we don't have "normal market conditions." For more than a quarter of a century, the US Trade Representative has demanded that all of America's trading partners - including Canada - enact "anti-circumvention" laws that make it a crime to alter how a digital device works unless the original (usually American) manufacturer consents.
>
> 25/
>
> ---
>
> In other words, it's *illegal* for some Waterloo grads to tap ambitious RIM millionaires for the seed capital to start a company that helps Canadians install Canadian app stores on their Canadian phones so when they buy things from other Canadians, all the money stays in Canada, without a 30% "app tax" being siphoned off by either Google or Apple.
>
> 26/
>
> ---
>
> That's right: in 2012, Canada passed a law that lets *American* companies use *Canada's* courts to destroy *Canadian* companies that help *Canadian* technology users get more out of *their own property*. This law - the Copyright Modernization Act - was wildly unpopular from the start. A federal consultation drew over 6,000 opposing comments, and only *53* comments in support of the bill.
>
> 27/
>
> ---
>
> But Prime Minister Stephen Harper whipped the vote among his Conservative MPs and passed it, because he judged that tariff-free access to America's markets to be a price worth paying:
>
> https://pluralistic.net/2024/11/15/radical-extremists/#sex-pest
>
> 28/
>
> ---
>
> Trump's tariffs prove that this was a bad bargain. By voluntarily gluing its technological elbows to its sides, Canada made itself easy pickings for America's tech giants, who wiped out Canada's tech sector while making Canada geopolitically and economically dependent on - and vulnerable to - the US and its tech companies. Canada is long overdue for a reckoning with this blunder.
>
> 29/
>
> ---
>
> The best time to have made Canada digitally sovereign would have been *before* an American president announced his intention to annex Canada and began explicitly deploying America's tech companies to attack his geopolitical adversaries.
>
> The second-best time is *now*.
>
> 30/
>
> ---
>
> By repealing Bill C-11 and legalizing reverse-engineering and modification of digital technology with consent of its users and in accordance with privacy, consumer and labour rights, Canada will gain a devastating counter to Trump's tariffs.
>
> 31/
>
> ---
>
> Not only will legalizing jailbreaking let Canadians get more out of their own property, it will turn America's tech trillions into Canada's tech billions - *while* making Canada digitally sovereign by facilitating the uncoupling of Canadian ministries, corporations, households, *and* devices from America's cloud. *This* is how Canada removes the digital kill switch it handed to America, a kill switch that can shut down its tractors, phones, and governments.
>
> 32/
>
> ---
>
> This is the *best possible moment* for such a move. To incubate a successful tech sector, you need a) an innovative product; b) skilled technologists; and c) capital. Thanks to Trump, Canada has all three.
>
> First: innovative ideas. Thanks to the prohibition on modifying America's defective tech exports, there is a whole *orchard* of low-hanging fruit for product designers to pick from.
>
> 33/
>
> ---
>
> An app that aggregates all of your streaming services into one place and lets you record shows to watch later, even if the service deletes it; reliable tools for using generic ink and independent app stores; new firmware for tractors and cars that facilitate independent repair and unlock subscription features, and, of course, privacy- and ad-blockers of all description.
>
> 34/
>
> ---
>
> These are truly *disruptive* products, striking at the maddening antifeatures installed at the insistence of sclerotic, extractive tech bosses. Move fast and break *their* things!
>
> 35/
>
> ---
>
> Next: talent. Who will do that fast moving? Again, we can thank Trump for giving Canada an *army* of skilled technologists who have fled Silicon Valley one step ahead of an ICE chud who wanted to black-bag them and deport them to Liberia (or a Salvadoran slave-labor camp). Trump is creating the largest wave of reverse brain-drain in history, as everyone ambitious and smart realizes that their lifelong US tech work dream is a nightmare.
>
> 36/
>
> ---
>
> If Canada can't get enough talent to harvest that orchard of low-hanging fruit from its returning Canadians, it need only open its borders to the skilled technologists of *all* nations who are racing out of America as fast as they can go.
>
> 37/
>
> ---
>
> Finally, money. The AI bubble collapse is imminent. The forces of capital are *desperate* for promising, high-return investment opportunities that *aren't* grossly overvalued, overhyped and underperforming AI companies. Even if you can find a company like that in America, it's increasingly apparent that to make that business a success, you will need to buy more $TRUMP coins than your rivals, lest Trump direct his agencies to destroy your fledgling business.
>
> 38/
>
> ---
>
> And here's the kicker: turning America's trillions into Canada's billions, moving fast and breaking America's tech-kings, fixing the defects in America's extractive tech exports? It's all *good for Americans*. Sure, cratering the share-price of America's Big Tech companies will be bad for America's retirement savers, but the median American worker *only has $955 saved for retirement*:
>
> https://finance.yahoo.com/news/955-saved-for-retirement-millions-are-in-that-boat-150003868.html
>
> 39/
>
> ---
>
> Most Americans are *far* more exposed to the predatory conduct of US tech companies than they are to the share price of those companies. That's because Americans are the beta-testers for every ripoff and surveillance tool that Silicon Valley produces. Long before those tools get to Canada or find their way around the world, they are making Americans poorer and worse off.
>
> 40/
>
> ---
>
> Remember: Canada is America's second largest trading partner. Americans are *really good* at buying things from Canada - even when those things aren't allowed in America. Trump wasn't entirely wrong when he accused Canada of flooding America with drugs - but the drugs Canada sends to America aren't fentanyl and oxy. Canada sends America *insulin* and other cheap pharmaceuticals that cost 10-100x more in Ripoff America than they do in Canada.
>
> 41/
>
> ---
>
> If Americans can figure out how to buy cheap generic meds from Canadians *over the US Postal Service*, they will be able to buy disenshittification tools from Canadians *over the internet*.
>
> Selling Americans products that make their lives better is *much* better politics than boycotting American products that make *Canadians'* lives better.
>
> 42/
>
> ---
>
> No politician can pursue a strategy of higher prices and lower living standards forever - not even if you've got a lot of "elbows up" rhetoric you can use to convince Canadians that they're doing their duty to the nation by paying more for everything. Paying more for everything to punish Americans is like punching yourself in the face as hard as you can and hoping the downstairs neighbours say "ouch."
>
> 43/
>
> ---
>
> When Canadians swap delicious American bourbon for Wayne Gretzky's shitty rye, they punish corn farmers in states that begin and end with a vowel - farmers who have *nothing to do* with Canada's problems.
>
> 44/
>
> ---
>
> By swapping disenshittification for tariffs, Canadians can go back to drinking delicious bourbon, and make money from that farmer by selling him the jailbreaks he needs to fix his tractor without paying the John Deere tax of $200+ that the company charges *after you do your own repair* to send someone to the farm to type an unlock code into your console.
>
> 45/
>
> ---
>
> A lot of Very Serious Grown Up Canadians have told me that they think Carney should confine his response to Trump to toothless symbolic gestures, lest they make Trump mad. Trump is *always* mad. He gets mad at symbolic gestures. He gets mad if you point out that Ronald Reagan thought tariffs were stupid:
>
> https://abcnews.com/Politics/trump-raises-tariffs-canada-10-after-reagan-ad/story?id=126866712
>
> 46/
>
> ---
>
> Freeing Americans from the tyranny of their own tech companies has the power to create a partisan army of American Canada weebs who will fight for Canada when - *not* if - Trump gets mad at Canada. That's the *best* defense Canada can have - common cause and solidarity with the people of America, who share a common enemy in Trump, the least popular president in history, who is looting billions and letting his cronies destroy Americas' lives.
>
> 47/
>
> ---
>
> That's some *real* elbows up stuff. True Carneyism has never been tried - *especially* by Carney. It's long past time someone gave it a go.
>
> eof/

### 16. From its inception, I've loved Creative Commons (2026-07-31) [link](https://mamot.fr/@pluralistic/117014470049200240)
**Metrics:** 29 boosts, 21 favourites, 2 replies (thread of 38 posts)
**Opening hook (verbatim):**
> From its inception, I've loved Creative Commons. I hung out with Lisa Rein, Matt Haughey and Aaron Swartz while they coded up the site, and my first novel was the first professionally published text ever released under a CC license, just weeks after CC itself launched:

**Structure:** Long essay-thread (38 posts) marking Creative Commons' 25th anniversary: half legal explainer (fair use's four factors, first sale, de minimis), half first-person anecdote about fielding fan permission requests.
**Framing:** Explainer-plus-personal-experience framing: teaches copyright's built-in limitations, then illustrates them through his own inbox, closing on a terse maxim ('Life is hard. Read books.').
**Full text (verbatim):**
> From its inception, I've loved Creative Commons. I hung out with Lisa Rein, Matt Haughey and Aaron Swartz while they coded up the site, and my first novel was the first professionally published text ever released under a CC license, just weeks after CC itself launched:
>
> https://creativecommons.org/
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/07/31/just-do-it/#dadt
>
> 1/
>
> ---
>
> In those early days, CC licenses were primarily of interest to people who were steeped in copyright law, lore and litigation; so many of the early debates about these licenses turned on esoteric (but important!) questions about copyright; for example, how CC would interact with copyright's "limitations and exceptions."
>
> 2/
>
> ---
>
> You see, copyright has *never* meant the absolute right to control all uses of a work. Every system of copyright includes a set of "limitations and exceptions" for people making use of copyrighted works without permission, *even if the copyright holder objects to that use*. The best-known example of this is "fair use," a concept from American law.
>
> 3/
>
> ---
>
> Fair use is (potentially) extremely broad, but it's *also* extremely "fact-intensive" - that's the phrase lawyers use to describe the kind of legal question whose answer is almost always "it depends." Fair use might let you copy the entirety of a work, even for a commercial purpose. It might let you create new works based on existing works. It might let you do these things *specifically to discourage people from buying the original*. But...it depends.
>
> 3/
>
> ---
>
> If you know anything about fair use, it's probably something about a "four-step test" used to determine if a usage is fair. These four steps are just questions a judge might ask of someone who's been sued for copyright infringement, but who claims that they were making a fair use. The questions are:
>
> I. What was the "nature and purpose" of your use? Were you doing something "transformative?" Were you criticizing the work? Were you using the work for educational purposes?
>
> 4/
>
> ---
>
> II. What was the nature of the work you used? Was it primarily factual (like a news article) or creative (like a short story)?
>
> III. How much of the work did you take? Did you take more than you needed to transform the work, to accomplish your criticism, to teach someone?
>
> IV. What impact did your use have on the original? Did the copyright holder lose money as a result of your use?
>
> https://fairuse.stanford.edu/overview/fair-use/four-factors/
>
> 5/
>
> ---
>
> These questions are indeed enshrined in US copyright law, but (for better and for worse) you can't figure out if a use is "fair" just by asking these questions. Fair use is ultimately subject to "the rule of reason," a legal principle meaning that the law shouldn't result in obviously stupid restrictions. What's "obviously stupid?" Well, that's the tricky part - you'll have to convince a judge!
>
> 6/
>
> ---
>
> For example, the author of a book called *The Wind Done Gone* was sued for taking the characters, plot and setting of *Gone With the Wind* in order to tell the same story from the perspective of the enslaved Africans who were denied agency and moral consideration in the original. The court found for *The Wind Done Gone*:
>
> https://en.wikipedia.org/wiki/The_Wind_Done_Gone
>
> 7/
>
> ---
>
> *Wind Done Gone* took the "heart" of *Gone With the Wind* (III), but then again, *Done Gone* was highly transformative (I), *Gone With* was also a work of fiction, entitled to the highest level of protection (II). Even worse, the point of *Done Gone* was to point out the gross defects in *Gone With* (I) and thus directly undermine sales and licensing for the original (IV). 
>
> 8/
>
> ---
>
> Anyone who claims you can answer fair use controversies by running through the four factors as though they were a checklist *really* doesn't understand fair use:
>
> https://pluralistic.net/2022/02/06/crypto-copyright-%f0%9f%a4%a1%f0%9f%92%a9/
>
> But even after you've acquired an appreciation of the fact-intensive, nuanced flexibility of fair use, you *still* don't understand copyright's limitations and exceptions. 
>
> 9/
>
> ---
>
> Fair use is important, but there's also "first sale," the doctrine that says that after you buy something, you own it, and copyright can't be used to interfere with your traditional property rights. That's why you can buy and sell used books, paintings, records, and other copyrighted work, *even if* they are sold with fine print that says you're not allowed to:
>
> https://en.wikipedia.org/wiki/Kirtsaeng_v._John_Wiley_%26_Sons,_Inc.
>
> 10/
>
> ---
>
> When it comes to copyright's limitations and exceptions, "fair use" and "first sale" are the big ones, but just as important are the *small* ones - the *really* small ones. Like other laws, copyright is subject to the principle of "*di minimis*" (from a longer Latin phrase that translates as "the law does not concern itself with trifles"):
>
> https://en.wikipedia.org/wiki/De_minimis
>
> 11/
>
> ---
>
> Technically, it may be trespassing to step on someone else's yard. But if your shoe brushes up against their lawn while you're walking on the sidewalk out front of their house, it's not trespassing. Or if it is trespassing, it's a *di minimis* trespass, too small to matter to the law. A *lot* of potential copyright violations - like taking a picture of a passage in a book and posting it to social media - are so small that we don't need to apply a fair use analysis to them.
>
> 12/
>
> ---
>
> They're trifles, and "the law does not concern itself with trifles."
>
> These limitations and exceptions all apply *without permission* from rightsholders. They apply *even if they make rightsholders furious*. They are *your* rights, as a member of the public, as a purchaser of a work, or just as someone who whistles a song that's stuck in your head. 
>
> 13/
>
> ---
>
> And *that's* where the esoteric early Creative Commons copyright debate comes in. Creative Commons is a way to formally codify and convey permission to use copyrighted works. Without Creative Commons, it's *really* hard - and expensive - to provide legally reliable permission to someone else to use something you've created.
>
> 14/
>
> ---
>
> If I want to let you adapt one of my short stories for the stage, we should both probably hire copyright lawyers at several hundred dollars per hour to draft and review a contract setting out what my permission really means. Worse: even after we've paid the lawyers, neither of us will likely *really* understand the fine legal technicalities of the deal. We just have to take the lawyers' word for it that the complex jargon in the contract is sufficient for our purposes. 
>
> 15/
>
> ---
>
> Between the complexity and the expense, there are lots of potential creative collaborations that would cost so much to paper over that they're just not worth doing, even if they'd delight everyone involved.
>
> Creative Commons cuts through this with its standardized licenses, which spell out in plain language which permissions are being granted. Even better, these licenses are *international*, translated into the language and laws of dozens of countries. 
>
> 16/
>
> ---
>
> That means that you can take a CC licensed short story from Japan, animate it using CC licensed 3D models from Italy, set it to a CC licensed soundtrack from Indonesia and release it in Ukraine, and the whole thing *just works*.
>
> Those uses - turning a story into an animation, using a 3D model, syncing a soundtrack to a video - are all pretty ambitious uses, *especially* if you're going to make the final result indefinitely available to the general public. 
>
> 17/
>
> ---
>
> It makes sense to paper over these uses, and Creative Commons makes that legal work as simple as linking to your sources and their licenses in your final product.
>
> But there are *plenty* of uses that *don't* need licenses - even ambitious ones. Remember *Wind Done Gone*? There are circumstances when you can adapt someone else's story without permission, relying instead on a limitation or exception to copyright. 
>
> 18/
>
> ---
>
> And of course, there are plenty of trivial uses - pasting a photo into your groupchat, say - that are *di minimis* and *also* don't need permission.
>
> These copyright flexibilities are critical. Imagine if you could only criticize someone's work if they gave you permission to do so! 
>
> 19/
>
> ---
>
> From the founding of CC, copyfighters raised serious concerns that CC would teach people that they can *only* remix other people's work if they have a license, be it a CC license or the kind that you negotiate with a lawyer.
>
> Today - 25 years later!-  CC is an unqualified success. Without CC, we wouldn't have Wikipedia! You find CC licenses on Youtube, Flickr, Bandcamp, the Internet Archive, and in many of the most important scholarly and scientific journals in the world.
>
> 20/
>
> ---
>
> But, also, 25 years later, the world is even *more* convinced that you must always ask permission: "better safe than sorry." I don't know if CC contributed to this culture of timidity. More likely, it was bullying copyright trolls who terrorized people into a reflex of asking permission for everything, always.
>
> As the creator of more than 30 books, hundreds of collages, and tens of thousands of essays and blog-posts, I am often on the receiving end of permission requests.
>
> 21/
>
> ---
>
> For example, people often ask me if they can use my CC licensed works in ways that the associated licenses *clearly* permit. I'm sure the people who email me for permission to do things I've already granted them permission to do think they're being polite, but I really wish they'd stop. When someone asks me if they can make a use permitted by my CC licenses, I need to carefully parse through their use to make sure they're not asking for something more.
>
> 22/
>
> ---
>
> This is time-consuming work that often involves several volleys of email just to confirm that, no, they're just asking if they can do something I've already told them they can do. This is not a good use of anyone's time! By all means, drop me a note with a link to something you've remixed from my work. That's *fun*! It's a lot more fun than making me play detective in order to figure out if you're exceeding the license's permissions.
>
> 24/
>
> ---
>
> There are also a lot of requests that *clearly* amount to fair use and/or *di minimis*. You don't need to email to get permission to read a brief passage from one of my books on a Youtube video! You don't need my permission to quote one of my stories in an English exam! What's more, the world would be a lot shittier if you did, so let's not act as though that's reasonable behavior, lest we shift the (already far too restrictive) norms, which might even lead to a legal change.
>
> 24/
>
> ---
>
> Finally, there's the people who email me about their desire to make uses that are more (ahem) ambitious, but that no one could possibly find out about or get angry over...*except for the fact that they emailed me to ask my permission.*
>
> 25/
>
> ---
>
> You want to make a tiny bootleg edition of one of my novels for your anarchist book fair? That's *totally* a copyright infringement, it's super-illegal, and if my publisher found out about it, I'm sure they'd send you a sphincter-puckering legal letter telling you to knock it off (and maybe even demanding that you disgorge the seven dollars, three bottlecaps and eleven cool feathers you took in trade for those pirate books).
>
> 26/
>
> ---
>
> But my publisher *won't* ever find out about it - *unless you email me asking for permission*. I absolutely *cannot* give you permission to do this. I have a contract with my publisher promising that I will never authorize someone other than them to publish that book. Once you tell me about your intention to do this, I'm obliged to tell my publisher, so that they can tell you *no* in language that would strip paint off a barn.
>
> 27/
>
> ---
>
> Buying a classroom set of books, but you also want to paste chunks of one of my books into your educational institution's classroom intranet for use as a teaching aid? There's no way my publisher would ever find out you did that, and if they did, sure, you'd also get a blood-curdling legal letter. But dude, *all my books are DRM-free*. 
>
> 28/
>
> ---
>
> You could have just pasted the text into your CMS. In what universe is my publisher going to pay one of their lawyers to review, adjudicate *and* paper over your request to make a use that you're not proposing to pay them for?
>
> 29/
>
> ---
>
> Let's be clear: I'm not giving you permission to pirate my work. I already spend far too much of my time chasing down dickheads who sell competing editions of my books on Amazon and Audible. I'm sick to the back teeth of wrangling Ingram's takedown process to get rid of bootleg print editions of my books.
>
> 30/
>
> ---
>
> What I'm saying is, all of your interactions with copyrighted works need not involve the author and publisher. There is a whole universe of uses that might *technically* violate copyright, might *technically* not fit into *di minimis*, first sale or fair use - but these are also uses that no one would ever find out.
>
> 31/
>
> ---
>
> I get it. You may feel like you can't tell the difference between the kind of uses that no one would give a shit about; the uses that might attract a bone-chilling lawyer letter; and the uses that might land you in court. I'm sorry, but I can't help you figure that one out. I'm not a lawyer. Even if I was, I'm not *your* lawyer.
>
> 32/
>
> ---
>
> This is one of those areas where I break with my friend, the wonderful John Hodgman. On his indispensable podcast "Judge John Hodgman," he frequently admonishes people who are uncertain if they're overstepping a bound in a commercial establishment to ask an employee for permission. For example: should you fill up a water glass with soda water from a self-serve dispenser?
>
> https://maximumfun.org/podcasts/judge-john-hodgman/
>
> 33/
>
> ---
>
> John says you should always ask the cashier. But I've worked jobs like that, and I can tell you there were plenty of jobs where my boss felt strongly that taking $0.0000001 worth of water and bubbles without paying for it was theft...and where I thought my boss was a dick for thinking that. If I pretended I didn't see you getting a glass of fizzy water, the worst that would happen is my boss would tell me to keep a closer eye on the customers lest they steal his precious CO2.
>
> 34/
>
> ---
>
> But if you *asked me* whether you could fill your glass, and my boss caught me saying yes, I'd be *fired*.
>
> There's a lot of normal, perfectly fine stuff that *technically* violates copyright that I can't give you permission to do, because I've signed a contract with my publisher. If you ask me, I'll have to ask my editor, who will say no, even though he thinks it's fine, too. 
>
> 35/
>
> ---
>
> If I push it, he'll have to ask the lawyers, who will almost certainly *also* say no, even if *they* think it's fine, because it doesn't make sense to spend hours papering over a legal agreement with someone who wants to sell seven copies of a book at an anarchist book-fair or upload a couple chapters of a book to a school's intranet.
>
> 36/
>
> ---
>
> Are there instances in which you might misjudge which category your use falls under and end up in court? I guess so. But if that's your concern, asking my permission does no good, because I'm just gonna tell you no.
>
> Life is hard.
>
> Read books.
>
> eof/

### 17. Obviously, the non-American world has a digital sovereignty problem (2026-08-04) [link](https://mamot.fr/@pluralistic/117036956357033588)
**Metrics:** 26 boosts, 22 favourites, 3 replies (thread of 22 posts)
**Opening hook (verbatim):**
> Obviously, the non-American world has a digital sovereignty problem - Trump has means, motive and opportunity to order his tech companies to shut down any public official, large corporation, or individual who displeases him:

**Structure:** Essay-thread (22 posts) built around a specific news hook (the launch of the Technology Freedom Cooperative), framed by his recurring digital-sovereignty argument.
**Framing:** News-hook-plus-endorsement framing: uses a concrete example (Apple pulling the ICE Block app) to establish stakes, then profiles a new nonprofit coalition and a named colleague (Patrick Ball) as a proof-of-concept.
**Full text (verbatim):**
> Obviously, the non-American world has a digital sovereignty problem - Trump has means, motive and opportunity to order his tech companies to shut down any public official, large corporation, or individual who displeases him:
>
> https://pluralistic.net/2026/06/18/their-trillions-our-billions/#eyes-on-the-prize
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/04/technology-freedom-cooperative/#hrdag
>
> 1/
>
> ---
>
> But *Americans* face the same digital sovereignty risk. America is a lawless place now, where a pliable Supreme Court and supine Congress have affirmed that "it's not a crime if the president does it." The same tech giants who sold out to Trump for tax breaks and protection from antitrust enforcement will happily disconnect any member of the American public, any American company, any American official who displeases Trump.
>
> 2/
>
> ---
>
> It's a strange irony that in this moment when so many of us are struggling to "de-Google" our lives, a forcible, sudden de-Googling amounts to a sort of digital death penalty:
>
> https://www.nytimes.com/2022/08/21/technology/google-surveillance-toddler-photo.html
>
> In a world dominated by monopolies, duopolies and cartels, there's every reason in the world to seek protection and insulation from these companies that are "too big to care" - and yet, the very same dominance that makes these companies such a danger also makes them indispensable.
>
> 3/
>
> ---
>
> Take "ICE Block," an iOS app that warns you if there's an ICE thug hunting people like you in your vicinity, which might save you from being kidnapped, disappeared, sent to a concentration camp, forced into slave labor in El Salvador, or simply murdered. 
>
> 4/
>
> ---
>
> In order to protect its relationship with the Trump regime (and the tax breaks, monopoly power and tariff-free access to Chinese labor that that relationship guarantees), Apple declared ICE officers to be a protected class and then removed ICE Block from its App Store:
>
> https://pluralistic.net/2025/10/06/rogue-capitalism/#orphaned-syrian-refugees-need-not-apply
>
> Big Tech is key to Trump's pogroms. Without Oracle's databases, Microsoft's administrative tools, Amazon's cloud, and Google's location data, ICE would be frozen in place. 
>
> 5/
>
> ---
>
> Big Tech is the source of Americans' risk from authoritarian oppression. That means that Americans *cannot* rely on Big Tech to protect them from that authoritarianism.
>
> And yet, after decades of regulatory forbearance and lax antitrust enforcement, Big Tech has forced nearly all its rivals out of business. Who can compete with companies that use Irish domicile to evade taxation and US domicile to evade privacy law?
>
> 6/
>
> ---
>
> There's a joke from eastern Canada I think of often in situations like this. Its punchline goes, "If you wanted to get there, I wouldn't start from here."
>
> But here we are. And speaking of Canada, while it has many problems, it is not (as of time of writing) the USA, but it *is* connected to the USA via the internet. 
>
> 7/
>
> ---
>
> Which means that Americans could - hypothetically - source their computing infrastructure from companies that were based in Canada, and who strictly ensured that they had no dependency on US services and scrupulously avoided a US "enforcement nexus":
>
> https://pluralistic.net/2023/03/05/theyre-still-trying-to-ban-cryptography/
>
> 8/
>
> ---
>
> That is *exactly* what some American - and international - human rights nonprofits have done. The Technology Freedom Cooperative is a brand new organization founded by the Human Rights Data Analysis Group (San Francisco), Kilómetro 0 (Puerto Rico), Invisible Institute (Chicago), Data Cívica (Mexico) and Innocence & Justice Louisiana:
>
> https://www.linkedin.com/pulse/techfreedomcoop-stuart-flack-8eipc/
>
> 9/
>
> ---
>
> All of these organizations are longstanding, highly effective human rights fighters. They have long, storied histories of collecting, analyzing, and presenting data to address systemic discrimination, false imprisonment, extrajudicial killings, war crimes and genocides. They have concluded that they can't rely on US tech and US servers with their data.
>
> 10/
>
> ---
>
> Not after Trump and Microsoft colluded to kill the online accounts of the Chief Prosecutor of the International Criminal Court to punish him for swearing out a genocide warrant against Netanyahu:
>
> https://apnews.com/article/icc-trump-sanctions-karim-khan-court-a4b4c02751ab84c09718b1b95cbd5db3
>
> Tech Freedom Coop has federated computing resources in Canada, the United States, Mexico, Puerto Rico and Europe. 
>
> 11/
>
> ---
>
> By spreading out their data and computation across multiple jurisdictions, they seek to ensure that a US seizure or deletion of their data will not halt their work.
>
> This federated system serves as a replacement for Big Tech's administrative tools - email hosting, cloud storage, document collaboration. More than that: Tech Freedom Coop is also building out its own AI infrastructure, locally hosted and managed.
> 12/
>
> ---
>
> Groups like HRDAG have decades of experience using cutting edge statistical techniques to uncover and reveal the extent of crimes committed during civil wars, hot wars, genocides and secret wars. They built the largest human rights database ever created, to track every death in the Colombian Civil War and estimate the likelihood that each killing was carried out by a CIA-backed militia, FARC guerrillas, or the Colombian military:
>
> https://hrdag.org/colombia/
>
> 13/
>
> ---
>
> They conducted the first ever census of killing by US police officers:
>
> https://hrdag.org/poli/
>
> They partnered with Innocence Project New Orleans to sift through mountains of arrest reports to surface cases similar to successful exonerations, helping more innocents to win their freedom:
>
> https://hrdag.org/2025/02/20/ipno/
>
> Today, they are active across the USA, tracking and analyzing the crimes committed by the Trump regime:
>
> https://hrdag.org/2026/07/05/naming-police-officers-who-kill-in-california/
>
> 14/
>
> ---
>
> And they are working in Gaza, to document the genocide so that someday, the truth can be acknowledged and the perpetrators brought to justice:
>
> https://hrdag.org/pressroom/nyt-gaza-toll/
>
> I've known Patrick Ball, the statistician and programmer who founded HRDAG, for more than 20 years, and every time we meet, I learn something from him. 
>
> 15/
>
> ---
>
> He's the person who comes to mind whenever people tell me that AI is useless and that programmers who claim otherwise are deluded. Patrick is one of the best programmers I know, he is the very best statistician I know, and he's found many, many ways to use coding assistants to help him perform massive data-analysis projects that are vital to human rights struggles. He's a "centaur" if ever there was one:
>
> https://pluralistic.net/2025/12/05/pop-that-bubble/#u-washington 
>
> 16/
>
> ---
>
> It's exciting to see Patrick and his colleagues and collaborators taking these decisive steps to begin building the post-American internet and a kind of post-bubble AI, where AI tools are treated as normal technologies, capable of helping skilled practitioners who have discernment born of experience to apply them wisely to achieve important things:
>
> https://pluralistic.net/2026/07/28/hitl-ers/#aiaioh 
>
> 17/
>
> ---
>
> For more than 20 years, HRDAG has been impressing me with the things we can do using advanced statistical analysis. The current generation of AI tools are founded in advanced stats, too. No one should think that advanced stats can solve all your problems of course. The AI bubble is madness and will lead to ruin - environmental, economic, political:
>
> https://pluralistic.net/2026/05/26/the-ai-will-continue/#until-morale-improves
>
> 18/
>
> ---
>
> The world would be a better place without the AI bubble. But AI? It's fine. It's another form of statistical analysis and inference. There's no reason to use all the planet's energy, computing and water to perform that analysis, but the correct and desirable amount of useful AI-style computation is nowhere near zero.
>
> 19/
>
> ---
>
> The coop is building good AI tools - ones grounded in a realistic assessment of their usefulness and a reasonable commitment of resources to them. They're running open models based on their own data, on computers they own and control. Their stated goal is to "help organizations test whether models are accurate, reproducible, secure, and appropriate for specific human rights use cases." 
>
> 20/
>
> ---
>
> Which brings me to the final component of Tech Freedom Coop: training. They're teaching people who work in human rights how to administer their own servers, secure their data and communications, and analyze data. As their press release says, these are all "skills that are increasingly necessary for human rights organizations documenting abuses of power."
>
> 21/
>
> ---
>
> I've known this was coming for a while now, and I'm so pleased to see that it's finally launched. At last, the first steps towards a post-American internet. 
>
> eof/

### 18. While making this collage... I was amused by how many had 6 or 7 fingers (2026-08-06) [link](https://mamot.fr/@pluralistic/117048261081461887)
**Metrics:** 12 boosts, 34 favourites, 4 replies
**Opening hook (verbatim):**
> While making this collage (and snipping little medieval dudes out of Agostino Ramelli’s 16th C "Theatre of Machines") I was amused by how many had 6 or 7 fingers. Weird hands predate AI - plenty of overworked engravers seem to have lost count.

**Structure:** Single short observational post about his own visual art (paper collage), no links, no thread.
**Framing:** Personal-craft aside: a wry observation connecting old engravings' anatomical errors to the 'AI gives everyone extra fingers' meme, without making an argument.
**Full text (verbatim):**
> While making this collage (and snipping little medieval dudes out of Agostino Ramelli’s 16th C "Theatre of Machines") I was amused by how many had 6 or 7 fingers. Weird hands predate AI - plenty of overworked engravers seem to have lost count.

### 19. Monday's collage came out GREAT (2026-08-08) [link](https://mamot.fr/@pluralistic/117060423409739313)
**Metrics:** 8 boosts, 35 favourites, 4 replies
**Opening hook (verbatim):**
> Monday's collage came out GREAT.

**Structure:** Single bare announcement, no links, no thread.
**Framing:** Minimal self-promotional aside pointing to his visual art practice.
**Full text (verbatim):**
> Monday's collage came out GREAT.

### 20. Have you ever received a Terms of Service or Privacy Policy update from a business you used that was an improvement (2026-08-03) [link](https://mamot.fr/@pluralistic/117031673739385247)
**Metrics:** 25 boosts, 17 favourites, 13 replies
**Opening hook (verbatim):**
> Have you ever received a Terms of Service or Privacy Policy update from a business you used that was an *improvement* on the previous version?

**Structure:** Single rhetorical question, no thread continuation from him (13 replies are other users answering).
**Framing:** Rhetorical-question framing: an open provocation designed to generate replies rather than argue a thesis outright.
**Full text (verbatim):**
> Have you ever received a Terms of Service or Privacy Policy update from a business you used that was an *improvement* on the previous version?

### 21. As far as I can tell, this dialog between MacArthur prize-winning mathematician Terrence Tao and Chatgpt... (2026-07-28) [link](https://mamot.fr/@pluralistic/116997210062423037)
**Metrics:** 21 boosts, 20 favourites, 6 replies (thread of 34 posts)
**Opening hook (verbatim):**
> As far as I can tell, this dialog between MacArthur prize-winning mathematician Terrence Tao and Chatgpt about "the Jacobian conjecture counterexample" is very impressive:

**Structure:** Essay-thread (34 posts) that opens by reacting to a viral example (Tao's ChatGPT math dialogue), admits his own inability to judge it, then pivots into an extended personal anecdote (his local, offline LLM spellchecker) as a case study in AI discernment.
**Framing:** Admission-of-uncertainty framing: uses his own epistemic humility about the math example to set up a broader argument about who is qualified to evaluate AI output, defending a narrow personal AI use against critics.
**Full text (verbatim):**
> As far as I can tell, this dialog between MacArthur prize-winning mathematician Terrence Tao and Chatgpt about "the Jacobian conjecture counterexample" is very impressive:
>
> https://chatgpt.com/share/6a5fdc7a-d6f8-83e8-bbea-8deb42cfed56
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/07/28/hitl-ers/#ai-ai-oh
>
> 1/
>
> ---
>
> Now, the clause "as far as I can tell" is doing a *lot* of work in that sentence. I am reasonably math literate, up to first-year calculus and a lifetime spent around my father (a mathematician). However, I have never heard of "the Jacobian conjecture," and while I know what all the words in the first paragraph of the relevant Wikipedia entry mean, I can't parse any of the sentences they form:
>
> https://en.wikipedia.org/wiki/Jacobian_conjecture
>
> 2/
>
> ---
>
> In other words, I lack the discernment to evaluate the output of the chatbot that Tao exchanged theories with. If you showed me an equally opaque transcript of a "conversation" between a chatbot and a crank with AI psychosis whose math made no sense whatsoever, I couldn't make an *a priori* judgment about which one was a solid piece of mathematical theorizing and which one was a math-flavored word-salad.
>
> 3/
>
> ---
>
> As many skilled programmers can attest, chatbots can produce very useful output - but as even the most ardent AI-assisted coder will admit, chatbot code is also full of baffling, obvious errors (and subtle, hard-to-spot ones):
>
> https://pluralistic.net/2025/08/04/bad-vibe-coding/#maximally-codelike-bugs
>
> These errors (which the industry wants us to refer to as "hallucination" - a whimsical, obscuring, anthropomorphizing euphemism) are the reason that reliable AI use requires the discernment that comes from skill and expertise.
>
> 4/
>
> ---
>
> I use a local chatbot to spellcheck these posts. Chatbots spot all kinds of typos that regular spellcheckers miss:
>
> https://pluralistic.net/2026/02/19/now-we-are-six/#stock-buyback
>
> There's a reactionary group of strangers who seek me out to tell me that I'm a bad person for doing this. These are pointless conversations, mostly because I can barely make out a word over the scraping sounds of all the goalpost-moving these scolding strangers engage in.
>
> 5/
>
> ---
>
> They start by insisting that I'm burning down the planet by running a low-CPU load piece of software on my own computer. After I explain that running a chatbot on my machine uses no more carbon than, say, applying a blur effect to an image in my image editor, they tell me I'm unwisely giving my private data to the AI companies. Then I show them the network logs that demonstrate that my local chatbot doesn't send or receive *any* network data.
>
> 6/
>
> ---
>
> Then they turn to the supposed cognitive effects of using a chatbot to find typos in an essay. I explain that I'm not asking an AI to write things for me or explain them to me - I'm asking it to point out where I've forgotten to put a period at the end of a paragraph, or fatfingered a word like "ever" as "every." I even send them the "before" and "after" of an essay after I've corrected some chatbot-identified typos in it:
>
> https://craphound.com/before.txt
>
> https://craphound.com/after.txt
>
> 7/
>
> ---
>
> This is when things get increasingly pointless. My interlocutors come up with farcical reasons why it's immoral or dangerous to use this LLM-based spellchecker. They say I'm using too much compute and that I could use a simpler piece of software to do the same thing (which is both untrue and silly - I also run a journaling filesystem on my computer that is vastly overpowered for editing a textfile - who cares?). 
>
> 8/
>
> ---
>
> Or they insist that the mere act of making copies of published works in order to count their elements and the relationships between them is a sin, despite the fact that this standard would kill search engines, the Internet Archive, and the Oxford English Dictionary:
>
> https://pluralistic.net/2023/09/17/how-to-think-about-scraping/
>
> 9/
>
> ---
>
> I mean, by all means let's hate the AI companies and work to end their disgusting campaign to pauperize creative workers, but let's not fall into the trap of siding with the media bosses who insist that the salvation of creative labor will arrive when Sam Altman pays David Zaslav for the right to cram the entire Warner catalog into Openai's chatbots:
>
> https://pluralistic.net/2026/03/03/its-a-trap-2/#inheres-at-the-moment-of-fixation
>
> 10/
>
> ---
>
> Above all, my interlocutors continue to insist that my LLM-powered, local, open source chatbot spellchecker will make me a worse writer. It's a very strange insistence. My first word processor was a program listing published in a magazine I bought at a corner store and laboriously typed into my Apple ][+. In the 40+ years since, word processors have gotten *lots* of new features, many of which I thought were useful and many more that I found annoying. 
>
> 11/
>
> ---
>
> There were even some of these features that made the writers who used them worse at writing, in my (expert) judgment.
>
> But from the very start, I knew that you couldn't just trust a spellchecker to correct your documents. I mean, I'm a *science fiction writer*. I started making up silly words *decades* before coining "enshittification." I've been telling spellcheckers to fuck off since I learned to type.
>
> 12/
>
> ---
>
> But from the very start, I knew that you couldn't just trust a spellchecker to correct your documents. I mean, I'm a *science fiction writer*. I started making up silly words *decades* before coining "enshittification." I've been telling spellcheckers to fuck off since I learned to type. If you aren't a good writer, spellcheckers are *dangerous*, and the more "advanced" the spellchecker is, the more dangerous it is. 
>
> 13/
>
> ---
>
> A few of my collaborators insist that I use Office 365's AI-enabled version of Word to work on documents with them. It's *maddening*. I estimate the ratio of good suggestions to bad ones that M365 insists on shoving into my face at about 1:100. It's practically unusable - so much so that I often copy the block of text we're working on into a text editor, make my changes, then paste it back into the Word window.
>
> 14/
>
> ---
>
> If I were to accept even 10% of these suggestions, my work would be made *significantly* worse. Putting chatbots into Word pushed it from "annoying" into "enshittening." I certainly understand how relying on a chatbot to make edits to your work could make it worse.
>
> That's where *discernment* comes in. I have written more than 30 books over the past 25 years. 
>
> 15/
>
> ---
>
> I have *lots* of experience defending my word choices, and not just against the mechanical judgments of a high-handed spellchecker, but also against overreaching copyeditors and paranoid publisher's lawyers. I *know* which words I want to write, and I know *why* I want to write them - and I know when a suggested fix is a good one and when it's wrong or stupid or just plain clunky. When it comes to writing, I have discernment.
>
> 16/
>
> ---
>
> That's not true when it comes to higher math. I would no more ask a chatbot to explain "the Jacobian conjecture counterexample" than I would tell my writing students to get a chatbot to suggest ways to fix their stories:
>
> https://pluralistic.net/2026/01/07/delicious-pizza/#hold-the-gravel
>
> I don't know nearly enough about math to ask a chatbot to explain it, or check my work, or even assemble a bibliography of human-authored works I should work my way through if I want to learn about it. 
>
> 17/
>
> ---
>
> If I wanted to understand "the Jacobian conjecture counterexample," I would set aside several days and work my way through that gnarly Wikipedia entry and its references and blue links to related concepts. If I *really* wanted to understand it, I'd enroll in a course at the Open University or Khan Academy.
>
> 18/
>
> ---
>
> All of this has been obvious to me since I first encountered LLM-powered bots. If you understand a subject really well - well enough to discern useful bot output from defective bot output - then bots can be useful. Sometimes very useful, mostly ordinarily useful. 
>
> 19/
>
> ---
>
> For example, I've been writing Pluralistic for about 6.5 years now. I've written 1,683 posts now (1,684 after I hit publish on this one), and the corpus is now getting large enough that I sometimes struggle to find a post I'm trying to reference, even with all my careful tagging and my extensive knowledge of Wordpress's URL-line options for searching the database with tag and keyword combos.
>
> 20/
>
> ---
>
> I've been toying with exporting my whole corpus and shoveling it into a local chatbot, so that I can type, "Which post did I talk about the evils of showing people your chatbot output in?" and get a link to the correct essay:
>
> https://pluralistic.net/2026/03/02/nonconsensual-slopping/#robowanking
>
> (Don't follow this link! I will be referencing the essay it goes to shortly; I struggled to find it when I sat down to write today; I'd accidentally tagged it with "at" instead of "ai" and missed the typo when I published it.)
>
> 21/
>
> ---
>
> There are very few subjects I have more discernment over than "essays I have written." If I ask a chatbot to tell me which post I'm thinking of, I will *instantly* know which of its guesses are correct and which ones aren't. No one in the universe is better qualified than me to perform this task. No one ever will be.
>
> 22/
>
> ---
>
> Now, as it happens, I know exactly how badly a chatbot can screw up when it comes to my own work, because strangers insist on asking chatbots about me and then, for reasons I find baffling, they send me the output. Please don't show anyone your chatbot transcripts unless they ask to see them. It's embarrassing at best and annoying at worst:
>
> https://pluralistic.net/2026/03/02/nonconsensual-slopping/#robowanking
>
> (There's that reference I promised. You can follow the link now!)
>
> 23/
>
> ---
>
> Again, discernment is *everything* when it comes to getting useful work out of a chatbot. If you don't know anything about my work and you ask a chatbot to explain it to you, you will likely be badly misled. If you are familiar with my work and you ask a chatbot for the best examples where I explain a given subject, you may get a good answer, and if you get a bad one, you'll know it.
>
> 24/
>
> ---
>
> The centrality of discernment to productive AI usage is obvious, and that's why I find the insistence that AI can be used as a teaching assistant (or worse, a *teacher*) so baffling. By definition, a student *isn't* an expert on the subject they're studying. That's the whole point of studying - to acquire knowledge and thus discernment. Asking students to learn via chatbot explanations is both incoherent and dangerous.
>
> 25/
>
> ---
>
> Doubtless, there are ways that teachers might find chatbots useful, but for Christ's sake, don't use them to *teach*. There's plenty of ways teachers can use chatbots without asking students to learn from them.
>
> Here's an example. My daughter graduated from a big, typical American high school a couple years ago, and I spent her high-school years getting progressively angrier about the bad compromises that her teachers were forced into.
>
> 26/
>
> ---
>
> Between "Common Core" and "Advanced Placement," the US system is highly standardized. Teachers are under enormous pressure to teach specific aspects of specific subjects in a specific order, and students are told that their future life chances turn on their ability to pass high-stakes tests:
>
> https://pluralistic.net/2024/01/16/flexibility-in-the-margins/#a-commons
>
> This gives rise to many frustrations for teachers and students alike, but nothing got my dander up so much as my daughter's math teachers' testing practices.
>
> 27/
>
> ---
>
> In all of my kid's higher math classes, teachers had a single, prized set of tests, and lived in fear of these escaping into the wild and turning into cheating aids. As a result, teachers collected students' math exams and quizzes *and did not return them*. Students sat exams, worked through the problems and got their grades - but *were not allowed to take home their tests to see where they went wrong*.
>
> 28/
>
> ---
>
> Look, I *know* I'm no mathematician, and I know I'm not a math teacher, but I know enough about pedagogy to know that this is *crazy*. This is like trying to get better at archery by loosing arrows at a target but not checking to see where they hit. It's *bananas*.
>
> 29/
>
> ---
>
> I also understand why the teachers felt they had to do it. Writing test questions that test for specific concepts in a specific order is a *lot* of work, and generating new tests for every class is the kind of task that would consume time better spent on lesson planning and meeting with students.
>
> It's easy to imagine a teacher who creates prompts for each test question that cause a chatbot to emit a new test paper for each class, along with answer keys. 
>
> 30/
>
> ---
>
> These questions are easily validated by a skilled teacher, who definitionally has the discernment to know whether a test question fits the bill. I could even see vibe-coding a little app to spit these questions out - though again, I would want the teacher to work through the questions each time to make sure they were sound.
>
> Both my parents are teachers. My brother is a teacher. I teach every now and again. Teachers do a lot of repetitive, unrewarding work. 
>
> 31/
>
> ---
>
> They also do a lot of difficult, creative, extremely important work. Good teachers have the discernment to sort good classroom materials from bad ones. They do that already, because just as you don't need an LLM to generate bad spellchecker suggestions, you also don't need an LLM to generate sub-par educational materials. There are plenty of "educational" publishers who'll do that all day long.
>
> 32/
>
> ---
>
> AI is a normal technology. That means there are times when it is useful and times when it is pointless or actively harmful. One rule of thumb for chatbots is that they can only provide useful information to experts who have the discernment to ignore the defective output that LLMs *always* emit. That means that the dream of chatbots as replacements for teachers is a nightmare.
>
> 33/
>
> ---
>
> Getting rid of teachers because we all have chatbots is like getting rid of doctors because we all have the plague.
>
> eof/

### 22. Today's threads (a thread) (2026-08-05) [link](https://mamot.fr/@pluralistic/117042617768434501)
**Metrics:** 22 boosts, 15 favourites, 2 replies (thread of 14 posts)
**Opening hook (verbatim):**
> Today's threads (a thread)	

**Structure:** Same recurring daily-digest format as #12/#25/#26/#27/#30.
**Framing:** Digest/roundup framing: links to the day's essay plus reading list and historical anniversary items.
**Full text (verbatim):**
> Today's threads (a thread)	
>
> Inside: Google is a scammer's paradise; and more!
>
> Archived at: https://pluralistic.net/2026/08/05/absentee-landlord/
>
> #Pluralistic
>
> 1/
>
> ---
>
> Google is a scammer's paradise: The internet's absentee landlord.
>
> https://mamot.fr/@pluralistic/117042522377325981
>
> 2/
>
> ---
>
> Hey look at this
>
> * When the AI bubble bursts, will Europe be ready? https://www.euractiv.com/opinion/when-the-ai-bubble-bursts-will-europe-be-ready/
>
> * Gavin Newsom Makes An Ass Of Himself On Antitrust, Paramount Merger https://www.techdirt.com/2026/08/04/gavin-newsom-makes-an-ass-of-himself-on-antitrust-paramount-merger/
>
> * Against Self-Fulfilling Prophecy https://www.hamiltonnolan.com/p/against-self-fulfilling-prophecy
>
> * Arson markets https://www.merkley.senate.gov/wp-content/uploads/2026.08.03-LTR-Wildfire-Prediction-Markets-FINAL.pdf
>
> * Eight Myths on Software Engineering and GenAI https://queue.acm.org/detail.cfm?id=3807963
>
> 3/
>
> ---
>
> #25yrsago Steve Ballmer: DEVELOPERS DEVELOPERS DEVELOPERS DEVELOPERS DEVELOPERS http://www.ntk.net/ballmer/dancemonkeyboy.mpg
>
> #15yrsago HOWTO E-Z realistic corpse from a cheap plastic skeleton https://propnomicon.blogspot.com/2011/08/quick-and-dirty-corpses.html
>
> #15yrsago $300 Million Button: making customers create logins to buy cost etailer $300M/year https://centercentre.com/
>
> #10yrsago 1 billion computer monitors vulnerable to undetectable firmware attacks https://www.defcon.org/html/defcon-24/dc-24-speakers.html#Cui
>
> 4/
>
> ---
>
> #10yrsago Stiglitz quits Panama’s official money-laundering panel over internal sabotage https://www.reuters.com/article/us-panama-tax-idUSKCN10G24Z/
>
> #10yrsago BBC will use surveillance powers to sniff Britons’ wifi and find license-cheats https://web.archive.org/web/20160806155022/https://www.telegraph.co.uk/news/2016/08/05/bbc-to-deploy-detection-vans-to-snoop-on-internet-users/
>
> #10yrsago How and why to short Uber https://qz.com/707947/investors-have-placed-a-one-way-bet-on-uber-which-made-us-want-to-figure-out-a-way-to-short-it
>
> #5yrsago Facebook's official disinformation research portal is a bad joke https://pluralistic.net/2021/08/06/get-you-coming-and-going/#potemkin-research-program
>
> #5yrsago Scammers sell griefers social media banning services https://pluralistic.net/2021/08/06/get-you-coming-and-going/#curse-of-bigness
>
> 5/
>
> ---
>
> #1yrago Which jobs can be replaced with AI? https://pluralistic.net/2025/08/06/unmerchantable-substitute-goods/#customer-disservice
>
> 6/
>
> ---
>
> Yesterday's threads: Post-American compute for a post-American Internet; and more!
>
> https://mamot.fr/@pluralistic/117037018623588904
>
> 7/
>
> ---
>
> My latest nonfiction book is the internationally bestselling"The Reverse Centaur's Guide to Life After AI," from MCD/Farrar, Straus and Giroux:
>
> https://us.macmillan.com/books/9780374621568/thereversecentaursguidetolifeafterai/
>
> --
>
> My previous nonfiction book is the internationally bestselling "Enshittification: Why Everything Suddenly Got Worse and What to Do About It":
>
> https://us.macmillan.com/books/9780374619329/enshittification/
>
> 8/
>
> ---
>
> My ebooks and audiobooks (from FSGxMCD, Tor Books, Head of Zeus, McSweeneys, Beacon, Verso and others) are for sale all over the net, but I sell 'em too, and when you buy 'em from me, I earn twice as much and you get books with no DRM and no license "agreements."
>
> https://craphound.com/shop/
>
> 9/
>
> ---
>
> Upcoming appearances:
>
> * Virtual: EFFecting Change: Who the Machine Serves, Aug 12
> https://www.eff.org/event/effecting-change-who-machine-serves
>
> * #Edinburgh International Book Festival with Jimmy Wales, Aug 17
> https://www.edbookfest.co.uk/events/the-front-list-cory-doctorow-and-jimmy-wales
>
> * #Sydney: The Festival of Dangerous Ideas, Aug 23-24
> https://festivalofdangerousideas.com/program/
>
> * #Melbourne: Enshittification at the Wheeler Centre, Aug 25
> https://www.wheelercentre.com/events-tickets/season-2026/cory-doctorow-enshittification
>
> 10/
>
> ---
>
> Upcoming appearances (cont'd):
>
> * #Brighton: The Reverse Centaur's Guide to Life After AI with Carole Cadwalladr (Brighton Dome), Sep 8
> https://brightondome.org/whats-on/LSC-cory-doctorow-the-reverse-centaurs-guide-to-life-after-ai/
>
> * #London: The Reverse Centaur's Guide to Life After AI with Riley Quinn (Foyle's Picadilly), Sep 9
> https://www.foyles.co.uk/events/enshittification-cory-doctorow-riley-quinn
>
> * #SouthBend: An Evening With Cory Doctorow (Notre Dame), Oct 6
> https://franco.nd.edu/events/2026/10/06/an-evening-with-cory-doctorow/
>
> * #Vancouver: BC Policy Solutions Gala, Nov 12
> https://bcpolicy.ca/gala/
>
> 11/
>
> ---
>
> Recent appearances:
>
> * The AI Enshittification Bubble (Hidden Forces)
> https://hiddenforces.io/podcasts/the-ai-enshittification-bubble-cory-doctorow/
>
> * F@#$ the AI Overlords (On The Media)
> https://www.wnycstudios.org/podcasts/otm/articles/f-the-ai-overlords
>
> * Why AI Won't Replace Workers, But Will Crash The Economy (Smart Cookies)
> https://www.youtube.com/watch?v=rRRmUuxJolY
>
> * AI and the Enshittification Era (The Weekly Show with Jon Stewart)
> https://www.youtube.com/watch?v=-dAIJRjb-Bw
>
> * AI is not inevitable (Betakit)
> https://www.youtube.com/watch?v=DbiTVkq1WHo
>
> 13/
>
> ---
>
> You can follow these posts as a daily blog at pluralistic.net: no ads, trackers, or data-collection! 
>
> Here's today's edition: https://pluralistic.net/2026/08/05/absentee-landlord/
>
> --
>
> If you prefer a newsletter, subscribe to the plura-list, which is ad-/tracker-free, and is utterly unadorned save a single daily emoji. Today's is "🧇". Suggestions solicited for future emojis!
>
> --
>
> You can also get a fulltext RSS feed, licensed CC BY 4.0:
>
> https://pluralistic.net/feed/
>
> 14/
>
> ---
>
> I'm also on Bluesky. Read today's thread there at:
>
> https://bsky.app/profile/did:web:pluralistic.net/post/3msdflrvyf22z
>
> eof/

### 23. The 'Serenity Prayer'... is usually cited as pop psychology or addiction recovery advice, but I think there's a place for it in policymaking (2026-07-27) [link](https://mamot.fr/@pluralistic/116991564459295969)
**Metrics:** 17 boosts, 19 favourites, 2 replies (thread of 19 posts)
**Opening hook (verbatim):**
> The "Serenity Prayer" (*Serenity to accept things I can't change/Courage to change the things I can/Wisdom to know the difference*) is usually cited as pop psychology or addiction recovery advice, but I think there's a place for it in policymaking.

**Structure:** Essay-thread (19 posts): a policy narrative (EU antitrust enforcement against Big Tech, and Trump's pressure campaign against it) framed through a borrowed self-help maxim.
**Framing:** Maxim-as-lens framing: uses the Serenity Prayer's accept/change/discern structure as an organizing device for a foreign-policy and antitrust argument.
**Full text (verbatim):**
> The "Serenity Prayer" (*Serenity to accept things I can't change/Courage to change the things I can/Wisdom to know the difference*) is usually cited as pop psychology or addiction recovery advice, but I think there's a place for it in policymaking.
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/07/27/eucd-6/#and-the-wisdom-to-know-the-difference
>
> 1/
>
> ---
>
> Take the EU's fight against US Big Tech. During the Biden years, the EU's tech policy matured into something serious and ambitious, culminating in the Digital Markets Act (DMA) and Digital Services Act (DSA), a pair of big, muscular policies that would curb Big Tech's most abusive conduct. The EU's ambition didn't occur in a vacuum: it was part of a global wave of antitrust fervor whose top agenda item was reining in tech:
>
> https://pluralistic.net/2025/06/28/mamdani/#trustbusting
>
> 2/
>
> ---
>
> In this fight, the EU had important partners all over the world. For example, South Korea and Japan used the facts uncovered through EU enforcement action against Google and Apple to pursue similar cases:
>
> https://pluralistic.net/2024/04/10/an-injury-to-one/#is-an-injury-to-all
>
> But the EU's most important partner in its fight against American Big Tech was *America*. Biden's trustbusters - Lina Khan, Rohit Chopra, Jonathan Kanter, Tim Wu, et al - were every bit as serious about Big Tech power as anyone in the EU. 
>
> 3/
>
> ---
>
> After all, the American public are always the first victims of any new tech scam, and America is the only country with a large, affluent population who lack modern, comprehensive consumer privacy protection, making Americans highly prized prey for tech companies:
>
> https://pluralistic.net/2025/04/23/zuckerstreisand/#zdgaf
>
> With America and the EU on the same side of the tech fight, the world had a fighting chance. 
>
> 4/
>
> ---
>
> Tech knew this, which is why Big Tech backed Trump hard during the 2024 election and aggressively curried his favor after he won. From the tech barons who paid $1m each to sit behind Trump on the inaugural dais to the millions tech companies donated to Trump's Epstein Ballroom at the White House, tech has made it clear that it supports anything Trump wants to do, provided he shields Big Tech from any attempt to limit their ability to spy on and steal from Americans and the world.
>
> 5
>
> ---
>
> Even before he took office, Trump made it clear how he would reward tech's loyalty: weeks before the inauguration, Trump went to Davos and threatened the EU with reprisals if they enforced the DSA or DMA against his tech companies:
>
> https://techcrunch.com/2025/01/23/trumps-not-happy-with-how-eu-regulators-have-treated-us-tech-giants/
>
> Trump wasted no time leaning on US trading partners on behalf of Big Tech. He bullied Canadian PM Mark Carney into dropping his plan to tax US tech companies. 
>
> 6/
>
> ---
>
> Big Tech uses a variety of tax-cheating gambits to evade taxation around the world, making it impossible for (tax-paying) domestic companies to compete:
>
> https://www.canada.ca/en/department-finance/news/2025/06/canada-rescinds-digital-services-tax-to-advance-broader-trade-negotiations-with-the-united-states.html
>
> Trump also got UK PM Keir Starmer to drop his plan to tax tech:
>
> https://www.theguardian.com/us-news/2025/apr/01/starmer-offered-big-us-tech-firms-tax-cuts-in-return-for-lower-trump-tariffs
>
> And he got the EU to roll back its plan to regulate AI:
>
> https://fortune.com/2025/11/07/eu-ai-act-weaken-regulation-delay-big-tech-trump-government/
>
> 7/
>
> ---
>
> None of the governments that caved to Trump got anything in return. As I've written:
>
> > Give Trump everything he asks for and he'll demand more. Deny Trump anything and he'll demand more. Sign a contract with Trump and he'll break it. Send Trump an invoice and he'll stiff you. For Trump, "the art of the deal" can be summed up in one word: *renege*.
>
> https://pluralistic.net/2026/07/22/table-flipper/#graveyard-of-indispensable-nations
>
> 8/
>
> ---
>
> Case in point: after the EU surrendered to Trump on AI regulation, Trump announced that a on ban EU officials who had worked on the Digital Services Act from traveling to the USA:
>
> https://www.state.gov/releases/office-of-the-spokesperson/2025/12/announcement-of-actions-to-combat-the-global-censorship-industrial-complex/
>
> Then, after the EU made *more* concessions to Trump, he announced a ban on even *more* EU officials:
>
> https://www.lawfaremedia.org/article/the-trump-administration-targets-europe-s-content-moderation-laws
>
> Trump ordered his tech giants to dig through EU officials' private correspondence so he can figure out who to ban next:
>
> https://www.politico.eu/article/us-congress-judiciary-committee-big-tech-private-communication-eu-officials/
>
> 9/
>
> ---
>
> Trump's tech companies got the memo. When the EU ordered Apple to follow the law, Apple told the EU to fuck off:
>
> https://pluralistic.net/2024/02/06/spoil-the-bunch/#dma
>
> After all, Apple is a key partner in the Trump administration's mass deportations. Apple blocked an iPhone app that warns Apple customers if they're about to be kidnapped or murdered by ICE. Trump *needs* Apple, just as much as Apple needs Trump:
>
> https://pluralistic.net/2025/10/06/rogue-capitalism/#orphaned-syrian-refugees-need-not-apply
>
> 10/
>
> ---
>
> Despite this, the EU keeps trying to enforce its laws against Trump's companies. Last week, the Commission announced a $1b fine against Google for violating the Digital Services Act with conduct that cost Europeans many billions:
>
> https://digital-markets-act.ec.europa.eu/commission-fines-google-eur890-million-breaches-digital-markets-act-2026-07-23_en
>
> In other words, Google wasn't even being ordered to disgorge *all* the money it stole, just some of it. Remember, a fine is a price: the EU's fine here will only make this kind of cheating slightly less profitable.
>
> 11/
>
> ---
>
> Nevertheless, Trump responded immediately by threatening the EU with many billions more in tariffs if they continue to attempt to enforce the law against one of his companies:
>
> https://www.lemonde.fr/en/international/article/2026/07/24/trump-says-eu-to-pay-very-big-price-for-890-million-google-fine_6755804_4.html
>
> Trump, the European Commission and Google all know this is about more than one $1b fine. The DSA and DMA both provide for steeply rising fines and other penalties for repeat offenders, and Google clearly has no plan to end its very profitable European crime-spree. 
>
> 12/
>
> ---
>
> Trump's threats aren't a bid to kill *this* enforcement - Trump wants to kill *all* enforcement.
>
> Retaliatory tariffs aren't the only weapon Trump has at his disposal. If the EU (or any other country) levies a *serious* fine against Google, Apple, Oracle, Microsoft, or any of Trump's other tech companies, Trump can order US banks not to turn over those fines, even after the EU sends them a court order for the money. 
>
> 13/
>
> ---
>
> If a bank defies Trump, he can threaten to yank its charter. Or he could just run the same swindle he pulled on Tiktok: stealing the whole company and selling it to one of his buddies, who will run it the way Trump wants.
>
> The reality is that without America's assistance, the EU has precious little hope of forcing American companies to do things they don't want to do. In terms of the Serenity Prayer, this is "a thing they cannot change."
>
> 14/
>
> ---
>
> The Serenity Prayer doesn't stop with "things you can't change." Next is "courage to change the things I can." The EU has no control over Google's conduct, but it has *total* control over its *own* conduct.
>
> Specifically, the EU could get rid of the laws that ban European companies from modifying US tech exports. The EU adopted the Copyright Directive in 2001. Article 6 of the EUCD makes it a crime to reverse-engineer and modify a device without the manufacturer's permission.
>
> 15/
>
> ---
>
> This law was adopted under pressure from the US Trade Representative, who threatened the EU with tariffs on its exports unless it adopted an "anticircumvention rule" that banned EU technologists from making products that let Europeans prevent US tech companies from stealing their money and data":
>
> https://pluralistic.net/2026/01/01/39c3/#the-new-coalition
>
> 16/
>
> ---
>
> This law is still in force in the EU, despite the fact that Trump (predictably) reneged on the US side of the bargain, hitting the EU with massive tariffs and even threatening to steal part of Denmark.
>
> Article 6 of the Copyright Directive is the reason European tech companies can't jailbreak America's apps, whether that's to get its government and corporate data off of US platforms:
>
> https://pluralistic.net/2025/10/15/freedom-of-movement/#data-dieselgate
>
> 17/
>
> ---
>
> Or to modify American social media apps to respect EU privacy laws:
>
> https://pluralistic.net/2026/01/30/zucksauce/#gandersauce
>
> The EU can't control what Apple or Google do. But the EU can *absolutely* decide whether Trump's companies can use *Europe's courts* to destroy *European companies* that defend the privacy and economic integrity of the *European people*.
>
> 18/
>
> ---
>
> If the EU kills off Article 6 of the Copyright Directive, they can use *European* companies to bring Google and Apple's defective tech exports into compliance with European law. Unlike Trump's companies, those companies can be forced to pay their taxes and respect their users' privacy, labor and consumer rights.
>
> That's the Serenity Prayer's "wisdom to know the difference." 
>
> eof/

### 24. You don't have to believe AI 'art' is good... to understand the reason the capital markets are putting trillions into AI (2026-08-18) [link](https://mamot.fr/@pluralistic/117117069650181826)
**Metrics:** 20 boosts, 15 favourites, 1 replies (thread of 44 posts)
**Opening hook (verbatim):**
> You don't have to believe AI "art" is good (I don't), nor do you have to believe AI "art" *can* be any good (I don't) to understand the reason the capital markets are putting trillions into AI is that *they* believe they can fire workers of every kind and replace them with AI:

**Structure:** Long essay-thread (44 posts), an internal-debate/persuasion piece aimed at his own political allies (artists and labor advocates).
**Framing:** Argue-against-your-allies framing: stakes out a contrarian position against copyright-expansion-based anti-AI advocacy, warning it will backfire, in favor of labor-focused remedies.
**Full text (verbatim):**
> You don't have to believe AI "art" is good (I don't), nor do you have to believe AI "art" *can* be any good (I don't) to understand the reason the capital markets are putting trillions into AI is that *they* believe they can fire workers of every kind and replace them with AI:
>
> https://pluralistic.net/2025/03/18/asbestos-in-the-walls/#government-by-spicy-autocomplete
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/18/enron-corpus/#sign-here
>
> 1/
>
> ---
>
> I'm an artist and a worker. I want to protect my labor interests. So do my peers from across the "creative industries." But a sizable group of my peers think the way we're going to protect our interests is by expanding copyright so that it's unambiguously illegal to scrape the internet, analyze the files retrieved by those scrapers, and publish that analysis (a process more familiarly known as "training AI"):
>
> https://pluralistic.net/2023/09/17/how-to-think-about-scraping/
>
> 2/
>
> ---
>
> This is a losing strategy. First, because banning scraping, or requiring permission to count the elements in creative works, or demanding a license to publish collections of facts about copyrighted works will inflict enormous collateral damage on a wide variety of socially beneficial activities.
>
> 3/
>
> ---
>
> From the OED to search engines to the Internet Archive, so many beneficial activities rely on the fact that copyright permits unlicensed collection and analysis of every copyrighted work as a single, massive corpus, and copyright allows the publication of that analysis without permission from the creators of the works it analyzes.
>
> 4/
>
> ---
>
> A lot of people who are (rightfully) very angry about AI dispute this. They believe that they can craft an "AI training" law that would ban scraping, analysis and publication when these activities are part of AI training, but not when they're undertaken for a benign purpose. I am very, very skeptical of this.
>
> 5/
>
> ---
>
> After 25 years of watching internet policy go badly awry, to the great detriment of workers of all kinds and everyday users, it is my professional, considered opinion that drafting a statute that only stops these "bad" activities is much, much harder than these people think, and may actually be impossible.
>
> 6/
>
> ---
>
> I think some artists advocating for a copyright-based solution to AI's war on labor understand this and have decided that they're willing to catch a lot of dolphins in these legal tuna-nets they're hoping to get from Congress. I get that: there are always trade-offs, and the perfect can't be the enemy of the good.
>
> 7/
>
> ---
>
> But I think they're making the wrong trade-off, and not just because I value archives, accountability corpuses, large-scale linguistic research and search engines. I think they're making the wrong trade-off because *copyright will not protect their livelihoods from AI-based wage erosion*.
>
> 8/
>
> ---
>
> Here's why: the theory of copyright as an "artist's right" is premised on the idea that we artists get these exclusive rights, which we use in our bargaining with media companies and other intermediaries. It's a (pseudo) property right, and it's sub-licensable.
>
> 9/
>
> ---
>
> Just as an entrepreneur might get the contract to supply catering for a sports stadium and then parcel out the pretzel stand, beer bar, and pizza concessions to subcontractors, we're meant to sell our English rights, foreign language rights, graphic novel rights, film rights, audio rights, (and so on) to a variety of media companies.
>
> 10/
>
> ---
>
> To bargain successfully, it's not only necessary to have something valuable to trade: you also need to have *leverage*. You need to have *options*. The other side has to believe that if they lowball you, you will do a deal elsewhere.
>
> This is where copyright fails to serve creative workers. Even at the best of times, the world naturally produces an oversupply of would-be professional artists, and a sufficiency of the talented to fill most of the workaday niches in our field.
>
> 11/
>
> ---
>
> Even exceptional artists - and exceptional works of art - are often commercial flops, for reasons that aren't always well understood (though sometimes it's a self-fulfilling prophecy, where a media company buys the rights and then loses confidence in the work and does not exert itself in the marketing of the work). 
>
> 12/
>
> ---
>
> These are not the best of times. Decades of lax antitrust enforcement has boiled the "creative industries" down to 5 publishers, 4 studios, 3 labels, 2 app stores, and one company that's in charge of all the ebooks and audiobooks.
>
> 13/
>
> ---
>
> Since the 1976 Copyright Act, Congress has acted time and again to broaden copyright. Today's copyright lasts longer, restricts more uses, extends to more kinds of works, and carries stiffer statutory penalties for infringement ($150,000 per download!). The media companies we creative workers bargain with are larger, richer and more profitable than at any time in history - *and we are poorer*.
>
> 14/
>
> ---
>
> The share of those massive profits that ends up in *our* pocket is *lower* than ever - and we don't just get smaller slices of that larger pie, those slices are smaller than the slices we *used* to get, when the pie was much smaller. The rising tide of copyright expansion lifted our bosses' boats - even as our dinghies filled with bilge and sank.
>
> 15/
>
> ---
>
> How could we get so much more to bargain with, only to bargain it all *away*, for less money than we used to get for a much smaller bundle of rights? Simple: giving us rights did not give us *leverage*. Giving us more rights without giving us more bargaining power is like giving your bullied schoolkid extra lunch-money.
>
> 16/
>
> ---
>
> There's no amount of lunch-money that will get that kid fed; but if you keep increasing how much money the kid gets, the bullies will end up so rich that they can afford to run a global campaign demanding that we all think of those poor hungry kids and send them even *more* lunch money.
>
> Copyright's failure to deliver for creative workers doesn't mean that we're doomed to poverty.
>
> 17/
>
> ---
>
> Our works are generating *record* profits for our bosses, and there are *plenty* of ways to change the "distributional outcomes" (the phrase economists use for "who gets what") in arts/labor policy. In 2022, I co-wrote *Chokepoint Capitalism* along with the eminent Australian copyright scholar Rebecca Giblin. The whole book is full of these pro-worker arts policies:
>
> https://pluralistic.net/2022/08/21/what-is-chokepoint-capitalism/
>
> 18/
>
> ---
>
> Rebecca and I start from the premise that artists are workers, not the small businesses that our bosses insist we see ourselves as. The idea that an artist is an LLC with an MFA fits in very neatly with copyright: you're getting this bundle of exclusive rights from Congress and then you bargain, business-to-business, with other companies out there in the world, selling those rights for the best price you can get.
>
> 19/
>
> ---
>
> This approach rarely works, and when it does, it works badly. 50 years of more copyright, richer bosses, *and* poorer artists put the lie to the "LLC with an MFA" approach.
>
> If we're workers, then we derive our power from *labor* rights. The Writers Guild - the only creative workers in world history to have comprehensively beaten AI in their workplace - won their AI fight with a *strike*:
>
> https://pluralistic.net/2023/10/01/how-the-writers-guild-sunk-ais-ship/
>
> 20/
>
> ---
>
> The Hollywood guilds are able to pursue a limited form of "sectoral bargaining" (where all the workers in a field bargain with all its bosses) called "multi-employer bargaining." Bosses *hate* sectoral bargaining, and in 1947 they got it banned outright through the Taft-Hartley Act.
>
> Getting other kinds of creative workers into multi-employer bargaining arrangements will be a *lot* of work - and repealing Taft-Hartley and restoring sectoral bargaining will be even harder.
>
> 21/
>
> ---
>
> But just because it's hard to do the thing that works, it doesn't follow that we should do the easy thing that *doesn't* work.
>
> Compared to winning more labor rights, getting more copyright will be easy. That's because our *bosses* want more copyright. When we demand more copyright, our bosses - the most powerful, profitable media companies in human history, grown rich off our labor - will fight alongside of us.
>
> 22/
>
> ---
>
> But media companies *don't* want to stop AI from depriving us of our wages. Quite the contrary! The whole reason that the Writers Guild had to go on strike was that *movie studios* - not Openai or Anthropic - wanted to replace them with AI. The same studios that are *suing* the AI companies for "mass copyright theft" have made it very clear that they want to buy chatbots from those AI companies and use them to erode our wages and thin our ranks.
>
> 23/
>
> ---
>
> The copyright lawsuits our bosses are waging against the AI companies are intended to force tech companies to pay for licenses before they train their chatbots on our work. But they won't be paying *us* for those licenses - they'll be paying *our bosses*.
>
> The AI copyright fight isn't being fought to protect your wages - it's being fought to see whether your lost wages end up in the pockets of a tech boss or a media boss.
>
> 24/
>
> ---
>
> AI copyright suits are a fight over who's going to get the lion's share when they eat you up for dinner. They're not a way to keep you off the menu.
>
> This becomes more obviously true with each passing day, and this morning, the world got its clearest example of what a poor substitute copyright is for fundamental human rights, like labor rights and privacy rights.
>
> 25/
>
> ---
>
> Last year, Spirit Airlines went bankrupt, a casualty of a monopolized aviation sector and Trump's oil price surge. Ever since, vultures have circled its carcass, picking off its assets in a string of auctions conducted by Spirit's bankruptcy trustees. Today, those trustees announced that *they had sold all of Spirit's employees' data to Google*, for use in AI training:
>
> https://www.axios.com/2026/08/17/google-spirit-airlines-bankruptcy
>
> 26/
>
> ---
>
> Every email, every memo, every calendar entry. *Oceans* of sensitive, personal information, all to be shoveled directly into the bottomless maw of Google's AI training systems. This training data includes messages between colleagues and with outside parties about workers' romantic lives, their health, their family situations. These workers' most private lives will end up as fodder for a Google chatbot.
>
> 27/
>
> ---
>
> Now, all of these workers have a copyright in all of that work. Under international copyright treaties and US law, copyright "inheres at the moment of fixation of a work of human creativity." The very instant a worker sets fingers to keyboard and types out a message with even the smallest quantum of creativity, a new copyright springs into existence, giving the copyright holder 90 years' worth of control over it.
>
> 28/
>
> ---
>
> But even though every one of those emails and messages and memos was written by a human being working for Spirit, the copyright over those works does not belong to the workers. Every single one of them will have signed an employment agreement that designates their emails and other copyrightable work as "works made for hire," owned by Spirit Airlines, which means that their work is now an asset in Spirit's bankruptcy estate.
>
> 29/
>
> ---
>
> That's why that personal information is about to be transferred to a new corporate owner, Google, who can do *anything they want* with it.
>
> We know how terrible this kind of disclosure will be for workers. In 2001, the criminal enterprise Enron collapsed after the extent of its fraud was revealed. In the ensuing litigation, Enron's bankruptcy overseers decided it was too expensive to purge the company's email servers of personal information before entering it into evidence.
>
> 30/
>
> ---
>
> hat meant that once the court battles were over, *all the Enron employees' emails* entered the public domain through the court record:
>
> https://en.wikipedia.org/wiki/Enron_Corpus
>
> The "Enron Corpus" is a foundational data-set in modern computer science. Academics analyzed the data to do pioneering work on machine learning and social graph theory, which found its way into the design and operations of social media companies, who learned how to spot and manipulate social connections by studying it.
>
> 31/
>
> ---
>
> The Enron Corpus isn't just a data-set, though. It's a privacy catastrophe, full of sensitive personal information that haunts the 158 employees whose correspondence is now permanently afloat upon the internet.
>
> Why was the Enron Corpus so exploitable? Because US labor law does not protect this kind of sensitive information when it is in your employer's hands.
>
> 32/
>
> ---
>
> In fact, if your boss ends up with a trove of your personal information in the form of emails, calendar entries and files, *you* will typically be blamed for it: "Why did you use your work computer for personal activities?"
>
> But anthropologists who study computer usage have known for *decades* that *everyone* ends up with personal data on their work devices.
>
> 33/
>
> ---
>
> What's more, this problem is only getting worse, because (thanks to weak labor laws), we're expected to work longer hours and to be on call when we're not at the job, which means that you're often dealing with personal crises after hours from your desk, and dealing with work crises at home from your sofa.
>
> 34/
>
> ---
>
> Any fit-for-purpose labor rights regime would recognize that your privacy rights *must* extend to the data that finds its way onto your boss's computers, even if you put that data there. Any failure to recognize this bedrock fact gives employers free license to plunder and exploit your personal information.
>
> 35/
>
> ---
>
> Of course, labor law isn't the only way to protect private information. While labor law should contain explicit, job-related privacy guarantees, *privacy* law should protect *all* our privacy (after all, Spirit's servers are also full of emails and messages from Spirit's *passengers*).
>
> 36/
>
> ---
>
> Unfortunately for anyone who ever flew on Spirit - or anyone who worked for them - American privacy law is all but dead. America's last consumer privacy law went into effect in *1988*, when the Video Privacy Protection Act made it illegal for video-store clerks to disclose your VHS rental records.
>
> 37/
>
> ---
>
> Google says it won't use your profile or frequent flier info to train its model, but they haven't made the same promise about the millions of messages that passengers exchanged with the airline. Google has also promised to use "de-identification" algorithms to purge the Spirit customer, supplier and employee data of personal information.
>
> 38/
>
> ---
>
> But "de-identification" is a pipe-dream, widely understood by security experts as a form of wishful thinking by companies that want to exploit your personal information while still insisting that they aren't violating your privacy. In reality, "de-identified" data is always vulnerable to "re-identification" attacks:
>
> https://pluralistic.net/2021/04/30/dox-the-world/#experian
>
> 39/
>
> ---
>
> The collapse of privacy and labor rights in post-Reagan America and the mass expansion of copyright over the same period are part of the same phenomenon, aspects of two generations' worth of policies designed to benefit capital at the expense of workers, and corporations at the expense of consumers.
>
> 40/
>
> ---
>
> As consumers, we're told to substitute shopping for legal rights: if a corporation wrongs you, it's easier and quicker to "vote with your wallet" than it is to sue them or ask the government to intervene. Substituting shopping for politics has been a total failure. Shopping your way out of a monopoly is like recycling your way out of a wildfire:
>
> https://pluralistic.net/2026/05/21/purity-culture/#stop-fucking-that-chicken
>
> 41/
>
> ---
>
> As creative workers we were told to stop thinking of ourselves as workers altogether, to become small businesses, and to use the LLC With an MFA method to bargain our way out of exploitative arrangements. This, too, has been a failure:
>
> https://pluralistic.net/2026/03/03/its-a-trap/#inheres-at-the-moment-of-fixation
>
> The sale of Spirit's data to Google for AI training shows us that privacy and labor rights are indispensable.
>
> 42/
>
> ---
>
> We can't substitute market mechanisms like comparison shopping or individual contract negotiations for broad, systemic, inalienable rights backstopped by law.
>
> By demanding the copyright our bosses love, we're seeking the right to be angry about AI, even as the AI companies and our bosses cut deals to train chatbots with our work, which they will use to attack our livelihoods.
>
> 43/
>
> ---
>
> Once we stop pretending to be small businesses, once we abandon the fantasy of LLCs with MFAs, we can join with *every* worker in *every* industry in demanding sectoral bargaining; and with *every* consumer in demanding privacy rights. Winning privacy and labor struggles mean more than the right to be angry about AI - that's the right to *do something* about it.
>
> eof/

### 25. Today's threads (a thread) (2026-08-12) [link](https://mamot.fr/@pluralistic/117081956893620747)
**Metrics:** 16 boosts, 19 favourites, 6 replies (thread of 14 posts)
**Opening hook (verbatim):**
> Today's threads (a thread)	

**Structure:** Same recurring daily-digest format as #12/#22/#26/#27/#30.
**Framing:** Digest/roundup framing.
**Full text (verbatim):**
> Today's threads (a thread)	
>
> Inside: Model collapse; and more!
>
> Archived at: https://pluralistic.net/2026/08/12/insurance-value-of-biodiversity/
>
> #Pluralistic
>
> 1/
>
> ---
>
> Model collapse: Living in a world that's trained on itself.
>
> https://mamot.fr/@pluralistic/117081780444919003
>
> 2/
>
> ---
>
> Hey look at this
>
> * Mamdani’s Taking On Amazon. His Opponent? Chuck Schumer’s Daughter. https://prospect.org/2026/08/11/mamdani-schumer-lobbying-new-york-city-council-amazon-delivery-drivers/
>
> * On AI Coding and Its Discontents https://calnewport.com/on-ai-coding-and-its-discontents/
>
> * Crocs Has a Trick for Dodging Taxes: a Tiny Office in Malta https://www.nytimes.com/2026/08/05/business/economy/crocs-malta-tax-haven.html?unlocked_article_code=1.4VA.UZy2.BtVrP_IVnz8b
>
> * Why State-Level Contract Law is Essential to the Future of Digital Library Rights https://www.libraryjournal.com/story/news/moving-beyond-the-publisher-playbook-why-state-level-contract-law-is-essential-to-the-future-of-digital-library-rights
>
> * What is a Reverse Centaur? https://www.youtube.com/watch?v=CVjt3_bf1bI
>
> 3/
>
> ---
>
> #25yrsago Awful, stupid Wired report on Dutch hacker camp https://web.archive.org/web/20011007084604/https://www.wired.com/news/culture/0,1284,46033,00.html
>
> #20yrsago Our faulty intuition about open systems https://www.ft.com/content/64167124-263d-11db-afa1-0000779e2340
>
> #20yrsago Defending against the last plot won’t save us from the next one https://www.schneier.com/blog/archives/2006/08/terrorism_secur.html
>
> #20yrsago NBC: Hair-gel terrorists posed no risk last week https://web.archive.org/web/20060813194630/http://www.msnbc.msn.com/id/14320452/
>
> #15yrsago AT&T merger leak: it’s all about raising prices and reducing competition https://web.archive.org/web/20110920222524/http://www.broadbandreports.com/shownews/Leaked-ATT-Letter-Demolishes-Case-For-TMobile-Merger-115652
>
> 4/
>
> ---
>
> #10yrsago What’s inside a Tiki Bird? https://miehana.blogspot.com/2016/08/fancy-feathers-restoring-tiki-room-birds.html
>
> #5yrsago End of the line for Reaganomics https://pluralistic.net/2021/08/13/post-bork-era/#manne-down
>
> #5yrsago Smart cities are neither, 2021 edition https://pluralistic.net/2021/08/13/post-bork-era/#our-streets
>
> #1yrago Maga's boss class think they are immune to American carnage https://pluralistic.net/2025/08/13/then-they-came-for-me/#boss-politics
>
> 5/
>
> ---
>
> Yesterday's threads: Surveillance vs guillotines; and more!
>
> https://mamot.fr/@pluralistic/117076727591706613
>
> 6/
>
> ---
>
> My latest nonfiction book is the internationally bestselling"The Reverse Centaur's Guide to Life After AI," from MCD/Farrar, Straus and Giroux:
>
> https://us.macmillan.com/books/9780374621568/thereversecentaursguidetolifeafterai/
>
> --
>
> My previous nonfiction book is the internationally bestselling "Enshittification: Why Everything Suddenly Got Worse and What to Do About It":
>
> https://us.macmillan.com/books/9780374619329/enshittification/
>
> 7/
>
> ---
>
> My ebooks and audiobooks (from FSGxMCD, Tor Books, Head of Zeus, McSweeneys, Beacon, Verso and others) are for sale all over the net, but I sell 'em too, and when you buy 'em from me, I earn twice as much and you get books with no DRM and no license "agreements."
>
> https://craphound.com/shop/
>
> 8/
>
> ---
>
> Upcoming appearances:
>
> * Virtual: EFFecting Change: Who the Machine Serves, Aug 12
> https://www.eff.org/event/effecting-change-who-machine-serves
>
> * #Edinburgh International Book Festival (solo), Aug 16
> https://www.edbookfest.co.uk/events/cory-doctorow-enshittification
>
> * #Edinburgh International Book Festival with Jimmy Wales, Aug 17
> https://www.edbookfest.co.uk/events/the-front-list-cory-doctorow-and-jimmy-wales
>
> * #Sydney: The Festival of Dangerous Ideas, Aug 23-24
> https://festivalofdangerousideas.com/program/
>
> 9/
>
> ---
>
> Upcoming appearances (cont'd):
>
> * #Melbourne: Enshittification at the Wheeler Centre, Aug 25
> https://www.wheelercentre.com/events-tickets/season-2026/cory-doctorow-enshittification
>
> * #Brighton: The Reverse Centaur's Guide to Life After AI with Carole Cadwalladr (Brighton Dome), Sep 8
> https://brightondome.org/whats-on/LSC-cory-doctorow-the-reverse-centaurs-guide-to-life-after-ai/
>
> * #London: Reverse Centaur's Guide to Life After AI w/Riley Quinn (Foyle's Picadilly), Sep 9
> https://www.foyles.co.uk/events/enshittification-cory-doctorow-riley-quinn
>
> * #SouthBend: An Evening With Cory Doctorow (Notre Dame), Oct 6
> https://franco.nd.edu/events/2026/10/06/an-evening-with-cory-doctorow/
>
> 10/
>
> ---
>
> Upcoming appearances (cont'd):
>
> * #Vancouver: BC Policy Solutions Gala, Nov 12
> https://bcpolicy.ca/gala/
>
> 11/
>
> ---
>
> Recent appearances:
>
> * Speculative Fiction for Social Change (Cool People Who Did Cool Stuff)
> https://pocketcasts.com/podcast/cool-people-who-did-cool-stuff/08cbb840-a6ae-013a-d8aa-0acc26574db2/part-one-cory-doctorow-on-speculative-fiction-for-social-change/15ad467c-0832-44c9-91ea-59defd783dba
>
> * AI, automation and enshittification (Telecoms.com)
> https://www.telecoms.com/ai/the-telecoms-com-podcast-ai-automation-and-enshittification
>
> * The AI Enshittification Bubble (Hidden Forces)
> https://hiddenforces.io/podcasts/the-ai-enshittification-bubble-cory-doctorow/
>
> * F@#$ the AI Overlords (On The Media)
> https://www.wnycstudios.org/podcasts/otm/articles/f-the-ai-overlords
>
> * Why AI Won't Replace Workers, But Will Crash The Economy (Smart Cookies)
> https://www.youtube.com/watch?v=rRRmUuxJolY
>
> 12/
>
> ---
>
> You can follow these posts as a daily blog at pluralistic.net: no ads, trackers, or data-collection! 
>
> Here's today's edition: https://pluralistic.net/2026/08/12/insurance-value-of-biodiversity/
>
> --
>
> If you prefer a newsletter, subscribe to the plura-list, which is ad-/tracker-free, and is utterly unadorned save a single daily emoji. Today's is "🐐". Suggestions solicited for future emojis!
>
> --
>
> You can also get a fulltext RSS feed, licensed CC BY 4.0:
>
> https://pluralistic.net/feed/
>
> 13/
>
> ---
>
> I'm also on Bluesky. Read today's thread there at:
>
> https://bsky.app/profile/doctorow.pluralistic.net/post/3msuu4xjjek2h
>
> eof/

### 26. Today's thread2s (a thread) (2026-08-01) [link](https://mamot.fr/@pluralistic/117020378449814951)
**Metrics:** 15 boosts, 15 favourites, 3 replies (thread of 15 posts)
**Opening hook (verbatim):**
> Today's thread2s (a thread)	

**Structure:** Same recurring daily-digest format (note the typo 'thread2s' in the original).
**Framing:** Digest/roundup framing.
**Full text (verbatim):**
> Today's thread2s (a thread)	
>
> Inside: Why businesses lie about AI; and more!
>
> Archived at: https://pluralistic.net/2026/08/01/dare-snot/
>
> #Pluralistic
>
> 1/
>
> ---
>
> Why businesses lie about AI: Humoring the boss all the way into bankruptcy.
>
> https://mamot.fr/@pluralistic/117020262269371294
>
> 2
>
> ---
>
> Hey look at this
>
> * The rent was already high. Then came the $200 work-from-home fee https://finance.yahoo.com/real-estate/articles/rent-already-high-then-came-174555709.html
>
> * Families in London temporary housing told they cannot use in-built AC https://www.theguardian.com/society/2026/jul/27/homeless-families-london-temporary-housing-air-conditioning
>
> * The New Defcon Badges Pack a Unique Open Source Chip That Doubles as a Security Key https://www.wired.com/story/defcon-34-badge-baochip-andrew-bunnie-huang/
>
> * US government map of Africa mislabels every country at global conference https://www.theguardian.com/us-news/2026/jul/30/government-map-mislabels-african-countries?CMP=Share_AndroidApp_Other
>
> * EFF Guide to Recording Law Enforcement https://www.eff.org/deeplinks/2026/07/eff-guide-recording-law-enforcement
>
> 3/
>
> ---
>
> #25yrsago Vernor Vinge in the NYT  https://www.nytimes.com/2001/08/02/technology/a-scientist-s-art-computer-fiction.html
>
> #25yrsago Why publishers should thank Syklarov https://web.archive.org/web/20011023092940/http://www.zdnet.com/zdnn/stories/comment/0,5859,2800985,00.html
>
> #25yrsago David Byrne track to be bundled with WinXP https://web.archive.org/web/20010804040357/http://www.ananova.com/news/story/sm_365899.html?menu=news.technology
>
> #20yrsago Five things about blogs that no one ever needs to say again https://web.archive.org/web/20060813090449/http://www.stevenberlinjohnson.com/2006/08/five_things_all.html
>
> #15yrsago Castles made from human hair https://inhabitat.com/artist-uses-human-hair-to-construct-a-castle-of-3000-bricks/
>
> 4/
>
> ---
>
> #15yrsago Wisconsin Democratic voters targeted with Koch-funded absentee ballot notices advising them to vote 2 days after the recall election https://www.politico.com/blogs/david-catanese/2011/08/afp-wisconsin-ballots-have-late-return-date-037977?showall
>
> #15yrsago Gingrich’s million Twitter followers: “80% dummy accounts, 10% paid followers” https://web.archive.org/web/20110812100159/https://gawker.com/5826645/most-of-newt-gingrichs-twitter-followers-are-fake
>
> #15yrsago Missouri State business-school professor leads successful campaign to ban Slaughterhouse-Five from local schools https://www.theguardian.com/books/2011/jul/29/slaughterhouse-five-banned-us-school
>
> 5/
>
> ---
>
> #10yrsago Australian media accessibility group raises red flag about DRM in web standards https://hotelsantalya.net/accessiq/news/news/2016-p/08-p/concerns-raised-for-assistive-technology-development-as-w3c-debates-encrypted/
>
> #10yrsago Reminder: the GOP has been attacking veterans and their families for years https://web.archive.org/web/20160803203106/https://crookedtimber.org/2016/08/02/trumps-indecent-proposal/
>
> #10yrsago Isis joins Donald Trump in denouncing Khizr Khan https://web.archive.org/web/20160802161454/https://theintercept.com/2016/08/02/donald-trump-and-islamic-state-agree-no-room-for-people-like-khizr-khan/
>
> #10yrsago Furries don’t have sex in fursuits https://www.ohjoysextoy.com/fursuits-grey-white/
>
> #5yrsago Machine learning sucks at covid https://pluralistic.net/2021/08/02/autoquack/#gigo
>
> 6/
>
> ---
>
> #1yrago AI's pogo-stick grift https://pluralistic.net/2025/08/02/inventing-the-pedestrian/#three-apis-in-a-trenchcoat
>
> 7/
>
> ---
>
> Yesterday's threads: Better to beg forgiveness; and more!
>
> https://mamot.fr/@pluralistic/117014573978677030
>
> 8/
>
> ---
>
> My latest nonfiction book is the internationally bestselling"The Reverse Centaur's Guide to Life After AI," from MCD/Farrar, Straus and Giroux:
>
> https://us.macmillan.com/books/9780374621568/thereversecentaursguidetolifeafterai/
>
> --
>
> My previous nonfiction book is the internationally bestselling "Enshittification: Why Everything Suddenly Got Worse and What to Do About It":
>
> https://us.macmillan.com/books/9780374619329/enshittification/
>
> 9/
>
> ---
>
> My ebooks and audiobooks (from FSGxMCD, Tor Books, Head of Zeus, McSweeneys, Beacon, Verso and others) are for sale all over the net, but I sell 'em too, and when you buy 'em from me, I earn twice as much and you get books with no DRM and no license "agreements."
>
> https://craphound.com/shop/
>
> 10/
>
> ---
>
> Upcoming appearances:
>
> * Virtual: EFFecting Change: Who the Machine Serves, Aug 12
> https://www.eff.org/event/effecting-change-who-machine-serves
>
> * #Edinburgh International Book Festival with Jimmy Wales, Aug 17
> https://www.edbookfest.co.uk/events/the-front-list-cory-doctorow-and-jimmy-wales
>
> * #Sydney: The Festival of Dangerous Ideas, Aug 23-24
> https://festivalofdangerousideas.com/program/
>
> * #Melbourne: Enshittification at the Wheeler Centre, Aug 25
> https://www.wheelercentre.com/events-tickets/season-2026/cory-doctorow-enshittification
>
> 11/
>
> ---
>
> Upcoming appearances (cont'd):
>
> * #Brighton: The Reverse Centaur's Guide to Life After AI with Carole Cadwalladr (Brighton Dome), Sep 8
> https://brightondome.org/whats-on/LSC-cory-doctorow-the-reverse-centaurs-guide-to-life-after-ai/
>
> * #London: The Reverse Centaur's Guide to Life After AI with Riley Quinn (Foyle's Picadilly), Sep 9
> https://www.foyles.co.uk/events/enshittification-cory-doctorow-riley-quinn
>
> * #SouthBend: An Evening With Cory Doctorow (Notre Dame), Oct 6
> https://franco.nd.edu/events/2026/10/06/an-evening-with-cory-doctorow/
>
> * #Vancouver: BC Policy Solutions Gala, Nov 12
> https://bcpolicy.ca/gala/
>
> 12/
>
> ---
>
> Recent appearances:
>
> * F@#$ the AI Overlords (On The Media)
> https://www.wnycstudios.org/podcasts/otm/articles/f-the-ai-overlords
>
> * Why AI Won't Replace Workers, But Will Crash The Economy (Smart Cookies)
> https://www.youtube.com/watch?v=rRRmUuxJolY
>
> * AI and the Enshittification Era (The Weekly Show with Jon Stewart)
> https://www.youtube.com/watch?v=-dAIJRjb-Bw
>
> * AI is not inevitable (Betakit)
> https://www.youtube.com/watch?v=DbiTVkq1WHo
>
> * A Conversation with Lina Khan (Law and Economy Student Network)
> https://www.youtube.com/live/7Ak5LZllqwE
>
> 13/
>
> ---
>
> You can follow these posts as a daily blog at pluralistic.net: no ads, trackers, or data-collection! 
>
> Here's today's edition: https://pluralistic.net/2026/08/01/dare-snot/
>
> --
>
> If you prefer a newsletter, subscribe to the plura-list, which is ad-/tracker-free, and is utterly unadorned save a single daily emoji. Today's is "🦡". Suggestions solicited for future emojis!
>
> --
>
> You can also get a fulltext RSS feed, licensed CC BY 4.0:
>
> https://pluralistic.net/feed/
>
> 14/
>
> ---
>
> I'm also on Bluesky. Read today's thread there at:
>
> https://bsky.app/profile/doctorow.pluralistic.net/post/3mrzjfsyqo22j
>
> eof/

### 27. Today's threads (a thread) (2026-08-19) [link](https://mamot.fr/@pluralistic/117121090724073316)
**Metrics:** 19 boosts, 9 favourites, 5 replies (thread of 15 posts)
**Opening hook (verbatim):**
> Today's threads (a thread)	

**Structure:** Same recurring daily-digest format as #12/#22/#25/#30.
**Framing:** Digest/roundup framing.
**Full text (verbatim):**
> Today's threads (a thread)	
>
> Inside: The ordinariness of evil; and more!
>
> Archived at: https://pluralistic.net/2026/08/19/banaility/
>
> #Pluralistic
>
> 1/
>
> ---
>
> The ordinariness of evil: Stop selling AI (bad).
>
> https://mamot.fr/@pluralistic/117121055423124959
>
> 2/
>
> ---
>
> Hey look at this
>
> * Are We Still Litigating Whether Corporate Profit-Taking Contributed to Inflation?  https://www.thesling.org/are-we-still-litigating-whether-corporate-profit-taking-contributed-to-inflation/
>
> * Hook and Squeeze https://data4democracy.substack.com/p/hook-and-squeeze
>
> 3/
>
> ---
>
> #25yrsago Dot-com crash toilet paper https://web.archive.org/web/20010822220826/http://news.cnet.com/news/0-1007-200-6908350.html
>
> #25yrsago Associated Press says a single sentence excerpt is not fair use https://web.archive.org/web/20050717075914/http://www.infoanarchy.org/?op=displaystory;sid=2001/8/17/202249/240
>
> #15yrsago German Pirate Party poised to win first federal election https://torrentfreak.com/german-pirate-party-on-course-to-election-win-110820/
>
> #15yrsago Understanding the Nym Wars https://epeus.blogspot.com/2011/08/google-plus-must-stop-this-identity.html
>
> #15yrsago Journalism school teaches students pre-digital newspaper production techniques https://journoterrorist.com/2011/08/02/paperball2/
>
> 4/
>
> ---
>
> #15yrsago 90 percent of US net users don’t know from crtl-F https://www.theatlantic.com/technology/archive/2011/08/crazy-90-percent-of-people-dont-know-how-to-use-ctrl-f/243840/
>
> #15yrsago Bruce Sterling’s Augmented Reality project https://web.archive.org/web/20110827010512/https://www.wired.com/beyond_the_beyond/2011/08/augmented-reality-science-fiction-writer-becomes-augmented-reality-developer/
>
> #10yrsago Woman sues cops because they destroyed her empty house, thinking a suspect was hiding in it https://www.techdirt.com/2016/08/19/woman-sues-after-police-destroy-her-home-during-10-hour-standoff-with-family-dog/
>
> #10yrsago US Army committed $6.5 trillion in accounting fraud in one year https://www.reuters.com/article/us-usa-audit-army-idUSKCN10U1IG/
>
> 5/
>
> ---
>
> #10yrsago Candid Republican operators admit that voter ID laws are about disenfranchisement https://www.brennancenter.org/our-work/research-reports/when-politicians-tell-truth-voting-restrictions
>
> #1yrago Become unoptimizable https://pluralistic.net/2025/08/20/billionaireism/#surveillance-infantalism
>
> 6/
>
> ---
>
> Yesterday's threads: IP can't save you from AI; and more!
>
> https://mamot.fr/@pluralistic/117117159439667176
>
> 7/
>
> ---
>
> My latest nonfiction book is the internationally bestselling"The Reverse Centaur's Guide to Life After AI," from MCD/Farrar, Straus and Giroux:
>
> https://us.macmillan.com/books/9780374621568/thereversecentaursguidetolifeafterai/
>
> --
>
> My previous nonfiction book is the internationally bestselling "Enshittification: Why Everything Suddenly Got Worse and What to Do About It":
>
> https://us.macmillan.com/books/9780374619329/enshittification/
>
> 8/
>
> ---
>
> My ebooks and audiobooks (from FSGxMCD, Tor Books, Head of Zeus, McSweeneys, Beacon, Verso and others) are for sale all over the net, but I sell 'em too, and when you buy 'em from me, I earn twice as much and you get books with no DRM and no license "agreements."
>
> https://craphound.com/shop/
>
> 9/
>
> ---
>
> Upcoming appearances:
>
> * #Sydney: The Festival of Dangerous Ideas, Aug 23-24
> https://festivalofdangerousideas.com/program/
>
> * #Melbourne: Enshittification at the Wheeler Centre, Aug 25
> https://www.wheelercentre.com/events-tickets/season-2026/cory-doctorow-enshittification
>
> * #London: AI and the Enshittification of the Media, NUJ (Sep 2)
> https://www.nuj.org.uk/learn/ems-event-calendar/ai-and-the-enshitification-of-the-media.html
>
> * #Brighton: The Reverse Centaur's Guide to Life After AI with Carole Cadwalladr (Brighton Dome), Sep 8
> https://brightondome.org/whats-on/LSC-cory-doctorow-the-reverse-centaurs-guide-to-life-after-ai/
>
> 10/
>
> ---
>
> Upcoming appearances (cont'd):
>
> * #Manchester: Take Back Big Tech with Jovan Owusu-Nepaul (House of Books and Friends), Sep 11
> https://ma.to/event/cory-doctorow-house-of-books-and-friends-11-sep-2026
>
> * #London: The Reverse Centaur's Guide to Life After AI with Riley Quinn (Foyle's Picadilly), Sep 9
> https://www.foyles.co.uk/events/enshittification-cory-doctorow-riley-quinn
>
> * #SouthBend: An Evening With Cory Doctorow (Notre Dame), Oct 6
> https://franco.nd.edu/events/2026/10/06/an-evening-with-cory-doctorow/
>
> * #Victoria: Munro's Books (Oct 20)
> https://www.munrobooks.com/events/6113620261020
>
> 11/
>
> ---
>
> Upcoming appearances (cont'd)
>
> * #Vancouver: BC Policy Solutions Gala, Nov 12
> https://bcpolicy.ca/gala/
>
> 12/
>
> ---
>
> Recent appearances:
>
> * Deflating the AI Bubble (Do Not Pass Go)
> https://www.donotpassgo.ca/p/deflating-the-ai-bubble-with-cory
>
> * Technofeudal Enshittification (Fucking Cancelled)
> https://www.fuckingcancelled.com/p/technofeudal-enshittification-with
>
> * Who The Machine Serves (EFF)
> https://archive.org/details/effecting-change-who-the-machine-serves
>
> * Speculative Fiction for Social Change II (Cool People Who Did Cool Stuff)
> https://pocketcasts.com/podcast/cool-people-who-did-cool-stuff/08cbb840-a6ae-013a-d8aa-0acc26574db2/part-two-cory-doctorow-on-speculative-fiction-for-social-change/937e8800-9404-45a6-b5e3-90ebee2cfaea
>
> * Speculative Fiction for Social Change I (Cool People Who Did Cool Stuff)
> https://pocketcasts.com/podcast/cool-people-who-did-cool-stuff/08cbb840-a6ae-013a-d8aa-0acc26574db2/part-one-cory-doctorow-on-speculative-fiction-for-social-change/15ad467c-0832-44c9-91ea-59defd783dba
>
> 13/
>
> ---
>
> You can follow these posts as a daily blog at pluralistic.net: no ads, trackers, or data-collection! 
>
> Here's today's edition: https://pluralistic.net/2026/08/19/banaility/
>
> --
>
> If you prefer a newsletter, subscribe to the plura-list, which is ad-/tracker-free, and is utterly unadorned save a single daily emoji. Today's is "🦥". Suggestions solicited for future emojis!
>
> --
>
> You can also get a fulltext RSS feed, licensed CC BY 4.0:
>
> https://pluralistic.net/feed/
>
> 14/
>
> ---
>
> I'm also on Bluesky. Read today's thread there at:
>
> https://bsky.app/profile/did:web:pluralistic.net/post/3mtgabpugcc27
>
> eof/

### 28. One of my favorite rhetorical/ analytical moves is joining things together...and taking them apart (2026-08-12) [link](https://mamot.fr/@pluralistic/117081780444919003)
**Metrics:** 19 boosts, 9 favourites, 3 replies (thread of 50 posts)
**Opening hook (verbatim):**
> One of my favorite rhetorical/ analytical moves is joining things together (showing how seemingly unrelated ideas are parts of the same phenomenon) and taking them apart (resolving paradoxes by demonstrating that what appears like a contradictory thing is actually two things,  lumped together).

**Structure:** Long essay-thread (50 posts), a meta-rhetorical essay that names its own analytical method up front, then applies it across several AI debates, incorporating a block-quoted external essay (Lauren Leek on cultural homogenization).
**Framing:** Named-method framing: explicitly labels the 'join together / take apart' technique as the essay's organizing device, then demonstrates it repeatedly across unrelated AI controversies.
**Full text (verbatim):**
> One of my favorite rhetorical/ analytical moves is joining things together (showing how seemingly unrelated ideas are parts of the same phenomenon) and taking them apart (resolving paradoxes by demonstrating that what appears like a contradictory thing is actually two things,  lumped together).
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/12/insurance-value-of-biodiversity/#model-collapse
>
> 1/
>
> ---
>
> "Taking things apart" is a useful framework for analyzing AI. How do we resolve the (seeming) paradox that some skilled workers report wonderful results working with AI, while others are full of dire warnings about the lurking defects in their AI-assisted outputs? Simple: the first group are "centaurs" (humans who are assisted by machines) and the second are "reverse centaurs" (humans who have been pressed into service as peripherals for machines):
>
> https://pluralistic.net/2025/12/05/pop-that-bubble/#UWashington 
>
> 2/
>
> ---
>
> What are we to make of the people who've been fired by bosses who replaced them with AI, in light of the fact that AI is demonstrably not able to do their (former) jobs? Again, it's simple if you separate out two distinct phenomena: "AI can do your job" is the first. 
>
> 3/
>
> ---
>
> The second is: "Your boss is a credulous dolt who is infinitely horny for replacing lippy workers with pliable machines, which made him an easy mark for an AI salesman who convinced him to fire you and replace you with an AI that *can't* do your job":
>
> https://pluralistic.net/2025/03/18/asbestos-in-the-walls/#government-by-spicy-autocomplete
>
> 4/
>
> ---
>
> This is also a useful move for understanding the AI investment bubble. It's not just billionaires who don't think other people are as real as they are and consequently their jobs can be done by chatbots. It's *also* billionaires who believe that bosses can be sold AI and don't care if the AI is defective, because that's your boss's problem after he buys the AI and fires you. 
>
> 5/
>
> ---
>
> They don't have to believe in AI in order to think it's a good investment: like an investor betting that Joe Rogan can sell millions of dollars' worth of peptides to desperate young men, they are assessing the sales potential, not the merits of the thing for sale:
>
> https://pluralistic.net/2026/08/03/andor/#either 
>
> 6/
>
> ---
>
> As useful as "taking things apart" is, "putting things together" is also a *very* important technique for assessing, critiquing and improving AI. In a *stellar* essay entitled "Temperature Zero for Culture: Why Everything Is Starting to Look the Same" by the data scientist Lauren Leek, we get a top-notch example of "putting things together":
>
> https://laurenleek.substack.com/p/temperature-zero-for-culture-why
>
> 7/
>
> ---
>
> Leek's essay is one of those fabulous, wide-ranging, cross-disciplinary pieces, touching on urban design, music trends, synthetic LLM crowds, Netflix recommendation algorithms, and several other subjects, all seeking to resolve a(nother) (seeming) paradox: how is it that we have so much *potential* variety, but *everything* is so manifestly *the same*?
>
> 8/
>
> ---
>
> The answer is complicated and nuanced, but Leek's foundational point is that in a data-driven society, "predictions" are self-fulfilling prophecies. As Leek puts it: "Once prediction shapes the choices in front of us, we lose the ability to tell the difference between what people wanted and what the system made easy to want."
>
> 9/
>
> ---
>
> This is a pervasive issue across many domains. Leek says that economists call it "performativity," while machine learning researchers call it "model collapse" and urbanists call it "placelessness."
>
> "Performativity" describes how, once a market has been modeled by economists, that model becomes the foundation for economic policy, which pushes the market to conform to the model:
>
> https://press.princeton.edu/books/paperback/9780691138497/do-economists-make-markets
>
> 10/
>
> ---
>
> "Model collapse" describes how machine learning models that are trained on their own predictions become incredibly bland, with all variety disappearing from the system's predictions:
>
> https://pluralistic.net/2024/03/14/inhuman-centipede/#enshittibottification
>
> This is hugely consequential: it's why bias proliferates through predictive policing algorithms: train a model with data from racist stop-and-frisks and it will predict that all the weapons and drugs in a city are to be found in Black and brown peoples' pockets. 
>
> 11/
>
> ---
>
> Turn those predictions into recommendations telling cops where to go look for weapons and drugs and they will double down on racist stops, producing even more biased training data, which turns into still more bias in the predictions:
>
> https://hrdag.org/2016/10/10/predictive-policing-reinforces-police-bias/
>
> 12/
>
> ---
>
> "Placelessness" is the urbanist's name for "when everywhere optimises toward the same template." I think of it as Flinstones Syndrome, where the same background is looped behind Fred and Barney as they drive through Bedrock. In New York City, it's Citibank-bodega-Chipotle-Walgreens; in the Chicago suburbs, it's the strip malls with a Chili's, a gas station, and a big box store.
>
> 13/
>
> ---
>
> Leek proposes that these are all expressions of the same underlying phenomenon, a failure mode of data science that takes a world of "granular personal data" and arrives at a world where "personalisation produc[es] more sameness."
>
> To these excellent examples, I'd add another one, from the world of monetary policy: Goodhart's Law, which holds that "When a measure becomes a target, it ceases to be a good measure":
>
> https://en.wikipedia.org/wiki/Goodhart%27s_law
>
> 14/
>
> ---
>
> Goodhart's Law captures a wide variety of phenomena. When Google first deployed Pagerank, they showed that by counting the inbound links to all the pages on the web, you could extract a signal about which pages were most important (because there was no reason to link to a page unless you found it noteworthy).
>
> 15/
>
> ---
>
> But once Pagerank became the dominant means by which web users found pages, counting links stopped being useful: first, because people used Pagerank to find the best pages and link to them, making it impossible for new pages to get the inbound links needed to supersede incumbent pages; and second, because it's easy for fraudsters to create inbound links for low-quality pages in bulk, once there's a reason to do so.
>
> 16/
>
> ---
>
> Counting inbound links was a world-beating *retrospective* way of predicting which page would best match a searcher's query, but once it shaped the world it sought to analyze, it ceased to be a good *prospective* way to predict which page would best match your queries.
>
> 17/
>
> ---
>
> Leek is a brilliant data scientist and an even better science communicator, with a knack for crisp, readily understood explanations. How can a world of granular, highly varied data turn into a world of homogeneous choices? Simple: start with a set of items ("cuisines, genres, shop types") and a standard algorithm for sorting them. Let users choose from those recommendations. 
>
> 18/
>
> ---
>
> The mode (average) of those choices "gets shown more, so it gets picked more, so the model grows more confident the mode is what people want, and the tails starve." Run this for a few rounds and the evenly distributed catalog of choices "collapses onto one dominant option."
>
> 19/
>
> ---
>
> This is intrinsic in the choices we make in designing recommendation algorithms, tilting them towards the likelihood of a successful recommendation. A recommender that wants to succeed every time will make the safest possible recommendations, "so an algorithm that is uncertain about you, and it is always at least a little uncertain, hedges toward the average."
>
> 20/
>
> ---
>
> Then she busts out a beautiful statistics aphorism: "Personalisation under a standard loss function is regression to the collective mean with extra steps." That is, "regression to the mean" (the tendency of varied things to become standardized) cannot be avoided with a standard personalization algorithm. That algorithm is going to play it safe, showing you things that are broadly palatable, and because your choices are constrained to the average, you will choose average things.
>
> 21
>
> ---
>
> This is how recommendation systems - and other analytical tools that produce predictions that are then turned into action - force so many diverse phenomena (streets, markets, media recommendations) into sameness. The fact that these recommenders are self-fulfilling prophecies means that "they don't have to be *right*," only "listened to."
>
> 22/
>
> ---
>
> This explains the sameness of so many of London's high streets. Leek examines 640 shopping streets, characterizing 18,000 food places spread out across them, flagging all the chain restaurants. Her analysis shows that any two London streets will, on average, share about half of their "food profile."
>
> 23/
>
> ---
>
> Obviously, this is most pronounced on streets with chains, and it doesn't take that many chain outlets before a street's sameness shoots up: "A relatively small number of repeated names is enough to make otherwise different streets resemble one another more." So why do streets with chains resemble one another so much? Because the chains use an algorithm (weighting footfall, proximity to train stations, demographics, and competitors) to decide where to put their restaurants. 
>
> 24/
>
> ---
>
> If a street with a Gail's Bakery on it feels like every other street with a Gail's Bakery, that's because Gail's only puts its restaurants in places that have highly similar characteristics, measured to a high degree of accuracy and controlled by a narrow set of tolerances.
>
> 25/
>
> ---
>
> In other words, every street that *feels* like it should have a Gail's will *eventually* get a Gail's, whereupon that street will feel even more like all the other streets that have a Gail's, because it will share one more common factor with those other streets (a Gail's).
>
> Leek points here to her earlier work on pub closures in the UK. The UK has experienced an epidemic of pub closures, with thousands of pubs disappearing since 2016:
>
> https://laurenleek.substack.com/p/britain-lost-14000-third-places-they
>
> 26/
>
> ---
>
> Her research found that the biggest predictor of a pub surviving was its similarity to the median pub; which is to say that the more distinctive a pub was, the more "character" it had, the more likely it was to close. Pubs that are different from the average pub are harder to categorize, which means they're harder for a bank manager to assess for creditworthiness or for a landlord to justify extending a long-term lease to. 
>
> 27/
>
> ---
>
> The algorithms used to allocate capital and real estate are *also* recommenders, and they *also* drive variety out of the system.
>
> 28/
>
> ---
>
> This same phenomenon acts on culture. In an age of music recommendation algorithms, hit songs are changing; today's songs use a smaller vocabulary of unique words and repeat those words more often:
>
> > Vocabulary richness, distinct words relative to length, has fallen by more than a quarter since the early 1960s, while the share of repeated lines has climbed by nearly a third. The modern hit says less and says it more often, because the hook that works gets repeated.
>
> 29/
>
> ---
>
> But that's not the whole story! While each song resembles *itself* more ("saying less more often"), within that constraint, there's far *more* variety today than before: a given song's (constrained) vocabulary has grown *more* distinct when compared to all the other songs' vocabularies. Songs repeat the words they use, but the words repeated in songs are getting more different.
>
> 30/
>
> ---
>
> For Leek, this is the key to understanding the whole phenomenon and (more importantly) *doing something* about it. Music recommendation systems optimized for a singable hook, but did not optimize on any of the other variables in songs, so those dimensions acquired a broader range, even as the optmized variable got flatter and narrower.
>
> 31/
>
> ---
>
> This means that the tendency of recommenders to "flatten the world" isn't a single blunt outcome: it depends on which dimension we choose to flatten through recommendation, and *who* chooses to flatten that dimension.
>
> A media recommender optimizes for consumption, showing you a tractable set of things it believes you'll watch, read or listen to. 
>
> 32/
>
> ---
>
> When you choose from among this limited set, the recommender takes note of that fact and shows you more of the same, pushing everything to a greige median. All the movies, books and songs you might have liked that were omitted from that initial set are excluded from being recommended in the future. The features of that media that you might have appreciated "decay out of consideration." They are never tested for desirability. The model collapses.
>
> 33/
>
> ---
>
> How badly does it collapse? Leek cites Movietweetings' data on which movies people watch: out of a million public movie ratings, half relate to the top 2% of movies in the set. There's 38,000 films in the set, but just *380* titles account for 40% of the ratings. Leek argues (persuasively) that this isn't because recommenders are good at "knowing your taste" - rather, they are good at "narrowing the menu."
>
> 34/
>
> ---
>
> Leek relates this to her work on creating LLM "personas" - synthetic populations meant to mimic the tastes and proclivities of real groups of people, that you can interrogate "before you spend money asking actual humans." While this would be useful for many applications, "it fails in exactly the way this whole essay is about."
>
> 35/
>
> ---
>
> Leek went to enormous lengths to reproduce the traits that make people interesting to study in aggregate, painstakingly replicating the ways that social connections, psychological outlook and demographic factors predict people's beliefs. The result was a set of LLM personas with "elaborate stories" about how they differed from one another, but whose survey responses about planned actions were homogeneous in a way that real populations are not.
>
> 36/
>
> ---
>
> This, Leek writes, is the same force that homogenizes other data-driven predictors. Because she'd ordered her LLM to reproduce the statistically validated relationships between different factors that predict a person's beliefs, each synthetic persona was a homogenized average. It's like the paradox of "The Average Man," where military uniforms sized to the average of all service personnel fit no one, because no one is average:
>
> https://archive.org/details/DTIC_AD0010203
>
> 37/
>
> ---
>
> The thing is (as Leek points out) the idea that synthetic personas are a good way to understand the preferences of a real population is not a harmless delusion: it's a product that's being actively sold to governments, campaigning politicians and marketers. It's a self-fulfilling prophecy that drives governance, political campaigns and product design to the same homogeneous median that is making every shopping street in London feel the same.
>
> 38/
>
> ---
>
> This matters. As Leek writes, ecologists have long understood the importance of variety for systemic resilience: they call it "the insurance value of biodiversity." A diverse system has reservoirs of species and variation that may not be optimized for how things stand *now*, but that can move into niches created when things *change* in ways that lay waste to the previously dominant organisms. 
>
> 39/
>
> ---
>
> As anyone whose favorite banana went extinct can tell you, homogeneity *works* well, but diversity *fails* well:
>
> https://en.wikipedia.org/wiki/Gros_Michel
>
> The brittleness of algorithm-induced homogeneity is compounded by the fact that recommenders obscure the *true* preferences of people. 
>
> 40/
>
> ---
>
> If you watch two Scandinavian crime dramas after Netflix recommends them, it will keep showing you Scandy crime for the next decade - even if there's another kind of programming  you'd vastly prefer (if only you knew about it). This means that decision-makers who choose which shows will get made in the future will keep on funding their safe Danish detectives, to the exclusion of whatever might emerge from the same weird attractor that produced the K-Pop Demon Hunter fortune.
>
> 41/
>
> ---
>
> Transpose this failure mode onto states, bank managers and landlords, and we see whole ranges of policies, businesses and activities that never come into existence, despite the popularity, prosperity and joy they might bring us.
>
> 42/
>
> ---
>
> But Leek doesn't end with this worrisome note. Instead, she identifies this whole thing - model collapse, placelessness, performativity, even Goodhart's Law - as an expression of one of the best-understood tradeoffs in computer science: "exploration vs exploitation":
>
> > Any system learning from feedback has to divide its effort between exploiting what already scores well and exploring options it hasn’t tried, in case they’re better.
>
> 43/
>
> ---
>
> Computer scientists have long understood that focusing on exploitation to the exclusion of exploration is a trap that locks you into "the first decent option" so you can never discover the best one.
>
> Which means that this algorithmic homogeneity has a well-understood corrective: "forcing exploration back in." The problem is that markets *hate* this kind of exploration. 
>
> 44/
>
> ---
>
> A company that lives and dies by how many clicks it gets is never going to sacrifice 20% of its traffic by showing its users weird, untested options that score worse than the median because these weird things have never had a chance to prove that they are desirable.
>
> 45/
>
> ---
>
> This is a classic market failure, and, as Leek points out, there are regulatory responses in the UK (the Digital Markets, Competition and Consumers Act) and the EU (the Digital Services Act), both of which require the largest platforms to open up their recommendation systems, but so far, regulators have focused on "online harms" rather than variety (though the DSA does require platforms to offer algorithmic recommendations that are not based on your personal traits).
>
> 46/
>
> ---
>
> Leek identifies to willingness of states to intervene in algorithm design as a means by which "exploration" can be forced back into the system. She's also bullish on interoperability, so that users can leave platforms with bad recommenders, without losing access to their media or social circles. As she writes, "the deepest discipline on a feed that has trapped you is the credible ability to leave it and take your data with you." I couldn't agree more:
>
> https://pluralistic.net/2023/01/08/watch-the-surpluses/
>
> 47/
>
> ---
>
> She's less hopeful about individual responses. Demanding that you be an "adventurous consumer" is a way of letting systems off the hook. When every street has the same restaurants and every bookshop has the same books and the people in your life are all locked into one of two social media platforms, "choosing wisely" only gets you so far. Shopping isn't politics!
>
> https://pluralistic.net/2026/05/21/purity-culture/#stop-fucking-that-chicken
>
> 48/
>
> ---
>
> Leek is a superb writer. After reading this piece yesterday, I sent it to half a dozen people and then read everything else in Leek's newsletter archives. Not only is it all brilliant, but I also realized that she'd written one of the most memorable articles about cities and platforms I've read in the last year, "How Google Maps quietly allocates survival across London’s restaurants - and how I built a dashboard to see through it":
>
> https://laurenleek.substack.com/p/how-google-maps-quietly-allocates
>
> 49/
>
> ---
>
> I should have added Leek's newsletter to my RSS reader when I read that last December. I've rectified that oversight! What a fantastic thinker, scientist and communicator! If she isn't being relentlessly pestered by editors and literary agents offering her a book deal, then it really does prove that the recommender systems are elevating the bland median over the thoroughly, delightfully spiky outliers. 
>
> eof/

### 29. The greatest magic trick of them all is lying (2026-08-03) [link](https://mamot.fr/@pluralistic/117030639698172447)
**Metrics:** 14 boosts, 14 favourites, 2 replies (thread of 28 posts)
**Opening hook (verbatim):**
> The greatest magic trick of them all is *lying*. The reason you can't figure out that coin vanish even after the conjurer performs it three times in a row is that they *didn't* do the same trick three times in a row! 

**Structure:** Essay-thread (28 posts) that opens with a stage-magic analogy and uses it to dismantle a specific claim (an interviewer's argument that predictive chatbots are becoming conscious).
**Framing:** Extended-analogy framing: a coin-vanish trick stands in for rhetorical sleight-of-hand, used to debunk a syllogism equating predictive text with human consciousness.
**Full text (verbatim):**
> The greatest magic trick of them all is *lying*. The reason you can't figure out that coin vanish even after the conjurer performs it three times in a row is that they *didn't* do the same trick three times in a row! 
>
> --
>
> If you'd like an essay-formatted version of this thread to read or share, here's a link to it on pluralistic.net, my surveillance-free, ad-free, tracker-free blog:
>
> https://pluralistic.net/2026/08/03/andor/#either
>
> 1/
>
> ---
>
> They did three *different* tricks: "Didn't catch it? Here, let me do it again!" is a lie:
>
> https://magiciansmag.com/3-cool-coin-disappearing-trick/
>
> There's times when it makes sense to treat two outcomes as the same, even if they were produced by very different means. As a reader, my enjoyment of your novel is the same whether it was dictated, typed on an Underwood Noiseless, keyed into a word processor, or scratched out with a fountain pen:
>
> https://nealstephenson.substack.com/p/writing-by-hand-is-good-for-your
>
> 2/
>
> ---
>
> There's plenty of routes that arrive at the same place, and if the destination is all that matters to you, it's fine to ignore the journey. But often, those end-points have subtle differences that are only revealed when things go wrong. If all you care about is how things work, chances are good that you're in for an unpleasant surprise when things *fail*.
>
> 3/
>
> ---
>
> I recently found myself arguing with an interviewer about whether AI is/could be conscious. Not whether it might someday be possible to make an artificial consciousness - as a materialist, I'll stipulate to this. I think everything we call "consciousness" is the result of a physical process occurring within our bodies (and *possibly* around them?), so I think it's perfectly reasonable to imagine that someday we might create another physical process that produces the same effect.
>
> 4/
>
> ---
>
> But that's not what the interviewer wanted to argue about. His point was that teaching more words to the word-guessing program would produce consciousness, an argument I always liken to "breeding horses to run faster and faster until one of them foals a locomotive." In support of this (outlandish) proposition, the interviewer performed a kind of cognitive coin-trick. 
>
> 5/
>
> ---
>
> He said, "I can often predict what my wife is going to say, and so can a chatbot that's been trained on her words. Therefore, we're both doing the same conscious work - and therefore the chatbot will eventually be as conscious as I am."
>
> 6/
>
> ---
>
> "Predicting what you will say through an understanding based on a theory of your mind" and "predicting what you are going to say based on a statistical analysis of your utterances" might produce the same *outputs*, but they are *not* the same trick. You can tell by what happens when the trick fails.
>
> 7/
>
> ---
>
> My wife and I have been together for 23 years now, and there's plenty of times that we can finish each other's sentences - and so can the autocomplete on our phones. The autocomplete manages the trick by exploiting the fact that we often repeat ourselves. But *we* manage the trick by *understanding each other* (and by exploiting the fact of repetition).
>
> 8/
>
> ---
>
> When my wife says something surprising - because she is angry or delighted, sad or happy - I can make a reliable guess about what caused my prediction to misfire. Our "sentence completion" trick doesn't emerge from a rough, automatically generated mental table of the statistical likelihood that word A will follow word B. We also *understand why* those combinations appear in each other's speech and writing.
>
> 9/
>
> ---
>
> "Understanding" and "statistical extrapolation" *can* often lead to the same place, but when they *don't*, "understanding" provides a way forward, while "extrapolation" founders. Both work fine, but only one fails gracefully. The two tricks only *appear* the same, but they are fundamentally different.
>
> 10/
>
> ---
>
> AI's investor story - and the science fiction tales of AI's eventual capabilities that underpin that investor story - makes heavy use of this conjurer's trick, in which two different outcomes are equated to one another because they resemble each other.
>
> This "ignore the journey, focus on the destination" idea is baked *very deeply* into the way we think about AI. Take the "Turing Test," a complicated and nuanced thought-experiment proposed in 1950. 
>
> 11/
>
> ---
>
> Over the ensuing 75 years, Turing's thought-experiment has been stripped down into a blunt metric: "Can a chatbot trick a human into thinking it is also human?"
>
> https://en.wikipedia.org/wiki/Timeline_of_artificial_intelligence
>
> "I mistook a chatbot for a human" and "I took a human for a human" arrive at near-identical places, but they are subtly and importantly different. 
>
> 12/
>
> ---
>
> The erroneous assumption that my phone's autocomplete is actually a person who understands me well enough to finish my sentences works fine, but the instant I turn to it for understanding, it will fail very badly. Autocomplete's predictions are always grounded in who you *used to be*, which means autocomplete knows very little about who you are now, and absolutely nothing about who you will become:
>
> https://reallifemag.com/instant-recall/
>
> 13/
>
> ---
>
> The low-rez Turing Test that captured popular discourse is profoundly misleading. It's the unsound foundation of a worldview that renders you incapable of distinguishing your understanding of your spouse from their phone's autocomplete function. It's the self-serving rationale that leads you to declare yourself a proud stochastic parrot:
>
> https://xcancel.com/sama/status/1599471830255177728
>
> 14/
>
> ---
>
> The AI bubble is (seemingly) full of contradictions, but - like those baffling coin-tricks - these contradictions often resolve themselves very neatly once you realize that the "contradiction" is actually just *two things* that appear to be one.
>
> For example, *some* of the billionaires who put up the first several hundred million for AI are solipsists who just don't believe other people are entirely real and therefore find it easy to believe that AI can do their jobs. 
>
> 15/
>
> ---
>
> *Other* billionaires are cynics who think that bosses can be sold defective worker-replacing chatbots because they're credulous suckers for that pitch, the same way they believe that desperate young men are suckers for Joe Rogan's useless and/or dangerous supplements and peptides:
>
> https://pluralistic.net/2026/07/24/supplemental-income/#andrew-tate-gwyneth-paltrow
>
> 16/
>
> ---
>
> Billionaire AI true believers and billionaire AI cynics make for a powerful coalition. The roadblocks that might discourage the first group are easily hurdled by the second, and vice-versa. You don't have to believe AI works to believe it can be sold, and you don't have to be motivated by the sales opportunity to believe that AI is about to become god.
>
> 17/
>
> ---
>
> Almost every debate I get into about AI turns out to be an unjustified, unacknowledged conflation of two things that seem similar, but have profoundly different underlying characteristics. Take this argument: "Every time we extend rights to the nonhuman world - watersheds, endangered animals, ecosystems - the world gets better. Let's extend rights to AI - whether or not we think it's a 'person' and so reap those benefits."
>
> 18/
>
> ---
>
> This, too, is a coin trick. Extending rights to *nature* reliably makes the world better, but extending rights to *constructs* makes the world *far* worse (Exhibit A is corporate personhood) (obviously).
>
> A few moments' thought reveals the difference. If we extend rights to a watershed, that might result in an AI data-center being killed. If we extend rights to AI, that might lead to sacrificing the watershed to cool the data-center:
>
> https://pluralistic.net/2026/07/10/posthuman-as-in-no-humans/#hell-is-other-people
>
> 19/
>
> ---
>
> Then there's AI and labor. The world is full of skilled workers who have found ways to use AI on the job that they insist have improved their work. It's also full of skilled workers who warn us that on-the-job AI is producing tech debt at unimaginable scale, seriously depreciating the quality of the tools we use today, and setting us up for painful reckonings in the future.
>
> 20/
>
> ---
>
> This (seeming) contradiction melts away once you realize that these workers only *appear* to be doing the same thing. The first group of workers, excited about their AI-assisted output, are "centaurs": people assisted by machines; workers who choose the time and manner of their AI adoption. The second group are "reverse centaurs": people recruited to serve as peripherals for machines, who direct their actions and workflow:
>
> https://pluralistic.net/2025/12/05/pop-that-bubble/#uwashington  
>
> 21/
>
> ---
>
> Note that this isn't the same thing as saying "A skilled worker who adopts a tool willingly is always right and will produce a better output as a result." Nor is it saying, "The tool is so flawed that workers who claim it works for them must be deluded."
>
> 22/
>
> ---
>
> That's another coin trick! The reality - again - is that this is *two* things: *some* workers whose AI-assisted work is measurably worse are wrong about AI making their work better (centaurs, but wrong), *and*; *some* workers are being forced to use AI and know damned well that it's making their work *worse* (reverse centaurs).
>
> 23/
>
> ---
>
> Finally, there's an *economic* coin-trick: "AI will destroy jobs." Sure, yes, AI is destroying jobs. But there's a vast difference between "You got fired because an AI can do your job" and "You got fired because your boss was convinced that the AI can do your job, even though it *cannot*."
>
> This is one of the most consequential coin-tricks, because it's a real convincer for the investors who are funding the AI bubble. 
>
> 24/
>
> ---
>
> The difference is *huge*: "AI can do your job" means you're well and truly screwed. If an AI can *really* replace a contract lawyer, then everyone who needs a contract written or evaluated should be on the side of mass technological unemployment for contract lawyers. The point of contract lawyers is to produce contracts, not to pay contract lawyers' law-school debts and mortgages.
>
> 25/
>
> ---
>
> BUT! If some BigLaw's credulous partners can be suckered into firing their juniors and replacing them with chatbots who bill you $1,200/hour to produce unenforceable, error-riddled contracts, then everyone who needs a contract is on the same side as the contract lawyers - united in opposition to their bosses:
>
> https://www.loweringthebar.net/2026/06/its-finally-happened-both-sides-ai.html
>
> 26/
>
> ---
>
> Every time we fail to draw this distinction, we help an AI boss raise another billion dollars. Every time we insist on this distinction, we hasten the day that the AI bubble pops, thus sparing a few more everyday savers and innocent bystanders from being wiped out in the crash we can all see on the horizon:
>
> https://www.thebignewsletter.com/p/monopoly-round-up-how-new-dealers.
>
> 27/
>
> ---
>
> As "Cathy" so aptly put it: "The thing that is a good tool for the skilled people is being sold as a thing to reduce the number of skilled people hired":
>
> https://bsky.app/profile/cathyby.bsky.social/post/3ms3pzq57nc2c
>
> The former is a normal technology. The latter is the root of a catastrophic folly that is destroying our environment, destroying workers' lives, destroying the quality of the goods and services we rely on, and which will shortly destroy our economy.
>
> It's a distinction with a difference.
>
> eof/

### 30. Today's threads (a thread) (2026-08-22) [link](https://mamot.fr/@pluralistic/117136600592645407)
**Metrics:** 12 boosts, 14 favourites, 2 replies (thread of 15 posts)
**Opening hook (verbatim):**
> Today's threads (a thread)	

**Structure:** Same recurring daily-digest format as #12/#22/#25/#26/#27.
**Framing:** Digest/roundup framing.
**Full text (verbatim):**
> Today's threads (a thread)	
>
> Inside: Born on technology's third base; and more!
>
> Archived at: https://pluralistic.net/2026/08/21/world-historic-forces/
>
> #Pluralistic
>
> 1/
>
> ---
>
> Born on technology's third base: Material forces shape life-chances.
>
> https://mamot.fr/@pluralistic/117136533182049636
>
> 2/
>
> ---
>
> Hey look at this
>
> * Does copyright protect your AI-generated content in Europe? Let’s find out https://euobserver.com/232898/interview-does-copyright-protect-your-ai-generated-content-in-europe-lets-find-out/
>
> * FTC Says It Will Enforce Surveillance Pricing. It Won’t. https://prospect.org/2026/08/21/ftc-says-it-will-enforce-surveillance-pricing-it-wont/
>
> * Why shaming people about AI slop isn’t enough to stop Big AI https://www.anildash.com/2026/08/21/ai-slop-and-shame/
>
> 3/
>
> ---
>
> #25yrsago Glue anything to anything https://www.thistothat.com/
>
> #20yrsago No unions in iPod City https://web.archive.org/web/20061123003816/https://www.wired.com/news/columns/0,71629-0.html?tw=wn_index_2
>
> #15yrsago Credit scores are bullshit https://web.archive.org/web/20111013005626/https://a.wholelottanothing.org/2011/08/credit-scores-are-bullshit.html
>
> #15yrsago RIP, Jack Layton https://www.bbc.com/news/world-us-canada-14618943
>
> #15yrsago William Gibson on cities and the future https://www.scientificamerican.com/article/gibson-interview-cities-in-fact-and-fiction/
>
> #10yrsago Bronx cops can steal anything they want by calling it “evidence” https://www.theatlantic.com/technology/archive/2016/08/how-police-use-a-legal-gray-area-to-rob-suspects-of-their-belongings/495740/
>
> 4/
>
> ---
>
> #10yrsago Robert Moses wove enduring racism into New York’s urban fabric https://web.archive.org/web/20160402184527/http://www.hopesandfears.com/hopes/now/politics/216905-the-lingering-effects-of-nyc-racist-city-planning
>
> #10yrsago EFF takes a deep dive into Windows 10’s brutal privacy breaches https://www.eff.org/deeplinks/2016/08/windows-10-microsoft-blatantly-disregards-user-choice-and-privacy-deep-dive
>
> #10yrsago Inside the “sweatshop” terminally ill Britons must call to get benefits https://web.archive.org/web/20160820094907/https://www.theguardian.com/public-leaders-network/2016/aug/20/work-pensions-disability-claim-call-handler-benefits-dwp
>
> #10yrsago How the New York Public Library made ebooks open, and thus one trillion times better https://www.crummy.com/writing/speaking/2015-RESTFest/
>
> #5yrsago Raiders of the lost ARC https://pluralistic.net/2021/08/22/raiders-of-the-lost-arc/
>
> 5/
>
> ---
>
> #1yrago Radical juries https://pluralistic.net/2025/08/22/jury-nullification/#voir-dire
>
> 6/
>
> ---
>
> Yesterday's threads: The actual epistemic crisis; and more!
>
> https://mamot.fr/@pluralistic/117130550369417613
>
> 7/
>
> ---
>
> My latest nonfiction book is the internationally bestselling"The Reverse Centaur's Guide to Life After AI," from MCD/Farrar, Straus and Giroux:
>
> https://us.macmillan.com/books/9780374621568/thereversecentaursguidetolifeafterai/
>
> --
>
> My previous nonfiction book is the internationally bestselling "Enshittification: Why Everything Suddenly Got Worse and What to Do About It":
>
> https://us.macmillan.com/books/9780374619329/enshittification/
>
> 8//
>
> ---
>
> My ebooks and audiobooks (from FSGxMCD, Tor Books, Head of Zeus, McSweeneys, Beacon, Verso and others) are for sale all over the net, but I sell 'em too, and when you buy 'em from me, I earn twice as much and you get books with no DRM and no license "agreements."
>
> https://craphound.com/shop/
>
> 9/
>
> ---
>
> Upcoming appearances:
>
> * #Sydney: The Festival of Dangerous Ideas, Aug 23-24
> https://festivalofdangerousideas.com/program/
>
> * #Melbourne: Enshittification at the Wheeler Centre, Aug 25
> https://www.wheelercentre.com/events-tickets/season-2026/cory-doctorow-enshittification
>
> * #London: AI and the Enshittification of the Media, NUJ (Sep 2)
> https://www.nuj.org.uk/learn/ems-event-calendar/ai-and-the-enshitification-of-the-media.html
>
> * #Brighton: The Reverse Centaur's Guide to Life After AI with Carole Cadwalladr (Brighton Dome), Sep 8
> https://brightondome.org/whats-on/LSC-cory-doctorow-the-reverse-centaurs-guide-to-life-after-ai/
>
> 10/
>
> ---
>
> Upcoming appearances (cont'd):
>
> * #Manchester: Take Back Big Tech with Jovan Owusu-Nepaul (House of Books and Friends), Sep 11
> https://ma.to/event/cory-doctorow-house-of-books-and-friends-11-sep-2026
>
> * #London: The Reverse Centaur's Guide to Life After AI with Riley Quinn (Foyle's Picadilly), Sep 9
> https://www.foyles.co.uk/events/enshittification-cory-doctorow-riley-quinn
>
> * #SouthBend: An Evening With Cory Doctorow (Notre Dame), Oct 6
> https://franco.nd.edu/events/2026/10/06/an-evening-with-cory-doctorow/
>
> * #Hudson, OH: Hudson Library, Oct 7
> https://engagedpatrons.org/EventsExtended.cfm?SiteID=3850&EventID=596952&PK=
>
> 11/
>
> ---
>
> Upcoming appearances (cont'd)
>
> * #Victoria: Munro's Books, Oct 20
> https://www.munrobooks.com/events/6113620261020
>
> * #Vancouver: BC Policy Solutions Gala, Nov 12
> https://bcpolicy.ca/gala/
>
> 12/
>
> ---
>
> Recent appearances:
>
> * Deflating the AI Bubble (Do Not Pass Go)
> https://www.donotpassgo.ca/p/deflating-the-ai-bubble-with-cory
>
> * Technofeudal Enshittification (Fucking Cancelled)
> https://www.fuckingcancelled.com/p/technofeudal-enshittification-with
>
> * Who The Machine Serves (EFF)
> https://archive.org/details/effecting-change-who-the-machine-serves
>
> * Speculative Fiction for Social Change II (Cool People Who Did Cool Stuff)
> https://pocketcasts.com/podcast/cool-people-who-did-cool-stuff/08cbb840-a6ae-013a-d8aa-0acc26574db2/part-two-cory-doctorow-on-speculative-fiction-for-social-change/937e8800-9404-45a6-b5e3-90ebee2cfaea
>
> * Speculative Fiction for Social Change I (Cool People Who Did Cool Stuff)
> https://pocketcasts.com/podcast/cool-people-who-did-cool-stuff/08cbb840-a6ae-013a-d8aa-0acc26574db2/part-one-cory-doctorow-on-speculative-fiction-for-social-change/15ad467c-0832-44c9-91ea-59defd783dba
>
> 13/
>
> ---
>
> You can follow these posts as a daily blog at pluralistic.net: no ads, trackers, or data-collection! 
>
> Here's today's edition: https://pluralistic.net/2026/08/21/world-historic-forces/
>
> --
>
> If you prefer a newsletter, subscribe to the plura-list, which is ad-/tracker-free, and is utterly unadorned save a single daily emoji. Today's is "🌦". Suggestions solicited for future emojis!
>
> --
>
> You can also get a fulltext RSS feed, licensed CC BY 4.0:
>
> https://pluralistic.net/feed/
>
> 14/
>
> ---
>
> I'm also on Bluesky. Read today's thread there at:
>
> https://bsky.app/profile/did:web:pluralistic.net/post/3mtn5a6p2k22x
>
> eof/
