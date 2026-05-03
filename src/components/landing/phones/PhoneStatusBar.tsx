/**
 * Tiny iOS-style status bar that sits at the top of every phone
 * mockup screen. Rendered in pure CSS — the time string is fixed
 * at "9:41" because that's what every Apple device mockup uses
 * (per Apple's own marketing convention since the original iPhone
 * keynote). Battery / signal glyphs are simple SVG-ish shapes.
 *
 * Compact (~20px tall) so it doesn't eat the screen real estate.
 * The notch from PhoneFrame sits centered over this row.
 */

export function PhoneStatusBar() {
  return (
    <div className="relative z-10 flex h-7 items-center justify-between px-5 pt-1 text-[10px] font-semibold text-white">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        {/* Signal bars */}
        <div aria-hidden="true" className="flex items-end gap-[2px]">
          <span className="block h-[3px] w-[2px] rounded-sm bg-white" />
          <span className="block h-[5px] w-[2px] rounded-sm bg-white" />
          <span className="block h-[7px] w-[2px] rounded-sm bg-white" />
          <span className="block h-[9px] w-[2px] rounded-sm bg-white" />
        </div>
        {/* Wi-Fi (simple arc proxy) */}
        <span className="text-[10px]">5G</span>
        {/* Battery */}
        <div
          aria-hidden="true"
          className="ml-1 flex h-[10px] w-[20px] items-center rounded-[3px] border border-white/80 p-[1px]"
        >
          <span className="block h-full w-[80%] rounded-[1px] bg-white" />
        </div>
      </div>
    </div>
  );
}
