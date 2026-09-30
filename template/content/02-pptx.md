# One title, inside a .pptx

PowerPoint stores where the title sits as an offset and a size, counted in EMU: 914,400 to the inch. To move the title, you change the numbers.

Example: a trimmed excerpt of `slide1.xml` for a title that says "Quarterly review". Point out the offset and size lines.

```xml
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="2" name="Title 1"/>
    <p:nvPr><p:ph type="title"/></p:nvPr>
  </p:nvSpPr>
  <p:spPr><a:xfrm>
    <a:off x="838200" y="365125"/>
    <a:ext cx="10515600" cy="1325563"/>
  </a:xfrm></p:spPr>
  <p:txBody>
    <a:bodyPr/><a:p><a:r>
      <a:t>Quarterly review</a:t>
    </a:r></a:p>
  </p:txBody>
</p:sp>
```

## Speaker notes

This is a trimmed excerpt of slide1.xml from a real .pptx: one title placeholder. Point at the marked lines. The title's place on the page is stored as numbers, so any edit to the layout is arithmetic on those numbers. The next slide uses Reveal's auto-animate: the words move and everything else changes around them.
