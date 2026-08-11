import { describe, expect, test } from "vitest";
import { parseTaskContent } from "./taskContent";

describe("task content parser", () => {
  test("accepts the default BlockNote document shapes used by the task drawer", () => {
    const document = [
      {
        id: "intro",
        type: "paragraph",
        props: {
          backgroundColor: "default",
          textAlignment: "left",
          textColor: "default",
        },
        content: [
          { type: "text", text: "Důležité ", styles: { bold: true } },
          {
            type: "link",
            href: "https://example.com",
            content: [
              { type: "text", text: "zadání", styles: { underline: true } },
            ],
          },
        ],
        children: [
          {
            type: "bulletListItem",
            content: "První bod",
            children: [{ type: "checkListItem", props: { checked: true } }],
          },
        ],
      },
      { type: "heading", props: { level: 2 }, content: "Nadpis" },
      { type: "numberedListItem", props: { start: 3 }, content: "Třetí" },
      { type: "toggleListItem", content: "Podrobnosti" },
      { type: "quote", content: "Citace" },
      {
        type: "codeBlock",
        props: { language: "typescript" },
        content: [{ type: "text", text: "const safe = true;", styles: {} }],
      },
      { type: "divider" },
      { type: "file", props: { name: "zadani.pdf", url: "https://files/x" } },
      { type: "image", props: { url: "https://files/image", showPreview: true } },
      { type: "audio", props: { url: "https://files/audio", showPreview: true } },
      { type: "video", props: { url: "https://files/video", previewWidth: 640 } },
      {
        type: "table",
        content: {
          type: "tableContent",
          columnWidths: [200, null],
          headerRows: 1,
          rows: [
            { cells: ["Jméno", "Stav"] },
            {
              cells: [
                {
                  type: "tableCell",
                  props: { colspan: 1, rowspan: 1 },
                  content: "Workeee",
                },
                [{ type: "text", text: "Hotovo", styles: {} }],
              ],
            },
          ],
        },
      },
    ];

    expect(parseTaskContent(JSON.stringify(document))).toEqual(document);
  });

  test("rejects content shapes that would throw during BlockNote conversion", () => {
    expect(parseTaskContent('[{"type":"unknown"}]')).toBeNull();
    expect(
      parseTaskContent('[{"type":"paragraph","content":[null]}]'),
    ).toBeNull();
    expect(
      parseTaskContent(
        '[{"type":"paragraph","content":[{"type":"text","text":"x","styles":{"unknown":true}}]}]',
      ),
    ).toBeNull();
    expect(
      parseTaskContent(
        '[{"type":"table","content":{"type":"tableContent","rows":[]}}]',
      ),
    ).toBeNull();
  });
});
