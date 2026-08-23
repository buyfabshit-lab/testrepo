import { useCallback, useEffect, useMemo, useState } from "react";
import { isConfigured } from "./lib/supabase";
import { loadFan, saveFan, type Fan } from "./lib/fan";

import { useSettings } from "./hooks/useSettings";
import { useSchedule } from "./hooks/useSchedule";
import { useChat } from "./hooks/useChat";
import { useWall } from "./hooks/useWall";
import { usePoll } from "./hooks/usePoll";
import { useReactions } from "./hooks/useReactions";
import { usePresence } from "./hooks/usePresence";
import { useShop } from "./hooks/useShop";

import { Backdrop } from "./components/Backdrop";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Section } from "./components/Section";
import { ChatPanel } from "./components/ChatPanel";
import { PollCard } from "./components/PollCard";
import { FanWall } from "./components/FanWall";
import { SchedulePanel } from "./components/SchedulePanel";
import { Shop } from "./components/Shop";
import { CartDrawer } from "./components/CartDrawer";
import { ReactionBar, ReactionLayer } from "./components/ReactionBar";
import { HandleSheet } from "./components/HandleSheet";
import { Footer } from "./components/Footer";
import { ConfigNotice } from "./components/ConfigNotice";

export default function App() {
  // The fan identity is read once and threaded down; every hook keys its
  // writes and dedupes off it.
  const [fan, setFan] = useState<Fan>(() => loadFan());

  const [handleOpen, setHandleOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const { settings } = useSettings();
  const schedule = useSchedule();
  const chat = useChat(fan);
  const wall = useWall(fan);
  const poll = usePoll(fan);
  const reactions = useReactions(fan);
  const presence = usePresence(fan);
  const shop = useShop(fan);

  const updateFan = useCallback((next: Fan) => {
    setFan(next);
    saveFan(next);
  }, []);

  // Stripe returns the shopper to the bare site URL, so surface the result by
  // opening the drawer rather than leaving them wondering whether it worked.
  useEffect(() => {
    if (shop.outcome) setCartOpen(true);
  }, [shop.outcome]);

  const jumpToChat = useCallback(() => {
    document.getElementById("room")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const roomHeading = useMemo(
    () => (settings.is_live ? "Everyone's in here" : "The room stays open"),
    [settings.is_live],
  );

  return (
    <div className="grain min-h-screen">
      <Backdrop live={settings.is_live} />

      <Header
        name={settings.display_name}
        live={settings.is_live}
        presence={presence.count}
        handles={presence.handles}
        fan={fan}
        onEditHandle={() => setHandleOpen(true)}
        cartCount={shop.itemCount}
        onOpenCart={() => setCartOpen(true)}
      />

      <main className="mx-auto max-w-6xl space-y-24 px-5 pb-16">
        <Hero
          settings={settings}
          hype={reactions.recentCount}
          onJumpToChat={jumpToChat}
        />

        {!isConfigured && <ConfigNotice />}

        <Section
          id="room"
          eyebrow="live"
          title={roomHeading}
          aside={
            <p className="max-w-xs text-sm text-ash">
              Chat and votes land in Supabase the moment you send them — everyone sees
              the same thing at the same time.
            </p>
          }
        >
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <ChatPanel
              messages={chat.messages}
              send={chat.send}
              sending={chat.sending}
              error={chat.error}
              fan={fan}
              presence={presence.count}
            />
            <PollCard
              poll={poll.poll}
              results={poll.results}
              total={poll.total}
              myOption={poll.myOption}
              onVote={poll.vote}
              error={poll.error}
            />
          </div>
        </Section>

        <Section
          id="wall"
          eyebrow="memory"
          title="The wall"
          aside={
            <p className="max-w-xs text-sm text-ash">
              Chat scrolls away. This doesn't — it's still here next time you visit.
            </p>
          }
        >
          <FanWall
            posts={wall.posts}
            post={wall.post}
            heart={wall.heart}
            hearted={wall.hearted}
            error={wall.error}
            fan={fan}
          />
        </Section>

        <Section id="schedule" eyebrow="when" title="What's coming">
          <SchedulePanel
            items={schedule}
            timezone={settings.timezone}
            location={settings.location}
          />
        </Section>

        <Section
          id="shop"
          eyebrow="merch"
          title="The shop"
          aside={
            <p className="max-w-xs text-sm text-ash">
              Checkout is handled by Stripe. Ships from New York.
            </p>
          }
        >
          <Shop products={shop.products} onAdd={shop.add} />
        </Section>

        <Footer name={settings.display_name} socials={settings.socials} bio={settings.bio} />
      </main>

      <ReactionLayer bursts={reactions.bursts} />
      <ReactionBar onReact={reactions.react} />

      <HandleSheet
        open={handleOpen}
        fan={fan}
        onClose={() => setHandleOpen(false)}
        onSave={updateFan}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={shop.cart}
        setQty={shop.setQty}
        subtotal={shop.subtotal}
        checkout={shop.checkout}
        busy={shop.busy}
        error={shop.error}
        outcome={shop.outcome}
        onDismissOutcome={shop.dismissOutcome}
      />
    </div>
  );
}
