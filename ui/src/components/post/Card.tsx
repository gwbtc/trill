import Icon from "@/components/Icon";
import type { IconName } from "@/components/Icon";

export default function ({
  children,
  logo,
  cn,
}: {
  cn?: string;
  logo: IconName;
  children: any;
}) {
  const className = "trill-post-card" + (cn ? ` ${cn}` : "");
  return (
    <div className={className}>
      <Icon name={logo} size={30} className="trill-post-card-logo" />
      {children}
    </div>
  );
}
