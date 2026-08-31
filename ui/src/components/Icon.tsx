import bellSvg from "@/assets/icons/bell.svg?raw";
import cometSvg from "@/assets/icons/comet.svg?raw";
import copySvg from "@/assets/icons/copy.svg?raw";
import crowSvg from "@/assets/icons/crow.svg?raw";
import emojiSvg from "@/assets/icons/emoji.svg?raw";
import homeSvg from "@/assets/icons/home.svg?raw";
import followSvg from "@/assets/icons/follow.svg?raw";
import groundwireSvg from "@/assets/icons/groundwire.svg?raw";
import keySvg from "@/assets/icons/key.svg?raw";
import messagesSvg from "@/assets/icons/messages.svg?raw";
import nostrSvg from "@/assets/icons/nostr.svg?raw";
import nostrSvg2 from "@/assets/icons/Ostrich.svg?raw";
import planetSvg from "@/assets/icons/planet.svg?raw";
import palsSvg from "@/assets/icons/pals.svg?raw";
import profileSvg from "@/assets/icons/profile.svg?raw";
import quoteSvg from "@/assets/icons/quote.svg?raw";
import radioSvg from "@/assets/icons/radio.svg?raw";
import replySvg from "@/assets/icons/reply.svg?raw";
import repostSvg from "@/assets/icons/rt.svg?raw";
import rumorsSvg from "@/assets/icons/rumors.svg?raw";
import settingsSvg from "@/assets/icons/settings.svg?raw";
import trashSvg from "@/assets/icons/trash.svg?raw";
import youtubeSvg from "@/assets/icons/youtube.svg?raw";
import { colorToCSSVar, type ThemeColorsType } from "@/styles/ThemeProvider";

const icons = {
  bell: bellSvg,
  comet: cometSvg,
  copy: copySvg,
  crow: crowSvg,
  emoji: emojiSvg,
  follow: followSvg,
  groundwire: groundwireSvg,
  home: homeSvg,
  key: keySvg,
  messages: messagesSvg,
  nostr: nostrSvg,
  nostr2: nostrSvg2,
  pals: palsSvg,
  planet: planetSvg,
  profile: profileSvg,
  quote: quoteSvg,
  radio: radioSvg,
  reply: replySvg,
  repost: repostSvg,
  rumors: rumorsSvg,
  settings: settingsSvg,
  trash: trashSvg,
  youtube: youtubeSvg,
} as const;

export type IconName = keyof typeof icons;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  color?: ThemeColorsType;
  filter?: string;
}

const Icon: React.FC<IconProps> = ({
  name,
  className = "",
  title,
  onClick,
  size,
  color = "text",
  filter,
}) => {
  const svgContent = icons[name];

  if (!svgContent) {
    console.error(`Icon "${name}" not found`);
    return null;
  }

  // Remove embedded <style> tags and inline style attributes that can override our styling
  let processedSvg = svgContent
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s*style="[^"]*"/gi, "");

  // Replace fill/stroke with currentColor so they inherit from CSS color property
  // Preserve fill="none" for transparent parts
  processedSvg = processedSvg
    .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"');

  // Remove existing width/height attributes
  processedSvg = processedSvg
    .replace(/\s*width="[^"]*"/g, "")
    .replace(/\s*height="[^"]*"/g, "");

  // Inject width/height 100% into SVG tag so it fills the wrapper
  processedSvg = processedSvg.replace(
    /<svg/,
    '<svg width="100%" height="100%"',
  );

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    cursor: onClick ? "pointer" : "default",
    color: `var(${colorToCSSVar(color)})`,
    // When size is set, use explicit dimensions; otherwise fill parent height and stay square
    width: size ?? "auto",
    height: size ?? "100%",
    aspectRatio: size ? undefined : 1,
  };
  const style = filter ? { ...baseStyle, filter } : baseStyle;
  return (
    <span
      className={`icon ${className}`}
      onClick={onClick}
      title={title}
      role={onClick ? "button" : undefined}
      style={style}
      dangerouslySetInnerHTML={{ __html: processedSvg }}
    />
  );
};

export default Icon;
