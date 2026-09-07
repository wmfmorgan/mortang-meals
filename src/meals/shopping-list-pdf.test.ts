import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  shoppingListPdf,
  shoppingListPdfFilename,
} from "./shopping-list-pdf";

describe("shoppingListPdf", () => {
  it("names the file with the week range", () => {
    expect(shoppingListPdfFilename("Aug 31-Sep 6, 2026")).toBe(
      "Mortang shopping list — Aug 31-Sep 6, 2026.pdf",
    );
  });

  it("returns a PDF blob", async () => {
    const blob = await shoppingListPdf({
      weekLabel: "Aug 31–Sep 6, 2026",
      groups: [
        {
          aisle: "produce",
          items: [
            { name: "garlic", quantity: "4", unit: "clove", aisle: "produce" },
          ],
        },
      ],
    });
    expect(blob.type).toBe("application/pdf");
    const header = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
    expect(header).toBe("%PDF-");
  });

  it("includes a checkbox field for each item", async () => {
    const blob = await shoppingListPdf({
      weekLabel: "Aug 31–Sep 6, 2026",
      groups: [
        {
          aisle: "produce",
          items: [
            { name: "garlic", quantity: "4", unit: "clove", aisle: "produce" },
            { name: "parsley", quantity: "4", unit: "tbsp", aisle: "produce" },
          ],
        },
      ],
    });
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    const form = doc.getForm();
    expect(form.getFields()).toHaveLength(2);
    expect(form.getCheckBox("item.0")).toBeTruthy();
    expect(form.getCheckBox("item.1")).toBeTruthy();
  });
});
