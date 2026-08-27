/* ============================================
   Database Types — Peak Music Reviews
   Matches the Supabase schema (supabase/schema.sql)
   ============================================ */

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  profile_color: string;
  profile_gradient: string | null;
  profile_song_url: string | null;
  profile_song_title: string | null;
  spotify_url: string | null;
  soundcloud_url: string | null;
  statsfm_url: string | null;
  apple_music_url: string | null;
  /** NULL for accounts that never picked genres (signup trigger
      doesn't set it) — always guard with ?? [] before iterating. */
  favorite_genres: string[] | null;
  role: "user" | "reviewer" | "admin" | "owner" | "tester";
  /* Steam-style customization (migration 006) */
  theme: ProfileTheme;
  showcases: ShowcaseType[];
  pronouns: string | null;
  location: string | null;
  tagline: string | null;
  featured_review_id: string | null;
  /** Animated streak icon choice (migration 010). May be absent
      until that migration runs — treat undefined as "flame". */
  streak_icon?: "flame" | "vinyl" | "cd";
  created_at: string;
  updated_at: string;
}

/** Profile theme presets — site default + vintage console dashboards. */
export type ProfileTheme =
  | "crt-blue" // site default
  | "ps2" // boot nebula: midnight indigo, galaxy clouds, silver dust
  | "ps3" // XMB: black void, silver-blue, thin type
  | "ps4" // deep PlayStation blue
  | "xbox-og" // acid green on black metal
  | "xbox-360" // blade-dashboard green, glossy
  | "wii" // white channel cards, rounded + cheerful
  | "limewire" // lime on old-Windows gray, beveled panels
  | "bleach" // Soul Reaper: manga ink, black & white + blood red
  | "daft-punk"; // Robot Rock: helmet chrome + Discovery gold

/** Showcase blocks a user can arrange on their profile, Steam-style. */
export type ShowcaseType =
  | "favorites"
  | "stats"
  | "recent_reviews"
  | "featured_review"
  | "badges"
  | "lists"
  | "anticipated"
  | "listening" // ON ROTATION — now playing / last played (stats.fm)
  | "listening_stats" // ALL-TIME LISTENING — lifetime minutes/streams (stats.fm)
  | "sotd"; // SONG OF THE DAY — daily pick + streak flame

