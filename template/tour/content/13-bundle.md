# Send the deck as one file

`byeslide bundle` puts every slide, font, video and script into one HTML file. Put it on Teams or SharePoint: people download it, open it in Edge or Chrome, and it works offline.

The picture, in one click: the 59 files that `byeslide build` writes for this deck turn into one file.

- **byeslide.html**: one file, 3.6 MB.
- Caption: This deck after `byeslide build`: 59 files in `dist/`. After `byeslide bundle`: one.

## Speaker notes

Click once: the 59 files that byeslide build writes for this deck fly into one HTML file. That file is what you share after the talk. It needs no server and no network, and the speaker view still works. Videos above 20 MB stop the bundle with a message; raise the limit with --max-asset-mb. Technique: a slide script creates the sheets and aims each one with custom properties, and one empty fragment starts the move.
