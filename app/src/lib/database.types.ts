
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "artist_members": {
                  Row: {
                    "artist_id": string,"created_at": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "artist_id"?: string,"created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "artist_members_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artist_members_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    }
                  ]
                },"artists": {
                  Row: {
                    "bio": string | null,"contact_email": string | null,"created_at": string,"created_by": string | null,"currency": string,"dimension_unit": string,"id": string,"inventory_prefix": string,"location": string | null,"name": string,"next_inventory_number": number,"public_profile": boolean,"slug": string,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"contact_email"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"dimension_unit"?: string,"id"?: string,"inventory_prefix"?: string,"location"?: string | null,"name": string,"next_inventory_number"?: number,"public_profile"?: boolean,"slug": string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "bio"?: string | null,"contact_email"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"dimension_unit"?: string,"id"?: string,"inventory_prefix"?: string,"location"?: string | null,"name"?: string,"next_inventory_number"?: number,"public_profile"?: boolean,"slug"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"collection_pieces": {
                  Row: {
                    "artist_id": string,"collection_id": string,"created_at": string,"piece_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"collection_id": string,"created_at"?: string,"piece_id": string,"position"?: number
                  }
                  Update: {
                    "artist_id"?: string,"collection_id"?: string,"created_at"?: string,"piece_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_pieces_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_pieces_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_pieces_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_pieces_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "public_collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_pieces_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_pieces_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "public_pieces"
      referencedColumns: ["id"]
    }
                  ]
                },"collections": {
                  Row: {
                    "artist_id": string,"created_at": string,"description": string | null,"id": string,"is_public": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_public"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "artist_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_public"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "collections_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collections_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    }
                  ]
                },"piece_editions": {
                  Row: {
                    "artist_id": string,"created_at": string,"edition_number": string,"id": string,"location": string | null,"notes": string | null,"piece_id": string,"price": number | null,"status": Database["public"]['Enums']["piece_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"created_at"?: string,"edition_number": string,"id"?: string,"location"?: string | null,"notes"?: string | null,"piece_id": string,"price"?: number | null,"status"?: Database["public"]['Enums']["piece_status"],"updated_at"?: string
                  }
                  Update: {
                    "artist_id"?: string,"created_at"?: string,"edition_number"?: string,"id"?: string,"location"?: string | null,"notes"?: string | null,"piece_id"?: string,"price"?: number | null,"status"?: Database["public"]['Enums']["piece_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "piece_editions_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piece_editions_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piece_editions_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piece_editions_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "public_pieces"
      referencedColumns: ["id"]
    }
                  ]
                },"piece_images": {
                  Row: {
                    "artist_id": string,"caption": string | null,"created_at": string,"height": number | null,"id": string,"piece_id": string,"position": number,"storage_path": string,"thumb_path": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"caption"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"piece_id": string,"position"?: number,"storage_path": string,"thumb_path"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "artist_id"?: string,"caption"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"piece_id"?: string,"position"?: number,"storage_path"?: string,"thumb_path"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "piece_images_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piece_images_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piece_images_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piece_images_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "public_pieces"
      referencedColumns: ["id"]
    }
                  ]
                },"pieces": {
                  Row: {
                    "artist_id": string,"created_at": string,"creation_date": string | null,"currency": string | null,"depth": number | null,"description": string | null,"dimension_unit": string,"edition_size": number | null,"framed": boolean,"framed_depth": number | null,"framed_height": number | null,"framed_width": number | null,"height": number | null,"id": string,"inventory_number": string | null,"is_public": boolean,"kind": Database["public"]['Enums']["piece_kind"],"location": string | null,"medium": string | null,"notes": string | null,"price": number | null,"show_price": boolean,"signature": string | null,"source_ref": string | null,"status": Database["public"]['Enums']["piece_status"],"style": string | null,"subject": string | null,"tags": (string)[],"title": string,"updated_at": string,"width": number | null,"year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"created_at"?: string,"creation_date"?: string | null,"currency"?: string | null,"depth"?: number | null,"description"?: string | null,"dimension_unit"?: string,"edition_size"?: number | null,"framed"?: boolean,"framed_depth"?: number | null,"framed_height"?: number | null,"framed_width"?: number | null,"height"?: number | null,"id"?: string,"inventory_number"?: string | null,"is_public"?: boolean,"kind"?: Database["public"]['Enums']["piece_kind"],"location"?: string | null,"medium"?: string | null,"notes"?: string | null,"price"?: number | null,"show_price"?: boolean,"signature"?: string | null,"source_ref"?: string | null,"status"?: Database["public"]['Enums']["piece_status"],"style"?: string | null,"subject"?: string | null,"tags"?: (string)[],"title": string,"updated_at"?: string,"width"?: number | null,"year"?: number | null
                  }
                  Update: {
                    "artist_id"?: string,"created_at"?: string,"creation_date"?: string | null,"currency"?: string | null,"depth"?: number | null,"description"?: string | null,"dimension_unit"?: string,"edition_size"?: number | null,"framed"?: boolean,"framed_depth"?: number | null,"framed_height"?: number | null,"framed_width"?: number | null,"height"?: number | null,"id"?: string,"inventory_number"?: string | null,"is_public"?: boolean,"kind"?: Database["public"]['Enums']["piece_kind"],"location"?: string | null,"medium"?: string | null,"notes"?: string | null,"price"?: number | null,"show_price"?: boolean,"signature"?: string | null,"source_ref"?: string | null,"status"?: Database["public"]['Enums']["piece_status"],"style"?: string | null,"subject"?: string | null,"tags"?: (string)[],"title"?: string,"updated_at"?: string,"width"?: number | null,"year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pieces_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pieces_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "public_artists": {
                  Row: {
                    "bio": string | null,"contact_email": string | null,"currency": string,"dimension_unit": string,"id": string,"location": string | null,"name": string,"slug": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "bio"?: string | null,"contact_email"?: string | null,"currency"?: string | null,"dimension_unit"?: string | null,"id"?: string | null,"location"?: string | null,"name"?: string | null,"slug"?: string | null,"website"?: string | null
                         }
                        Update: {
                           "bio"?: string | null,"contact_email"?: string | null,"currency"?: string | null,"dimension_unit"?: string | null,"id"?: string | null,"location"?: string | null,"name"?: string | null,"slug"?: string | null,"website"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"public_collections": {
                  Row: {
                    "artist_id": string,"artist_slug": string,"description": string | null,"id": string,"name": string,"piece_ids": (string)[] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "collections_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collections_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    }
                  ]
                },"public_pieces": {
                  Row: {
                    "artist_id": string,"artist_slug": string,"created_at": string,"currency": string | null,"depth": number | null,"description": string | null,"dimension_unit": string,"edition_size": number | null,"framed": boolean,"framed_depth": number | null,"framed_height": number | null,"framed_width": number | null,"height": number | null,"id": string,"images": Json | null,"inventory_number": string | null,"kind": Database["public"]['Enums']["piece_kind"],"medium": string | null,"price": number | null,"status": Database["public"]['Enums']["piece_status"],"style": string | null,"subject": string | null,"tags": (string)[],"title": string,"width": number | null,"year": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "pieces_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pieces_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_member_by_email":
{ Args: { "p_artist_id": string,"p_email": string,"p_role"?: Database["public"]['Enums']["member_role"] }; Returns: undefined
                           },
"can_edit":
{ Args: { "a": string }; Returns: boolean
                           },
"is_member":
{ Args: { "a": string }; Returns: boolean
                           },
"is_owner":
{ Args: { "a": string }; Returns: boolean
                           },
"member_role_of":
{ Args: { "a": string }; Returns: Database["public"]['Enums']["member_role"]
                           },
"storage_artist_id":
{ Args: { "object_name": string }; Returns: string
                           }
          }
          Enums: {
            "member_role": "owner"|"editor"|"viewer","piece_kind": "original"|"edition","piece_status": "available"|"on_hold"|"sold"|"on_loan"|"consigned"|"not_for_sale"|"gifted"|"donated"|"destroyed"|"archived"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "member_role": ["owner", "editor", "viewer"],"piece_kind": ["original", "edition"],"piece_status": ["available", "on_hold", "sold", "on_loan", "consigned", "not_for_sale", "gifted", "donated", "destroyed", "archived"]
          }
        }
} as const
