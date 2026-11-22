
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
                },"contacts": {
                  Row: {
                    "address": string | null,"artist_id": string,"city": string | null,"company": string | null,"country": string | null,"created_at": string,"email": string | null,"id": string,"kind": string,"name": string,"notes": string | null,"phone": string | null,"represents_artist": boolean,"source_ref": string | null,"tags": (string)[],"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"artist_id": string,"city"?: string | null,"company"?: string | null,"country"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"kind"?: string,"name": string,"notes"?: string | null,"phone"?: string | null,"represents_artist"?: boolean,"source_ref"?: string | null,"tags"?: (string)[],"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"artist_id"?: string,"city"?: string | null,"company"?: string | null,"country"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null,"represents_artist"?: boolean,"source_ref"?: string | null,"tags"?: (string)[],"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "artist_id": string,"contact_id": string | null,"created_at": string,"created_by": string | null,"exhibition_id": string | null,"id": string,"mime_type": string | null,"piece_id": string | null,"sale_id": string | null,"size_bytes": number | null,"source_url": string | null,"storage_path": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"exhibition_id"?: string | null,"id"?: string,"mime_type"?: string | null,"piece_id"?: string | null,"sale_id"?: string | null,"size_bytes"?: number | null,"source_url"?: string | null,"storage_path": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "artist_id"?: string,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"exhibition_id"?: string | null,"id"?: string,"mime_type"?: string | null,"piece_id"?: string | null,"sale_id"?: string | null,"size_bytes"?: number | null,"source_url"?: string | null,"storage_path"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_exhibition_id_fkey"
      columns: ["exhibition_id"]
isOneToOne: false
      referencedRelation: "exhibitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_exhibition_id_fkey"
      columns: ["exhibition_id"]
isOneToOne: false
      referencedRelation: "public_exhibitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "public_pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"exhibition_pieces": {
                  Row: {
                    "artist_id": string,"created_at": string,"exhibition_id": string,"notes": string | null,"piece_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"created_at"?: string,"exhibition_id": string,"notes"?: string | null,"piece_id": string
                  }
                  Update: {
                    "artist_id"?: string,"created_at"?: string,"exhibition_id"?: string,"notes"?: string | null,"piece_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exhibition_pieces_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exhibition_pieces_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exhibition_pieces_exhibition_id_fkey"
      columns: ["exhibition_id"]
isOneToOne: false
      referencedRelation: "exhibitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exhibition_pieces_exhibition_id_fkey"
      columns: ["exhibition_id"]
isOneToOne: false
      referencedRelation: "public_exhibitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exhibition_pieces_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exhibition_pieces_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "public_pieces"
      referencedColumns: ["id"]
    }
                  ]
                },"exhibitions": {
                  Row: {
                    "artist_id": string,"city": string | null,"country": string | null,"created_at": string,"description": string | null,"end_date": string | null,"id": string,"is_public": boolean,"kind": string,"source_ref": string | null,"start_date": string | null,"title": string,"updated_at": string,"url": string | null,"venue": string | null,"venue_contact_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"city"?: string | null,"country"?: string | null,"created_at"?: string,"description"?: string | null,"end_date"?: string | null,"id"?: string,"is_public"?: boolean,"kind"?: string,"source_ref"?: string | null,"start_date"?: string | null,"title": string,"updated_at"?: string,"url"?: string | null,"venue"?: string | null,"venue_contact_id"?: string | null
                  }
                  Update: {
                    "artist_id"?: string,"city"?: string | null,"country"?: string | null,"created_at"?: string,"description"?: string | null,"end_date"?: string | null,"id"?: string,"is_public"?: boolean,"kind"?: string,"source_ref"?: string | null,"start_date"?: string | null,"title"?: string,"updated_at"?: string,"url"?: string | null,"venue"?: string | null,"venue_contact_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exhibitions_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exhibitions_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exhibitions_venue_contact_id_fkey"
      columns: ["venue_contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    }
                  ]
                },"import_runs": {
                  Row: {
                    "artist_id": string,"created_at": string,"created_by": string | null,"file_names": (string)[],"id": string,"source": string,"summary": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"created_at"?: string,"created_by"?: string | null,"file_names"?: (string)[],"id"?: string,"source": string,"summary"?: NonNullable<Json>
                  }
                  Update: {
                    "artist_id"?: string,"created_at"?: string,"created_by"?: string | null,"file_names"?: (string)[],"id"?: string,"source"?: string,"summary"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_runs_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "import_runs_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "artist_id": string,"contact_id": string | null,"created_at": string,"currency": string | null,"discount": number | null,"due_date": string | null,"id": string,"issue_date": string,"notes": string | null,"number": string,"paid_date": string | null,"shipping": number | null,"source_ref": string | null,"status": string,"tax_rate": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"contact_id"?: string | null,"created_at"?: string,"currency"?: string | null,"discount"?: number | null,"due_date"?: string | null,"id"?: string,"issue_date"?: string,"notes"?: string | null,"number": string,"paid_date"?: string | null,"shipping"?: number | null,"source_ref"?: string | null,"status"?: string,"tax_rate"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "artist_id"?: string,"contact_id"?: string | null,"created_at"?: string,"currency"?: string | null,"discount"?: number | null,"due_date"?: string | null,"id"?: string,"issue_date"?: string,"notes"?: string | null,"number"?: string,"paid_date"?: string | null,"shipping"?: number | null,"source_ref"?: string | null,"status"?: string,"tax_rate"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "address": string | null,"artist_id": string,"contact_id": string | null,"created_at": string,"id": string,"is_public": boolean,"kind": string,"name": string,"notes": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"artist_id": string,"contact_id"?: string | null,"created_at"?: string,"id"?: string,"is_public"?: boolean,"kind"?: string,"name": string,"notes"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"artist_id"?: string,"contact_id"?: string | null,"created_at"?: string,"id"?: string,"is_public"?: boolean,"kind"?: string,"name"?: string,"notes"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "locations_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "locations_contact_fk"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
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
                    "artist_id": string,"caption": string | null,"created_at": string,"height": number | null,"id": string,"is_public": boolean,"piece_id": string,"position": number,"source_url": string | null,"storage_path": string,"thumb_path": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"caption"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"is_public"?: boolean,"piece_id": string,"position"?: number,"source_url"?: string | null,"storage_path": string,"thumb_path"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "artist_id"?: string,"caption"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"is_public"?: boolean,"piece_id"?: string,"position"?: number,"source_url"?: string | null,"storage_path"?: string,"thumb_path"?: string | null,"width"?: number | null
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
                },"piece_notes": {
                  Row: {
                    "artist_id": string,"body": string,"created_at": string,"created_by": string | null,"id": string,"piece_id": string,"source_ref": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"piece_id": string,"source_ref"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "artist_id"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"piece_id"?: string,"source_ref"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "piece_notes_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piece_notes_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piece_notes_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "piece_notes_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "public_pieces"
      referencedColumns: ["id"]
    }
                  ]
                },"pieces": {
                  Row: {
                    "artist_id": string,"created_at": string,"creation_date": string | null,"currency": string | null,"depth": number | null,"description": string | null,"dimension_unit": string,"edition_size": number | null,"framed": boolean,"framed_depth": number | null,"framed_height": number | null,"framed_width": number | null,"height": number | null,"id": string,"inventory_number": string | null,"is_public": boolean,"kind": Database["public"]['Enums']["piece_kind"],"location": string | null,"location_id": string | null,"medium": string | null,"notes": string | null,"price": number | null,"show_price": boolean,"signature": string | null,"slug": string,"source_ref": string | null,"status": Database["public"]['Enums']["piece_status"],"style": string | null,"subject": string | null,"tags": (string)[],"title": string,"updated_at": string,"width": number | null,"year": number | null,"year_circa": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"created_at"?: string,"creation_date"?: string | null,"currency"?: string | null,"depth"?: number | null,"description"?: string | null,"dimension_unit"?: string,"edition_size"?: number | null,"framed"?: boolean,"framed_depth"?: number | null,"framed_height"?: number | null,"framed_width"?: number | null,"height"?: number | null,"id"?: string,"inventory_number"?: string | null,"is_public"?: boolean,"kind"?: Database["public"]['Enums']["piece_kind"],"location"?: string | null,"location_id"?: string | null,"medium"?: string | null,"notes"?: string | null,"price"?: number | null,"show_price"?: boolean,"signature"?: string | null,"slug"?: string,"source_ref"?: string | null,"status"?: Database["public"]['Enums']["piece_status"],"style"?: string | null,"subject"?: string | null,"tags"?: (string)[],"title": string,"updated_at"?: string,"width"?: number | null,"year"?: number | null,"year_circa"?: boolean
                  }
                  Update: {
                    "artist_id"?: string,"created_at"?: string,"creation_date"?: string | null,"currency"?: string | null,"depth"?: number | null,"description"?: string | null,"dimension_unit"?: string,"edition_size"?: number | null,"framed"?: boolean,"framed_depth"?: number | null,"framed_height"?: number | null,"framed_width"?: number | null,"height"?: number | null,"id"?: string,"inventory_number"?: string | null,"is_public"?: boolean,"kind"?: Database["public"]['Enums']["piece_kind"],"location"?: string | null,"location_id"?: string | null,"medium"?: string | null,"notes"?: string | null,"price"?: number | null,"show_price"?: boolean,"signature"?: string | null,"slug"?: string,"source_ref"?: string | null,"status"?: Database["public"]['Enums']["piece_status"],"style"?: string | null,"subject"?: string | null,"tags"?: (string)[],"title"?: string,"updated_at"?: string,"width"?: number | null,"year"?: number | null,"year_circa"?: boolean
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
    },{
      foreignKeyName: "pieces_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
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
                },"provenance": {
                  Row: {
                    "artist_id": string,"contact_id": string | null,"created_at": string,"date_text": string | null,"description": string | null,"event": string,"id": string,"is_public": boolean,"party": string | null,"piece_id": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"contact_id"?: string | null,"created_at"?: string,"date_text"?: string | null,"description"?: string | null,"event"?: string,"id"?: string,"is_public"?: boolean,"party"?: string | null,"piece_id": string,"position"?: number,"updated_at"?: string
                  }
                  Update: {
                    "artist_id"?: string,"contact_id"?: string | null,"created_at"?: string,"date_text"?: string | null,"description"?: string | null,"event"?: string,"id"?: string,"is_public"?: boolean,"party"?: string | null,"piece_id"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "provenance_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provenance_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provenance_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provenance_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provenance_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "public_pieces"
      referencedColumns: ["id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "artist_id": string,"buyer_contact_id": string | null,"commission_pct": number | null,"created_at": string,"currency": string | null,"edition_id": string | null,"id": string,"invoice_id": string | null,"notes": string | null,"piece_id": string,"price": number | null,"sale_date": string | null,"source_ref": string | null,"status": string,"tax_amount": number | null,"updated_at": string,"via_contact_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"buyer_contact_id"?: string | null,"commission_pct"?: number | null,"created_at"?: string,"currency"?: string | null,"edition_id"?: string | null,"id"?: string,"invoice_id"?: string | null,"notes"?: string | null,"piece_id": string,"price"?: number | null,"sale_date"?: string | null,"source_ref"?: string | null,"status"?: string,"tax_amount"?: number | null,"updated_at"?: string,"via_contact_id"?: string | null
                  }
                  Update: {
                    "artist_id"?: string,"buyer_contact_id"?: string | null,"commission_pct"?: number | null,"created_at"?: string,"currency"?: string | null,"edition_id"?: string | null,"id"?: string,"invoice_id"?: string | null,"notes"?: string | null,"piece_id"?: string,"price"?: number | null,"sale_date"?: string | null,"source_ref"?: string | null,"status"?: string,"tax_amount"?: number | null,"updated_at"?: string,"via_contact_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_buyer_contact_id_fkey"
      columns: ["buyer_contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "piece_editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_piece_id_fkey"
      columns: ["piece_id"]
isOneToOne: false
      referencedRelation: "public_pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_via_contact_id_fkey"
      columns: ["via_contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    }
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
                },"public_exhibitions": {
                  Row: {
                    "artist_id": string,"artist_slug": string,"city": string | null,"country": string | null,"description": string | null,"end_date": string | null,"id": string,"kind": string,"piece_ids": (string)[] | null,"start_date": string | null,"title": string,"url": string | null,"venue": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "exhibitions_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exhibitions_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "public_artists"
      referencedColumns: ["id"]
    }
                  ]
                },"public_pieces": {
                  Row: {
                    "artist_id": string,"artist_slug": string,"created_at": string,"currency": string | null,"depth": number | null,"description": string | null,"dimension_unit": string,"edition_size": number | null,"framed": boolean,"framed_depth": number | null,"framed_height": number | null,"framed_width": number | null,"height": number | null,"id": string,"images": Json | null,"inventory_number": string | null,"kind": Database["public"]['Enums']["piece_kind"],"medium": string | null,"price": number | null,"slug": string,"status": Database["public"]['Enums']["piece_status"],"style": string | null,"subject": string | null,"tags": (string)[],"title": string,"width": number | null,"year": number | null,"year_circa": boolean
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
"catalogue_v1":
{ Args: { "p_artist_slug": string }; Returns: Json
                           },
"free_piece_slug":
{ Args: { "p_artist_id": string,"p_base": string,"p_exclude"?: string }; Returns: string
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
"next_invoice_number":
{ Args: { "p_artist_id": string }; Returns: string
                           },
"slugify":
{ Args: { "p_text": string }; Returns: string
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
