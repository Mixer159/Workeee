import type { Dictionary } from "@blocknote/core";
import { en } from "@blocknote/core/locales";

/**
 * Czech copy for BlockNote.
 *
 * BlockNote ships 24 locales and Czech is not one of them, so the English
 * dictionary is the base and everything a person actually reads — the slash
 * menu, the placeholders, the toolbars, the block menu — is replaced. Anything
 * left in English is a string the UI does not surface (the AI and collaborative
 * comment features are off).
 *
 * The `aliases` are what the slash menu matches on, so each item keeps both its
 * Czech and its English keywords: people type `/img` as often as `/obrázek`.
 */
export const blocknoteCs: Dictionary = {
  ...en,
  slash_menu: {
    ...en.slash_menu,
    heading: {
      title: "Nadpis 1",
      subtext: "Hlavní nadpis",
      aliases: ["nadpis", "h", "h1", "heading1"],
      group: "Nadpisy",
    },
    heading_2: {
      title: "Nadpis 2",
      subtext: "Nadpis sekce",
      aliases: ["nadpis2", "h2", "heading2", "podnadpis"],
      group: "Nadpisy",
    },
    heading_3: {
      title: "Nadpis 3",
      subtext: "Nadpis podsekce",
      aliases: ["nadpis3", "h3", "heading3", "podnadpis"],
      group: "Nadpisy",
    },
    heading_4: {
      title: "Nadpis 4",
      subtext: "Menší nadpis podsekce",
      aliases: ["nadpis4", "h4", "heading4"],
      group: "Podnadpisy",
    },
    heading_5: {
      title: "Nadpis 5",
      subtext: "Malý nadpis podsekce",
      aliases: ["nadpis5", "h5", "heading5"],
      group: "Podnadpisy",
    },
    heading_6: {
      title: "Nadpis 6",
      subtext: "Nejmenší nadpis",
      aliases: ["nadpis6", "h6", "heading6"],
      group: "Podnadpisy",
    },
    toggle_heading: {
      title: "Rozbalovací nadpis 1",
      subtext: "Hlavní nadpis, který jde sbalit",
      aliases: ["nadpis", "h1", "rozbalovaci", "collapsable"],
      group: "Podnadpisy",
    },
    toggle_heading_2: {
      title: "Rozbalovací nadpis 2",
      subtext: "Nadpis sekce, který jde sbalit",
      aliases: ["nadpis2", "h2", "rozbalovaci", "collapsable"],
      group: "Podnadpisy",
    },
    toggle_heading_3: {
      title: "Rozbalovací nadpis 3",
      subtext: "Nadpis podsekce, který jde sbalit",
      aliases: ["nadpis3", "h3", "rozbalovaci", "collapsable"],
      group: "Podnadpisy",
    },
    quote: {
      title: "Citace",
      subtext: "Citace nebo výňatek",
      aliases: ["citace", "quote", "bq"],
      group: "Základní bloky",
    },
    toggle_list: {
      title: "Rozbalovací seznam",
      subtext: "Seznam se skrytými položkami",
      aliases: ["seznam", "rozbalovaci", "toggle", "list"],
      group: "Základní bloky",
    },
    numbered_list: {
      title: "Číslovaný seznam",
      subtext: "Seznam s pořadím",
      aliases: ["cislovany", "seznam", "ol", "list"],
      group: "Základní bloky",
    },
    bullet_list: {
      title: "Odrážkový seznam",
      subtext: "Seznam bez pořadí",
      aliases: ["odrazky", "seznam", "ul", "list"],
      group: "Základní bloky",
    },
    check_list: {
      title: "Zaškrtávací seznam",
      subtext: "Seznam s políčky k odškrtnutí",
      aliases: ["ukoly", "checklist", "seznam", "checkbox"],
      group: "Základní bloky",
    },
    paragraph: {
      title: "Odstavec",
      subtext: "Běžný text",
      aliases: ["odstavec", "text", "p"],
      group: "Základní bloky",
    },
    code_block: {
      title: "Blok kódu",
      subtext: "Kód se zvýrazněnou syntaxí",
      aliases: ["kod", "code", "pre"],
      group: "Základní bloky",
    },
    page_break: {
      title: "Konec stránky",
      subtext: "Oddělovač stránek",
      aliases: ["stranka", "break", "page"],
      group: "Základní bloky",
    },
    divider: {
      title: "Oddělovač",
      subtext: "Vodorovná čára mezi bloky",
      aliases: ["oddelovac", "cara", "hr", "divider"],
      group: "Základní bloky",
    },
    table: {
      title: "Tabulka",
      subtext: "Tabulka s upravitelnými buňkami",
      aliases: ["tabulka", "table"],
      group: "Pokročilé",
    },
    image: {
      title: "Obrázek",
      subtext: "Obrázek s popiskem",
      aliases: ["obrazek", "image", "img", "foto", "upload"],
      group: "Média",
    },
    video: {
      title: "Video",
      subtext: "Video s popiskem",
      aliases: ["video", "mp4", "upload"],
      group: "Média",
    },
    audio: {
      title: "Zvuk",
      subtext: "Zvuková nahrávka s popiskem",
      aliases: ["zvuk", "audio", "mp3", "upload"],
      group: "Média",
    },
    file: {
      title: "Soubor",
      subtext: "Vložený soubor",
      aliases: ["soubor", "file", "upload"],
      group: "Média",
    },
    emoji: {
      title: "Emoji",
      subtext: "Najít a vložit emoji",
      aliases: ["emoji", "smajlik", "emote"],
      group: "Ostatní",
    },
  },
  placeholders: {
    ...en.placeholders,
    default: "Napište popis… „/“ pro příkazy",
    heading: "Nadpis",
    toggleListItem: "Rozbalovací položka",
    bulletListItem: "Položka",
    numberedListItem: "Položka",
    checkListItem: "Položka",
  },
  file_blocks: {
    add_button_text: {
      image: "Přidat obrázek",
      video: "Přidat video",
      audio: "Přidat zvuk",
      file: "Přidat soubor",
    },
  },
  toggle_blocks: {
    add_block_button: "Prázdný blok. Kliknutím přidáte obsah.",
  },
  side_menu: {
    add_block_label: "Přidat blok",
    drag_handle_label: "Otevřít nabídku bloku",
  },
  drag_handle: {
    delete_menuitem: "Smazat",
    colors_menuitem: "Barvy",
    header_row_menuitem: "Záhlaví řádku",
    header_column_menuitem: "Záhlaví sloupce",
  },
  table_handle: {
    delete_column_menuitem: "Smazat sloupec",
    delete_row_menuitem: "Smazat řádek",
    add_left_menuitem: "Přidat sloupec vlevo",
    add_right_menuitem: "Přidat sloupec vpravo",
    add_above_menuitem: "Přidat řádek nad",
    add_below_menuitem: "Přidat řádek pod",
    split_cell_menuitem: "Rozdělit buňku",
    merge_cells_menuitem: "Sloučit buňky",
    background_color_menuitem: "Barva pozadí",
  },
  suggestion_menu: {
    no_items_title: "Nic nenalezeno",
  },
  color_picker: {
    text_title: "Text",
    background_title: "Pozadí",
    colors: {
      default: "Automatická",
      gray: "Šedá",
      brown: "Hnědá",
      red: "Červená",
      orange: "Oranžová",
      yellow: "Žlutá",
      green: "Zelená",
      blue: "Modrá",
      purple: "Fialová",
      pink: "Růžová",
    },
  },
  formatting_toolbar: {
    ...en.formatting_toolbar,
    bold: { tooltip: "Tučně", secondary_tooltip: "Mod+B" },
    italic: { tooltip: "Kurzíva", secondary_tooltip: "Mod+I" },
    underline: { tooltip: "Podtržení", secondary_tooltip: "Mod+U" },
    strike: { tooltip: "Přeškrtnutí", secondary_tooltip: "Mod+Shift+S" },
    code: { tooltip: "Kód", secondary_tooltip: "" },
    colors: { tooltip: "Barvy" },
    link: { tooltip: "Vložit odkaz", secondary_tooltip: "Mod+K" },
    file_caption: { tooltip: "Upravit popisek", input_placeholder: "Popisek" },
    file_replace: {
      tooltip: {
        image: "Nahradit obrázek",
        video: "Nahradit video",
        audio: "Nahradit zvuk",
        file: "Nahradit soubor",
      },
    },
    file_rename: {
      tooltip: {
        image: "Přejmenovat obrázek",
        video: "Přejmenovat video",
        audio: "Přejmenovat zvuk",
        file: "Přejmenovat soubor",
      },
      input_placeholder: {
        image: "Název obrázku",
        video: "Název videa",
        audio: "Název zvuku",
        file: "Název souboru",
      },
    },
    file_download: {
      tooltip: {
        image: "Stáhnout obrázek",
        video: "Stáhnout video",
        audio: "Stáhnout zvuk",
        file: "Stáhnout soubor",
      },
    },
    file_delete: {
      tooltip: {
        image: "Smazat obrázek",
        video: "Smazat video",
        audio: "Smazat zvuk",
        file: "Smazat soubor",
      },
    },
  },
  file_panel: {
    upload: {
      title: "Nahrát",
      file_placeholder: {
        image: "Nahrát obrázek",
        video: "Nahrát video",
        audio: "Nahrát zvuk",
        file: "Nahrát soubor",
      },
      upload_error: "Nahrání se nepovedlo",
    },
    embed: {
      title: "Odkaz",
      embed_button: {
        image: "Vložit obrázek",
        video: "Vložit video",
        audio: "Vložit zvuk",
        file: "Vložit soubor",
      },
      url_placeholder: "Zadejte adresu",
    },
  },
  link_toolbar: {
    delete: { tooltip: "Odstranit odkaz" },
    edit: { text: "Upravit odkaz", tooltip: "Upravit" },
    open: { tooltip: "Otevřít v novém panelu" },
    form: {
      title_placeholder: "Text odkazu",
      url_placeholder: "Adresa",
    },
  },
  generic: { ctrl_shortcut: "Ctrl" },
};
