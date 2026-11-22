import { useMemo } from "react";
import { useSiteContent, type CvRow } from "./content";

/** From the artist's own site (reference/google-site/CONTENT.md). Names stay in their original language. */
const builtInSolo: [string, string][] = [
  ["2020", "American Paintings New York + Los Angeles 1985–1999 · Centre Cultural Terrassa, Barcelona"],
  ["2019", "Seeing beneath the walls · Castell de Benedormiens, Girona"],
  ["2011", "Blanc i Negre · Galeria Àmbit, Barcelona"],
  ["2008", "The heartbeat of the earth · Convent of San Salvador, Horta de Sant Joan"],
  ["2003", "Retrovisor 93–03 · Galeria Àmbit, Barcelona"],
  ["2002", "Paraísos perdidos · Sala Parés, Barcelona"],
  ["1998", "100 days · Círculo de Bellas Artes, Madrid"],
  ["1994", "ARCO · Galería Trama, Madrid"],
  ["1990", "Catalunya Gallery · Tokyo"],
  ["1986", "Limbo Lounge Gallery · New York"],
  ["1975", "Taller Picasso · Barcelona"],
];

const builtInCommissions: [string, string][] = [
  ["2022", "Suite of 60 paintings for Álvaro Palacios · Corullón, León"],
  ["2021", "Sun & Moon, two large-scale paintings · Hospital Clínic, Barcelona"],
  ["2017", "Paintings for Hotel Seminari · La Seu d'Urgell, Lleida"],
  ["2008", "My Town, a suite of 32 paintings · Hotel Santuari del Sant Crist, Balaguer"],
  ["2006", "Wine label paintings for Álvaro Palacios (Pétalos)"],
  ["2005", "Limbo, a carpet for the Nani Marquina collection"],
  ["1999", "Seven true fresco murals · Hotel Juan Carlos I, Barcelona"],
  ["1998", "Acid-engraved glass wall · Triangle, Barcelona"],
  ["1992", "Postage stamps for the Barcelona Olympic Games"],
];

const toRows = (r: [string, string][]): CvRow[] => r.map(([year, text]) => ({ year, text }));
const fromRows = (r: CvRow[]): [string, string][] => r.map(({ year, text }) => [year, text]);

/** The site's built-in CV, sent to Artfolio so its editor starts from what the site shows today. */
export const builtInCv = () => ({ solo: toRows(builtInSolo), commissions: toRows(builtInCommissions) });

/** The CV as set in Artfolio → Website → CV, or the built-in one. An emptied list hides its column. */
export function useCv() {
  const cv = useSiteContent().cv;
  return useMemo(
    () => ({
      soloShows: cv?.solo ? fromRows(cv.solo) : builtInSolo,
      commissions: cv?.commissions ? fromRows(cv.commissions) : builtInCommissions,
    }),
    [cv],
  );
}
