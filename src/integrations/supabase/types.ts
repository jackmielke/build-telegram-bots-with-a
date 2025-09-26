export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_chat_sessions: {
        Row: {
          chat_type: string
          community_id: string
          cost_usd: number
          created_at: string
          id: string
          message_count: number | null
          metadata: Json | null
          model_used: string
          session_end_at: string | null
          session_start_at: string
          tokens_used: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          chat_type: string
          community_id: string
          cost_usd?: number
          created_at?: string
          id?: string
          message_count?: number | null
          metadata?: Json | null
          model_used: string
          session_end_at?: string | null
          session_start_at?: string
          tokens_used?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          chat_type?: string
          community_id?: string
          cost_usd?: number
          created_at?: string
          id?: string
          message_count?: number | null
          metadata?: Json | null
          model_used?: string
          session_end_at?: string | null
          session_start_at?: string
          tokens_used?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_sessions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          accept_invitation: boolean | null
          anything_else: string | null
          cancellation_policy: boolean | null
          community_id: string | null
          confirmation_status: string | null
          confirmed_at: string | null
          contribution: string | null
          created_at: string
          edge_city_ticket: boolean | null
          email: string
          excited_to_build: string | null
          food_preferences: string | null
          full_name: string
          hotel_room: string | null
          housing_option: string | null
          id: string
          media_release: boolean | null
          payment_method: string | null
          planning_dev_connect: boolean | null
          residency_tier: string | null
          seeking_experiences: string[] | null
          suggested_experience: string | null
          updated_at: string
          want_house_accommodation: boolean | null
        }
        Insert: {
          accept_invitation?: boolean | null
          anything_else?: string | null
          cancellation_policy?: boolean | null
          community_id?: string | null
          confirmation_status?: string | null
          confirmed_at?: string | null
          contribution?: string | null
          created_at?: string
          edge_city_ticket?: boolean | null
          email: string
          excited_to_build?: string | null
          food_preferences?: string | null
          full_name: string
          hotel_room?: string | null
          housing_option?: string | null
          id?: string
          media_release?: boolean | null
          payment_method?: string | null
          planning_dev_connect?: boolean | null
          residency_tier?: string | null
          seeking_experiences?: string[] | null
          suggested_experience?: string | null
          updated_at?: string
          want_house_accommodation?: boolean | null
        }
        Update: {
          accept_invitation?: boolean | null
          anything_else?: string | null
          cancellation_policy?: boolean | null
          community_id?: string | null
          confirmation_status?: string | null
          confirmed_at?: string | null
          contribution?: string | null
          created_at?: string
          edge_city_ticket?: boolean | null
          email?: string
          excited_to_build?: string | null
          food_preferences?: string | null
          full_name?: string
          hotel_room?: string | null
          housing_option?: string | null
          id?: string
          media_release?: boolean | null
          payment_method?: string | null
          planning_dev_connect?: boolean | null
          residency_tier?: string | null
          seeking_experiences?: string[] | null
          suggested_experience?: string | null
          updated_at?: string
          want_house_accommodation?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          community_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          glb_file_url: string
          id: string
          is_default: boolean | null
          metadata: Json | null
          name: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          glb_file_url: string
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          name: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          glb_file_url?: string
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          agent_avatar_url: string | null
          agent_instructions: string | null
          agent_intro_message: string | null
          agent_max_tokens: number | null
          agent_model: string | null
          agent_name: string | null
          agent_suggested_messages: string[] | null
          agent_temperature: number | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          experiences: string[] | null
          id: string
          invite_code: string | null
          last_activity_at: string | null
          name: string
          privacy_level: string
          support_email: string | null
          telegram_bot_token: string | null
          telegram_bot_url: string | null
          total_cost_usd: number | null
          total_tokens_used: number | null
          universal_id: string
          updated_at: string
        }
        Insert: {
          agent_avatar_url?: string | null
          agent_instructions?: string | null
          agent_intro_message?: string | null
          agent_max_tokens?: number | null
          agent_model?: string | null
          agent_name?: string | null
          agent_suggested_messages?: string[] | null
          agent_temperature?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          experiences?: string[] | null
          id?: string
          invite_code?: string | null
          last_activity_at?: string | null
          name: string
          privacy_level?: string
          support_email?: string | null
          telegram_bot_token?: string | null
          telegram_bot_url?: string | null
          total_cost_usd?: number | null
          total_tokens_used?: number | null
          universal_id: string
          updated_at?: string
        }
        Update: {
          agent_avatar_url?: string | null
          agent_instructions?: string | null
          agent_intro_message?: string | null
          agent_max_tokens?: number | null
          agent_model?: string | null
          agent_name?: string | null
          agent_suggested_messages?: string[] | null
          agent_temperature?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          experiences?: string[] | null
          id?: string
          invite_code?: string | null
          last_activity_at?: string | null
          name?: string
          privacy_level?: string
          support_email?: string | null
          telegram_bot_token?: string | null
          telegram_bot_url?: string | null
          total_cost_usd?: number | null
          total_tokens_used?: number | null
          universal_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_join_requests: {
        Row: {
          community_id: string
          created_at: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_join_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          group_name: string | null
          id: string
          joined_at: string
          notes: string | null
          questionnaire_completed: boolean | null
          referred_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          group_name?: string | null
          id?: string
          joined_at?: string
          notes?: string | null
          questionnaire_completed?: boolean | null
          referred_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          group_name?: string | null
          id?: string
          joined_at?: string
          notes?: string | null
          questionnaire_completed?: boolean | null
          referred_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_batch_progress: {
        Row: {
          batch_size: number | null
          completed_at: string | null
          error_message: string | null
          failed_embeddings: number | null
          id: string
          processed_users: number | null
          started_at: string | null
          status: string | null
          successful_embeddings: number | null
          total_users: number
        }
        Insert: {
          batch_size?: number | null
          completed_at?: string | null
          error_message?: string | null
          failed_embeddings?: number | null
          id?: string
          processed_users?: number | null
          started_at?: string | null
          status?: string | null
          successful_embeddings?: number | null
          total_users: number
        }
        Update: {
          batch_size?: number | null
          completed_at?: string | null
          error_message?: string | null
          failed_embeddings?: number | null
          id?: string
          processed_users?: number | null
          started_at?: string | null
          status?: string | null
          successful_embeddings?: number | null
          total_users?: number
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          attended: boolean | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          rsvp_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attended?: boolean | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          rsvp_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attended?: boolean | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          rsvp_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          current_attendees: number | null
          description: string | null
          event_end_time: string
          event_image_url: string | null
          event_location: string | null
          event_start_time: string
          event_status: string | null
          event_type: string | null
          hosted_by: string | null
          id: string
          is_public: boolean | null
          max_attendees: number | null
          metadata: Json | null
          registration_required: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          current_attendees?: number | null
          description?: string | null
          event_end_time: string
          event_image_url?: string | null
          event_location?: string | null
          event_start_time: string
          event_status?: string | null
          event_type?: string | null
          hosted_by?: string | null
          id?: string
          is_public?: boolean | null
          max_attendees?: number | null
          metadata?: Json | null
          registration_required?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          current_attendees?: number | null
          description?: string | null
          event_end_time?: string
          event_image_url?: string | null
          event_location?: string | null
          event_start_time?: string
          event_status?: string | null
          event_type?: string | null
          hosted_by?: string | null
          id?: string
          is_public?: boolean | null
          max_attendees?: number | null
          metadata?: Json | null
          registration_required?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          community_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          community_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          community_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_type: string | null
          community_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string | null
          metadata: Json | null
          reply_to_message_id: string | null
          sender_id: string | null
          sent_by: string | null
          topic_name: string | null
          universal_id: string
          updated_at: string
        }
        Insert: {
          chat_type?: string | null
          community_id?: string | null
          content: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sent_by?: string | null
          topic_name?: string | null
          universal_id?: string
          updated_at?: string
        }
        Update: {
          chat_type?: string | null
          community_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sent_by?: string | null
          topic_name?: string | null
          universal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          email: string | null
          id: string
          product_name: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          product_name: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          product_name?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          phone: string | null
          sponsorship_level: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          phone?: string | null
          sponsorship_level?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          phone?: string | null
          sponsorship_level?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_bots: {
        Row: {
          bot_name: string | null
          bot_token: string
          bot_username: string
          community_id: string
          created_at: string
          id: string
          is_active: boolean
          last_activity_at: string | null
          metadata: Json | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          bot_name?: string | null
          bot_token: string
          bot_username: string
          community_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          bot_name?: string | null
          bot_token?: string
          bot_username?: string
          community_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      telegram_chat_sessions: {
        Row: {
          bot_id: string
          community_id: string
          created_at: string
          id: string
          is_active: boolean | null
          last_message_at: string | null
          message_count: number | null
          metadata: Json | null
          telegram_chat_id: number
          telegram_first_name: string | null
          telegram_last_name: string | null
          telegram_user_id: number | null
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          bot_id: string
          community_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          telegram_chat_id: number
          telegram_first_name?: string | null
          telegram_last_name?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          bot_id?: string
          community_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          telegram_chat_id?: number
          telegram_first_name?: string | null
          telegram_last_name?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_chat_sessions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      user_embeddings: {
        Row: {
          bio_embedding: string | null
          bio_text: string | null
          combined_embedding: string | null
          created_at: string
          id: string
          interests_embedding: string | null
          interests_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio_embedding?: string | null
          bio_text?: string | null
          combined_embedding?: string | null
          created_at?: string
          id?: string
          interests_embedding?: string | null
          interests_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio_embedding?: string | null
          bio_text?: string | null
          combined_embedding?: string | null
          created_at?: string
          id?: string
          interests_embedding?: string | null
          interests_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          headline: string | null
          id: string
          instagram_handle: string | null
          intentions: string | null
          interests_skills: string[] | null
          name: string | null
          original_item_id: number | null
          phone_number: string | null
          phone_verified: boolean | null
          profile_picture_url: string | null
          source_url: string | null
          telegram_username: string | null
          twitter_handle: string | null
          universal_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          headline?: string | null
          id?: string
          instagram_handle?: string | null
          intentions?: string | null
          interests_skills?: string[] | null
          name?: string | null
          original_item_id?: number | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_picture_url?: string | null
          source_url?: string | null
          telegram_username?: string | null
          twitter_handle?: string | null
          universal_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          headline?: string | null
          id?: string
          instagram_handle?: string | null
          intentions?: string | null
          interests_skills?: string[] | null
          name?: string | null
          original_item_id?: number | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_picture_url?: string | null
          source_url?: string | null
          telegram_username?: string | null
          twitter_handle?: string | null
          universal_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      conversations: {
        Row: {
          chat_type: string | null
          community_id: string | null
          conversation_id: string | null
          last_message_at: string | null
          message_count: number | null
          participant_count: number | null
          started_at: string | null
          topic_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_join_community_as_admin: {
        Args: { target_community_id: string }
        Returns: boolean
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      check_community_membership: {
        Args: { _auth_user_id: string; _community_id: string }
        Returns: boolean
      }
      ensure_unique_universal_id: {
        Args: { table_name: string }
        Returns: string
      }
      generate_universal_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_communities_with_member_count: {
        Args: {
          excluded_community_ids?: string[]
          limit_count?: number
          offset_count?: number
        }
        Returns: {
          cover_image_url: string
          description: string
          id: string
          invite_code: string
          member_count: number
          name: string
          privacy_level: string
        }[]
      }
      get_current_user_from_context: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_id_from_auth: {
        Args: { auth_user_id: string }
        Returns: string
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_community_admin: {
        Args: { community_id_param: string; user_auth_id: string }
        Returns: boolean
      }
      is_community_member: {
        Args: { community_id_param: string; user_id_param: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      semantic_search_users: {
        Args: {
          excluded_user_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          avatar_url: string
          bio: string
          interests_skills: string[]
          name: string
          similarity: number
          user_id: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "member"],
    },
  },
} as const
