# Text that doesn't fit gets caught

`byeslide check` opens each slide in Chromium and measures it. This page runs the same measurement live: type into it or add a sentence.

The sample page the audience can edit:

**Pilot plan**

Two teams start in March. We check in every week and decide in May whether to widen the pilot.

Sentences that "Add a sentence" appends, one per click:

1. Each team names one owner who reports blockers on Mondays.
2. Budget stays inside the current tooling line until May.
3. If both teams hit their targets, a third team joins in June.
4. Risks and open questions live in the shared tracker.
5. We present the results at the all-hands in the last week of May.

Buttons: **Add a sentence**, **Reset**.

Output when the page fits: "No overflow detected." When it doesn't, the same lines `byeslide check` prints.

## Speaker notes

Click "Add a sentence" twice: the text runs past the page, the hatched band shows by how much, and the output matches what byeslide check prints for a deck. You can also click into the page and type. Agents run check after each edit, so overflow is found before anyone presents. Technique: contenteditable and buttons inside a slide; Reveal ignores keys while you type.
