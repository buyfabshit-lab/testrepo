export type Social = { label: string; url: string };

export type Settings = {
  id: number;
  display_name: string;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  /** IANA zone the schedule is authored in, e.g. "America/New_York". */
  timezone: string | null;
  is_live: boolean;
  stream_title: string | null;
  stream_platform: string | null;
  stream_embed_url: string | null;
  stream_url: string | null;
  next_stream_at: string | null;
  socials: Social[];
  updated_at: string;
};

export type ScheduleItem = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_min: number | null;
  platform: string | null;
};

export type ChatMessage = {
  id: number;
  fan_id: string;
  handle: string;
  body: string;
  hue: number;
  created_at: string;
};

export type WallPost = {
  id: number;
  fan_id: string;
  handle: string;
  body: string;
  hue: number;
  hearts: number;
  created_at: string;
};

export type Poll = { id: string; question: string; is_open: boolean; created_at: string };

export type PollResult = {
  poll_id: string;
  option_id: string;
  label: string;
  position: number;
  votes: number;
};

export type Reaction = { id: number; fan_id: string; emoji: string; created_at: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  tags: string[];
  stock: number | null;
  is_active: boolean;
  position: number;
};

export type CartLine = { product: Product; qty: number };

/**
 * Hand-written and deliberately partial: only what this site touches is
 * modelled. Insert/Update shapes are permissive because the read-only
 * guarantee lives in the RLS policies, not in the TypeScript types.
 * Regenerate in full with `supabase gen types typescript` if this grows.
 */
type Table<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      dime_settings: Table<Settings>;
      dime_schedule: Table<ScheduleItem>;
      dime_products: Table<Product>;
      dime_polls: Table<Poll>;
      dime_poll_options: Table<{
        id: string;
        poll_id: string;
        label: string;
        position: number;
      }>;
      dime_chat_messages: Table<
        ChatMessage,
        Pick<ChatMessage, "fan_id" | "handle" | "body" | "hue">
      >;
      dime_wall_posts: Table<
        WallPost,
        Pick<WallPost, "fan_id" | "handle" | "body" | "hue">
      >;
      dime_wall_hearts: Table<
        { post_id: number; fan_id: string; created_at: string },
        { post_id: number; fan_id: string }
      >;
      dime_poll_votes: Table<
        { poll_id: string; option_id: string; fan_id: string; created_at: string },
        { poll_id: string; option_id: string; fan_id: string }
      >;
      dime_reactions: Table<Reaction, Pick<Reaction, "fan_id" | "emoji">>;
      // dime_orders is deliberately absent: since Stripe checkout landed, the
      // browser neither reads nor writes orders. Only the Edge Functions touch
      // that table, using the service role.
    };
    Views: {
      dime_poll_results: { Row: PollResult; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
