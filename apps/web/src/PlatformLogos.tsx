import metaIcon from "../../../Icons/meta.png";
import googleAdsIcon from "../../../Icons/adwords.png";

const iconStyle = { display: "block", objectFit: "contain" as const, flexShrink: 0 };

export function MetaLogo() {
  return <img src={metaIcon} alt="" aria-hidden="true" width={24} height={24} style={iconStyle} />;
}

export function GoogleAdsLogo() {
  return <img src={googleAdsIcon} alt="" aria-hidden="true" width={24} height={24} style={iconStyle} />;
}
