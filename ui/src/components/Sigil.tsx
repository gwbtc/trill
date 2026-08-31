import { auraToHex } from "@/logic/utils";
import { sigil } from "urbit-sigils";
import { reactRenderer } from "urbit-sigils";

interface SigilProps {
  patp: string;
  size: number;
  bg?: string;
  fg?: string;
}

const Sigil = (props: SigilProps) => {
  const bg = props.bg ? auraToHex(props.bg) : "var(--color-background)";
  const fg = props.fg ? auraToHex(props.fg) : "var(--color-primary)";
  if (props.patp.length > 15)
    // moons
    return (
      <>
        {sigil({
          patp: props.patp.substring(props.patp.length - 13),
          renderer: reactRenderer,
          size: props.size,
          colors: ["grey", "white"],
        })}
      </>
    );
  else
    return (
      <>
        {sigil({
          patp: props.patp,
          renderer: reactRenderer,
          size: props.size,
          colors: [bg, fg],
        })}
      </>
    );
};

export default Sigil;
