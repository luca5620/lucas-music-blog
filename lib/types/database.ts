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
  favorite_genres: string[];
  created_at: string;
  updated_at: string;
}

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
