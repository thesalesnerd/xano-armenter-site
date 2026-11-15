import type { Database } from './database.types';

type T = Database['public']['Tables'];
type V = Database['public']['Views'];

export type Artist = T['artists']['Row'];
export type Member = T['artist_members']['Row'];
export type MemberRole = Database['public']['Enums']['member_role'];
export type Piece = T['pieces']['Row'];
export type PieceInsert = T['pieces']['Insert'];
export type PieceImage = T['piece_images']['Row'];
export type PieceEdition = T['piece_editions']['Row'];
export type Collection = T['collections']['Row'];
export type PieceStatus = Database['public']['Enums']['piece_status'];
export type PublicPiece = V['public_pieces']['Row'];
export type PublicArtist = V['public_artists']['Row'];
export type PublicCollection = V['public_collections']['Row'];

export type PublicImage = {
  storage_path: string;
  thumb_path: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
};

export type PieceWithImages = Piece & {
  piece_images: Pick<PieceImage, 'id' | 'storage_path' | 'thumb_path' | 'position'>[];
  collection_pieces: { collection_id: string }[];
};
