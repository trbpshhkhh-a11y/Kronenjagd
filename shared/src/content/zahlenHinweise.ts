/**
 * Hinweisbegriffe für Bots als Kenner bei „Zahlen erraten“.
 * Jede Kategorie hat genau 10 Begriffe, geordnet von ganz klein/wenig (1) bis riesig/sehr viel (10).
 */
export interface HinweisKategorie {
  kategorie: string;
  begriffe: string[];
}

export const ZAHLEN_HINWEISE: HinweisKategorie[] = [
  { kategorie: 'Tiere', begriffe: ['Ameise', 'Maus', 'Hamster', 'Katze', 'Hund', 'Schaf', 'Pferd', 'Nashorn', 'Elefant', 'Blauwal'] },
  { kategorie: 'Gebäude', begriffe: ['Vogelhaus', 'Hundehütte', 'Gartenhaus', 'Garage', 'Einfamilienhaus', 'Bauernhof', 'Kirche', 'Hochhaus', 'Fernsehturm', 'Burj Khalifa'] },
  { kategorie: 'Fahrzeuge', begriffe: ['Tretroller', 'Fahrrad', 'Motorrad', 'Kleinwagen', 'Auto', 'Lieferwagen', 'Bus', 'Lastwagen', 'Zug', 'Kreuzfahrtschiff'] },
  { kategorie: 'Obst & Gemüse', begriffe: ['Erbse', 'Kirsche', 'Erdbeere', 'Pflaume', 'Apfel', 'Mango', 'Ananas', 'Kohlkopf', 'Wassermelone', 'Riesenkürbis'] },
  { kategorie: 'Weihnachten', begriffe: ['Schneeflocke', 'Plätzchen', 'Christbaumkugel', 'Kerze', 'Geschenk', 'Adventskranz', 'Schneemann', 'Tannenbaum', 'Rentierschlitten', 'Weihnachtsmarkt'] },
  { kategorie: 'Orte', begriffe: ['Schuhkarton', 'Zimmer', 'Wohnung', 'Garten', 'Fußballfeld', 'Dorf', 'Kleinstadt', 'Großstadt', 'Deutschland', 'Russland'] },
];