export interface Review {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  artist: string;
  rating: number;
  genre: string | null;
  release_type: string | null;
  release_date: string | null;
  review_date: string | null;
  summary: string | null;
  snippet: string | null;
  cover_image: string | null;
  standout_tracks: { title: string; spotifyUrl: string }[];
  is_published: boolean;
  release_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewLike {
  id: string;
  user_id: string;
  review_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  review_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

/* --- Phase 2a: Artists & Releases --- */

export interface ReleaseTrack {
  position: number;
  title: string;
  duration_ms: number;
  spotify_id?: string;
  preview_url?: string | null;
}

export interface Artist {
  id: string;
  slug: string;
  name: string;
  spotify_id: string | null;
  genius_id: string | null;
  image_url: string | null;
  bio: string | null;
  genres: string[];
  popularity: number | null;
  created_at: string;
  updated_at: string;
}

export interface Release {
  id: string;
  slug: string;
  title: string;
  primary_artist_id: string;
  release_type: "single" | "EP" | "album" | "mixtape" | "compilation";
  release_date: string | null;
  cover_image: string | null;
  spotify_id: string | null;
  genius_id: string | null;
  source: "spotify" | "genius" | "manual";
  is_unreleased: boolean;
  description: string | null;
  tracks: ReleaseTrack[];
  popularity: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseArtist {
  release_id: string;
  artist_id: string;
  role: "primary" | "feature" | "producer" | "remix";
  position: number;
}

export interface ArtistFollow {
  id: string;
  follower_id: string;
  artist_id: string;
  created_at: string;
}

export interface ReleaseFollow {
  id: string;
  follower_id: string;
  release_id: string;
  created_at: string;
}

export interface ArtistStats {
  follower_count: number;
  release_count: number;
  review_count: number;
}

export interface ReleaseStats {
  follower_count: number;
  review_count: number;
  avg_rating: number | null;
}

/* --- Phase 2b: Live release rooms --- */

export interface ReleaseRoom {
  id: string;
  release_id: string;
  message_count: number;
  last_activity_at: string | null;
  created_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  track_position: number | null;
  created_at: string;
}

export interface RoomReaction {
  id: string;
  room_id: string;
  user_id: string;
  target_type: "track" | "message";
  track_position: number | null;
  message_id: string | null;
  emoji: string;
  created_at: string;
}

// Aggregated for UI: how many of each emoji per track
export interface TrackReactionCounts {
  track_position: number;
  emoji: string;
  count: number;
}

/* --- Overhaul: Lists, Favorites (migration 004; diary removed in 006) --- */

export interface List {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  is_ranked: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  release_id: string | null;
  title: string;
  artist: string;
  cover_image: string | null;
  note: string | null;
  position: number;
  created_at: string;
}

export interface ListLike {
  id: string;
  user_id: string;
  list_id: string;
  created_at: string;
}

export interface ProfileFavorite {
  id: string;
  user_id: string;
  position: number; // 1-4
  release_id: string | null;
  title: string;
  artist: string;
  cover_image: string | null;
  created_at: string;
}

// Histogram bucket from get_rating_distribution()
export interface RatingBucket {
  bucket: number;
  count: number;
}

/* --- Debates (migration 006) — Real-app style two-sided rooms --- */

export interface Debate {
  id: string;
  slug: string;
  title: string;
  prompt: string | null;
  side_a_label: string;
  side_b_label: string;
  release_id: string | null;
  created_by: string;
  status: "open" | "closed";
  message_count: number;
  /** false = draft, visible only to the creator (migration 024).
      Optional because rows predate the column until 024 runs —
      treat undefined as published. */
  is_published?: boolean;
  created_at: string;
}

export interface DebateVote {
  debate_id: string;
  user_id: string;
  side: "a" | "b";
  created_at: string;
}

export interface DebateMessage {
  id: string;
  debate_id: string;
  user_id: string;
  side: "a" | "b" | null;
  content: string;
  created_at: string;
}

export interface DebateMessageReaction {
  id: string;
  debate_id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

/* --- Posts (migration 013) — freeform blog-style writeups --- */

export interface Post {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  body: string;
  /** Both video fields are set together or both null (DB constraint).
      video_id is the extracted platform id only — never a raw URL. */
  video_kind: "youtube" | "tiktok" | null;
  video_id: string | null;
  release_id: string | null;
  /** false = draft, visible only to the author (migration 024).
      Optional because rows predate the column until 024 runs —
      treat undefined as published. */
  is_published?: boolean;
  created_at: string;
  updated_at: string;
}

/* --- Aggregate / computed types --- */

export interface ProfileStats {
  review_count: number;
  follower_count: number;
  following_count: number;
  total_likes_received: number;
}

export interface ReviewStats {
  like_count: number;
  comment_count: number;
}

/* --- Supabase Database type helper --- */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "username">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      reviews: {
        Row: Review;
        Insert: Partial<Review> &
          Pick<Review, "user_id" | "title" | "slug" | "artist" | "rating">;
        Update: Partial<Review>;
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      review_likes: {
        Row: ReviewLike;
        Insert: Pick<ReviewLike, "user_id" | "review_id"> &
          Partial<Omit<ReviewLike, "user_id" | "review_id">>;
        Update: Partial<ReviewLike>;
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: Comment;
        Insert: Pick<Comment, "user_id" | "review_id" | "content"> &
          Partial<Omit<Comment, "user_id" | "review_id" | "content">>;
        Update: Partial<Comment>;
        Relationships: [
          {
            foreignKeyName: "comments_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      follows: {
        Row: Follow;
        Insert: Pick<Follow, "follower_id" | "following_id"> &
          Partial<Omit<Follow, "follower_id" | "following_id">>;
        Update: Partial<Follow>;
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      artists: {
        Row: Artist;
        Insert: Partial<Artist> & Pick<Artist, "slug" | "name">;
        Update: Partial<Artist>;
        Relationships: [];
      };
      releases: {
        Row: Release;
        Insert: Partial<Release> &
          Pick<Release, "slug" | "title" | "primary_artist_id" | "release_type">;
        Update: Partial<Release>;
        Relationships: [
          {
            foreignKeyName: "releases_primary_artist_id_fkey";
            columns: ["primary_artist_id"];
            isOneToOne: false;
            referencedRelation: "artists";
            referencedColumns: ["id"];
          }
        ];
      };
      release_artists: {
        Row: ReleaseArtist;
        Insert: Pick<ReleaseArtist, "release_id" | "artist_id" | "role"> &
          Partial<Omit<ReleaseArtist, "release_id" | "artist_id" | "role">>;
        Update: Partial<ReleaseArtist>;
        Relationships: [
          {
            foreignKeyName: "release_artists_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "releases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "release_artists_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "artists";
            referencedColumns: ["id"];
          }
        ];
      };
      artist_follows: {
        Row: ArtistFollow;
        Insert: Pick<ArtistFollow, "follower_id" | "artist_id"> &
          Partial<Omit<ArtistFollow, "follower_id" | "artist_id">>;
        Update: Partial<ArtistFollow>;
        Relationships: [
          {
            foreignKeyName: "artist_follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "artist_follows_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "artists";
            referencedColumns: ["id"];
          }
        ];
      };
      release_follows: {
        Row: ReleaseFollow;
        Insert: Pick<ReleaseFollow, "follower_id" | "release_id"> &
          Partial<Omit<ReleaseFollow, "follower_id" | "release_id">>;
        Update: Partial<ReleaseFollow>;
        Relationships: [
          {
            foreignKeyName: "release_follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "release_follows_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "releases";
            referencedColumns: ["id"];
          }
        ];
      };
      release_rooms: {
        Row: ReleaseRoom;
        Insert: Pick<ReleaseRoom, "release_id"> &
          Partial<Omit<ReleaseRoom, "release_id">>;
        Update: Partial<ReleaseRoom>;
        Relationships: [
          {
            foreignKeyName: "release_rooms_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: true;
            referencedRelation: "releases";
            referencedColumns: ["id"];
          }
        ];
      };
      room_messages: {
        Row: RoomMessage;
        Insert: Pick<RoomMessage, "room_id" | "user_id" | "content"> &
          Partial<Omit<RoomMessage, "room_id" | "user_id" | "content">>;
        Update: Partial<RoomMessage>;
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "release_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      room_reactions: {
        Row: RoomReaction;
        Insert: Pick<
          RoomReaction,
          "room_id" | "user_id" | "target_type" | "emoji"
        > &
          Partial<
            Omit<RoomReaction, "room_id" | "user_id" | "target_type" | "emoji">
          >;
        Update: Partial<RoomReaction>;
        Relationships: [
          {
            foreignKeyName: "room_reactions_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "release_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "room_messages";
            referencedColumns: ["id"];
          }
        ];
      };
      debates: {
        Row: Debate;
        Insert: Pick<
          Debate,
          "slug" | "title" | "side_a_label" | "side_b_label" | "created_by"
        > &
          Partial<Omit<Debate, "slug" | "title" | "side_a_label" | "side_b_label" | "created_by">>;
        Update: Partial<Debate>;
        Relationships: [
          {
            foreignKeyName: "debates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debates_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "releases";
            referencedColumns: ["id"];
          }
        ];
      };
      debate_votes: {
        Row: DebateVote;
        Insert: Pick<DebateVote, "debate_id" | "user_id" | "side"> &
          Partial<Omit<DebateVote, "debate_id" | "user_id" | "side">>;
        Update: Partial<DebateVote>;
        Relationships: [
          {
            foreignKeyName: "debate_votes_debate_id_fkey";
            columns: ["debate_id"];
            isOneToOne: false;
            referencedRelation: "debates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debate_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      debate_messages: {
        Row: DebateMessage;
        Insert: Pick<DebateMessage, "debate_id" | "user_id" | "content"> &
          Partial<Omit<DebateMessage, "debate_id" | "user_id" | "content">>;
        Update: Partial<DebateMessage>;
        Relationships: [
          {
            foreignKeyName: "debate_messages_debate_id_fkey";
            columns: ["debate_id"];
            isOneToOne: false;
            referencedRelation: "debates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debate_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      debate_message_reactions: {
        Row: DebateMessageReaction;
        Insert: Pick<
          DebateMessageReaction,
          "debate_id" | "message_id" | "user_id" | "emoji"
        > &
          Partial<
            Omit<
              DebateMessageReaction,
              "debate_id" | "message_id" | "user_id" | "emoji"
            >
          >;
        Update: Partial<DebateMessageReaction>;
        Relationships: [
          {
            foreignKeyName: "debate_message_reactions_debate_id_fkey";
            columns: ["debate_id"];
            isOneToOne: false;
            referencedRelation: "debates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debate_message_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "debate_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debate_message_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      lists: {
        Row: List;
        Insert: Pick<List, "user_id" | "slug" | "title"> &
          Partial<Omit<List, "user_id" | "slug" | "title">>;
        Update: Partial<List>;
        Relationships: [
          {
            foreignKeyName: "lists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      list_items: {
        Row: ListItem;
        Insert: Pick<ListItem, "list_id" | "title" | "artist"> &
          Partial<Omit<ListItem, "list_id" | "title" | "artist">>;
        Update: Partial<ListItem>;
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "list_items_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "releases";
            referencedColumns: ["id"];
          }
        ];
      };
      list_likes: {
        Row: ListLike;
        Insert: Pick<ListLike, "user_id" | "list_id"> &
          Partial<Omit<ListLike, "user_id" | "list_id">>;
        Update: Partial<ListLike>;
        Relationships: [
          {
            foreignKeyName: "list_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "list_likes_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          }
        ];
      };
      posts: {
        Row: Post;
        Insert: Pick<Post, "user_id" | "slug" | "title" | "body"> &
          Partial<Omit<Post, "user_id" | "slug" | "title" | "body">>;
        Update: Partial<Post>;
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "releases";
            referencedColumns: ["id"];
          }
        ];
      };
      profile_favorites: {
        Row: ProfileFavorite;
        Insert: Pick<ProfileFavorite, "user_id" | "position" | "title" | "artist"> &
          Partial<Omit<ProfileFavorite, "user_id" | "position" | "title" | "artist">>;
        Update: Partial<ProfileFavorite>;
        Relationships: [
          {
            foreignKeyName: "profile_favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_favorites_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "releases";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
