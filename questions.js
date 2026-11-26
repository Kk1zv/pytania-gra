// Pytania. Każdy wpis:
//   q:      treść pytania, ____ oznacza miejsce na odpowiedź
//   a:      prawdziwa odpowiedź (pokazywana na ekranie)
//   alt:    inne formy, które też liczą się jako prawdziwa odpowiedź (gracze nie mogą ich wpisać)
//   decoys: fałszywe odpowiedzi, których używają boty
// Polskie znaki i wielkość liter nie mają znaczenia przy porównywaniu.
window.QUESTIONS = [
  { q: "Większość mieszkańców australijskiego miasteczka Coober Pedy mieszka ____.", a: "pod ziemią", alt: ["w podziemnych domach", "w podziemiach", "pod ziemi"], decoys: ["w przyczepach", "na palach", "w starych ciężarówkach górniczych"] },
  { q: "W 1932 roku australijska armia wypowiedziała wojnę ____ i ją przegrała.", a: "emu", alt: ["emom", "strusiom emu", "strusiom"], decoys: ["kangurom", "królikom", "ropuchom"] },
  { q: "Stado flamingów po angielsku nazywa się „flamboyance”, czyli dosłownie ____.", a: "ekstrawagancja", alt: ["przepych", "ekstrawagancją", "flamboyance"], decoys: ["rumieniec", "parada", "różowość"] },
  { q: "Stado wron po angielsku nazywa się ____.", a: "morderstwo", alt: ["murder", "zabójstwo"], decoys: ["sąd", "chór", "pogrzeb"] },
  { q: "Folię bąbelkową początkowo sprzedawano jako ____.", a: "tapetę", alt: ["tapeta", "tapety", "tapetę z fakturą"], decoys: ["materac", "osłonę na basen", "wyciszenie ścian"] },
  { q: "Wombaty robią kupy w kształcie ____.", a: "sześcianów", alt: ["sześcian", "sześcianu", "kostek", "kostki", "kostka", "kwadratów", "kostek do gry"], decoys: ["gwiazdek", "spiralek", "monet"] },
  { q: "W latach 30. XIX wieku keczup sprzedawano jako ____.", a: "lekarstwo", alt: ["lek", "leki", "lekarstwa", "tabletki", "lekarstwo w tabletkach"], decoys: ["farbę do włosów", "polewę do deserów", "pastę do butów"] },
  { q: "Narodowym zwierzęciem Szkocji jest ____.", a: "jednorożec", alt: ["jednorożce"], decoys: ["haggis", "jeleń szlachetny", "orzeł przedni"] },
  { q: "W Szwajcarii nie wolno trzymać tylko jednej ____.", a: "świnki morskiej", alt: ["świnka morska", "świnki", "świnek morskich"], decoys: ["złotej rybki", "krowy", "papugi"] },
  { q: "Ośmiornica ma ____ serca.", a: "trzy", alt: ["3"], decoys: ["dwa", "cztery"] },
  { q: "Archeolodzy znaleźli jadalny miód, który przeleżał tysiące lat w ____.", a: "egipskich grobowcach", alt: ["grobowcach", "grobowcu", "egipskim grobowcu", "grobowcach egipskich", "piramidach", "piramidzie", "egipskich piramidach"], decoys: ["zatopionym statku wikingów", "jaskini w Peru", "rzymskiej latrynie"] },
  { q: "Kleopatra żyła bliżej czasów lądowania na Księżycu niż czasów budowy ____.", a: "Wielkiej Piramidy w Gizie", alt: ["wielkiej piramidy", "piramid", "piramidy", "piramid w gizie", "piramidy w gizie", "piramidy cheopsa"], decoys: ["Koloseum", "Partenonu", "Wielkiego Muru Chińskiego"] },
  { q: "Wydry morskie podczas snu trzymają się za ____, żeby nie odpłynąć od siebie.", a: "łapki", alt: ["łapy", "ręce", "rączki", "łapę", "łapkę", "rękę"], decoys: ["ogony", "wąsy", "płetwy"] },
  { q: "Wieża Eiffla potrafi urosnąć o około 15 cm ____.", a: "latem", alt: ["w lecie", "w lato", "w upale", "w upały", "podczas upałów", "gdy jest gorąco"], decoys: ["zimą", "w deszczu", "nocą"] },
  { q: "Banany są lekko ____.", a: "radioaktywne", alt: ["promieniotwórcze", "radioaktywny", "promieniotwórczy"], decoys: ["magnetyczne", "alkoholowe", "naelektryzowane"] },
  { q: "Wynalazcę tuby na chipsy Pringles pochowano ____.", a: "w tubie po Pringlesach", alt: ["w tubie pringles", "w tubie", "w puszce po pringlesach", "w puszce pringles", "w puszce", "w opakowaniu po pringlesach"], decoys: ["z dożywotnim zapasem chipsów", "pod pierwszą fabryką", "na stojąco"] },
  { q: "Jeden dzień na Wenus trwa dłużej niż jeden wenusjański ____.", a: "rok", alt: ["roku"], decoys: ["miesiąc", "weekend", "sezon"] },
  { q: "Najdłuższy zarejestrowany lot kury trwał ____ sekund.", a: "13", alt: ["trzynaście"], decoys: ["6", "45", "90"] },
  { q: "Japońska wyspa Ōkunoshima jest opanowana przez przyjazne ____.", a: "króliki", alt: ["króliczki", "królik"], decoys: ["lisy", "żółwie", "kozy"] },
  { q: "Naukowcy nauczyli gołębie odróżniać obrazy Moneta od obrazów ____.", a: "Picassa", alt: ["picasso", "pabla picassa"], decoys: ["Van Gogha", "Dalego", "Rembrandta"] },
  { q: "W 1923 roku dżokej Frank Hayes wygrał wyścig konny, mimo że był już ____.", a: "martwy", alt: ["nieżywy", "trupem", "zmarły"], decoys: ["emerytem", "niewidomy", "dziewięciolatkiem"] },
  { q: "Homary poznają smak jedzenia za pomocą ____.", a: "nóg", alt: ["odnóży", "nogi", "stóp", "nog"], decoys: ["ogona", "oczu", "pancerza"] },
  { q: "Z botanicznego punktu widzenia truskawki nie są jagodami, ale ____ już tak.", a: "banany", alt: ["banan"], decoys: ["wiśnie", "maliny", "śliwki"] },
  { q: "Pierwsza kamerka internetowa na świecie, w Cambridge, obserwowała ____.", a: "dzbanek z kawą", alt: ["dzbanek kawy", "dzbanek", "ekspres do kawy", "ekspres", "kawę", "dzbanek na kawę"], decoys: ["akwarium", "drukarkę", "drzwi do pokoju"] },
  { q: "Dawni angielscy „budziciele” budzili ludzi, strzelając w ich okna ____.", a: "suszonym grochem", alt: ["grochem", "groszkiem", "suszonym groszkiem", "groch"], decoys: ["ryżem", "żołędziami", "kulkami z papieru"] },
  { q: "Mała kieszonka w dżinsach została wymyślona na ____.", a: "zegarek kieszonkowy", alt: ["zegarek", "zegarki", "zegarki kieszonkowe"], decoys: ["zapałki", "bilety kolejowe", "samorodki złota"] },
  { q: "Serce krewetki znajduje się w jej ____.", a: "głowie", alt: ["głowa"], decoys: ["ogonie", "odnóżach", "grzbiecie"] },
  { q: "Dwa „M” w nazwie M&M's pochodzą od nazwisk Mars i ____.", a: "Murrie", alt: ["bruce murrie"], decoys: ["Miller", "Morgan", "Malone"] },
  { q: "Firmę Nintendo założono w 1889 roku, żeby produkowała ____.", a: "karty do gry", alt: ["karty", "karty hanafuda", "hanafuda"], decoys: ["parasole", "garnki do ryżu", "latawce"] },
  { q: "Gdyby istniała dość duża wanna, Saturn by w niej ____.", a: "pływał", alt: ["unosił się", "unosił się na wodzie", "utrzymał się na wodzie", "pływałby", "nie zatonął"], decoys: ["zatonął", "rozpuścił się", "wybuchł"] },
  { q: "Krowy mają najlepszych przyjaciół, a gdy się je rozdzieli, są ____.", a: "zestresowane", alt: ["w stresie", "zestresowana", "zdenerwowane"], decoys: ["głośniejsze", "zagubione", "obrażone"] },
  { q: "Mona Lisa nie ma ____.", a: "brwi", alt: ["brwii", "brew"], decoys: ["dłoni", "podbródka", "ramion"] },
];
