import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Aisle, ShoppingList } from "@/lib/types";

const AISLE_LABELS: Record<Aisle, string> = {
  produce: "Produce",
  meat: "Meat & fish",
  dairy: "Dairy",
  pantry: "Pantry",
  other: "Other",
};

export function shoppingListPdfFilename(weekLabel: string): string {
  return `Mortang shopping list — ${weekLabel}.pdf`;
}

function pdfSafe(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, (ch) => {
    if (ch === "–" || ch === "—") return "-";
    if (ch === "’" || ch === "‘") return "'";
    if (ch === "“" || ch === "”") return '"';
    return " ";
  });
}

export async function shoppingListPdf(input: {
  groups: ShoppingList;
  weekLabel: string;
}): Promise<Blob> {
  const doc = await PDFDocument.create();
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage();
  let y = page.getSize().height - 52;
  const left = 48;
  const box = 11;
  const ink = rgb(0.1, 0.09, 0.06);
  let itemIndex = 0;

  function ensureSpace(size: number) {
    if (y < 48) {
      page = doc.addPage();
      y = page.getSize().height - 52;
    }
    y -= size;
  }

  function line(text: string, size: number, face = font) {
    ensureSpace(size);
    page.drawText(pdfSafe(text), { x: left, y, size, font: face, color: ink });
    y -= 8;
  }

  line("Shopping list", 18, bold);
  line(input.weekLabel, 11);
  y -= 10;
  for (const group of input.groups) {
    line(AISLE_LABELS[group.aisle] ?? group.aisle, 13, bold);
    for (const item of group.items) {
      ensureSpace(11);
      const check = form.createCheckBox(`item.${itemIndex}`);
      itemIndex += 1;
      check.addToPage(page, {
        x: left,
        y: y - 1,
        width: box,
        height: box,
        borderWidth: 1,
        borderColor: ink,
        textColor: ink,
      });
      page.drawText(
        pdfSafe(`${item.quantity} ${item.unit}   ${item.name}`),
        { x: left + box + 8, y, size: 11, font, color: ink },
      );
      y -= 10;
    }
    y -= 8;
  }

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
