# Pak Vets Mobile App – Flow Book

Visual flow book for the **Create Case** journey from Dashboard to Case Detail and back to Home.

## Contents

- **pak-vets-flow-book.html** – Flow document with embedded screenshots
- **pak-vets-flow-book.pdf** – PDF version (generated)
- **assets/** – Screenshot images used in the flow

## Generate PDF

1. **Using browser (recommended)**  
   - Open `pak-vets-flow-book.html` in Chrome or Safari  
   - `File` → `Print` (or Cmd+P)  
   - Destination: **Save as PDF**  
   - Enable "Background graphics" in print settings  
   - Save the file

2. **Using command line (Playwright)**  
   ```bash
   npx playwright install chromium
   npx playwright pdf pak-vets-flow-book.html pak-vets-flow-book.pdf
   ```

## Flow Summary

1. Dashboard (Home) – New Case or open existing case
2. Create New Case – Select Animal required
3. Search Animal – Find by image or by Tag ID / Owner / Phone
4. Create New Case – Animal selected, date, chief complaint → Create Case
5. Case Detail – Overview, collapsible sections
6. Diagnoses – AI suggestions, add/confirm diagnoses
7. Treatments – Add suggested treatments, mark complete
8. Notes & Media – Optional additions
9. Save – Return to Home

*Assumes doctor is registered and signed in.*
