export const HUDCorner = ({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) => {
  const c = "absolute w-4 h-4 border-cyan-500/50";
  const p = {
    tl: "top-0 left-0 border-t-2 border-l-2",
    tr: "top-0 right-0 border-t-2 border-r-2",
    bl: "bottom-0 left-0 border-b-2 border-l-2",
    br: "bottom-0 right-0 border-b-2 border-r-2"
  };
  return <div className={`${c} ${p[pos]}`} />;
};
