interface BigcapitalAltProps extends React.SVGProps<SVGSVGElement> {}

export function BigcapitalAlt({ color, ...props }: BigcapitalAltProps) {
  return (
    <svg
      data-icon="kct-financials"
      width="214"
      height="37"
      viewBox="0 0 214 37"
      {...props}
    >
      <text
        x="0"
        y="28"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontWeight="700"
        fontSize="26"
        letterSpacing="-0.5"
        fill={color || 'currentColor'}
      >
        KCT Financials
      </text>
    </svg>
  );
}
