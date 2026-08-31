type Props = {
  size: number;
  fg: string;
  bg: string;
};
const GwIcon: React.FC<Props> = ({ size, fg, bg }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 509 509"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="254.5" cy="254.5" r="254.5" fill={bg} />
      <line
        x1="254"
        y1="105"
        x2="254"
        y2="273"
        stroke={fg}
        stroke-width="22"
        stroke-linecap="round"
      />
      <line
        x1="425"
        y1="275"
        x2="84"
        y2="275"
        stroke={fg}
        stroke-width="22"
        stroke-linecap="round"
      />
      <line
        x1="362"
        y1="339"
        x2="147"
        y2="339"
        stroke={fg}
        stroke-width="22"
        stroke-linecap="round"
      />
      <line
        x1="297"
        y1="403"
        x2="211"
        y2="403"
        stroke={fg}
        stroke-width="22"
        stroke-linecap="round"
      />
    </svg>
  );
};

export default GwIcon;
