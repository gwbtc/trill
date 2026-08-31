# Trill 2.0

*Tasteful doomscrolling*
Tastescrolling?

Tentative subtitle. But it is hard to define in one sentence.

## Problem statement

Social media is called so because it used to be about your friends. That's what it all used to be. Facebook started like that. You had your friend group, they posted stuff, the posts got sent to all the friends, so you could keep up with what was going on with your IRL buddies.

This is not how it works like now. Every single popular social media app basically works the same way: there's The Algorithm, a mysterious, impersonal, eerie Leviathan that aggregates content from largely huge, professional accounts, then sends them around to people's feeds. Everyone largely consumes the same content, with some degree of variation depending on which specific celebrities you follow. I exaggerate but not by much.

What happened? Did people just stop having friends? Was it all a top-down conspiracy from Big Tech to sell us ads? We'll never know for sure but it's fair to assume it was a bit of both. There was a demand-side shift in that people just found pro (either outright commercial or from talented amateurs) content to be more compelling than their high school friends bragging about their pumpkin lattes, and also a very clear incentive from the Platforms to centralize content delivery. Commercial and political incentive, I might add, but the result was the same. Which is, everyone's doomscrolling on the same slop on basically all platforms, everybody claims to hate it, but nobody quits. So how to break this unsatisfactory state of affairs?

## The fallacious appeal of RETVRN

The obvious answer is to return to tradition; go back to an actually social media where feeds are composed of posts by your friends and your friends only, and get rid of the centralized slop.
That sounds good but it empirically is not a good product. If Platform Slop was so unappealing people could have moved to Mastodon or Nostr and do their thing. Some did, but not many.  It may sound good and righteous to claim the masses are sheep and it's on them if they get hooked on addictive internet slop, but we are a Foundation and it is our duty to society to develop an appealing product that leads them away from evil and helps discover the best side of their nature. So let us accept that doomscrolling exists and is pervasive for the very simple reason that it is a good product, and we must deliver something that supplies that demand, but in a better way. An incrementally better social media experience that feels familiar, easy to approach, yet doesn't make you hate yourself afterwards.

## The only way out is Through

All of the above might sound very lofty and high-minded but also a bit of a LARP; Trill cannot be a competitor of the big social media platforms even if it wanted to. We do not have the scale and we can't possibly have it. The reason Twitter, Instagram, Facebook and TikTok can deliver all that turbo-processed slop is because they have hundreds of millions of users, and trillion-dollar companies behind them. Trill, like any other Urbit app, is just not in that game.

What we can do is traditional social media. Trill 2.0 provides a classic, old-school social media experience. You can follow people. You can post. Your feed will show the posts of your friends. You can reply, with infinite nesting, you can quote, you can repost other people's content. You can DM other users too. Trill 1.0 did that already, reasonably well. But as we established that isn't quite enough. The problem with old school, actually social social media is that the content just isn't good enough, not competitive with professionally produced content. Trill 2.0 addresses this problem from both sides, inside and out.

### Hooks to the wider world

Trill 1.0 had this feature in which a user could ass their Twitter credentials (in the form of a browser cookie), and then browse their Twitter feed from inside the Trill UI. There are many external, unofficial Twitter frontends out there, but one unique value proposition of Urbit is that an individual user can consume his own content without triggering the usual roadblocks that commercial platforms set against external scraping. It is legally still a gray area, however, as we can see with the recent closure of Nitter by legal threat from X.com. At any rate while a nifty feature and good showcase of the potential of Urbit as an API aggregator (its original mission), it is not quite the UX that we want. If you want to browse Twitter you should go to Twitter.

We do want some window to the outer world, however. Not full tweets or Instagram posts or TikTok videos, but at least some sense of what's going on. At the end of the day in a social media app you need to know what to post about; what's relevant. Your high school friend might think her 100th pumpkin-spice latte of the week is very relevant but we are not all blessed with such self-confidence. 

Trill 2.0 will just give you a general sense of what's trending in the big social media platforms. Trends, topics, breaking news, from all major platforms. We have yet to determine where exactly will we source that data, and feedback is welcome. Of course blindly scraping global Twitter Trends is just going to give us a naked list of hashtags, most of it about inane celebrity gossip and the like, and usually geofenced, which is not ideal. So we will need to filter the general Trending Topics, either by asking users to define topics of their interest, hardcoding the filter with our Enlightened Judgment, or most likely a combination of both. That should suffice to introducing some Structure to the general Conversation in Trill 2.0 and make it easier for users to post and feel they are being part of something important and relevant.

### AI-assisted posting

This sounds terrible, I know, but hear me out. The first image people get in their heads when thinking of AI-assisted posting is people prompting LLMs to generate tweets, which unviariably results in the most inane slop imaginable. This is not the way.
However we do live in the age of AI and God wants us to add AI features. We do not make the rules. So what is the right way of using AI in a social media app? One approach is what Twitter does and have an official LLM mascot to interact with. That's been a great success. Groundwire however does not own a Colossus data center just yet. We can support agent-users, perhaps even some semi-oficially, that could add some flavor.

Most importantly though, we are an Urbit app, living in the users computer, and that is a unique strength that the commercial Platforms do not have. So the right way to use AI here is to have it help Trill users poast better. How? Give it access to your content. Trill 2.0 will integrate a user library (based on Grubbery) where people can add content their own; their memes, their books, the PDFs they hoard as second nature but never get around to reading. Have the user-defined LLM go through your content, read your Trill 2.0 feed, the Trending Topics, and have it suggest a tasteful post. Some good old-book quote you have on the tip of your tongue but can't quite remember exactly. The exact meme reaction. A reminder that that movie your friend posted about is in your collection and you watched it 2 months ago. Stuff like that. Again feedback here is most welcome.

### Nostr

The biggest technical innovation of Trill 2.0 compared to it's parent version is WebSockets support. This was added specifically to support the Nostr protocol. Trill 2.0 allows users to add Nostr relays, fetch data from them and send data to them. Unfortunately the data to be found in Nostr relays as of August 2026 is not very stellar content but there is still plenty of value in interop with the Nostr community, and we plan to support DMs, group DMs and user authentication using Nostr standards. The idea is to Embrace and Extend. Never Extinguish of course, we would never do that. We just want to welcome the Nostr community and show the how Urbit can complement their technology in a way nothing else can.


