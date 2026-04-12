// Supabase Database types for KDER
// Manually created from schema.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      members: {
        Row: { id: string; phone: string; display_name: string; handle: string | null; photo_url: string | null; bio: string | null; role: string; stripe_customer_id: string | null; inbox_active: boolean; last_handle_changed_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; phone: string; display_name: string; handle?: string | null; photo_url?: string | null; bio?: string | null; role?: string; stripe_customer_id?: string | null; inbox_active?: boolean; last_handle_changed_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; phone?: string; display_name?: string; handle?: string | null; photo_url?: string | null; bio?: string | null; role?: string; stripe_customer_id?: string | null; inbox_active?: boolean; last_handle_changed_at?: string | null; updated_at?: string };
      };
      creators: {
        Row: { id: string; member_id: string; legal_name: string | null; dob: string | null; stripe_connect_id: string | null; kyc_status: string; service_zip_codes: string[]; vibe_score: number | null; storefront_active: boolean; created_at: string };
        Insert: { id?: string; member_id: string; legal_name?: string | null; dob?: string | null; stripe_connect_id?: string | null; kyc_status?: string; service_zip_codes?: string[]; vibe_score?: number | null; storefront_active?: boolean; created_at?: string };
        Update: { member_id?: string; legal_name?: string | null; dob?: string | null; stripe_connect_id?: string | null; kyc_status?: string; service_zip_codes?: string[]; vibe_score?: number | null; storefront_active?: boolean };
      };
      listings: {
        Row: { id: string; creator_id: string; name: string; description: string; price: number; quantity: number; min_order: number | null; photos: string[]; video: string | null; fulfillment_type: string; status: string; category_tags: string[]; allergens: string[]; availability_windows: Json; discount_codes: Json; order_count: number; created_at: string; updated_at: string };
        Insert: { id?: string; creator_id: string; name: string; description?: string; price: number; quantity?: number; min_order?: number | null; photos?: string[]; video?: string | null; fulfillment_type?: string; status?: string; category_tags?: string[]; allergens?: string[]; availability_windows?: Json; discount_codes?: Json; order_count?: number; created_at?: string; updated_at?: string };
        Update: { name?: string; description?: string; price?: number; quantity?: number; min_order?: number | null; photos?: string[]; video?: string | null; fulfillment_type?: string; status?: string; category_tags?: string[]; allergens?: string[]; availability_windows?: Json; discount_codes?: Json; order_count?: number; updated_at?: string };
      };
      orders: {
        Row: { id: string; listing_id: string; member_id: string; creator_id: string; quantity: number; fulfillment_type: string; status: string; total_amount: number; platform_fee: number; creator_payout: number; notes: string | null; stripe_payment_intent_id: string | null; terms_accepted_at: string; auto_decline_at: string; created_at: string; updated_at: string };
        Insert: { id?: string; listing_id: string; member_id: string; creator_id: string; quantity?: number; fulfillment_type: string; status?: string; total_amount: number; platform_fee: number; creator_payout: number; notes?: string | null; stripe_payment_intent_id?: string | null; terms_accepted_at?: string; auto_decline_at?: string; created_at?: string; updated_at?: string };
        Update: { status?: string; notes?: string | null; stripe_payment_intent_id?: string | null; updated_at?: string };
      };
      messages: {
        Row: { id: string; order_id: string | null; sender_id: string; recipient_id: string; body: string; read_at: string | null; created_at: string };
        Insert: { id?: string; order_id?: string | null; sender_id: string; recipient_id: string; body: string; read_at?: string | null; created_at?: string };
        Update: { read_at?: string | null };
      };
      vibe_ratings: {
        Row: { id: string; order_id: string; rater_id: string; ratee_id: string; ratee_role: string; hospitality: number | null; authenticity: number | null; professionalism: number | null; respect: number | null; punctuality: number | null; comment: string | null; created_at: string };
        Insert: { id?: string; order_id: string; rater_id: string; ratee_id: string; ratee_role: string; hospitality?: number | null; authenticity?: number | null; professionalism?: number | null; respect?: number | null; punctuality?: number | null; comment?: string | null; created_at?: string };
        Update: { hospitality?: number | null; authenticity?: number | null; professionalism?: number | null; respect?: number | null; punctuality?: number | null; comment?: string | null };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
